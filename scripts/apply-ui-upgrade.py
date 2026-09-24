"""Verify the V5.2 entry point. V5.2 intentionally keeps V4.6 application logic."""
from pathlib import Path
source=Path('index.html').read_text(encoding='utf-8')
assert 'V5.2' in source
assert 'trip-export.css?v=4.6' in source and 'trip-export.js?v=4.6' in source
assert 'v52-minimal.css?v=5.2' in source and 'v52-motion.js?v=5.2' in source
for forbidden in ('v5-experience.js','v5-engine.js','v5-report.js','v51-motion.js','v51-visual.css'):
    assert forbidden not in source, forbidden
print('V5.2 entry point verified: V4.6 logic + minimal light visual/motion layer.')
