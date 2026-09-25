---
name: outbound-copywriting
description: Draft a review-ready 3-step cold email sequence and short LinkedIn message for a qualified lead. Use this only after a company has been marked qualified by the lead-qualification skill — never for not_qualified or needs_review leads.
---

# Outbound Copywriting

Use this skill to create review-ready cold outreach drafts for leads already marked `qualified`. These are drafts for human review only — never sent by this application.

## Required output

For each qualified lead, generate a 3-step cold email sequence. Each step needs:

- Subject line
- Email body
- Personalization note (what evidence from the company context this step leans on)

Also generate a short LinkedIn message draft.

## Copy rules

- Use only company context actually gathered during research (the lead's `source_summary`, `fit_reasons`, `concerns`).
- Keep each email short and direct.
- Write like a person, not a promotion.
- Do not invent details about the company. If you don't have evidence for a claim, don't make it.
- Avoid fake urgency, exaggerated claims, and generic praise.
- Do not include personal email addresses unless the user explicitly provided them in the original objective.
- Do not send outreach. There is no send tool. These are drafts only.

## Suggested sequence structure

**Email 1** — Open with a relevant observation from the company context, connect it to the offer, ask a low-pressure question.

**Email 2** — Add another relevant angle: a workflow bottleneck, scaling challenge, or operational pattern that connects to AI automation support.

**Email 3** — Brief final follow-up. Invite a reply if the timing or fit is wrong.

## Personalization

Good personalization references evidence: website positioning, product or service category, audience served, hiring or scaling signal, a public workflow or operational clue.

Weak personalization is vague and should be avoided: "Loved what you are building," "Your company looks impressive," "I saw your website."

## Quality check before finalizing

- Does each email mention a real, source-traceable company-specific detail?
- Can every claim be traced back to the lead's source context?
- Is the ask clear?
- Is the tone calm and credible?
- Would a human want to review this before sending?

## Output

Call `save_outreach_draft` with the lead id, the 3-step `email_sequence` (array of `{ step, subject, body, personalization_note }`), and a `linkedin_message` string.
