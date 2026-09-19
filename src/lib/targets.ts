// src/lib/targets.ts — write config to OpenCode, OpenClaw, and Hermes Agent
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
  statSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { PROVIDERS_META, validateProviderApiKey } from "./config.js";
import { type Model } from "./utils.js";

const OPENCODE_PATH = join(homedir(), ".config", "opencode", "opencode.json");
const OPENCLAW_PATH = join(homedir(), ".openclaw", "openclaw.json");
const HERMES_CONFIG_PATH = join(homedir(), ".hermes", "config.yaml");
const HERMES_ENV_PATH = join(homedir(), ".hermes", ".env");
const IS_WIN = platform() === "win32";
let cachedOpenCodeConfig: Record<string, any> | null = null;
let cachedOpenCodeConfigFingerprint: string | null = null;

function readJson(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function readOpenCodeFingerprint() {
  if (!existsSync(OPENCODE_PATH)) return "missing";
  try {
    const stat = statSync(OPENCODE_PATH);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "missing";
  }
}

function readOpenCodeConfig(force = false) {
  const fingerprint = readOpenCodeFingerprint();
  if (
    !force &&
    cachedOpenCodeConfig &&
    cachedOpenCodeConfigFingerprint === fingerprint
  ) {
    return cachedOpenCodeConfig;
  }
  cachedOpenCodeConfig = readJson(OPENCODE_PATH);
  cachedOpenCodeConfigFingerprint = fingerprint;
  return cachedOpenCodeConfig;
}

function backupAndWriteJson(path: string, data: Record<string, any>) {
  backupAndWriteText(path, JSON.stringify(data, null, 2) + "\n");
}

function backupAndWriteText(path: string, data: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(path)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${path}.backup-${ts}`;
    copyFileSync(path, backupPath);
    try {
      chmodSync(backupPath, 0o600);
    } catch {
      /* best-effort */
    }
  }
  writeFileSync(path, data, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort */
  }
}

function getProviderMeta(providerKey: string) {
  const meta = PROVIDERS_META[providerKey];
  if (!meta) throw new Error(`Unknown provider "${providerKey}"`);
  return meta;
}

function resolvePersistedApiKey(
  providerKey: string,
  apiKey: string | null,
  options: { persistApiKey?: boolean } = {},
) {
  if (!options.persistApiKey || !apiKey) return null;
  const checked = validateProviderApiKey(providerKey, apiKey);
  if (!checked.ok) {
    throw new Error(
      `Refusing to persist invalid ${providerKey} API key: ${checked.reason}`,
    );
  }
  return checked.key;
}

/** Check whether a binary is available on PATH (cached per session). */
const binaryCache = new Map<string, boolean>();
function hasBinary(bin: string) {
  if (binaryCache.has(bin)) return binaryCache.get(bin);
  const locator = IS_WIN ? "where.exe" : "which";
  const probe = spawnSync(locator, [bin], {
    stdio: "ignore",
    shell: false,
  });
  const found = probe.status === 0 && !probe.error;
  binaryCache.set(bin, found);
  return found;
}

// ─── OpenCode installation detection ─────────────────────────────────────────

export function isOpenCodeInstalled() {
  return hasBinary("opencode");
}

export function detectAvailableInstallers() {
  const installers = [];
  if (hasBinary("npm"))
    installers.push({
      id: "npm",
      label: "npm",
      command: "npm install -g opencode",
    });
  if (platform() === "darwin" && hasBinary("brew")) {
    installers.push({
      id: "brew",
      label: "Homebrew",
      command: "brew install opencode",
    });
  }
  if (hasBinary("go"))
    installers.push({
      id: "go",
      label: "Go",
      command: "go install github.com/opencode-ai/opencode@latest",
    });
  return installers;
}

function resolveOpenCodeInstallerProcess(command: string) {
  switch (command) {
    case "npm install -g opencode":
      return {
        executable: IS_WIN ? "npm.cmd" : "npm",
        args: ["install", "-g", "opencode"],
      };
    case "brew install opencode":
      return { executable: "brew", args: ["install", "opencode"] };
    case "go install github.com/opencode-ai/opencode@latest":
      return {
        executable: IS_WIN ? "go.exe" : "go",
        args: ["install", "github.com/opencode-ai/opencode@latest"],
      };
    default:
      throw new Error(`Unsupported installer command for OpenCode: ${command}`);
  }
}

export function installOpenCode(installer: { command: string }) {
  try {
    const processSpec = resolveOpenCodeInstallerProcess(installer.command);
    const result = spawnSync(processSpec.executable, processSpec.args, {
      stdio: "inherit",
      shell: false,
      timeout: 120_000,
    });
    if (result.status === 0) return { ok: true };
    return { ok: false, error: `Command exited with code ${result.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Provider config blocks ───────────────────────────────────────────────────

function getBaseUrl(meta: { chatUrl: string }) {
  return meta.chatUrl.replace("/chat/completions", "");
}

function envLineValue(value: string) {
  if (/^[^\s"'\\#=]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function envAssignmentKey(line: string) {
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex < 0) return null;
  return trimmed.slice(0, equalsIndex).trimEnd();
}

function setEnvFileValue(path: string, key: string, value: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  const nextLine = `${key}=${envLineValue(value)}`;
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (envAssignmentKey(line) !== key) return line;
    replaced = true;
    return nextLine;
  });
  if (!replaced) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(nextLine);
  }
  writeFileSync(path, nextLines.join("\n").replace(/\n*$/, "\n"), {
    mode: 0o600,
  });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort */
  }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function assertOpenCodeProviderSelectable(
  cfg: Record<string, any>,
  providerKey: string,
) {
  const disabled = readStringArray(cfg.disabled_providers);
  if (disabled.includes(providerKey)) {
    throw new Error(
      `OpenCode provider "${providerKey}" is disabled in opencode.json.`,
    );
  }

  const enabled = readStringArray(cfg.enabled_providers);
  if (enabled.length > 0 && !enabled.includes(providerKey)) {
    throw new Error(
      `OpenCode provider "${providerKey}" is not listed in enabled_providers.`,
    );
  }
}

function openCodeProviderBlock(
  providerKey: string,
  apiKey: string | null,
  model: Model,
  existingBlock: Record<string, any> = {},
) {
  const meta = getProviderMeta(providerKey);
  const existingModels =
    existingBlock.models && typeof existingBlock.models === "object"
      ? existingBlock.models
      : {};
  const existingOptions =
    existingBlock.options && typeof existingBlock.options === "object"
      ? existingBlock.options
      : {};

  return {
    ...existingBlock,
    npm: "@ai-sdk/openai-compatible",
    name: meta.name,
    models: {
      ...existingModels,
      [model.id]: existingModels[model.id] ?? {},
    },
    options: {
      ...existingOptions,
      baseURL: getBaseUrl(meta),
      apiKey: apiKey || `{env:${meta.envVar}}`,
    },
  };
}

const OPENCODE_PROVIDER_FALLBACKS: Record<
  string,
  { providerKey: string; modelId: string }
> = {
  // models.dev currently lists Stepfun 3.5 Flash under OpenRouter, not NVIDIA.
  "nvidia:stepfun-ai/step-3.5-flash": {
    providerKey: "openrouter",
    modelId: "stepfun/step-3.5-flash:free",
  },
};

const DEFAULT_UNSUPPORTED_MODEL_FALLBACK = {
  providerKey: "nvidia",
  modelId: "deepseek-ai/deepseek-v4-pro",
};

function assertOpenCodeCompatible(model: Model) {
  if (model?.opencodeSupported === false) {
    throw new Error(
      `Model "${model.id}" is not marked as OpenCode-supported. Pick another model or refresh model metadata.`,
    );
  }
}

function modelTail(id: string): string {
  return (
    id
      .replace(/:free$/i, "")
      .split("/")
      .pop()
      ?.toLowerCase() || ""
  );
}

function findFallbackModel(
  allModels: Model[],
  providerKey: string,
  modelId: string,
): Model | null {
  if (!Array.isArray(allModels) || !allModels.length) return null;
  return (
    allModels.find(
      (m) => m?.providerKey === providerKey && m?.id === modelId,
    ) ||
    allModels.find(
      (m) =>
        m?.providerKey === providerKey &&
        modelTail(m?.id || "") === modelTail(modelId),
    ) ||
    null
  );
}

// ─── OpenCode ────────────────────────────────────────────────────────────────

/**
 * Merge free-router provider block into OpenCode config and set active model.
 * Preserves all existing keys (other providers, plugins, etc.).
 */
export function writeOpenCode(
  model: Model,
  providerKey: string,
  apiKey: string | null = null,
  options: { persistApiKey?: boolean } = {},
) {
  assertOpenCodeCompatible(model);
  const persistedApiKey = resolvePersistedApiKey(providerKey, apiKey, options);
  const currentCfg = readOpenCodeConfig();
  assertOpenCodeProviderSelectable(currentCfg, providerKey);
  const currentProviders = currentCfg.provider ?? {};
  const nextCfg = {
    ...currentCfg,
    provider: {
      ...currentProviders,
      [providerKey]: openCodeProviderBlock(
        providerKey,
        persistedApiKey ?? null,
        model,
        currentProviders[providerKey],
      ),
    },
    model: `${providerKey}/${model.id}`,
  };

  if (JSON.stringify(nextCfg) === JSON.stringify(currentCfg)) {
    return OPENCODE_PATH;
  }

  backupAndWriteJson(OPENCODE_PATH, nextCfg);
  cachedOpenCodeConfig = nextCfg;
  cachedOpenCodeConfigFingerprint = readOpenCodeFingerprint();
  return OPENCODE_PATH;
}

/**
 * Resolve model selection for OpenCode config.
 * Keeps the user's explicit provider/model unless metadata marks it unsupported
 * or a known provider remap is required.
 */
export function resolveOpenCodeSelection(
  model: Model,
  providerKey: string,
  _allModels: Model[] = [],
) {
  const fallbackRule =
    OPENCODE_PROVIDER_FALLBACKS[`${providerKey}:${model?.id}`] ??
    (model?.opencodeSupported === false
      ? DEFAULT_UNSUPPORTED_MODEL_FALLBACK
      : null);
  if (!fallbackRule) return { model, providerKey, fallback: false };

  const fallbackModel = findFallbackModel(
    _allModels,
    fallbackRule.providerKey,
    fallbackRule.modelId,
  );
  if (!fallbackModel) {
    return {
      model: {
        ...model,
        id: fallbackRule.modelId,
        providerKey: fallbackRule.providerKey,
        opencodeSupported: null,
      },
      providerKey: fallbackRule.providerKey,
      fallback: true,
    };
  }

  return {
    model: fallbackModel,
    providerKey: fallbackRule.providerKey,
    fallback: true,
  };
}

// ─── OpenClaw ────────────────────────────────────────────────────────────────

/**
 * Merge free-router config into OpenClaw JSON:
 *   - env.<PROVIDER>_API_KEY  (when plaintext export is explicitly enabled)
 *   - agents.defaults.model.primary
 *   - agents.defaults.models allowlist entry (required or OpenClaw rejects it)
 *
 * OpenClaw ships built-in openrouter/nvidia providers, so do not shadow them
 * with models.providers unless custom provider override support is added.
 */
export function writeOpenClaw(
  model: Model,
  providerKey: string,
  apiKey: string | null = null,
  options: { persistApiKey?: boolean } = {},
) {
  const persistedApiKey = resolvePersistedApiKey(providerKey, apiKey, options);
  const meta = getProviderMeta(providerKey);
  const cfg = readJson(OPENCLAW_PATH);
  const qid = `${providerKey}/${model.id}`;

  if (persistedApiKey) {
    cfg.env ??= {};
    cfg.env[meta.envVar] = persistedApiKey;
  } else if (cfg.env?.[meta.envVar]) {
    delete cfg.env[meta.envVar];
    if (Object.keys(cfg.env).length === 0) delete cfg.env;
  }

  cfg.agents ??= {};
  cfg.agents.defaults ??= {};
  cfg.agents.defaults.model ??= {};
  cfg.agents.defaults.model.primary = qid;
  cfg.agents.defaults.models ??= {};
  cfg.agents.defaults.models[qid] = {};

  backupAndWriteJson(OPENCLAW_PATH, cfg);
  return OPENCLAW_PATH;
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function isTopLevelYamlKeyLine(line: string, key: string) {
  const prefix = `${key}:`;
  if (!line.startsWith(prefix)) return false;
  const suffix = line.slice(prefix.length).trim();
  return suffix === "" || suffix.startsWith("#");
}

function replaceTopLevelYamlBlock(source: string, key: string, block: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTopLevelYamlKeyLine(lines[i], key)) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    const trimmed = source.replace(/\s*$/, "");
    return `${trimmed}${trimmed ? "\n\n" : ""}${block}\n`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z0-9_-]+:\s*/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [...lines.slice(0, start), ...block.split("\n"), ...lines.slice(end)]
    .join("\n")
    .replace(/\n*$/, "\n");
}

export function writeHermesAgent(
  model: Model,
  providerKey: string,
  apiKey: string | null = null,
  options: { persistApiKey?: boolean } = {},
) {
  const persistedApiKey = resolvePersistedApiKey(providerKey, apiKey, options);
  const meta = getProviderMeta(providerKey);
  const current = existsSync(HERMES_CONFIG_PATH)
    ? readFileSync(HERMES_CONFIG_PATH, "utf8")
    : "";
  const modelBlock = [
    "model:",
    `  provider: ${yamlString(providerKey)}`,
    `  default: ${yamlString(model.id)}`,
  ].join("\n");

  backupAndWriteText(
    HERMES_CONFIG_PATH,
    replaceTopLevelYamlBlock(current, "model", modelBlock),
  );

  if (persistedApiKey) {
    setEnvFileValue(HERMES_ENV_PATH, meta.envVar, persistedApiKey);
  }

  return HERMES_CONFIG_PATH;
}
