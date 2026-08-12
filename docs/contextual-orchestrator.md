# Pairing free-router with contextual-orchestrator

[free-router](https://github.com/ContextualWisdomLab/free-router) discovers free
NVIDIA NIM and OpenRouter models. [contextual-orchestrator](https://github.com/ContextualWisdomLab/contextual-orchestrator)
is the org OpenAI-compatible LLM gateway (cost routing, route vs conduct, KV
credentials, commercial evidence).

## Recommended flow

1. Run free-router to find healthy free models and obtain API keys
   (`NVIDIA_API_KEY` / `NVIDIA_NIM_API_KEY`, OpenRouter keys).
2. Seed secrets into the gateway KV (env is bootstrap transport only):

```bash
echo "$NVIDIA_NIM_API_KEY" | python -m contextual_orchestrator \
  register-credential --name NVIDIA_NIM_API_KEY --value-stdin
```

3. Discover model IDs (when gateway includes `nim_discovery`):

```python
from contextual_orchestrator.credentials import InMemoryCredentialBackend, set_backend, register_credential
from contextual_orchestrator.nim_discovery import discover_nim_models, models_to_agent_pool_entries

register_credential("NVIDIA_NIM_API_KEY", "…")  # or seed backend
report = discover_nim_models()
pool = models_to_agent_pool_entries(report["model_ids"])
```

4. Serve the gateway and point agent clients at it:

```bash
python -m contextual_orchestrator --serve \
  --agents agents.nim.json \
  --admin-token "$ADMIN" --inference-token "$INFER" \
  --price-per-million '{"meta/llama-3.1-70b-instruct": 0.0}'
```

Clients use `OPENAI_BASE_URL=http://127.0.0.1:8000/v1` and the inference Bearer
token. Prefer `model_group` replicas for first-valid race when that feature is
on main.

## Keys

- Live discovery and inference: **`NVIDIA_NIM_API_KEY`** (or provider-specific KV names).
- Do **not** use `COPILOT_GITHUB_TOKEN` for product LLM tests.
- OpenCode / Noema / Strix **review** agents keep their separate GitHub Models setup.
