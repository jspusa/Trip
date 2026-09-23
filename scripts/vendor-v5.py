"""Vendor licensed public browser PDF dependencies; no application data is uploaded."""
import subprocess,tarfile,urllib.request,tempfile,hashlib
from pathlib import Path
root=Path('vendor');root.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 for package,filename,inside,licensefile in [
  ('pdf-lib@1.17.1','pdf-lib-1.17.1.min.js','package/dist/pdf-lib.min.js','pdf-lib-LICENSE.txt'),
  ('@pdf-lib/fontkit@1.1.1','fontkit-1.1.1.umd.min.js','package/dist/fontkit.umd.min.js','fontkit-LICENSE.txt')]:
  if (root/filename).exists():continue
  completed=subprocess.run(['npm','pack',package,'--ignore-scripts','--pack-destination',temp],check=True,capture_output=True,text=True)
  archive=Path(temp)/completed.stdout.strip().splitlines()[-1]
  with tarfile.open(archive) as source:
   (root/filename).write_bytes(source.extractfile(inside).read())
   names=[n for n in source.getnames() if n.lower() in ['package/license','package/license.md','package/license.txt']]
   if names:
    (root/licensefile).write_bytes(source.extractfile(names[0]).read())
   else:
    # This pinned fontkit release declares MIT in README and package.json.
    import json
    metadata=json.loads(source.extractfile('package/package.json').read())
    assert package=='@pdf-lib/fontkit@1.1.1' and metadata.get('license')=='MIT','Unverified package license'
    readme=source.extractfile('package/README.md').read()
    assert b'MIT' in readme,'License declaration missing'
    (root/licensefile).write_bytes(b'Package licensing and attribution (unaltered upstream README):\n\n'+readme)
    (root/'fontkit-package.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
 if not (root/'trip-report-tc.ttf').exists():
  from fontTools.ttLib import TTFont
  from fontTools.varLib.instancer import instantiateVariableFont
  url='https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf'
  original=Path(temp)/'noto-variable.ttf';original.write_bytes(urllib.request.urlopen(url,timeout=90).read())
  print('Public font source sha256',hashlib.sha256(original.read_bytes()).hexdigest())
  font=TTFont(original);static=instantiateVariableFont(font,{'wght':400},inplace=False);static.save(root/'trip-report-tc.ttf')
  (root/'trip-report-OFL.txt').write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/OFL.txt',timeout=30).read())
