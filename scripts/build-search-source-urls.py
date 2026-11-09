#!/usr/bin/env python3
"""Collect context links from already-indexed public pages, without fetching sources."""
from pathlib import Path
from urllib.parse import urlsplit
from lxml import html
import json

ROOT=Path(__file__).resolve().parents[1]
raw=(ROOT/'assets/search-index.js').read_text()
data=json.loads(raw.split('window.HAP_SEARCH_INDEX=',1)[1].rstrip(';\n'))
cache={}; links={}
for record in data['records']:
    url=urlsplit(record['url'])
    path='tucson/index.html' if url.path=='index.html' else url.path
    if path not in cache:cache[path]=html.parse(str(ROOT/path))
    doc=cache[path]
    found=doc.xpath('//*[@id=$id]',id=url.fragment) if url.fragment else []
    if found:
        node=found[0]
        while node.getparent() is not None and node.tag not in ('article','section','li','tr'):
            node=node.getparent()
    else:
        node=doc.xpath('//main')[0]
    # These are contextual links from the containing section/page, not a claim-level audit.
    urls=sorted({u for u in node.xpath('.//a/@href') if u.startswith('https://') and
                 not any(host in u for host in ('facebook.com','goatcounter.com','housingaccountabilityproject.github.io'))})
    links[record['url']]=urls
serialized=json.dumps(links,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
(ROOT/'assets/search-source-urls.js').write_text('/* Context links from indexed public HTML; no new source research. */\nwindow.HAP_SEARCH_SOURCES='+serialized+';\n')
print(f'Built context links for {len(links)} indexed URLs from {len(cache)} public pages.')
