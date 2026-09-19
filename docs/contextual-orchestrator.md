# Pairing free-router with contextual-orchestrator

Status: Proposed

This page defines a bounded integration contract. It is not an install or production-run guide.

## Responsibility boundary

`free-router` is an optional operator-side assessment tool. It can probe models for a local interactive session, but its output is not a production routing decision and it does not write `contextual-orchestrator` state.

`contextual-orchestrator` is the sole production authority for provider discovery, capability verification, routing, and fallback. Consumers call its released API, client, and schema through an explicit port; they do not read owner source, databases, or temporary branches.

## Release gate

At the evidence bound for this proposal, no immutable, license-accepted contextual-orchestrator release has been verified for this integration. Do not install owner code from a commit, branch, or mutable URL.

Until a qualifying release exists, keep the integration behind a port, ACL, feature flag, or test double. Production enablement requires all of the following evidence from the owner:

- an immutable versioned release;
- API and schema compatibility evidence for the same revision;
- exact-revision security, SBOM, provenance, and license acceptance;
- consumer tests pinned to that released revision.

## Consumer contract after release

1. Pin the accepted immutable release and its published contract.
2. Application and GitHub Actions requests use logical model `orchestrator/free` and a gateway token only.
3. Consumers do not select a provider, concrete model, provider group, or paid fallback.
4. Missing capability or an exhausted verified free pool fails closed; it does not bypass the gateway.
5. The default application, Agent, and Gateway model timeout is `null`. User cancellation, provider termination, and an explicit admin timeout remain distinct events.
6. Provider credentials stay inside the canonical owner boundary and are never copied into consumer documentation, workflow configuration, or source.

`free-router` remains independently usable for its documented CLI workflow. Pairing does not make it a runtime dependency or a production control plane.

## Failure scenes

- If no qualifying release exists, the consumer integration stays disabled.
- If the gateway cannot satisfy the requested capability from its verified free pool, the request fails closed.
- If `free-router` and the gateway observe different model availability, the gateway decision wins for production traffic.
- If release, schema, SBOM, provenance, or license evidence refer to different revisions, release acceptance fails.
