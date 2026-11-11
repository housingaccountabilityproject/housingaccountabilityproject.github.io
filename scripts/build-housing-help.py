#!/usr/bin/env python3
"""Render reviewed resource additions without changing provider eligibility or availability."""
from html import escape
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
resources = json.loads((ROOT / 'data/housing-help-resources.json').read_text())
for scope, filename in [('tucson', 'housing-help.html'), ('phoenix', 'phoenix/housing-help.html')]:
    cards = []
    for resource in resources:
        if scope not in resource['scopes']:
            continue
        links = ' · '.join(f'<a href="{escape(link["url"], quote=True)}">{escape(link["title"])}</a>' for link in resource['links'])
        paragraphs = ''.join(f'<p>{escape(text)}</p>' for text in resource['description'])
        cards.append(f'<article class="resource" id="{escape(resource["id"])}"><p class="tag">{escape(resource["service_type"])}</p><h3>{escape(resource["name"])}</h3>{paragraphs}<p>{escape(resource["limitation"])}</p><p>{links}</p><p class="small">{escape(resource["check_label"])}</p></article>')
    section = '<section id="reviewed-resource-additions"><h2>More resource contacts</h2>' + ''.join(cards) + '</section>'
    path = ROOT / filename
    text = path.read_text()
    pattern = r'<section id="reviewed-resource-additions">.*?</section>'
    if re.search(pattern, text, re.S):
        text = re.sub(pattern, lambda match: section, text, flags=re.S)
    else:
        text = text.replace('</main>', section + '</main>')
    path.write_text(text)
print('Rendered individually qualified housing-help resource additions for both regions.')
