"""Apply the approved site-wide reading templates over the preserved research."""
from pathlib import Path
from html import escape
from lxml import html
import json
import re
from city_reader_guide import region, replace, href, data, project_facts, stages

ROOT = Path(__file__).resolve().parents[1]
LANDINGS = {'index.html','tucson/index.html','phoenix/index.html'}
PROJECT_STAGES = {
    'project-pub-001':'planned work', 'project-pub-002':'inventory', 'project-pub-003':'reported',
    'project-pub-004':'reported', 'project-pub-005':'work inventory',
    'project-bell':'reported', 'project-pueblo':'reported', 'project-garfield-ii':'reported',
    'project-falcon-park':'reported', 'project-harmony':'reported inventory',
    'project-moreland':'planned', 'project-girasol':'planned work', 'project-marcos-grant-park':'planning'
}


def flag(output, name):
    return re.sub(r'(<body\b[^>]*class=")([^"]*)"',lambda m:m[1]+m[2]+(' '+name if name not in m[2].split() else '')+'"',output,count=1)


def stage_control():
    choices = [('', 'All evidence stages'),('planning','Planning award'),('planned','Planned homes'),('work','Work reported'),('reported','Reported opening / completion'),('inventory','Existing inventory')]
    options = ''.join(f'<option value="{key}">{value}</option>' for key,value in choices)
    return f'<div class="city-stage-filter city-design-ui"><label for="city-project-stage">Evidence stage</label><select id="city-project-stage">{options}</select></div>'


def project_filters(output,path):
    if 'id="city-project-stage"' not in output:
        key = 'connection-filter' if path.startswith('phoenix/') else 'catalog-filter'
        _,end=region(output,'select','id="'+key+'"')
        output=output[:end]+stage_control()+output[end:]
    for key,values in PROJECT_STAGES.items():
        def set_stages(match):
            tag=re.sub(r' data-project-stages="[^"]*"','',match.group())
            return tag[:-1]+f' data-project-stages="{values}">'
        output=re.sub(r'<article\b[^>]*id="'+key+r'"[^>]*>',set_stages,output)
    return output


def story(path):
    directory=data()
    index=json.loads((ROOT/'data/phoenix-records.json').read_text())
    records={r['id']:r for r in index['records']}
    moreland=path.endswith('moreland.html')
    project=directory['projects']['phoenix']['project-moreland' if moreland else 'project-bell']
    if moreland:
        spec=json.loads((ROOT/'data/phoenix-connections.json').read_text())['project_details'][0]
        events=spec['timeline']
        ids=['PHX-WEB-007','PHX-WEB-009','PHX-WEB-010']
        known=[*records['PHX-WEB-007']['summary'], records['PHX-WEB-009']['summary'][0]]
        gaps=[item['text'] for item in spec['evidence_needed']]
        question='What does this financing tell us about housing delivery?'
        caution='A financing closing does not establish City spending. Phase II execution and the fund split remain unverified.'
    else:
        ids=['BELL-01','BELL-06','BELL-07','BELL-08']
        events=[{'date':day,'label':records[rid]['title'],'text':records[rid]['summary'][0],'record_id':rid,'source_id':records[rid]['source_ids'][0]} for day,rid in [('April 1, 2020','BELL-06'),('June 14, 2023','BELL-07'),('2025 recovery report','BELL-08'),('Draft FY2025–26 CAPER','BELL-01')]]
        known=[records['BELL-01']['summary'][0],'Separate City and State HOME activities describe the same physical property; their assisted-unit designations must be matched before counting unique homes.']
        gaps=['Executed assistance agreements and unit schedules are needed to establish designation overlap, applicable restrictions and the changed ARPA terms.','Project-specific disbursement records and current occupancy evidence remain unverified.']
        question='What do the records establish about one property?'
        caution='A funding field or authorization is not verified cash spending. The older 20-year ARPA authorization term cannot be applied to the later changed set-aside statement without an executed amendment. Draft completion reporting does not establish current occupancy or vacancies.'
    timelines=''.join(f'<li><p class="city-story-date">{escape(event["date"])}</p><h4>{escape(event["label"])}</h4><p>{escape(event["text"])}</p><a href="{href("phoenix/records.html#"+event["record_id"],path)}">Read this record →</a></li>' for event in events)
    sources=[];seen=set()
    for rid in ids:
        for item in records[rid]['citations']:
            if item['url'] in seen:continue
            seen.add(item['url'])
            note=item['locator'] or 'Source reference: ' + ' · '.join(item['source_ids'])
            sources.append(f'<details class="city-story-source source-locator"><summary>{escape(item["title"])}</summary><small>{escape(note)}</small><p>{escape(" · ".join(item["source_ids"]))}</p><a href="{escape(item["url"],quote=True)}">Open original document →</a></details>')
    established=''.join(f'<p>{escape(text)}</p>' for text in known)
    unknown=''.join(f'<p>{escape(text)}</p>' for text in gaps)
    return f'''<section class="city-project-story city-design-ui city-wrap" id="project-brief" data-project-name="{escape(project['name'],quote=True)}"><h2 class="city-story-question">{question}</h2>{project_facts(project)}<p class="city-story-warning">{escape(caution)}</p><div class="city-story-layout"><div><section class="city-story-timeline"><h3>Follow the dated records.</h3><p>Dates and record types matter. These statements are not payments in a single account.</p><ol>{timelines}</ol></section><div class="city-story-evidence"><section><h3>What the records establish</h3>{established}</section><section><h3>What still needs evidence</h3>{unknown}</section></div></div><aside class="city-source-rail"><h3>Check the original record.</h3><p>Read the source date, record type and limits beside the claim.</p>{''.join(sources)}</aside></div><div class="city-story-tools"><button type="button" id="print-project-brief" hidden>Print project brief</button><a href="#sources">Full source appendix →</a></div><p class="city-story-boundary">Planned homes, reported milestones and current housing availability are different measures. The complete findings and qualifications remain below.</p></section>'''


def project_story(output,path):
    new=story(path)
    if 'class="city-project-story city-design-ui city-wrap"' in output:
        output=replace(output,'section',r'class="city-project-story city-design-ui city-wrap"',new)
        if 'class="city-project-overview city-wrap"' in output:
            output=replace(output,'section',r'class="city-project-overview city-wrap"','')
    else:
        output=replace(output,'section',r'class="city-project-overview city-wrap"',new)
    return output


def insert_panel(output, panel):
    """Insert guidance after the page introduction without rewriting its evidence."""
    root=html.fromstring(output)
    main=root.xpath('//main')[0]
    for child in main:
        if child.xpath('.//h1'):
            klass=child.get('class')
            if klass:
                _,end=region(output,child.tag,'class="'+re.escape(klass)+'"')
                return output[:end]+panel+output[end:]
    # Plain reading pages keep their title and introduction before guidance.
    first=next((child for child in main if child.tag=='section'),None)
    if first is not None:
        marker='id="'+re.escape(first.get('id'))+'"' if first.get('id') else ''
        start,_=region(output,'section',marker)
        return output[:start]+panel+output[start:]
    return output


def resource_panel(output,path):
    if path in ['housing-help.html','phoenix/housing-help.html']:
        output=flag(output,'city-help-page')
        body='<strong>Find official housing resources.</strong><p>Housing Accountability Project publishes research. Providers determine eligibility, services and availability. Check the provider’s current information.</p>'
    elif path in ['research.html','phoenix/inaugural-report.html','reports/tucson-housing-funding-outcomes-2026.html']:
        output=flag(output,'city-report-page')
        target='reports/tucson-housing-funding-outcomes-2026.html' if path=='research.html' else 'phoenix/inaugural-report.html' if path.startswith('phoenix/') else path
        body=f'<div class="city-report-cover" aria-hidden="true">Housing Funding<br>&amp; Outcomes<span>Dated research</span></div><div><strong>Read the research.</strong><p>Keep the edition, source dates, corrections and limitations together.</p><a class="city-text-link" href="{href(target,path)}">Read the report →</a><button type="button" data-city-print hidden>Print this page / Save PDF</button></div>'
    elif path=='research-updates.html':
        output=flag(output,'city-history-page')
        body='<strong>Follow the research history.</strong><p>Dated updates and earlier wording remain available with their corrections.</p><nav aria-label="Research history"><a href="#county-housing-funding-2026-11-08">November 8 County funding review</a><a href="#audit-corrections-2026-11-06">Documented correction</a><a href="#method">Methods &amp; corrections</a></nav>'
    elif path=='phoenix/corrections.html':
        output=flag(output,'city-history-page')
        body='<strong>A correction preserves the record.</strong><p>A supported entry keeps the earlier statement, corrected statement, evidence and publication date together. The empty log below does not establish that every finding is verified.</p>'
    elif path in ['about.html','contact.html','privacy.html']:
        output=flag(output,'city-information-page')
        return output
    elif path in ['glossary.html','phoenix/glossary.html']:
        output=flag(output,'city-glossary-page')
        return output
    else:return output
    panel=f'<section class="city-resource-intro city-design-ui city-wrap">{body}</section>'
    if 'class="city-resource-intro city-design-ui city-wrap"' in output:
        return replace(output,'section',r'class="city-resource-intro city-design-ui city-wrap"',panel)
    return insert_panel(output,panel)


def apply(output,path):
    output=re.sub(r'<div class="city-page-banner"[^>]*>.*?</div>','',output,flags=re.S)
    if path not in LANDINGS:
        banner=f'<div class="city-page-banner" aria-hidden="true"><img src="{href("assets/arizona-landscape.webp",path)}" width="1983" height="793" alt="" decoding="async"></div>'
        output=output.replace('</header>','</header>'+banner,1)
    if path in ['housing-projects.html','phoenix/projects.html']:
        output=project_filters(output,path)
    if path in ['phoenix/projects/moreland.html','phoenix/projects/25th-at-bell.html']:
        output=project_story(output,path)
    if path in ['funding-explorer.html','phoenix/records.html']:
        spec=data()['cities']['phoenix' if path.startswith('phoenix/') else 'tucson']
        hidden=' hidden' if path.startswith('phoenix/') else ''
        panel=f'<section id="city-funding-primer" class="city-funding-primer city-design-ui city-wrap"{hidden}>{stages(spec,path)}</section>'
        if 'id="city-funding-primer"' in output:
            output=replace(output,'section',r'id="city-funding-primer"',panel)
        else:output=insert_panel(output,panel)
    return resource_panel(output,path)
