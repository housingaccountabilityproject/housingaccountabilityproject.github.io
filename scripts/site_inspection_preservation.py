"""Verify the exact approved Amazon Flats and search-label release."""
import hashlib
import subprocess

RELEASE_BASE = '2986596a080a97ce31222cd4c94a591aea5ec7a6'
REVIEWED = {
    'assets/category-search-data.js': '410099b93a96ed2b88fb991de337b8e1b0ba54ba8329871af044f44c3aed58e8',
    'assets/search-index.js': '0f9ab765e7ad88a3a057f17cd70eaf19065092b37a9d753a0799a6f256602890',
    'assets/search-source-urls.js': '3eeafe43083bf77a9f9efe4c80c504d71a2de8991a84f33efdc4b44972668501',
    'data/category-search.json': 'cc8eac8317737cb8e3965b3fc6a6c63fe151fe798974b83190b90ffff2c08601',
    'data/search-coverage.json': 'fe5838ea15baa6abb39699771e8c14b02e98b0de3c2a08ac6afebcb3d61c9f2f',
    'evidence.html': 'e7c103eb4e4acceed2ff8351ba85337aa54559b42d147f0355b6e2926e512f26',
    'findings.html': 'be295ca0b19290471da693252f337b0b1767076196adf7310bb42fe47a2ef7c2',
    'housing-projects.html': 'b25785e918dccc8d01a9b10aa222442ab41bfc8e39ca36b9481051de248c5864',
    'phoenix/records.html': 'fc01a53a6dce8d48fbb66c917f233e7332fe5131ce6cf8b1b5300e69a6b7f0ed',
    'questions-records.html': 'ffa6292d22146ca87c8358c74d033624375bbec30c07f51b3bdb595de836e135',
    'scripts/build-phoenix-records.py': '3f61558b491885564b6605c1550d1ea8aa3e16775320788a6cb8ece45596727a',
}
VALIDATION_PATHS = {
    'scripts/check-org-search.py',
    'scripts/org_search_preservation.py',
    'scripts/site_inspection_preservation.py',
}

VALIDATION_HASHES = {'scripts/check-org-search.py': '32dfe8575f0ad0df1c602d75d9a2025e44696fd18dfd6d080838c37523fc659e', 'scripts/org_search_preservation.py': 'e7c5e0b1950154ac2bf57f314989dea80309f3ad0cf36acfd1515024edc778cd'}

def released_source(root, name):
    current = (root / name).read_bytes()
    if name not in REVIEWED:
        return current
    assert hashlib.sha256(current).hexdigest() == REVIEWED[name], (
        'Unreviewed inspection or search change', name)
    return subprocess.check_output(['git', 'show', RELEASE_BASE + ':' + name], cwd=root)


def verify_release(root):
    changed = set(subprocess.check_output(
        ['git', 'diff', '--name-only', RELEASE_BASE, '--'], cwd=root, text=True).splitlines())
    expected = set(REVIEWED) | VALIDATION_PATHS
    assert changed == expected, ('Unexpected inspection release paths', sorted(changed ^ expected))
    for name, digest in VALIDATION_HASHES.items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, (
            "Unreviewed validation change", name)
    for name in REVIEWED:
        released_source(root, name)
    return expected
