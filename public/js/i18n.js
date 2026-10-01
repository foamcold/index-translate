// 全站中英切换：静态文本 data-en / data-en-ph / data-en-title；动态文本 T(zh,en)
// 切换后派发 atlang 事件，页面按需重渲染
(function () {
  const AT_LANG_KEY = "at-lang";

  function getUILang() {
    try {
      const sp = new URLSearchParams(location.search);
      const urlLang = sp.get("lang");
      if (urlLang === "zh" || urlLang === "zh-CN") {
        localStorage.setItem(AT_LANG_KEY, "zh");
        return "zh";
      }
      if (urlLang === "en") {
        localStorage.setItem(AT_LANG_KEY, "en");
        return "en";
      }
      return localStorage.getItem(AT_LANG_KEY) || "zh";
    } catch {
      return "zh";
    }
  }

  function T(zh, en) {
    return getUILang() === "en" ? en : zh;
  }

  function applyUILang(lang) {
    try {
      localStorage.setItem(AT_LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-en]").forEach((el) => {
      if (el.dataset.zh === undefined) el.dataset.zh = el.innerHTML;
      el.innerHTML = lang === "en" ? el.dataset.en : el.dataset.zh;
    });
    document.querySelectorAll("[data-en-ph]").forEach((el) => {
      if (el.dataset.zhPh === undefined) el.dataset.zhPh = el.placeholder;
      el.placeholder = lang === "en" ? el.dataset.enPh : el.dataset.zhPh;
    });
    document.querySelectorAll("[data-en-title]").forEach((el) => {
      if (el.dataset.zhTitle === undefined) el.dataset.zhTitle = el.title;
      el.title = lang === "en" ? el.dataset.enTitle : el.dataset.zhTitle;
    });
    document.querySelectorAll(".at-lang-btn").forEach((b) =>
      b.classList.toggle("on", b.dataset.setlang === lang),
    );
    const url = new URL(location.href);
    if (url.searchParams.has("lang") && url.searchParams.get("lang") !== lang) {
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url.toString());
    }
    document.dispatchEvent(new CustomEvent("atlang", { detail: lang }));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".at-lang-btn");
    if (btn && btn.dataset.setlang) applyUILang(btn.dataset.setlang);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyUILang(getUILang()));
  } else {
    applyUILang(getUILang());
  }

  window.getUILang = getUILang;
  window.T = T;
  window.applyUILang = applyUILang;
})();
