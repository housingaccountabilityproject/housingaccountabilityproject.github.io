"""Verify this presentation transition before applying the unchanged historical gates."""
from pathlib import Path
import hashlib
import json
import subprocess

BASE = '8cdea3fc518f327c45c372e6905d8488b9df42cc'
CHANGED = {'.github/workflows/reader-tools-qa.yml', '_config.yml', 'research-updates.html',
           'scripts/check-reader-data.py', 'scripts/check-list-baseline.py',
           'scripts/check-regional-editions.py'}
GUARDS = {'scripts/check-list-baseline.py', 'scripts/check-regional-editions.py'}
ADDED = {'_data/research_updates_inventory.json', 'assets/research-updates.css',
         'assets/research-updates.js', 'scripts/build-research-updates.py',
         'scripts/test-research-updates.mjs', 'scripts/research_updates_preservation.py',
         'scripts/fixtures/research-update-new-article.json',
         'research-updates-archive.html', *{f'research-updates-archive-{n}.html' for n in range(2, 7)}}


def verify_transition(root: Path, digest: str):
    data = json.loads((root / '_data/research_updates_short_transition.json').read_text())
    assert set(data) == {'base', 'files', 'added'} and data['base'] == BASE
    assert set(data['files']) == CHANGED and set(data['added']) == ADDED
    pins = {'base': BASE, 'files': {p: h for p, h in data['files'].items() if p not in GUARDS},
            'added': data['added']}
    assert hashlib.sha256(json.dumps(pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == digest, 'Unreviewed short-page pins'
    prior = {}
    for path, hashes in data['files'].items():
        assert set(hashes) == {'before', 'after'}
        old = subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=root)
        assert hashlib.sha256(old).hexdigest() == hashes['before'], ('Unverified short-page predecessor', path)
        assert hashlib.sha256((root / path).read_bytes()).hexdigest() == hashes['after'], ('Unreviewed short-page edit', path)
        prior[path] = old
    for path, expected in data['added'].items():
        assert hashlib.sha256((root / path).read_bytes()).hexdigest() == expected, ('Unreviewed short-page addition', path)
    assert (root / '_data/research_updates_inventory.json').is_file()
    print('PASS exact short-page transition; all earlier release gates inspect their verified predecessor.')
    return prior
