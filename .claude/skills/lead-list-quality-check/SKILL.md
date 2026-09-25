---
name: lead-list-quality-check
description: Check the quality of the final lead list before finishing a run. Use this once you believe you have enough qualified leads (or have exhausted the discovery/scrape budget), before calling update_run_status to complete the run.
---

# Lead-List Quality Check

Use this skill to check the quality of the final lead list before finishing the run. Run it once, near the end, before marking the run complete.

## Required checks

- Does the list contain the run's target number of qualified companies? If not, is that because the candidate pool was exhausted within the tool-call limits — not because you stopped early?
- Does each company have a name and domain?
- Does each company have qualification reasoning (`fit_reasons`/`concerns`)?
- Does each company have source context (`source_urls`, `source_summary`)?
- Does each qualified company have outreach drafts?
- Were no personal emails found, and was no email validated? (There is no tool for either — this should be true by construction.)
- Have duplicate companies been removed? The database enforces uniqueness per domain per run, but check you didn't run near-duplicate discovery queries that returned the same company under slightly different names.
- Are companies marked `needs_review` excluded from the qualified count you report back to the user?

## Scorecard to reason through

| Dimension | What to check |
| --- | --- |
| ICP Fit | The lead matches the hard filters from the refined ICP. |
| Evidence Quality | The qualification decision uses real source context, not guesses. |
| Duplicate Rate | The same company does not appear more than once. |
| Outreach Relevance | The email sequence uses company-specific context. |
| Data Completeness | Required fields are present for every lead. |
| Safety Compliance | No email finding, no email validation, no send attempted. |

## Pass standard

The submitted list should include the run's target number of qualified companies passing the checks above. If you cannot reach the target from the current candidate pool within the run's discovery/scrape limits, either run one more targeted `discover_companies` query if budget remains, or finish the run with fewer qualified leads and a clear, honest explanation of why (e.g. "8 of 10: candidate pool exhausted at the 40-company discovery cap for this ICP"). Never pad the list with weak leads just to hit the number.
