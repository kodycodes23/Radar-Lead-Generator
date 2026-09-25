---
name: icp-refinement
description: Turn a lead qualification objective into structured ICP criteria before searching for any companies. Use this first, at the start of every run, before calling discover_companies.
---

# ICP Refinement

Use this skill to turn the user's qualification objective into concrete ICP criteria before spending any discovery or scraping tool calls.

## Goal

Understand who counts as a good-fit company before searching. Do not call `discover_companies` until you have produced and saved an ICP object with `save_refined_icp`.

## Minimum criteria to clarify

- Target company type
- Industry or niche
- Geography
- Company size or headcount range
- Relevant buyer or operator persona
- Business problem the company may have
- Hard disqualifiers
- Soft preferences

## Hard filters vs. soft preferences

Hard filters must be true for a lead to qualify. Soft preferences improve fit but must never automatically disqualify a company. Whether something is a hard filter is a judgment call about how the objective phrases it and whether it's realistically checkable — not a reflex applied to every stated detail. Decide each constraint against these two tests:

1. **Is it phrased as non-negotiable?** Language like "must", "only", "exactly", "at least", "no more than" signals hard. Language that's descriptive of a typical target ("with 10-50 employees", "based around the East Coast") signals a strong soft preference, not an absolute gate.
2. **Is it something a public website will usually let you confirm?** Categorical facts (country, B2B vs. B2C, industry/vertical) are usually checkable and safe to treat as hard. Precise numeric ranges (exact headcount, exact revenue, funding amount) are rarely stated on a company's own site — treating an unverifiable number as a hard filter mostly produces `needs_review`, not real disqualification. Default these to soft preferences unless the objective makes them explicitly non-negotiable per test 1.

Either way, never drop or soften a constraint the user actually gave you: a soft preference still gets recorded in `soft_preferences` and still gets weighed in qualification — "soft" changes how failing it is handled (evidence for the decision, not an automatic reject), not whether it's tracked at all.

## When to ask instead of assume

Two of the minimum criteria directly shape the `discover_companies` search queries: **geography** and **target company type / industry**. Get either of those wrong and the entire discovery budget gets spent finding the wrong companies -- a mistake here isn't correctable later, it just wastes the run. If the objective doesn't state (even loosely) what kind of company or what geography it's targeting, call `ask_clarifying_question` with one specific question covering the missing one(s) before producing the ICP, then use the answer. Do not guess a country or an industry to fill this gap -- ask. This actually pauses the run for a human reply; it is available only before `save_refined_icp` and only once per run, so if both are missing, ask about both in a single question rather than spending your one question on just one of them.

The remaining criteria (headcount/size, buyer persona, business problem, soft preferences) only shape *qualification scoring* after discovery has already found real candidates -- a wrong guess there costs a `needs_review` flag on a lead, not a wasted search. Don't pause the run over these. Fill a missing one with your best-guess default and mark it inline, in that same field's own string/array value, with a leading `(assumed: ...)` note explaining what you inferred and why (e.g. `"headcount_range": "(assumed: no strict size given -- inferred a broad range consistent with the stated business problem)"`). Do not add fields outside the schema below to hold this — the ICP object's shape is fixed. This inline marker is what lets a human reviewer spot and correct a minor inference later without it costing a pause.

Only call `ask_clarifying_question` for the two search-shaping fields above. If the objective is ambiguous in some other way that isn't one of the minimum criteria at all (e.g. the target could mean two fundamentally different things), that also qualifies -- but stay disciplined about the single-question, single-use budget.

Keep the ICP narrow enough to search, but not so narrow that no company could plausibly qualify. Before finalizing, sanity-check your own `hard_filters` list: if you listed more than 2-3 hard filters, or a knowledgeable person given only your hard filters (ignoring soft preferences) would say most real companies in this industry/geography couldn't plausibly pass all of them at once, move the weaker ones to `soft_preferences`. A hard-filter list that's already implausibly narrow before a single company has been discovered is a sign you over-classified, not a sign the market is small.

## Output format

Produce exactly this object and pass it to `save_refined_icp`:

```json
{
  "target_company_type": "",
  "industries": [],
  "geography": [],
  "headcount_range": "",
  "buyer_persona": "",
  "business_problem": "",
  "hard_filters": [],
  "soft_preferences": [],
  "disqualifiers": []
}
```

Use these exact field names. Do not invent your own.
