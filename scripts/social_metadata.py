"""Fill missing sharing-preview fields on the site's public reader pages."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://housingaccountabilityproject.github.io/'
IMAGE = ORIGIN + 'assets/brand/social-preview.png'


class PageHead(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ''
        self.names = {}
        self.properties = {}
        self.canonical = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        elif tag == 'meta':
            if attrs.get('name'):
                self.names[attrs['name'].lower()] = attrs.get('content')
            if attrs.get('property'):
                self.properties[attrs['property'].lower()] = attrs.get('content')
        elif tag == 'link' and attrs.get('rel', '').lower() == 'canonical':
            self.canonical = attrs.get('href')

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def apply(document, path):
    end = re.search(r'</head\s*>', document, re.I)
    if not end:
        return document
    head = PageHead()
    head.feed(document[:end.start()])
    description = head.names.get('description')
    if not description or not head.title.strip():
        return document
    route = path.removesuffix('index.html') if path.split('/')[-1] == 'index.html' else path
    properties = {
        'og:type': 'article' if path.startswith('updates/') else 'website',
        'og:site_name': 'Housing Accountability Project',
        'og:title': ' '.join(head.title.split()),
        'og:description': description,
        'og:url': head.canonical or ORIGIN + route,
        'og:image': IMAGE,
        'og:image:alt': 'Housing Accountability Project. Follow the funding. Understand the outcomes.',
        'og:image:width': '1200',
        'og:image:height': '630',
    }
    tags = [f'<meta property="{key}" content="{escape(value, quote=True)}">'
            for key, value in properties.items() if key not in head.properties]
    if 'twitter:card' not in head.names:
        tags.append('<meta name="twitter:card" content="summary_large_image">')
    return document[:end.start()] + ''.join(tags) + document[end.start():]


def public_pages():
    pages = [p for p in ROOT.glob('*.html') if not p.name.startswith('google')]
    for directory in ('tucson', 'phoenix', 'reports', 'updates'):
        pages += list((ROOT / directory).rglob('*.html'))
    return sorted(pages)


if __name__ == '__main__':
    for page in public_pages():
        original = page.read_text()
        updated = apply(original, page.relative_to(ROOT).as_posix())
        if updated != original:
            page.write_text(updated)
