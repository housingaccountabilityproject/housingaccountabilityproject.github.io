#!/usr/bin/env python3
"""Scan the full PR and the actual Pages build without logging private values."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'ba87383359bdc0ba3de5042533dd7d78f720918d'
APPROVED_IMAGE = 'assets/tucson-house-arizona.webp'
APPROVED_IMAGE_SHA256 = '20327d03e39a4cba6d5cb8118b43bc2969d1c636bca30104f90a478cf56b6353'
PREVIEW_LINK = re.compile(rb'https?://[^\s<>"\x27)]+[.]chatgpt[.]site', re.I)


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--retired-ref', required=True)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    old = git('show', args.retired_ref + ':docs/reviews/regional-front-pages.md')
    private_links = PREVIEW_LINK.findall(old)
    private_commits = re.findall(rb'source commit `([0-9a-f]{40})`', old)
    assert private_links and private_commits, 'Retired-reference input unavailable'
    private_values = private_links + private_commits
    checked = 0

    def scan(name, content):
        nonlocal checked
        # Report the file class only, never the retired values or matching text.
        assert not PREVIEW_LINK.search(content), 'Private preview link in ' + name
        assert not any(value in content for value in private_values), 'Retired private reference in ' + name
        checked += 1

    # Net PR diff, not only the last commit: deleted lines in prior commits stay
    # historical evidence and are not mistaken for the current release tree.
    scan('complete PR diff', git('diff', '--binary', BASE, '--'))
    paths = [p.decode() for p in git('ls-files', '-z').split(b'\0') if p]
    for name in paths:
        scan('tracked file ' + name, (ROOT / name).read_bytes())
    changed = [p.decode() for p in git('diff', '--name-only', BASE, '--').splitlines()]
    added_images = []
    for name in changed:
        path = ROOT / name
        if path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'} and path.is_file():
            assert name == APPROVED_IMAGE, 'Unexpected changed image'
            assert hashlib.sha256(path.read_bytes()).hexdigest() == APPROVED_IMAGE_SHA256, 'Approved image bytes changed'
            added_images.append(name)
    assert added_images == [APPROVED_IMAGE], 'Expected only the approved Tucson House image'
    production_files = []
    if args.output:
        assert args.output.is_dir(), 'Production build missing'
        for path in sorted(args.output.rglob('*')):
            if path.is_file():
                name = str(path.relative_to(args.output))
                scan('production file ' + name, path.read_bytes())
                production_files.append(name)
        assert production_files, 'Empty production build'
        assert 'docs/reviews/regional-front-pages.html' in production_files, 'Rendered review documentation was not scanned'
        assert all(name in production_files for name in ['index.html', 'tucson.html', 'phoenix.html', 'feed.xml', 'sitemap.xml', 'assets/search-index.js', 'assets/category-search-data.js'])
    report = {'base': BASE, 'checkedFilesAndDiff': checked,
              'trackedFiles': len(paths), 'productionFiles': len(production_files),
              'privateReferencesFound': 0, 'unexpectedImages': 0,
              'approvedImageSHA256': APPROVED_IMAGE_SHA256,
              'productionFilePaths': production_files}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f'PASS full PR diff, {len(paths)} tracked files and {len(production_files)} production files: no private preview links or retired source reference; only approved Tucson House image changed.')
    print('Historical commits are not erased by this check. Published-only placement provenance is checked separately.')


if __name__ == '__main__':
    main()
