#!/usr/bin/env python3
"""Freeze public research independently from presentation changes."""
import hashlib,json,subprocess
from pathlib import Path
from lxml import html
ROOT=Path(__file__).resolve().parents[1]

# Approved next website set. Validate exact successor bytes while retaining
# every earlier gate, including the CoC and HAMC transition checks.
NEXT_REGIONAL_BASE = '88e06b446bcdee446ad069d932f9fd21d292787d'
NEXT_REGIONAL_PUBLIC = ('assets/search-index.js', 'assets/search-source-urls.js', 'data/search-coverage.json', 'housing-help.html', 'phoenix.html', 'phoenix/projects.html', 'research-updates.html', 'scripts/build-housing-help.py', 'scripts/build-phoenix-connections.py', 'scripts/build-regional-editions.py')
NEXT_REGIONAL_ADDED = ('_data/goodyear_action_plan_feature.html', '_data/tucson_weatherization_and_vail_resources.html', 'assets/arizona-cdbg-allocations.css', 'data/arizona-cdbg-formula-allocation-source-rows.csv')
NEXT_REGIONAL_GUARDS = ('scripts/check-list-baseline.py', 'scripts/check-regional-editions.py')
next_regional = json.loads((ROOT / '_data/regional_research_resources_transition.json').read_text())
assert set(next_regional) == {'base','files','added'} and next_regional['base'] == NEXT_REGIONAL_BASE
assert set(next_regional['files']) == set(NEXT_REGIONAL_PUBLIC + NEXT_REGIONAL_GUARDS)
assert set(next_regional['added']) == set(NEXT_REGIONAL_ADDED)
next_regional_pins = {'base':NEXT_REGIONAL_BASE,'files':{p:next_regional['files'][p] for p in NEXT_REGIONAL_PUBLIC},'added':next_regional['added']}
assert hashlib.sha256(json.dumps(next_regional_pins,sort_keys=True,separators=(',',':')).encode()).hexdigest() == '19c9b571dffae6dc263d57f67a78e11809f5f1b0bde24c61b348bfacb1d86206', 'Unexpected next regional release pins'
next_regional_prior = {}
for path, hashes in next_regional['files'].items():
    assert set(hashes) == {'before','after'}
    prior = subprocess.check_output(['git','show',NEXT_REGIONAL_BASE+':'+path],cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unverified next regional baseline',path)
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == hashes['after'], ('Unreviewed next regional change',path)
    next_regional_prior[path] = prior
for path, sha in next_regional['added'].items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == sha, ('Unreviewed next regional addition',path)

def next_regional_preserved_bytes(name):
    return next_regional_prior[name] if name in next_regional_prior else (ROOT/name).read_bytes()


# Approved CoC tracker: pin only its own additions and exact changed bytes;
# feed the actual verified predecessor to every existing historical gate.
COC_BASE = 'a296733f1a4c1695d3f640a914b4a7bbde8d5e3b'
COC_PUBLIC_PATHS = ('index.html', 'phoenix.html', 'research-updates.html', 'scripts/build-regional-editions.py', 'scripts/check-reader-data.py', 'sitemap.xml', 'tucson.html')
COC_GUARD_PATHS = ('scripts/check-list-baseline.py', 'scripts/check-regional-editions.py')
COC_NEW_PATHS = ('assets/coc-court-tracker.css', 'assets/coc-court-tracker.js', 'hud-coc-funding-court-tracker.html')
coc_transition = json.loads((ROOT / '_data/coc_court_tracker_transition.json').read_text())
assert set(coc_transition) == {'base', 'files', 'added'} and coc_transition['base'] == COC_BASE
assert set(coc_transition['files']) == set(COC_PUBLIC_PATHS + COC_GUARD_PATHS)
assert set(coc_transition['added']) == set(COC_NEW_PATHS)
coc_pins = {'base': COC_BASE, 'files': {p:coc_transition['files'][p] for p in COC_PUBLIC_PATHS}, 'added':coc_transition['added']}
assert hashlib.sha256(json.dumps(coc_pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == '1f7007ab71230056727c678a3cfb37d808444eecf688de36ad10cc93559fde2d', 'Unexpected CoC release pins'
coc_prior = {}
for coc_path, coc_hash in coc_transition['files'].items():
    assert set(coc_hash) == {'before','after'}
    coc_old = subprocess.check_output(['git','show',COC_BASE+':'+coc_path], cwd=ROOT)
    assert hashlib.sha256(coc_old).hexdigest() == coc_hash['before'], ('Unverified CoC predecessor',coc_path)
    assert hashlib.sha256(next_regional_preserved_bytes(coc_path)).hexdigest() == coc_hash['after'], ('Unreviewed CoC change',coc_path)
    coc_prior[coc_path] = coc_old
for coc_path, coc_hash in coc_transition['added'].items():
    assert hashlib.sha256((ROOT / coc_path).read_bytes()).hexdigest() == coc_hash, ('Unreviewed CoC addition',coc_path)


def coc_preserved_bytes(name):
    return coc_prior[name] if name in coc_prior else next_regional_preserved_bytes(name)


# Dated successor: restrict public changes to the approved HAMC notice, and
# feed independently verified predecessor bytes to all historical Phase 3 checks.
HAMC_NOTICE_BASE = '3b5dd9a9e179cda3156f5df0d2bfac0185b6c5d2'
hamc_notice_manifest = json.loads((ROOT / '_data/hamc_waitlist_notice_transition.json').read_text())
assert set(hamc_notice_manifest) == {'base', 'files'}
assert hamc_notice_manifest['base'] == HAMC_NOTICE_BASE
assert set(hamc_notice_manifest['files']) == {'scripts/check-list-baseline.py', 'scripts/check-regional-editions.py', 'phoenix/housing-help.html', 'scripts/reader-browser-test.mjs'}
assert hamc_notice_manifest['files']['phoenix/housing-help.html'] == {'before': '689d5ddf49128fda14c76da0cd4731e08d0d293c15548d98a7722b2582f26a7a', 'after': '83141790242fce4d1fd5b8c5b662f1ea61dba5dadff44a186169c0caa3ee0756'}
hamc_notice_predecessor = {}
for hamc_path, hamc_hashes in hamc_notice_manifest['files'].items():
    assert set(hamc_hashes) == {'before', 'after'}
    hamc_old = subprocess.check_output(['git', 'show', HAMC_NOTICE_BASE + ':' + hamc_path], cwd=ROOT)
    assert hashlib.sha256(hamc_old).hexdigest() == hamc_hashes['before'], ('Unverified HAMC baseline', hamc_path)
    assert hashlib.sha256(coc_preserved_bytes(hamc_path)).hexdigest() == hamc_hashes['after'], ('Unreviewed HAMC candidate', hamc_path)
    hamc_notice_predecessor[hamc_path] = hamc_old

# Phase 3 changes shared shell URLs without changing records. Pin the exact
# navigation-only set and use verified predecessors for old byte assertions.
PHASE3_BASE = 'a28da08067c7db82ea545129b06c1ea430d556c8'
PHASE3_DIGEST = '6a2ec3cd24c862d9b15a3ab41e5c6efe693d6006c6442c70f426c94d2e8fac59'
phase3 = json.loads((ROOT / '_data/phase3_shared_navigation_transition.json').read_text())
assert set(phase3) == {'base', 'files'} and phase3['base'] == PHASE3_BASE
phase3_guard_names = {'scripts/check-regional-editions.py', 'scripts/check-list-baseline.py'}
assert phase3_guard_names <= set(phase3['files'])
phase3_content = {'base': PHASE3_BASE, 'files': {k:v for k,v in phase3['files'].items() if k not in phase3_guard_names}}
assert hashlib.sha256(json.dumps(phase3_content,sort_keys=True,separators=(',',':')).encode()).hexdigest() == PHASE3_DIGEST
phase3_prior = {}
for name, hashes in phase3['files'].items():
    assert set(hashes) == {'before', 'after'}
    old = subprocess.check_output(['git', 'show', PHASE3_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(old).hexdigest() == hashes['before'], ('Unverified Phase 3 base bytes', name)
    assert hashlib.sha256(hamc_notice_predecessor.get(name, coc_preserved_bytes(name))).hexdigest() == hashes['after'], ('Unreviewed Phase 3 navigation bytes', name)
    phase3_prior[name] = old


def phase3_preserved_bytes(name):
    return phase3_prior[name] if name in phase3_prior else hamc_notice_predecessor.get(name, coc_preserved_bytes(name))

fixture=json.loads((ROOT/'scripts/fixtures/six-entry-baseline.json').read_text())
# Keep the earlier reviewed fixture unchanged. This supplemental, dated fixture
# enumerates only this private candidate's two records, six references and the
# existing amendment clarification; every other historical assertion still runs.
batch_a=json.loads((ROOT/'scripts/fixtures/phoenix-batch-a-nov20.json').read_text())
assert batch_a['base']=='776a12b556b5757820b7d03637184bf664a18249'
assert batch_a['addedRecordIds']==['PHX-WEB-037','PHX-WEB-038']
historical={r['id']:r for r in fixture['registers']['phoenix/records.html'][0]}
candidate={r['id']:r for r in batch_a['phoenixRecordFingerprints'][0]}
assert set(historical)<=set(candidate), 'Lost historical Phoenix record identity'
assert set(candidate)-set(historical)==set(batch_a['addedRecordIds']+batch_a['addedSourceIds'])
for rid,record in historical.items():
 if rid!='MC-PLAN-WEB-001':
  assert candidate[rid]==record, ('Unrelated historical Phoenix record changed',rid)
fixture['files'].update(batch_a['fileHashOverrides'])
fixture['registers']['phoenix/records.html']=batch_a['phoenixRecordFingerprints']
selectors={'evidence.html':['//table[@id="sources"]/tbody/tr','//table[@id="questions"]/tbody/tr'],'questions-records.html':['//*[@data-catalog-entry]'],'funding-explorer.html':['//*[@data-catalog-entry]'],'housing-projects.html':['//*[@data-catalog-entry]'],'phoenix/records.html':['//*[contains(concat(" ",@class," ")," record-card ")]'],'phoenix/questions.html':['//*[@data-connection-entry]'],'phoenix/projects.html':['//*[@data-connection-entry]'],'phoenix/comparisons.html':['//*[@data-connection-entry]']}
# Only these exact generated copies of the approved cleanup presentation change.
# Verify the current bytes and the protected-main bytes before every old check.
CLEANUP_DERIVED = {
 'assets/search-index.js': ('8924525e92570c9aa4517d1da4c27404c691413b958d3fb92b026b003a355e26', '804b0cebbc523c2056222597df25be3a0a5383860430d1accd5b1b7e050ef6a6'),
 'data/search-coverage.json': ('9d751ce7354b54ba6017a9b0284b4850e7a5cdff25696d71279a4df877b6b9e3', '5556448be11c5552d8ff3d51ecaed6b71874971a5ceda0fe033bb74e2d1ed6e0'),
}
# Preserve the historical baselines; exact reviewed audit transitions are
# checked before all previously approved hash and record checks.
AUDIT_REVIEW_BASE = '69843d7d301fc980b08da6a235b9859bd8e14156'
AUDIT_REVIEW_OUTPUTS = {
    'assets/category-search-data.js': ('32a95c829e0276471e4688c79ccb6a5b8c6c1c977043ebd4b1d6dd8dcd4cff33', 'c82df15091eea44b011294f33328f2d7e3fcce0b2bad5c554d0d2b5f2a003e24'),
    'assets/search-index.js': ('804b0cebbc523c2056222597df25be3a0a5383860430d1accd5b1b7e050ef6a6', 'eb68503d9c4636f105d87e84c317de7b0001e76bb0802914aefc088b2cace07e'),
    'assets/search-source-urls.js': ('2db8ca212b34c31e47f273899703e1df6e343207a4b270c75437cf6933cd2523', '5bc41e0f62db35732b011ca8e9cbd75bc49f6bb49a729e43030ac0ff4fc5bfe3'),
    'data/category-search.json': ('66b69c2c26eef81d926ea312908490ed403f3cb5a4316e64e01156eecfdd4706', '0eecbbe4395c172cfb1c75740fb1a150b47efa3d0f9f2216170cefa975b63107'),
    'data/housing-help-resources.json': ('ef9d80fd55e06e8d0321b23e21003cc7558c5f6d442801669c5f4ba64ab278c6', 'dff56e2d999a396a08f3cf484ba93078f3bfcfcbcb2413cfe564cd24722a2794'),
    'data/search-coverage.json': ('5556448be11c5552d8ff3d51ecaed6b71874971a5ceda0fe033bb74e2d1ed6e0', '1aed08c184334f470c9ad612865d7c2d54d50cfb7c0e2fbb78961306edd45ec5'),
    'feed.xml': ('7adb0d857035bea876550fae53587e6559bc33828130fa346367a78ee8bb1b3c', 'c0c531deb513876cf3c7b486981829cff4fa2b01afd56c83ee698bcdd8372233'),
}
# Round 1 navigation only: verify exact candidate bytes against exact deployed
# #46 originals, then apply every pre-existing preservation guard unchanged.
ROUND1_BASE = '595471cc45fc217c8b27edeb5fd1c120f924ad6a'
ROUND1_TRANSITIONS = {
    'assets/search-index.js': ('eb68503d9c4636f105d87e84c317de7b0001e76bb0802914aefc088b2cace07e', 'ff4ac60c1396050ed9a0986d84803339fd00c6f18bf4bfcf0fcea148abfca973'),
}

# Round 2 E/F verifies its exact tracked delta before the prior gates.
ROUND2_BASE = '8a621f0eecf6c3fa5d2e51619d8562d13422efca'
round2 = json.loads((ROOT / 'scripts/fixtures/round2-ef-transition.json').read_text())
assert round2['base'] == ROUND2_BASE
assert round2['tree'] == 'e4d5a3e23d77ef7e41f12dbea9a08abd31bce23f'
assert subprocess.check_output(['git', 'rev-parse', ROUND2_BASE + '^{tree}'], cwd=ROOT, text=True).strip() == round2['tree']
assert set(round2['files']) == {'assets/help-navigation.css', 'assets/search-source-urls.js', 'research-updates.html', 'assets/search-index.js', 'evidence.html', 'feed.xml', 'contact.html', 'data/search-coverage.json', 'assets/category-search.js', 'reports/tucson-housing-funding-outcomes-2026.html', 'scripts/test-category-search.mjs'}
round2_prior = {}
for name, hashes in round2['files'].items():
    prior = subprocess.check_output(['git', 'show', ROUND2_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unexpected Round 2 base bytes', name)
    assert hashlib.sha256(phase3_preserved_bytes(name)).hexdigest() == hashes['after'], ('Unverified Round 2 candidate bytes', name)
    round2_prior[name] = prior

round1_prior = {}
for name, (before, after) in ROUND1_TRANSITIONS.items():
    assert hashlib.sha256(round2_prior.get(name, phase3_preserved_bytes(name))).hexdigest() == after, ('Unexpected Round 1 bytes', name)
    original = subprocess.check_output(['git', 'show', ROUND1_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(original).hexdigest() == before, ('Unverified deployed Round 1 base bytes', name)
    round1_prior[name] = original

for name,(before,after) in AUDIT_REVIEW_OUTPUTS.items():
 assert hashlib.sha256(round1_prior.get(name, round2_prior.get(name, phase3_preserved_bytes(name)))).hexdigest()==after,('Unexpected audit-review bytes',name)
 assert hashlib.sha256(subprocess.check_output(['git','show',AUDIT_REVIEW_BASE+':'+name],cwd=ROOT)).hexdigest()==before,('Unverified pre-audit-review bytes',name)
for name,sha in fixture['files'].items():
 content=round2_prior.get(name, phase3_preserved_bytes(name))
 if name in AUDIT_REVIEW_OUTPUTS:
  content=subprocess.check_output(['git','show',AUDIT_REVIEW_BASE+':'+name],cwd=ROOT)
 if name in CLEANUP_DERIVED:
  before,after=CLEANUP_DERIVED[name]
  assert hashlib.sha256(content).hexdigest()==after,('Unreviewed generated cleanup bytes',name)
  content=subprocess.check_output(['git','show','fa7c7d826294fa9b7cd39bfe472f26cbc03e9b5e:'+name],cwd=ROOT)
  assert hashlib.sha256(content).hexdigest()==before,('Unverified prior generated bytes',name)
 if name=='assets/search-index.js':
  label=b'Search published Tucson & Pima County research'
  assert content.count(label)<=1,('Duplicated maintenance label',name)
  content=content.replace(label,b'Search all published research')
 assert hashlib.sha256(content).hexdigest()==sha,('Public research/data/download changed',name)
count=0
for name,queries in selectors.items():
 doc=html.parse(str(ROOT/name))
 for i,query in enumerate(queries):
  records=[]
  for e in doc.xpath(query):
   contents={'text':' '.join(e.text_content().split()),'links':[a.get('href') for a in e.xpath('.//a[@href]')],'ids':e.xpath('.//@id'),'data':dict(e.attrib)}
   records.append({'id':e.get('id'),'ids':contents['ids'],'sha256':hashlib.sha256(json.dumps(contents,sort_keys=True,ensure_ascii=False).encode()).hexdigest()})
  assert records==fixture['registers'][name][i],('IDs/order/text/links/qualifications changed',name,i)
  assert len(records)==len({r['id'] for r in records}),('Duplicate record',name)
  count+=len(records)
records=json.loads((ROOT/'data/category-search.json').read_text())['records']
source_records=[r for r in records if r['scope']=='tucson' and r['category']=='sources']
source_ids=[r['id'] for r in fixture['registers']['evidence.html'][0]]
extra=[r for r in source_records if r['url'].split('#')[-1] not in source_ids]
assert len(source_records)==68 and len(source_ids)==67
assert [(r['id'],r['title']) for r in extra]==[('source-excerpts','Let Readers Check the Evidence')]
print(f"PASS reviewed research baseline {fixture.get('research_update_baseline', fixture['commit'])}: {len(fixture['files'])} data/download hashes and {count} ordered record fingerprints match the individually reviewed changes; other text, dates, IDs, aliases, links and qualifications are preserved.")
print('PASS scope difference: 67 source-register rows; category search additionally includes source-excerpts, the explanatory evidence section (68).')
