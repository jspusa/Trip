"""V5.1 visual/motion and dark-mode regression; synthetic trips only."""
import argparse, functools, http.server, json, os, re, threading
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser();parser.add_argument('--inline',action='store_true');parser.add_argument('--live');args=parser.parse_args()
root=Path.cwd();out=root/'test-results'/'v51';out.mkdir(parents=True,exist_ok=True)
server=None
if not args.inline and not args.live:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',8766),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.live or 'http://127.0.0.1:8766/'

def load(page):
 if args.inline:
  source=(root/'index.html').read_text()
  source=re.sub(r'<link rel="stylesheet" href="([^"?]+)[^"]*">',lambda m:'<style>'+(root/m[1]).read_text()+'</style>',source)
  source=re.sub(r'<script src="([^"?]+)[^"]*"[^>]*></script>',lambda m:'<script>'+(root/m[1]).read_text()+'</script>',source)
  shim='''<base href="https://jspusa.github.io/Trip/"><script>const testStore={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>testStore[k]??null,setItem:(k,v)=>{testStore[k]=String(v)},removeItem:k=>{delete testStore[k]},key:i=>Object.keys(testStore)[i],get length(){return Object.keys(testStore).length}}});</script>'''
  page.route('https://jspusa.github.io/Trip/**',lambda route:route.fulfill(path=str(root/route.request.url.split('/Trip/')[1].split('?')[0]),headers={'Access-Control-Allow-Origin':'*'}))
  page.set_content(source.replace('<head>','<head>'+shim,1))
 else:page.goto(base,wait_until='networkidle')
 expect(page.locator('.app-version')).to_have_text('V5.1')

def trip(page):
 page.locator('#secretaryBtn').click()
 for text in ['胡志明市','2026/10/14 09:40','2026/10/17 17:30']:
  page.locator('#secretaryInput').fill(text);page.locator('.secretary-footer .secretary-send').click()
 page.locator('label[for="secretaryBreakfast"]').click();page.locator('#secretaryMealNextBtn').click()
 expect(page.locator('#secretaryReview')).to_be_visible()

def bounds(page):
 page.wait_for_timeout(420)
 g=page.evaluate('''()=>{const d=document.querySelector('#secretaryDialog').getBoundingClientRect(),body=document.querySelector('.secretary-body');return{h:innerHeight,w:innerWidth,top:d.top,bottom:d.bottom,left:d.left,right:d.right,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.secretary-footer .secretary-actions:not([hidden]) button')].map(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right}})};}''')
 assert g['top']>=-1 and g['bottom']<=g['h']+1 and g['left']>=-1 and g['right']<=g['w']+1,g
 assert len(g['buttons'])==3,g
 for b in g['buttons']:assert b['bottom']<=g['bottom']+1 and b['left']>=0 and b['right']<=g['w']+1,g
 assert g['scroll']<=g['w']+1,g
 page.locator('.secretary-body').evaluate('(n)=>n.scrollTop=n.scrollHeight')
 assert page.locator('.secretary-body').evaluate('(n)=>n.scrollTop>0||n.scrollHeight<=n.clientHeight+1')
 print('BOUNDS_PASS',g['w'],g['h'],flush=True)

def finish(page):
 page.locator('#secretaryConfirmBtn').click();expect(page.locator('#secretaryDialog')).not_to_be_visible();expect(page.locator('#totalAmount')).to_have_text('US$84.00');expect(page.locator('#exportPdfBtn')).to_be_enabled();page.wait_for_timeout(400)

def change(page,field,value):
 page.evaluate('([id,v])=>{const n=document.getElementById(id);n.value=v;n.dispatchEvent(new Event("change",{bubbles:true}));}',[field,value])

def pdf(page,kind,label):
 with page.expect_download(timeout=120000) as wait:page.locator('#exportPdfBtn' if kind=='full' else '#v5ReportPdfBtn').click()
 path=out/(label+'.pdf');wait.value.save_as(path)
 expect(page.locator('#exportPdfBtn')).to_be_enabled(timeout=30000)
 with fitz.open(path) as d:
  text=''.join(p.get_text() for p in d)
  if kind=='report':assert '出差伙食費報帳明細' in text and 'USD 84.00' in text and '2026-10-17' in text,text
  for i,sheet in enumerate(d):
   pix=sheet.get_pixmap(alpha=False);samples=pix.samples
   ratio=sum(v<200 for v in samples)/len(samples)
   assert ratio>.002 and ratio<.35,('blank or dark PDF page',label,i,ratio)
   pix.save(out/f'{label}-{i+1}.png')
  print('V51_PDF_PASS',label,len(d),flush=True)
 return path

with sync_playwright() as pw:
 for engine in os.environ.get('TRIP_TEST_ENGINES','chromium,webkit').split(','):
  browser=getattr(pw,engine).launch(**({'executable_path':os.environ['TRIP_CHROMIUM']} if engine=='chromium' and os.environ.get('TRIP_CHROMIUM') else {}))
  errors=[]
  def new(size=(1200,900),mode='light',motion='no-preference'):
   c=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='zh-TW',timezone_id='Asia/Taipei',color_scheme=mode,reduced_motion=motion,accept_downloads=True)
   p=c.new_page();p.set_default_timeout(20000);p.on('pageerror',lambda e:errors.append(str(e)));return c,p
  for mode,size in [('light',(1200,900)),('dark',(390,844)),('light',(320,568)),('dark',(844,390)),('light',(390,360)),('dark',(710,857))]:
   c,page=new(size,mode);load(page);expect(page.locator('html')).to_have_attribute('data-appearance',mode)
   if size[0]<641:
    page.locator('#countryCombo .combo-toggle').click();page.wait_for_timeout(260);assert page.locator('#countryCombo').evaluate("n=>n.classList.contains('open')");expect(page.locator('#countryMenu')).to_be_visible();page.locator('#countryCombo .combo-toggle').click()
   trip(page);bounds(page);page.screenshot(path=str(out/f'{engine}-{mode}-{size[0]}x{size[1]}-review.png'))
   page.locator('[data-edit="departure"]').click();expect(page.locator('#secretaryForm')).to_be_visible();expect(page.locator('#secretaryInputLabel')).to_contain_text('離開')
   page.locator('#secretaryBackBtn').click();expect(page.locator('#secretaryReview')).to_be_visible()
   finish(page);page.locator('#v5Summary').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{engine}-{mode}-{size[0]}x{size[1]}-result.png'))
   if size[0]<781:expect(page.locator('#v51MobilePdf')).to_be_visible();expect(page.locator('#mobileCalculateBtn')).not_to_be_visible()
   # Disclosure state remains stable after manual update, and invalid totals cannot be exported.
   page.locator('#resultToggle').click();page.wait_for_timeout(300);expect(page.locator('#resultDetails')).to_be_visible()
   change(page,'depTime','19:00');expect(page.locator('#totalAmount')).to_have_text('US$96.00');page.wait_for_timeout(300);expect(page.locator('#resultDetails')).to_be_visible()
   change(page,'depTime','');expect(page.locator('#exportPdfBtn')).to_be_disabled();expect(page.locator('#v51MobilePdf')).not_to_be_visible();expect(page.locator('#totalAmount')).to_have_text('—')
   c.close()
  # System theme follows OS and explicit choice overrides the OS.
  c,page=new(mode='dark');load(page);page.locator('#v51Theme').select_option('light');expect(page.locator('html')).to_have_attribute('data-appearance','light')
  page.emulate_media(color_scheme='dark');expect(page.locator('html')).to_have_attribute('data-appearance','light')
  assert page.evaluate("localStorage.getItem('jasper.trip.appearance')")=='light'
  if not args.inline:page.reload(wait_until='networkidle');expect(page.locator('html')).to_have_attribute('data-appearance','light')
  page.locator('#v51Theme').select_option('system');expect(page.locator('html')).to_have_attribute('data-appearance','dark')
  page.emulate_media(color_scheme='light');expect(page.locator('html')).to_have_attribute('data-appearance','light')
  # Conversation mode is the default: avatars and chat bubbles stay visible. Fast mode is optional at the bottom.
  page.locator('#secretaryBtn').click();expect(page.locator('#secretaryChat')).to_be_visible();expect(page.locator('.chat-avatar').first).to_be_visible()
  expect(page.locator('#secretaryChat .chat-message').first).to_contain_text('請問這次要到哪個國家出差')
  expect(page.locator('#secretaryInputLabel')).to_have_text('目的地');expect(page.locator('#secretaryInput')).to_have_attribute('placeholder','例如：胡志明市')
  page.locator('#secretaryInput').fill('胡志明市，2026/10/14 09:40 抵達，2026/10/17 17:30 離開');page.locator('.secretary-footer .secretary-send').click();expect(page.locator('#secretaryInputLabel')).to_have_text('抵達日期與時間')
  page.locator('#secretaryBackBtn').click();expect(page.locator('#secretaryInputLabel')).to_have_text('目的地');page.locator('#secretaryResetBtn').click();
  expect(page.locator('.v51-fast-mode')).to_be_visible();expect(page.locator('#v51FastInput')).not_to_be_visible()
  page.locator('.v51-fast-mode>summary').click();expect(page.locator('#v51FastInput')).to_be_visible()
  page.locator('#v51FastInput').fill('胡志明市，2026/10/14 09:40 抵達，2026/10/17 17:30 離開，飯店有早餐')
  page.locator('#v51FastSubmit').click();page.wait_for_timeout(300)
  assert page.locator('#secretaryChat .chat-message').count()>=2
  page.keyboard.press('Escape');expect(page.locator('#secretaryDialog')).not_to_be_visible();page.locator('#secretaryBtn').click()
  if page.locator('#secretaryReview').is_visible():finish(page)
  else:
   # The parser may intentionally ask one missing/ambiguous detail; complete through the normal conversation.
   while not page.locator('#secretaryReview').is_visible():
    if page.locator('#secretaryMeals').is_visible():page.locator('#secretaryMealNextBtn').click()
    else:page.locator('#secretaryInput').fill('2026/10/17 17:30');page.locator('.secretary-footer .secretary-send').click()
   finish(page)
  # Same true amount in light and dark exports. PDF colors always remain light.
  pdf(page,'full',engine+'-light-full');pdf(page,'report',engine+'-light-report')
  page.locator('#v51Theme').select_option('dark');pdf(page,'full',engine+'-dark-full');pdf(page,'report',engine+'-dark-report')
  page.emulate_media(media='print');expect(page.locator('#resultDetails')).to_be_visible();assert page.locator('body').evaluate('(n)=>getComputedStyle(n).color')=='rgb(29, 29, 31)';expect(page.locator('.v51-theme')).not_to_be_visible();page.emulate_media(media='screen')
  page.locator('#rulesBtn').click();page.wait_for_timeout(400);page.screenshot(path=str(out/(engine+'-dark-rules.png')));page.keyboard.press('Escape');expect(page.locator('#rulesDialog')).not_to_be_visible();c.close()
  # Reduced motion disables CSS AND programmatic motion, without removing functionality.
  c,page=new((390,844),'dark','reduce');load(page);trip(page);bounds(page)
  assert page.evaluate("document.getAnimations().filter(a=>a.playState==='running').length")==0
  finish(page);page.locator('#resultToggle').click();expect(page.locator('#resultDetails')).to_be_visible();page.locator('#v5ReportFields>summary').click();expect(page.locator('#v5Name')).to_be_visible()
  assert page.evaluate("document.getAnimations().filter(a=>a.playState==='running').length")==0
  c.close();assert not errors,errors;browser.close();print('ALL_V51_TESTS_PASSED',engine,flush=True)
if server:server.shutdown()
