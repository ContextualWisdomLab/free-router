# Pairing free-router with contextual-orchestrator

[free-router](https://github.com/ContextualWisdomLab/free-router) discovers and
benchmarks free NVIDIA NIM and OpenRouter models.
[contextual-orchestrator](https://github.com/ContextualWisdomLab/contextual-orchestrator)
serves an OpenAI-compatible gateway over an explicit agent-pool configuration.
The tools remain independently operable: free-router does not write gateway
state, and the gateway does not depend on free-router at runtime.

## Tested gateway revision

The commands below target the gateway revision whose CLI, KV credential
contract, and agent JSON schema were verified for this guide. Pinning avoids
silently picking up a changed CLI or configuration contract.

```bash
python -m pip install \
  "contextual-orchestrator[db] @ git+https://github.com/ContextualWisdomLab/contextual-orchestrator.git@6841b71935e0b7cb98fb52bcb4709cc5100c8d87"
```

## Production flow

### 1. Select a healthy NVIDIA model and normalize the key name

Run free-router and record an NVIDIA model ID that is healthy for the intended
workload. free-router reads `NVIDIA_API_KEY`; the gateway pool below names the
same secret `NVIDIA_NIM_API_KEY`. This bootstrap bridge accepts either name but
fails before registration when both are empty.

```bash
set -eu
export NVIDIA_NIM_API_KEY="${NVIDIA_NIM_API_KEY:-${NVIDIA_API_KEY:-}}"
if [ -z "$NVIDIA_NIM_API_KEY" ]; then
  echo "Set NVIDIA_NIM_API_KEY or NVIDIA_API_KEY before bootstrap." >&2
  exit 1
fi
: "${NIM_MODEL_ID:?Set NIM_MODEL_ID to the NVIDIA model ID selected in free-router}"
```

### 2. Configure one persistent credential registry

`register-credential` and `--serve` run in separate processes. The default
in-memory backend is process-local, so both commands must receive the same
persistent KV configuration in production.

```bash
export CONTEXTUAL_ORCHESTRATOR_KV_BACKEND=postgres
: "${CONTEXTUAL_ORCHESTRATOR_KV_DSN:?Set the credential-registry Postgres DSN}"
: "${CONTEXTUAL_ORCHESTRATOR_KV_PASSPHRASE:?Set the pgcrypto passphrase}"
export CONTEXTUAL_ORCHESTRATOR_KV_DSN
export CONTEXTUAL_ORCHESTRATOR_KV_PASSPHRASE

printf '%s' "$NVIDIA_NIM_API_KEY" | python -m contextual_orchestrator \
  register-credential --name NVIDIA_NIM_API_KEY --value-stdin
```

The provider key is bootstrap input only. The running gateway resolves it from
the encrypted KV by credential name rather than reading a provider-key
environment variable at request time.

### 3. Materialize the selected model as a static agent pool

The tested gateway revision does not publish a `nim_discovery` module. Use the
model ID selected by free-router to create the versioned pool explicitly instead
of importing an unreleased adapter.

```bash
python - <<'PY'
import json
import os
from pathlib import Path

model_id = os.environ["NIM_MODEL_ID"].strip()
if not model_id:
    raise SystemExit("NIM_MODEL_ID must be non-empty")

pool = {
    "agents": [
        {
            "id": "nim_general_agent",
            "model": model_id,
            "base_url": "https://integrate.api.nvidia.com/v1",
            "credential_key": "NVIDIA_NIM_API_KEY",
            "provider_name": "nvidia_nim",
            "tags": ["reasoning", "writing", "planning", "analysis"],
            "priority": 1,
        }
    ]
}
Path("agents.nim.json").write_text(
    json.dumps(pool, indent=2) + "\n",
    encoding="utf-8",
)
PY
```

Add more selected models as separate agent entries when routing or conducted
workflows need different capabilities. Keep every credential reference as a KV
name; do not put a secret value in the JSON file.

### 4. Start the gateway with the same KV configuration

The exports from step 2 remain in effect for this process. Restrict provider
egress to the exact NVIDIA API host and require independent admin and inference
tokens.

```bash
export CONTEXTUAL_ORCHESTRATOR_ALLOWED_PROVIDER_HOSTS=integrate.api.nvidia.com
: "${ADMIN:?Set an admin bearer token}"
: "${INFER:?Set an inference bearer token}"

python -m contextual_orchestrator --serve \
  --agents agents.nim.json \
  --admin-token "$ADMIN" \
  --inference-token "$INFER"
```

Clients use `OPENAI_BASE_URL=http://127.0.0.1:8000/v1` and the inference bearer
token. The CLI has no `--price-per-million` option. Applications that require a
price table configure `TaskOrchestrator(price_per_million=...)` through the
Python API supported by their pinned gateway revision.

## Single-process development procedure

The in-memory backend is safe only when registration and server construction
happen in the same Python interpreter. Do not run the standalone registration
command and a separate `--serve` command with the memory backend.

```python
from getpass import getpass

from contextual_orchestrator.credentials import (
    InMemoryCredentialBackend,
    register_credential,
    set_backend,
)
from contextual_orchestrator.orchestrator import ModelClient, TaskOrchestrator, load_agents
from contextual_orchestrator.server import SecurityConfig, serve

secret = getpass("NVIDIA NIM API key: ").strip()
if not secret:
    raise SystemExit("A non-empty NVIDIA NIM API key is required")

set_backend(InMemoryCredentialBackend())
register_credential("NVIDIA_NIM_API_KEY", secret)
orchestrator = TaskOrchestrator(load_agents("agents.nim.json"), client=ModelClient())
serve(
    orchestrator,
    host="127.0.0.1",
    port=8000,
    security=SecurityConfig(admin_token="dev-admin", inference_token="dev-infer"),
)
```

This development process is intentionally non-durable. Restarting it discards
the credential.

## Credential and automation boundaries

- Product discovery and inference use `NVIDIA_API_KEY` in free-router and the
  normalized KV name `NVIDIA_NIM_API_KEY` in the gateway.
- Product LLM tests use the GitHub secret `NVIDIA_NIM_API_KEY`; they do not use
  `COPILOT_GITHUB_TOKEN`.
- OpenCode, Noema, and Strix review agents retain their existing independent
  GitHub Models credential identities and scopes.
