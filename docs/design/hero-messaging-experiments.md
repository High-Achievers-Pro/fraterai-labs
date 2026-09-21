# Hero messaging options for future A/B tests

Saved September 21, 2026. These are approved copy candidates, not active experiments.

## Current website copy

**Headline:** Your next business advantage, built with AI.

**Supporting copy:** Strategic clarity, operator-level expertise, and disciplined engineering. We turn AI and machine learning into measurable progress for your business.

Keep the supporting copy, calls to action, design, and acquisition targeting consistent when comparing headlines so the test isolates the messaging change.

## Headline library

| Variant ID | Headline | Positioning | Hypothesis to test |
| --- | --- | --- | --- |
| business-advantage | Your next business advantage, built with AI. | Aspirational business value; current baseline | Visitors seeking competitive advantage will be more likely to start a conversation. |
| built-around-you | AI built around your business. | Tailored solutions grounded in the client's operations | Relevance and a bespoke approach will resonate with teams whose needs are not met by generic tools. |
| work-that-matters | Put AI to work where it matters. | Practical application and prioritization | Visitors seeking a useful starting point will respond to focused, actionable positioning. |
| decisions-operations | Better decisions. Smarter operations. Powered by AI. | Explicit business outcomes | Naming decision quality and operational improvement will make the value easier to understand. |
| ambition-to-impact | From AI ambition to business impact. | Strategy through implementation | Teams struggling to move from exploration to delivery will respond to the promise of end-to-end support. |

## Supporting-copy alternatives

Use the current machine-learning-inclusive version above for the first headline tests.

The original version remains available for a separate future test:

> Strategic clarity, operator-level expertise, and disciplined engineering. We turn AI into measurable progress for your business.

The earlier headline, “Production AI, shipped in a fiscal year. Not a strategy deck.”, is retained here for historical context. It was replaced because the timeline could sound slow and the business benefit was unclear.

## Suggested experiment plan

1. Confirm analytics and conversion events work before assigning visitors to variants.
2. Start with the current baseline and one challenger. Preserve the other candidates for later rounds rather than dividing traffic across all five at once.
3. Proposed PostHog experiment/flag key: `marketing-hero-headline`. Use the stable variant IDs above and keep assignment consistent for each visitor. The current headline should remain the fallback if flags are unavailable.
4. Primary outcome: a successfully submitted contact inquiry from an exposed visitor. Count success after the server accepts the submission, not on submit-button clicks.
5. Secondary outcomes: clicks on the hero's “Start a conversation” and “Explore services” links. A completed Calendly booking can be another conversion once its event is reliably instrumented.
6. Record exposure only when the assigned hero is rendered. Exclude internal/local testing traffic. Preserve the acquisition source and device context for diagnosis.
7. Before launch, record the hypothesis, traffic allocation, baseline conversion rate, minimum meaningful improvement, sample-size target, and decision rule. Choose duration and sample size from actual traffic; do not declare a winner from a few early conversions.
8. Record findings and the next decision below. No experiment is enabled by this document.

## Results log

No experiments have run yet.

For each future experiment, record its PostHog link, dates, variants, exposure counts, conversions, uncertainty, and the decision to adopt, retain, or retest the headline.
