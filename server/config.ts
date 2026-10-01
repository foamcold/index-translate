import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 配置文件路径，可用 CONFIG_PATH 覆盖（相对路径以项目根为基准）。 */
export const CONFIG_PATH = (() => {
  const fromEnv = process.env.CONFIG_PATH;
  if (!fromEnv) return join(ROOT, "config.yaml");
  return isAbsolute(fromEnv) ? fromEnv : join(ROOT, fromEnv);
})();

export interface AppConfig {
  server: {
    port: number;
    host: string;
    corsOrigin: string;
  };
  upstream: {
    base: string;
  };
  auth: {
    /** 是否启用 API Key 鉴权 */
    enabled: boolean;
    keys: string[];
    /** 系统设置页面的访问秘钥，默认 admin；置空则关闭设置页鉴权 */
    settingsKey: string;
  };
  defaults: {
    model: string;
    sourceLang: string;
    targetLang: string;
  };
}

export function generateApiKey(): string {
  return `sk-${randomBytes(24).toString("hex")}`;
}

export function defaultConfig(): AppConfig {
  return {
    server: {
      port: Number(process.env.PORT ?? 8787),
      host: "0.0.0.0",
      corsOrigin: "*",
    },
    upstream: {
      base: "https://index-translate.bilibili.com",
    },
    auth: {
      enabled: true,
      keys: [generateApiKey()],
      settingsKey: "admin",
    },
    defaults: {
      model: "index-mt-9b",
      sourceLang: "auto",
      targetLang: "zh",
    },
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((key): key is string => Boolean(key));
}

/** 把任意（可能是手写/残缺的）配置归一化为完整配置。 */
export function normalizeConfig(raw: unknown): AppConfig {
  const base = defaultConfig();
  const source = (raw ?? {}) as Record<string, unknown>;
  const server = (source.server ?? {}) as Record<string, unknown>;
  const upstream = (source.upstream ?? {}) as Record<string, unknown>;
  const auth = (source.auth ?? {}) as Record<string, unknown>;
  const defaults = (source.defaults ?? {}) as Record<string, unknown>;

  const parsedKeys = asKeys(auth.keys);
  const enabled = typeof auth.enabled === "boolean" ? auth.enabled : base.auth.enabled;
  const keys = parsedKeys.length > 0 ? parsedKeys : enabled ? [generateApiKey()] : [];
  // 字段缺失时用默认值 admin；显式置空字符串则关闭设置页鉴权
  const settingsKey =
    typeof auth.settingsKey === "string" ? auth.settingsKey.trim() : base.auth.settingsKey;

  return {
    server: {
      port: Number(server.port) > 0 ? Number(server.port) : base.server.port,
      host: asString(server.host) ?? base.server.host,
      corsOrigin: asString(server.corsOrigin) ?? base.server.corsOrigin,
    },
    upstream: {
      base: (asString(upstream.base) ?? base.upstream.base).replace(/\/+$/, ""),
    },
    auth: { enabled, keys, settingsKey },
    defaults: {
      model: asString(defaults.model) ?? base.defaults.model,
      sourceLang: asString(defaults.sourceLang) ?? base.defaults.sourceLang,
      targetLang: asString(defaults.targetLang) ?? base.defaults.targetLang,
    },
  };
}

function serialize(config: AppConfig): string {
  const header = [
    "# Index-Translate 配置文件",
    "# 由服务自动生成，也可通过 /settings 页面修改；手动修改后重启生效。",
    "",
  ].join("\n");
  return header + stringify(config, { lineWidth: 0 });
}

export function writeConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, serialize(config), "utf8");
}

let current: AppConfig | null = null;

/** 首次调用时加载配置文件；不存在则创建（默认开启鉴权并自动生成 Key）。 */
export function getConfig(): AppConfig {
  if (current) return current;

  if (!existsSync(CONFIG_PATH)) {
    const fresh = defaultConfig();
    writeConfig(fresh);
    current = fresh;
    return current;
  }

  try {
    const raw = parse(readFileSync(CONFIG_PATH, "utf8"));
    const config = normalizeConfig(raw);
    // 补齐缺失的 key 后回写，避免每次重启都重新生成
    const rawKeys = asKeys((raw as { auth?: { keys?: unknown } })?.auth?.keys);
    if (config.auth.enabled && rawKeys.length === 0) writeConfig(config);
    current = config;
  } catch (error) {
    console.error(`[config] 解析 ${CONFIG_PATH} 失败，使用默认配置：`, error);
    current = defaultConfig();
  }
  return current;
}

export interface ConfigPatch {
  server?: Partial<AppConfig["server"]>;
  upstream?: Partial<AppConfig["upstream"]>;
  auth?: Partial<AppConfig["auth"]>;
  defaults?: Partial<AppConfig["defaults"]>;
}

/** 合并并持久化配置，立即生效（端口/监听地址需重启）。 */
export function updateConfig(patch: ConfigPatch): AppConfig {
  const config = getConfig();
  const merged = normalizeConfig({
    server: { ...config.server, ...patch.server },
    upstream: { ...config.upstream, ...patch.upstream },
    auth: { ...config.auth, ...patch.auth },
    defaults: { ...config.defaults, ...patch.defaults },
  });
  if (merged.auth.enabled && merged.auth.keys.length === 0) {
    merged.auth.keys = [generateApiKey()];
  }
  writeConfig(merged);
  current = merged;
  return current;
}
