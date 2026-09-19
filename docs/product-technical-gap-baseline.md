# Product technical gap baseline

Status: Proposed

Evidence observed: 2026-09-20. This baseline is scoped to the `free-router` fork and stacked PR #62; an open PR is not protected-branch truth.

## Product responsibility and Context Map

`free-router` is an optional operator-side assessment CLI for interactive discovery, latency checks, and local target configuration. The npm identity in `package.json` is `@bytonylee/free-router`; it is not a ContextualWisdomLab package identity.

`contextual-orchestrator` is the production discovery, capability verification, routing, and fallback authority. The relationship is conformist/consumer through a released API, client, and schema. There is no shared database, source import, file copy, or runtime dependency.

```text
Operator -> free-router (optional operator-side assessment)
Application / GitHub Actions -> contextual-orchestrator released contract -> verified free provider pool
```

## Current evidence

| Evidence | Exact observation | Status |
| --- | --- | --- |
| Protected parent | `docs/deepwiki-public-surface@96bcd36d6590596dc6bc0c101382793879fdecfb` | Proposed parent PR #52 |
| Successor | `release/contextual-orchestrator-docs` / PR #62 | Proposed; not released |
| Package metadata | `@bytonylee/free-router@1.2.1`, upstream repository/homepage/author fields | Upstream distribution |
| Source license | Root `LICENSE` declares Apache-2.0 | Source grant observed; artifact acceptance separate |
| Release state | Repository Releases API returned no GitHub Release | No ContextualWisdomLab release evidence |
| Owner integration | No accepted immutable `contextual-orchestrator` release is bound to this consumer | Blocked |

## Architecture document map

| Artifact | Current evidence | Gap / Action |
| --- | --- | --- |
| PRD | Not present on the protected parent | Define only when product scope exceeds the README contract |
| TRD | Not present on the protected parent | Bind any production integration to a released owner contract |
| ADR | Not present on the protected parent | Record a decision before changing the responsibility boundary |
| UML | Not present on the protected parent | Add only when interactions exceed the Context Map above |
| ERD | Not applicable to the current stateless consumer boundary | Required if this product begins to own persistent domain data |

## Gap / Action / Status

| Gap | Action | Status |
| --- | --- | --- |
| The old guide installed owner source by commit and exposed provider-specific bootstrap details | Replace it with the released-contract and fail-closed boundary; keep #62 Draft until exact-head checks and review pass | In progress |
| A qualifying immutable `contextual-orchestrator` release is not bound to this consumer | Owner must publish matching API/schema, security, SBOM, provenance, and license evidence; consumer then pins that release | Blocked on canonical owner |
| npm availability could be mistaken for a ContextualWisdomLab release | Keep upstream package identity and the absence of a GitHub Release explicit in both READMEs | In progress |
| NOTICE, third-party obligations, SBOM, and provenance are not artifact-bound for a ContextualWisdomLab release | Verify the final dependency graph and publish NOTICE where required, SBOM, and provenance for the same immutable artifact | Open |
| README writer #52 and integration writer #62 overlap | Keep #62 stacked on #52 and preserve #52's complete badge delta before retargeting | Controlled |
