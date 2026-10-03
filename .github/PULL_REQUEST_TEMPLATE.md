<!--
  NOÖSPHERE // OS — pull request
  Keep it short. The three sections below are what a reviewer needs; delete anything
  that does not apply. See CONTRIBUTING.md for the full rubric.
-->

## What this changes

<!-- One paragraph. What behaviour, appearance or guarantee changes for a user? -->

## Closes

<!-- Register IDs and/or issues, e.g. "NOO-001, NOO-006 — closes #12" -->

- Register ID(s):
- Issue(s):

## Audit delta

<!-- Paste the output of `npm test`, or the relevant lines. -->

```
before:  findings ×  allowed ×
after:   findings ×  allowed ×
```

- [ ] No new register ID was introduced
- [ ] If a count increased, the reason is stated below **and** the baseline change is in this PR
- [ ] Payload delta is understood (current headroom to the 188,000 B warn threshold: ~9,300 B)

Baseline justification (required if any count increased):

<!-- e.g. "NOO-013 ×4 → ×6: two new telemetry elements are static by design — see issue #34." -->

## Verification

Manual matrix tasks run (see [`docs/TESTING.md` § 3](docs/TESTING.md#3-manual-verification-tier)):

- [ ] `npm test` exits 0 (`npm run verify` runs the audit and the smoke harness together)
- [ ] `npm start` serves the app and the change is visible
- [ ] Relevant manual-matrix tasks pass (list numbers below)
- [ ] Console is clean — no errors or warnings introduced
- [ ] Verified in Chromium / Firefox / Safari (delete what you did not test)

Task numbers: 

## Conventions

- [ ] `index.html` is still the only artefact required to run the application
- [ ] No new runtime dependency, build step, or network call from the runtime
- [ ] Colours arrive as tokens; no raw hex values in markup
- [ ] Documentation that this change makes stale is updated in this PR (`.md` files count as code)
- [ ] The satire framing is intact: nothing presents the corpus as advice

## Screenshots / notes

<!-- For visual changes, include a before/after. For anything non-obvious, explain the trade-off. -->
