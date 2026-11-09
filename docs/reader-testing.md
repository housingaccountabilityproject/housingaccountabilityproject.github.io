# Reader testing plan

## Status

Automated browser checks cover navigation, learning paths, responsive layout, contrast, city-scoped searches, Moreland evidence links, source-filter counts and printing. They do **not** establish that unfamiliar readers understand the research. A participant usability study has not been run.

## Small first study

Recruit five to eight adults unfamiliar with the project, with a mix of desktop and phone use. Participation should be voluntary. Do not request housing case histories, resident names, application details or other sensitive personal information. No outreach, recruitment or recording has been performed by the development work.

Start with the research home and alternate which city each participant explores first. Explain that the website is being tested, not the person. Ask participants to think aloud, but avoid teaching them the answer before the task. Let them stop at any point. Use anonymous participant labels and record only the device, task outcome, navigation route, confusion and approximate time.

Use `reader-testing-session.md` as the participant handout and blank observation sheet. Keep the interpretation column below for the observer; do not show it as a hint before a task. Include both the opening experience and the evidence-type disclosures in this iteration. Confirm which draft or published commit the participant actually uses.

## Neutral tasks and assessment

| Task prompt | What to observe | Interpretation to check afterward |
| --- | --- | --- |
| Start at the homepage. Explain what you think the site is for, then choose where you would begin. | Can the reader see the Arizona setting, identify a city and select an appropriate learning path without scrolling through a long introduction? | The site explains public records; it is not an application or a current housing-availability listing. |
| A reader sees an approval, a financing closing, a spending report and a housing completion report. Explain what each could tell you. | Does the reader discover the four evidence-type cards and use the disclosures when needed? | These are separate measures. A record of one does not establish the others or prove an automatic progression. |
| Find the Phoenix research, then find The Moreland. Tell us what the available records say about its phases. | Can the reader identify the city, use Projects and reach the project file? | 132 and 105 are planned apartments in two phases; 237 is not completed Phase I production. |
| Someone says the Moreland financing figure tells us what the City spent. Find the evidence and explain what you would say. | Can the reader distinguish the authorization, reported financing closing and Phase II assistance ceiling? | Up to $50m and $43.1m are different Phase I financing observations. Up to $10m is a Phase II mixed-fund authorization. These do not establish a City spending total. |
| Find the source behind a claim you want to check. Tell us where in the source you would look. | Are source links and locators discoverable without having to understand IDs first? | The reader can distinguish an original source from the site's explanation and locate the cited row, page or record. |
| Find a question that the existing records do not answer. Explain what evidence would help. | Does the reader discover the question/evidence matrix and retain uncertainty? | Missing evidence is a research gap, not by itself proof of misuse or noncompliance. |
| Search this city's research and prepare a printable set of results. | Can the reader filter, interpret the match explanation, preview, print and return? | The output preserves the city, active criteria and all matching results. Printing does not turn an old source into a current one. |
| Switch to the other city and find the same kind of information. | Does the shared structure transfer? Can the reader identify the current city? | Research scope stays separate even though layout and navigation are shared. |

After each task, ask “What was confusing?” and “How sure are you about your interpretation?” Do not count a quick wrong interpretation as success. Classify outcomes as unaided completion, completion with help, incorrect interpretation, or incomplete. Keep participant findings separate from automated pass/fail results.

Prioritize changes that prevent a wrong inference about spending, completed homes, availability or geography. Then address navigation friction and terminology. Repeat the same tasks after changes with fresh readers where possible; preserve a dated account of what was tested and actually observed.
