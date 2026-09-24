"""Browser regression tests for V4.6. Uses synthetic trip data only."""
import argparse
import functools
import hashlib
import http.server
import json
import threading
from pathlib import Path

import fitz
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url')
parser.add_argument('--live', action='store_true')
args = parser.parse_args()
output = Path('test-results/live' if args.live else 'test-results/local')
output.mkdir(parents=True, exist_ok=True)
server = None
if not args.url:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(Path.cwd()))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
base = args.url or 'http://127.0.0.1:8765/'


def reach_meals(page):
    page.goto(base, wait_until='networkidle')
    expect(page.locator('.app-version')).to_have_text('V5.2')
    assert page.locator('[data-appearance], #v5HistoryBtn, #v5NewTripBtn, .v51-fast-mode').count() == 0
    assert page.evaluate("getComputedStyle(document.documentElement).colorScheme") == 'light'
    expect(page.locator('#exportPdfBtn')).to_be_disabled()
    expect(page.locator('#v52ReportPdfBtn')).to_be_disabled()
    page.locator('#secretaryBtn').click()
    for value in ['胡志明市', '2026/10/14 09:40', '2026/10/17 17:30']:
        page.locator('#secretaryInput').fill(value)
        page.locator('.secretary-composer .secretary-send').click()
    expect(page.locator('#secretaryMeals')).to_be_visible()
    page.locator('label[for="secretaryBreakfast"]').click()
    expect(page.locator('#secretaryBreakfast')).to_be_checked()


def geometry(page, name):
    page.wait_for_timeout(200)
    result = page.evaluate('''()=>{
      const dialog=document.getElementById('secretaryDialog'),footer=dialog.querySelector('.secretary-footer'),body=dialog.querySelector('.secretary-body');
      const d=dialog.getBoundingClientRect(),f=footer.getBoundingClientRect();
      const buttons=Array.from(footer.querySelectorAll('.secretary-actions:not([hidden]) button')).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,top:r.top,bottom:r.bottom,left:r.left,right:r.right};});
      return {height:innerHeight,width:innerWidth,dialog:{top:d.top,bottom:d.bottom},footer:{top:f.top,bottom:f.bottom},buttons,scroll:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight};
    }''')
    assert result['dialog']['top'] >= -1, result
    assert result['dialog']['bottom'] <= result['height'] + 1, result
    assert len(result['buttons']) in (2,3), result
    for button in result['buttons']:
        assert button['top'] >= result['dialog']['top'], result
        assert button['bottom'] <= min(result['dialog']['bottom'], result['height']) + 1, result
        assert button['left'] >= 0 and button['right'] <= result['width'] + 1, result
    area = page.locator('.secretary-chat')
    area.evaluate('(el)=>{el.scrollTop=0}')
    assert area.evaluate('(el)=>el.scrollTop') == 0
    area.evaluate('(el)=>{el.scrollTop=el.scrollHeight}')
    if area.evaluate('(el)=>el.scrollHeight>el.clientHeight'):
        assert area.evaluate('(el)=>el.scrollTop') > 0, result
    assert abs(page.locator('.secretary-footer').bounding_box()['y'] - result['footer']['top']) < 1
    print('GEOMETRY', name, json.dumps(result, ensure_ascii=False), flush=True)


def complete(page):
    page.locator('#secretaryMealNextBtn').click()
    expect(page.locator('#secretaryReview')).to_be_visible()
    page.locator('#secretaryConfirmBtn').click()
    expect(page.locator('#secretaryDialog')).not_to_be_visible()
    expect(page.locator('#exportPdfBtn')).to_be_enabled()
    expect(page.locator('#v52ReportPdfBtn')).to_be_enabled()
    expect(page.locator('#totalAmount')).to_contain_text('84')
    expect(page.locator('#countB')).to_have_text('0')
    expect(page.locator('#countL')).to_have_text('4')
    expect(page.locator('#countD')).to_have_text('3')


def export_pdf(page, name, minimum_pages=2):
    previous = page.locator('#resultDetails').get_attribute('hidden')
    with page.expect_download(timeout=120000) as pending:
        page.locator('#exportPdfBtn').click()
    download = pending.value
    assert download.suggested_filename.endswith('.pdf'), download.suggested_filename
    path = output / f'{name}.pdf'
    download.save_as(path)
    expect(page.locator('#exportPdfBtn')).to_be_enabled()
    assert page.locator('#resultDetails').get_attribute('hidden') == previous
    assert page.locator('iframe[title="PDF 匯出暫存版面"]').count() == 0
    with fitz.open(path) as pdf:
        assert len(pdf) >= minimum_pages, len(pdf)
        assert len(pdf) < 30, len(pdf)
        digests = set()
        for index, sheet in enumerate(pdf):
            assert abs(sheet.rect.width - 595.276) < 1
            assert abs(sheet.rect.height - 841.89) < 1
            assert f'{index+1} / {len(pdf)}' in sheet.get_text()
            assert len(sheet.get_images()) == 1
            pix = sheet.get_pixmap(matrix=fitz.Matrix(1,1), alpha=False)
            samples = pix.samples
            assert sum(value < 230 for value in samples) / len(samples) > 0.004, f'Blank PDF page {index+1}'
            digest = hashlib.sha256(samples).hexdigest()
            assert digest not in digests, f'Duplicate PDF page {index+1}'
            digests.add(digest)
            pix.save(output / f'{name}-page-{index+1}.png')
        print('PDF_OK', name, 'pages=', len(pdf), 'bytes=', path.stat().st_size, flush=True)
    return path


with sync_playwright() as pw:
    for browser_name in ['chromium', 'webkit']:
        browser = getattr(pw, browser_name).launch()
        sizes = [(710,857),(1280,720),(390,844),(320,568),(844,390),(390,360)]
        if args.live:
            sizes = [(710,857),(390,360)]
        for width,height in sizes:
            context = browser.new_context(viewport={'width':width,'height':height}, locale='zh-TW', timezone_id='Asia/Taipei', accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(20000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            reach_meals(page)
            name = f'{browser_name}-{width}x{height}'
            geometry(page, name)
            page.screenshot(path=str(output / f'{name}-meals.png'))
            page.locator('label[for="secretaryLunch"]').click()
            expect(page.locator('#secretaryLunchDatesWrap')).to_be_visible()
            geometry(page, name+'-lunch')
            page.locator('label[for="secretaryLunch"]').click()
            page.locator('#secretaryMealNextBtn').click()
            geometry(page, name+'-review')
            page.locator('#secretaryReviewBackBtn').click()
            expect(page.locator('#secretaryBreakfast')).to_be_checked()
            complete(page)
            assert not errors, errors
            context.close()
        context = browser.new_context(viewport={'width':1100,'height':800}, locale='zh-TW', timezone_id='Asia/Taipei', accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(20000)
        reach_meals(page)
        complete(page)
        export_pdf(page, browser_name+'-full-trip')
        with page.expect_download(timeout=120000) as report_pending:
            page.locator('#v52ReportPdfBtn').click()
        report=report_pending.value
        assert '報帳版' in report.suggested_filename
        report_path=output / f'{browser_name}-report.pdf'
        report.save_as(report_path)
        with fitz.open(report_path) as pdf:
            assert len(pdf)>=1
            text_content=''.join(p.get_text() for p in pdf)
            assert 'Jasper Travel V5.2' in text_content
            assert '1 / ' in text_content
        page.emulate_media(media='print')
        expect(page.locator('#resultDetails')).to_be_visible()
        expect(page.locator('.export-actions')).not_to_be_visible()
        page.emulate_media(media='screen')
        page.locator('#depDate').fill('20261212')
        page.locator('#depDate').blur()
        expect(page.locator('#exportPdfBtn')).to_be_disabled()
        page.locator('#calculateBtn').click()
        export_pdf(page, browser_name+'-60-days', minimum_pages=4)
        context.close()
        if not args.live:
            context = browser.new_context(viewport={'width':1100,'height':800})
            context.route('**/vendor/html2canvas-*', lambda route: route.abort())
            page = context.new_page()
            reach_meals(page)
            complete(page)
            page.locator('#exportPdfBtn').click()
            expect(page.locator('#pdfStatus')).to_contain_text('匯出失敗')
            expect(page.locator('#exportPdfBtn')).to_be_enabled()
            assert page.locator('iframe[title="PDF 匯出暫存版面"]').count() == 0
            context.close()
        browser.close()
if server:
    server.shutdown()
print('ALL_BROWSER_TESTS_PASSED', 'live' if args.live else 'local', flush=True)
