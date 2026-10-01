// 站内公共工具
// · 公开配置走 /api/public（模型、默认偏好、上游地址，不含任何密钥）
// · 翻译页直接请求上游（浏览器 → 上游，不经本站中转、不需要 API Key）
// · 系统设置读写走 /api/settings，需要设置页秘钥（X-Settings-Key）
(function () {
  const API_BASE = window.location.origin;
  const DEFAULT_UPSTREAM = "https://index-translate.bilibili.com";
  const SETTINGS_KEY_STORAGE = "it-settings-key";

  const FALLBACK_MODELS = [
    { id: "index-mt-2b", label: "Index-Translate-2B", kind: "mt", tag: { zh: "快", en: "fast" } },
    { id: "index-mt-9b", label: "Index-Translate-9B", kind: "mt", tag: { zh: "均衡", en: "balanced" } },
    { id: "index-mt-35b", label: "Index-Translate-35B-A3B", kind: "mt", tag: { zh: "preview", en: "preview" } },
    { id: "index-chat-2b", label: "Index-Chat-2B", kind: "chat", tag: { zh: "快", en: "fast" } },
    { id: "index-chat-9b", label: "Index-Chat-9B", kind: "chat", tag: { zh: "均衡", en: "balanced" } },
    { id: "index-chat-35b", label: "Index-Chat-35B-A3B", kind: "chat", tag: { zh: "preview", en: "preview" } },
  ];

  const FALLBACK_PUBLIC = {
    models: FALLBACK_MODELS,
    defaults: { model: "index-mt-9b", sourceLang: "auto", targetLang: "zh" },
    upstream: { base: DEFAULT_UPSTREAM },
    auth: { enabled: false },
    settingsProtected: true,
  };

  let publicCache = null;

  class SettingsAuthError extends Error {
    constructor() {
      super("unauthorized");
      this.name = "SettingsAuthError";
      this.code = 401;
    }
  }

  function readError(resp) {
    return resp
      .clone()
      .json()
      .then((data) => (data && data.error && data.error.message ? data.error.message : JSON.stringify(data)))
      .catch(() => resp.text().then((t) => t.slice(0, 300)).catch(() => "HTTP " + resp.status));
  }

  // ---------- 设置页秘钥 ----------
  function getSettingsKey() {
    try {
      return localStorage.getItem(SETTINGS_KEY_STORAGE) || "";
    } catch {
      return "";
    }
  }

  function setSettingsKey(key) {
    try {
      if (key) localStorage.setItem(SETTINGS_KEY_STORAGE, key);
      else localStorage.removeItem(SETTINGS_KEY_STORAGE);
    } catch {
      /* ignore */
    }
  }

  function settingsHeaders(extra) {
    const key = getSettingsKey();
    return Object.assign(extra || {}, key ? { "X-Settings-Key": key } : {});
  }

  // ---------- 公开配置 ----------
  async function getPublicConfig(force) {
    if (publicCache && !force) return publicCache;
    try {
      const resp = await fetch(API_BASE + "/api/public");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      publicCache = await resp.json();
    } catch (err) {
      publicCache = Object.assign({}, FALLBACK_PUBLIC, { error: err.message });
    }
    return publicCache;
  }

  // ---------- 直连上游（与原始网页一致，无中转、无密钥） ----------
  async function upstreamFetch(path, init) {
    const config = await getPublicConfig();
    const base = ((config.upstream && config.upstream.base) || DEFAULT_UPSTREAM).replace(/\/+$/, "");
    return fetch(`${base}/?p=${encodeURIComponent(path)}`, init);
  }

  // ---------- 本站 OpenAI 兼容接口（供外部客户端；设置页测试用） ----------
  async function listModels(apiKey) {
    const headers = {};
    if (apiKey) headers.Authorization = "Bearer " + apiKey;
    const resp = await fetch(API_BASE + "/v1/models", { headers });
    if (!resp.ok) throw new Error(await readError(resp));
    return resp.json();
  }

  // ---------- 系统设置读写 ----------
  async function getSettings() {
    const resp = await fetch(API_BASE + "/api/settings", { headers: settingsHeaders() });
    if (resp.status === 401) throw new SettingsAuthError();
    if (!resp.ok) throw new Error(await readError(resp));
    return resp.json();
  }

  async function saveSettings(patch) {
    const resp = await fetch(API_BASE + "/api/settings", {
      method: "POST",
      headers: settingsHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    });
    if (resp.status === 401) throw new SettingsAuthError();
    if (!resp.ok) throw new Error(await readError(resp));
    return resp.json();
  }

  window.IT = {
    API_BASE,
    DEFAULT_UPSTREAM,
    FALLBACK_MODELS,
    getPublicConfig,
    upstreamFetch,
    listModels,
    getSettings,
    saveSettings,
    getSettingsKey,
    setSettingsKey,
    SettingsAuthError,
    readError,
  };
})();
