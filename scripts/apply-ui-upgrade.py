"""Apply the small, idempotent V4.6 entry-point change; never replace calculation code."""
from pathlib import Path

path = Path('index.html')
source = path.read_text(encoding='utf-8')
if 'trip-export.css?v=4.6' not in source:
    assert source.count('</head>') == 1, 'Unexpected HTML head; refusing to patch'
    source = source.replace('</head>', '  <link rel="stylesheet" href="trip-export.css?v=4.6">\n</head>')
if 'trip-export.js?v=4.6' not in source:
    assert source.count('</body>') == 1, 'Unexpected HTML body; refusing to patch'
    source = source.replace('</body>', '  <script src="trip-export.js?v=4.6" defer></script>\n</body>')
old = 'data-update-count="45" aria-label="版本 4.5">V4.5'
new = 'data-update-count="46" aria-label="版本 4.6">V4.6'
assert old in source or new in source, 'Unexpected version; refusing to patch'
source = source.replace(old, new)
path.write_text(source, encoding='utf-8')
print('V4.6 entry point ready; original rates and calculation logic untouched.')
