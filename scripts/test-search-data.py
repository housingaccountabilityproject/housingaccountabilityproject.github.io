#!/usr/bin/env python3
"""Exercise the generator in an isolated copy; never rewrite checked-in outputs."""
from pathlib import Path
from tempfile import TemporaryDirectory
from lxml import html
import json, shutil, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
with TemporaryDirectory(prefix='hap-search-') as tmp:
 root=Path(tmp)
 for p in ROOT.glob('*.html'):shutil.copy2(p,root/p.name)
 shutil.copytree(ROOT/'reports',root/'reports')
 (root/'scripts').mkdir()
 shutil.copy2(ROOT/'scripts/build-reader-data.py',root/'scripts/build-reader-data.py')
 # Distinct sentinels prevent a UI title inheriting a preceding research heading
 # from passing a mere target-exists check. Nested wrappers and tails matter too.
 fixture='''<section id="search-regression"><h2>Search preservation fixture</h2>
 <p>preserved-before <label>excluded-label</label> preserved-after</p>
 <div class="toolbar"><div><p id="fixture-controls">excluded-toolbar</p></div></div>
 <p id="fixture-status" role="status">excluded-status</p>
 <p id="fixture-empty" class="empty-state">excluded-empty</p>
 <div hidden><p id="fixture-hidden">excluded-hidden</p></div>
 <div aria-hidden="true">excluded-aria-hidden</div>
 <p style="display: none !important">excluded-display-none</p>
 <p style="visibility: hidden;">excluded-visibility-hidden</p>
 <template>excluded-template</template><input value="excluded-input">
 <form><p>excluded-form</p></form><button>excluded-button</button>
 <select><option>excluded-option</option></select><textarea>excluded-textarea</textarea>
 <nav>excluded-navigation</nav><div role="search">excluded-search-role</div>
 <div class="subnav">excluded-subnav</div><p class="counter">excluded-counter</p>
 <details><summary>Substantive source disclosure</summary><p>preserved-disclosure</p></details>
 <details><summary>Historical wording</summary><p>preserved-history</p></details>
 <p>preserved-final</p></section>'''
 p=root/'index.html';p.write_text(p.read_text().replace('</main>',fixture+'</main>'))
 subprocess.run([sys.executable,str(root/'scripts/build-reader-data.py')],check=True)
 records=json.loads((root/'assets/search-index.js').read_text().split('window.HAP_SEARCH_INDEX=',1)[1].rstrip(';\n'))['records']
 text=' '.join(r['text'] for r in records)
 assert 'excluded-' not in text
 for term in ['preserved-before','preserved-after','preserved-disclosure','preserved-history','preserved-final','SRC-094','Q-020','1,284,589.71']:
  assert term in text,term
 assert any(r['historical'] and 'preserved-history' in r['text'] for r in records)
 for r in records:
  assert r['url'].partition('#')[2] not in {'catalog-count','catalog-empty','count','empty'}
  assert 'No matching records' not in r['text']
 report_path='reports/tucson-housing-funding-outcomes-2026.html'
 report=html.parse(str(root/report_path))
 report_title=' '.join(' '.join(report.xpath('//h1//text()')).split())
 report_records=[r for r in records if r['url'].split('#')[0]==report_path]
 assert report_records
 assert all(r['page']==report_title+' · First edition, November 4; later corrections retained' for r in report_records)
 assert any(not r['historical'] for r in report_records), 'Do not mark the entire edition superseded'
 for heading in report.xpath('//main//*[self::h2 or self::h3][@id]'):
  matching=[r for r in report_records if r['url']==report_path+'#'+heading.get('id')]
  assert matching,heading.get('id')
  assert any(r['title']==' '.join(heading.text_content().split()) for r in matching),heading.get('id')
 # Real results must describe the substantive destination, not a status beneath it.
 for page,anchor in [('housing-projects.html','project-pub-005'),('funding-explorer.html','fund-pub-007'),('questions-records.html','q-020')]:
  target=html.parse(str(root/page)).xpath('//*[@id=$id]',id=anchor)[0]
  title=' '.join(target.xpath('.//h3')[0].text_content().split())
  result=[r for r in records if r['url']==page+'#'+anchor and not r['historical']]
  assert len(result)==1,(page,anchor)
  assert result[0]['title']==title
  assert result[0]['text']==' '.join(' '.join(target.itertext()).split()),(page,anchor)
 print('PASS: isolated generator UI exclusions, all eight status/empty targets, substantive destinations, text tails, disclosure/history preservation and original research terms.')
