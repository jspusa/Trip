"""V5 browser regression with synthetic itineraries and rendered PDF evidence."""
import argparse, functools, http.server, json, os, threading
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser();parser.add_argument('--live');args=parser.parse_args()
root=Path.cwd();out=root/'test-results'/'v5';out.mkdir(parents=True,exist_ok=True)
server=None
if not args.live:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.live or 'http://127.0.0.1:8765/'

def load(page,store=None):
    if store is not None:
        # Seed BEFORE the application starts, not immediately before pagehide,
        # which correctly saves the state of the page being left.
        page.add_init_script("(()=>{if(!sessionStorage.getItem('test-seeded')){const s="+json.dumps(store,ensure_ascii=False)+";localStorage.clear();Object.entries(s).forEach(([k,v])=>localStorage.setItem(k,v));sessionStorage.setItem('test-seeded','1');}})()")
    page.goto(base,wait_until='networkidle')
    expect(page.locator('.app-version')).to_have_text('V5.1')

def trip(page,paragraph=False):
    page.locator('#secretaryBtn').click()
    if paragraph:
        page.locator('#secretaryInput').fill('胡志明市，2026/10/14 09:40 抵達，10/17 17:30 離開，飯店有早餐，15、16 日展場有午餐。')
        page.locator('.secretary-footer .secretary-send').click()
    else:
        for value in ['胡志明市','2026/10/14 09:40','2026/10/17 17:30']:
            page.locator('#secretaryInput').fill(value);page.locator('.secretary-footer .secretary-send').click()
        expect(page.locator('#secretaryMeals')).to_be_visible()
        page.locator('label[for="secretaryBreakfast"]').click();page.locator('#secretaryMealNextBtn').click()
    expect(page.locator('#secretaryReview')).to_be_visible()

def finish(page,total=84):
    page.locator('#secretaryConfirmBtn').click()
    expect(page.locator('#secretaryDialog')).not_to_be_visible()
    expect(page.locator('#exportPdfBtn')).to_be_enabled()
    expect(page.locator('#totalAmount')).to_have_text(f'US${total:.2f}')

def change(page,field,value):
    page.evaluate('([id,v])=>{const n=document.getElementById(id);n.value=v;n.dispatchEvent(new Event("change",{bubbles:true}));}',[field,value])

def storage(page):
    page.wait_for_timeout(500)
    return page.evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return[k,localStorage.getItem(k)]}))')

def geometry(page):
    page.wait_for_timeout(400)
    g=page.evaluate('''()=>{const d=document.querySelector('#secretaryDialog').getBoundingClientRect(),f=document.querySelector('.secretary-footer').getBoundingClientRect();return{h:innerHeight,w:innerWidth,top:d.top,bottom:d.bottom,footer:f.top,buttons:[...document.querySelectorAll('.secretary-actions:not([hidden]) button')].map(b=>b.getBoundingClientRect()).filter(r=>r.height).map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))};}''')
    assert g['top']>=-1 and g['bottom']<=g['h']+1,g
    assert len(g['buttons'])==3,g
    for r in g['buttons']:assert r['bottom']<=g['h']+1 and r['left']>=0 and r['right']<=g['w']+1,g
    area=page.locator('.secretary-body');area.evaluate('(n)=>n.scrollTop=n.scrollHeight')
    assert area.evaluate('(n)=>n.scrollTop>0||n.scrollHeight<=n.clientHeight+1')
    assert abs(page.locator('.secretary-footer').bounding_box()['y']-g['footer'])<1

def makepdf(page,kind,label,expected=None):
    page.wait_for_timeout(400);prior=page.locator('#resultDetails').get_attribute('hidden')
    path=out/(label+'.pdf')
    with page.expect_download(timeout=150000) as pending:
        page.locator('#v5ReportPdfBtn' if kind=='report' else '#exportPdfBtn').click()
    pending.value.save_as(path)
    expect(page.locator('#exportPdfBtn')).to_be_enabled(timeout=30000)
    assert page.locator('#resultDetails').get_attribute('hidden')==prior
    with fitz.open(path) as pdf:
        text='\n'.join(p.get_text() for p in pdf)
        if kind=='report':
            assert '出差伙食費報帳明細' in text and '2026-10-14' in text,text
            if expected:assert expected in text,text
            assert not any(p.get_images() for p in pdf)
            if label.endswith('-short'):assert len(pdf)==1
        else:assert all(p.get_images() for p in pdf)
        for i,p in enumerate(pdf):
            assert abs(p.rect.width-595.276)<1 and abs(p.rect.height-841.89)<1
            p.get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(str(out/(label+f'-page-{i+1}.png')))
        print('PDF_PASS',kind,label,'pages',len(pdf),'bytes',path.stat().st_size,flush=True)
    return path

with sync_playwright() as pw:
    for engine in os.environ.get('TRIP_TEST_ENGINES','chromium,webkit').split(','):
        browser=getattr(pw,engine).launch(**({'executable_path':os.environ['TRIP_CHROMIUM']} if engine=='chromium' and os.environ.get('TRIP_CHROMIUM') else {}));errors=[]
        def new(size=(1100,800)):
            c=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='zh-TW',timezone_id='Asia/Taipei',accept_downloads=True)
            page=c.new_page();page.set_default_timeout(18000);page.on('pageerror',lambda e:errors.append(str(e)))
            return c,page
        for size in [(710,857),(390,844),(320,568),(844,390),(390,360)]:
            c,page=new(size);load(page);trip(page);geometry(page)
            page.screenshot(path=str(out/(engine+f'-{size[0]}x{size[1]}-review.png')))
            page.locator('[data-edit="departure"]').click();page.locator('#secretaryInput').fill('2026/10/17 19:00');page.locator('.secretary-footer .secretary-send').click()
            expect(page.locator('#secretaryReview')).to_be_visible();expect(page.locator('#secretaryReviewGrid')).to_contain_text('19:00');expect(page.locator('#secretaryReviewGrid')).to_contain_text('早餐：有')
            finish(page,96);c.close()
        print('VIEWPORTS_AND_SINGLE_EDIT_PASS',engine,flush=True)
        c,page=new();load(page);trip(page,paragraph=True)
        expect(page.locator('#secretaryReviewGrid')).to_contain_text('2026-10-15、2026-10-16');finish(page,60)
        page.locator('#resultToggle').click();expect(page.locator('#resultDetails')).to_be_visible();page.wait_for_timeout(650)
        y=page.evaluate('window.scrollY');change(page,'depTime','19:00');expect(page.locator('#totalAmount')).to_have_text('US$72.00');expect(page.locator('#resultDetails')).to_be_visible();assert abs(page.evaluate('window.scrollY')-y)<3
        page.locator('#v5Advanced > summary').click();page.locator('select[data-adjust="2026-10-15|D"]').select_option('company');expect(page.locator('#totalAmount')).to_have_text('US$60.00')
        expect(page.locator('select[data-adjust="2026-10-14|B"]')).to_be_disabled()
        page.locator('select[data-adjust="2026-10-15|B"]').select_option('self');expect(page.locator('#totalAmount')).to_have_text('US$66.00')
        page.locator('#v5ReportFields > summary').click();page.locator('#v5Name').fill('測試人員');page.locator('#v5Department').fill('國際業務');page.locator('#v5Purpose').fill('參展與客戶拜訪（測試資料）')
        page.locator('#v5Advanced > summary').click();page.locator('#v5ReportFields > summary').click();page.locator('#resultToggle').click();page.wait_for_timeout(500)
        page.screenshot(path=str(out/(engine+'-summary.png')),full_page=True)
        makepdf(page,'full',engine+'-whole');makepdf(page,'report',engine+'-short','測試人員')
        change(page,'depDate','2026-10-13');expect(page.locator('#totalAmount')).to_have_text('—');expect(page.locator('#exportPdfBtn')).to_be_disabled()
        change(page,'depDate','2026-10-18');expect(page.locator('#v5MealAck')).to_be_visible();expect(page.locator('#exportPdfBtn')).to_be_disabled();page.locator('#v5AckBtn').click();expect(page.locator('#exportPdfBtn')).to_be_enabled()
        saved=storage(page);assert json.loads(saved['jasper.trip.v5.draft'])['main']['meta']['name']=='測試人員';assert len(json.loads(saved['jasper.trip.v5.history']))==1
        # Real reload: the application's pagehide handler must persist the current draft.
        page.reload(wait_until='networkidle');expect(page.locator('#v5Resume')).to_be_visible();c.close()
        c,page=new();load(page,saved);expect(page.locator('#v5Resume')).to_be_visible();page.locator('#v5ResumeBtn').click();expect(page.locator('#secretaryDialog')).to_be_visible();page.locator('#closeSecretaryBtn').click();expect(page.locator('#totalAmount')).not_to_have_text('—')
        page.locator('#v5HistoryBtn').click();expect(page.locator('.history-item')).to_have_count(1)
        page.once('dialog',lambda d:d.accept());page.locator('[data-history="copy"]').click();expect(page.locator('#arrDate')).to_have_value('');expect(page.locator('#depDate')).to_have_value('');expect(page.locator('#exportPdfBtn')).to_be_disabled()
        page.locator('#v5HistoryBtn').click();page.once('dialog',lambda d:d.accept());page.locator('[data-history="load"]').click();expect(page.locator('#exportPdfBtn')).to_be_enabled()
        change(page,'depDate','2026-12-12');expect(page.locator('#v5MealAck')).to_be_visible();page.locator('#v5AckBtn').click();expect(page.locator('#exportPdfBtn')).to_be_enabled()
        makepdf(page,'full',engine+'-whole-long');long=makepdf(page,'report',engine+'-report-long','2026-12-12')
        with fitz.open(long) as doc:assert len(doc)>2
        page.emulate_media(media='print');expect(page.locator('#resultDetails')).to_be_visible();expect(page.locator('.workspace-tools')).not_to_be_visible();page.emulate_media(media='screen');c.close()
        print('AUTO_CALC_ADJUSTMENTS_STORAGE_HISTORY_PDF_PASS',engine,flush=True)
        c,page=new();load(page);page.locator('#secretaryBtn').click();page.locator('#secretaryInput').fill('東京');page.locator('.secretary-footer .secretary-send').click();page.locator('#secretaryInput').fill('2026/10/14 09:40');page.locator('#closeSecretaryBtn').click();page.locator('#secretaryBtn').click();expect(page.locator('#secretaryInput')).to_have_value('2026/10/14 09:40');page.locator('#closeSecretaryBtn').click();partial=storage(page);c.close()
        c,page=new();load(page,partial);page.locator('#v5ResumeBtn').click();expect(page.locator('#secretaryInput')).to_have_value('2026/10/14 09:40');c.close()
        c,page=new();load(page);page.locator('#secretaryBtn').click();page.locator('#secretaryInput').fill('東京，2026/10/14 09:40 抵達，2026/10/17 17:30 離開');page.locator('.secretary-footer .secretary-send').click();expect(page.locator('#secretaryMeals')).to_be_visible();c.close()
        c,page=new();load(page);page.locator('#secretaryBtn').click();page.locator('#secretaryInput').fill('東京，2026/12/30 09:40 抵達，1/2 17:30 離開');page.locator('.secretary-footer .secretary-send').click();expect(page.locator('#secretaryHint')).to_contain_text('跨年');c.close()
        c,page=new();page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('storage disabled')}})");load(page);trip(page);finish(page);expect(page.locator('#v5SaveStatus')).to_contain_text('無法暫存');c.close()
        c,page=new();c.route('**/vendor/pdf-lib-*',lambda route:route.abort());load(page);trip(page);finish(page);page.locator('#v5ReportPdfBtn').click();expect(page.locator('#v5ReportStatus')).to_contain_text('失敗',timeout=30000);expect(page.locator('#exportPdfBtn')).to_be_enabled();c.close()
        assert not errors,errors
        print('PARSING_RESUME_FAILURE_RECOVERY_PASS',engine,flush=True);browser.close()
if server:server.shutdown()
print('ALL_V5_TESTS_PASSED',flush=True)
