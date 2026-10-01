// 系统设置页：登录验证 + 读写服务端 config.yaml
(function () {
  const $ = (id) => document.getElementById(id);
  let models = IT.FALLBACK_MODELS;
  let saved = null;

  function genKey() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return "sk-" + hex;
  }

  // 提示信息：设置后自动消失，避免常驻；重复操作时刷新为新提示
  function setStatus(el, message, kind, timeout) {
    if (!el) return;
    clearTimeout(el._statusTimer);
    el.textContent = message || "";
    el.className = "it-status" + (message && kind ? " " + kind : "");
    if (message) {
      el._statusTimer = setTimeout(() => {
        el.textContent = "";
        el.className = "it-status";
      }, timeout || (kind === "err" ? 4500 : 3000));
    }
  }

  function toast(message, kind) {
    setStatus($("it-status"), message, kind);
  }

  // ---------- 登录验证 ----------
  function showLogin(message) {
    $("loginCard").hidden = false;
    $("settingsCard").hidden = true;
    setStatus($("loginStatus"), message || "", message ? "err" : "");
  }

  function showSettings() {
    $("loginCard").hidden = true;
    $("settingsCard").hidden = false;
  }

  async function tryEnter(key) {
    if (key !== undefined) IT.setSettingsKey(key);
    try {
      const settings = await IT.getSettings();
      showSettings();
      applySettings(settings);
      return true;
    } catch (err) {
      if (err instanceof IT.SettingsAuthError) {
        IT.setSettingsKey("");
        showLogin(T("秘钥错误，请重试。", "Wrong key, please try again."));
      } else {
        showLogin(T("无法读取设置：", "Failed to load settings: ") + err.message);
      }
      return false;
    }
  }

  async function login() {
    const key = $("loginKey").value.trim();
    if (!key) {
      setStatus($("loginStatus"), T("请输入秘钥。", "Please enter the key."), "err");
      return;
    }
    if (await tryEnter(key)) {
      $("loginKey").value = "";
      setStatus($("loginStatus"), "", "");
    }
  }

  $("loginBtn").onclick = login;
  $("loginKey").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  // 重新输入时清除旧的错误提示
  $("loginKey").addEventListener("input", () => setStatus($("loginStatus"), "", ""));

  // ---------- API Key 列表 ----------
  function addKeyRow(value) {
    const row = document.createElement("div");
    row.className = "key-item";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "key-input";
    input.value = value || "";
    input.placeholder = "sk-...";
    input.autocomplete = "off";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "key-remove";
    remove.textContent = "×";
    remove.title = T("删除", "Remove");
    remove.onclick = () => {
      row.remove();
      if (!$("keys").children.length) addKeyRow("");
    };
    row.appendChild(input);
    row.appendChild(remove);
    $("keys").appendChild(row);
  }

  function renderKeys(keys) {
    $("keys").innerHTML = "";
    (keys && keys.length ? keys : [""]).forEach((key) => addKeyRow(key));
  }

  function collectKeys() {
    return Array.from(document.querySelectorAll("#keys .key-input"))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function syncAuthState() {
    const on = $("authEnabled").checked;
    $("keysField").classList.toggle("disabled", !on);
    $("keys").querySelectorAll("input").forEach((input) => (input.disabled = !on));
    $("addKey").disabled = !on;
    $("generateKey").disabled = !on;
  }

  // ---------- 下拉 ----------
  function fillModels(selected) {
    const select = $("defaultModel");
    select.innerHTML = "";
    // 前端只提供翻译模型；对话模型仅在 API 使用
    models.filter((model) => model.kind === "mt").forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.label;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    else if ([...select.options].some((option) => option.value === "index-mt-9b")) select.value = "index-mt-9b";
  }

  function fillLangs(sourceLang, targetLang) {
    const srcSel = $("defaultSrcLang");
    const tgtSel = $("defaultTgtLang");
    initLangSelects(srcSel, tgtSel, null);
    if (sourceLang) srcSel.value = sourceLang;
    if (targetLang) tgtSel.value = targetLang;
  }

  // ---------- 表单 <-> 配置 ----------
  function applySettings(settings) {
    saved = settings;
    if (Array.isArray(settings.models) && settings.models.length) models = settings.models;
    const auth = settings.auth || {};
    const defaults = settings.defaults || {};
    const upstream = settings.upstream || {};
    const server = settings.server || {};

    $("authEnabled").checked = auth.enabled !== false;
    renderKeys(auth.keys || []);
    $("settingsKey").value = auth.settingsKey || "";
    fillModels(defaults.model || "index-mt-9b");
    fillLangs(defaults.sourceLang || "auto", defaults.targetLang || "zh");
    $("upstreamBase").value = upstream.base || "";
    $("serverInfo").value = `:${server.port || 8787} · ${server.host || "0.0.0.0"}`;
    $("configPath").textContent = settings.configPath || "config.yaml";
    syncAuthState();
  }

  function collectPatch() {
    return {
      auth: {
        enabled: $("authEnabled").checked,
        keys: collectKeys(),
        settingsKey: $("settingsKey").value.trim(),
      },
      defaults: {
        model: $("defaultModel").value,
        sourceLang: $("defaultSrcLang").value,
        targetLang: $("defaultTgtLang").value,
      },
      upstream: { base: $("upstreamBase").value.trim() },
    };
  }

  async function save({ silent } = {}) {
    let next;
    try {
      next = await IT.saveSettings(collectPatch());
    } catch (err) {
      if (err instanceof IT.SettingsAuthError) {
        showLogin(T("登录已失效，请重新输入秘钥。", "Session expired, please log in again."));
        return null;
      }
      throw err;
    }
    IT.setSettingsKey((next.auth && next.auth.settingsKey) || "");
    await IT.getPublicConfig(true); // 让翻译页/连接测试拿到最新的 API Key
    applySettings(next);
    if (!silent) toast(T("已保存到 config.yaml。", "Saved to config.yaml."), "ok");
    return next;
  }

  // ---------- 事件 ----------
  $("authEnabled").addEventListener("change", syncAuthState);
  $("addKey").onclick = () => addKeyRow("");
  $("generateKey").onclick = () => {
    const rows = $("keys").querySelectorAll(".key-input");
    if (rows.length === 0) addKeyRow(genKey());
    else rows[rows.length - 1].value = genKey();
    toast(T("已生成随机 Key，点击保存生效。", "Random key generated. Click Save to apply."), "ok");
  };

  $("saveBtn").onclick = async () => {
    try {
      await save();
    } catch (err) {
      toast(T("保存失败：", "Save failed: ") + err.message, "err");
    }
  };

  $("testBtn").onclick = async () => {
    $("testBtn").disabled = true;
    try {
      await save({ silent: true });
      const apiKey = $("authEnabled").checked ? collectKeys()[0] || "" : "";
      const data = await IT.listModels(apiKey);
      const ids = (data.data || []).map((model) => model.id).join(", ");
      toast(T("连接成功，可用模型：", "Connected. Models: ") + ids, "ok");
    } catch (err) {
      toast(T("连接失败：", "Connection failed: ") + err.message, "err");
    } finally {
      $("testBtn").disabled = false;
    }
  };

  $("resetBtn").onclick = () => {
    $("authEnabled").checked = true;
    renderKeys([genKey()]);
    $("settingsKey").value = "admin";
    $("upstreamBase").value = "https://index-translate.bilibili.com";
    fillModels("index-mt-9b");
    $("defaultSrcLang").value = "auto";
    $("defaultTgtLang").value = "zh";
    syncAuthState();
    toast(T("已恢复默认设置，点击保存生效。", "Defaults restored. Click Save to apply."), "ok");
  };

  document.addEventListener("atlang", () => {
    fillModels(saved && saved.defaults ? saved.defaults.model : $("defaultModel").value);
    fillLangs($("defaultSrcLang").value || "auto", $("defaultTgtLang").value || "zh");
  });

  // ---------- 初始化 ----------
  (async () => {
    try {
      const settings = await IT.getSettings();
      showSettings();
      applySettings(settings);
    } catch (err) {
      if (err instanceof IT.SettingsAuthError) {
        // 首次进入或本地秘钥失效：仅展示登录框，不提示“秘钥错误”
        IT.setSettingsKey("");
        showLogin("");
        $("loginKey").focus();
      } else {
        showLogin(T("无法读取设置：", "Failed to load settings: ") + err.message);
      }
    }
  })();
})();
