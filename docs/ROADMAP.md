# Roadmap

> Shipped workstation-shell baseline, Zaziopath source-corpus integration, and remaining UI/performance work.

## Completed in the current working tree

- Committed stable source-derived graph data, preserving all eight Zaziopath strata and source revision identity.
- Source-cited nodes, explicitly documented relationships, 15 searchable Grimoire excerpts, and visible SOURCE / INFERENCE / SYNTHESIS / OPEN QUESTION labels.
- Deterministic Canvas startup/simulation plus bounded offline lexical retrieval.
- Optional local-only `llama3.1:8b` context path with failure fallback; no cloud inference.
- Optional SYNAPSE SHELL PTY, xterm UI, session/process/port controls, gated local routes, and bounded three-mode local agent. AI SHELL starts OFF; the PTY is unsandboxed and uses the launcher's OS permissions.
- Session-only local text ingestion with candidate caps, normalized deduplication, source records, and marked heuristic/model links.
- Session-local cross-stratum OPEN QUESTION synthesis; no unsupported link is made a source fact.
- Graph validation, inline runtime smoke tests, updated static audit, and provenance/launch documentation.

## Next · UI correctness and usability

| Item | Why | Acceptance |
| --- | --- | --- |
| Correct remaining Tailwind accent-family utilities (`NOO-001`) | A few existing window borders use undefined color families | Audit finding count reaches zero; intended accents are visible |
| Replace the invalid Lucide `dread` icon (`NOO-006`) | Existing synthesizer icon may not render | Valid icon is included in the audit set and appears in browser |
| Add the synthesizer to the dock (`NOO-012`) | One of the core windows has no dock launcher | Every core window can be restored from the dock; optional shell remains separately launchable |
| Responsive/reachable default window geometry (`NOO-019`) | The authored desktop layout can extend beyond narrower viewports | Every window header remains reachable at the documented minimum viewport; desktop metaphor remains intact |
| Keyboard/assistive access (`NOO-016`) | Canvas content and window controls need a complete non-pointer interaction model | Graph node traversal, named regions, modal focus management, and screen-reader verification |
| Honor `prefers-reduced-motion` | Canvas and ambient UI animation are continuously active | Reduced-motion mode preserves graph access while pausing ambient motion |

## Later · Performance and maintainability

| Item | Rationale |
| --- | --- |
| Fixed-timestep force simulation (`NOO-020`) | Current force integration is frame-rate-dependent |
| Device-pixel-ratio-aware canvas (`NOO-014`) | Improve HiDPI sharpness after checking fill-rate cost |
| Profile before adding a spatial index (`NOO-015`) | Current committed graph is 86 nodes; 3,655 pair checks/frame is a modelled cost, not yet a measured bottleneck |
| Bound transcript DOM growth | Keep long-running local sessions manageable without adding persistence |
| Improve browser-level testing only if needed | Current VM smoke tests cover logic; visual behavior remains a manual browser check |

## Deliberately out of scope

| Not planned | Reason |
| --- | --- |
| Personality diagnosis or a clinical scoring engine | The source archive is non-clinical and its epistemic limits must remain visible |
| Cloud model APIs, API keys, remote upload of files, or server-side user data | Violates local-only ingestion and static fallback expectations |
| Models beyond `llama3.1:8b`, embeddings, vector databases, or general-purpose heavy dependencies | The corpus path remains bounded; optional shell uses only its small pinned terminal/PTy stack |
| Runtime crawling of Zaziopath | The committed, reviewable snapshot is the source of stable static behavior |
| Replacing Canvas or the existing window/CRT design with a framework | The request is to evolve, not redesign, the existing system |
| Browser persistence/export for private ingestion or session notes | Requires an explicit privacy/product decision; corpus additions remain discard-on-reload. Shell logs are separately saved only by explicit operator action |

See [Corpus data and provenance](ZAZIOPATH-CORPUS.md), [Architecture](ARCHITECTURE.md), [Testing](TESTING.md), and [Architecture Decisions](DECISIONS.md) for constraints and verification.
