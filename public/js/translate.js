// 文本翻译页：复刻上游交互，底层调用本站 OpenAI 兼容接口 /v1/chat/completions
(function () {
  const $ = (id) => document.getElementById(id);
  const src = $("src");
  const out = $("out");
  let abortController = null;
  let models = IT.FALLBACK_MODELS;
  let settings = null;

  // ---------- 模型选择器 ----------
  function shortId(id) {
    const match = id.match(/-(\d+b)$/i);
    return match ? match[1].toUpperCase() : id;
  }

  function fillSeg(containerId, list) {
    const container = $(containerId);
    container.innerHTML = "";
    list.forEach((model) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.m = model.id;
      const prefix = model.kind === "mt" ? "Index-Translate-" : "Index-Chat-";
      const moe = model.id.endsWith("35b") ? '<span class="m-moe">-A3B</span>' : "";
      const tag = model.tag ? `<span class="tag">${T(model.tag.zh, model.tag.en)}</span>` : "";
      button.innerHTML = `<span class="m-prefix">${prefix}</span>${shortId(model.id)}${moe}${tag}`;
      button.onclick = () => setModel(model.id);
      container.appendChild(button);
    });
  }

  function renderModels() {
    // 主页仅展示翻译模型，保持与原网页一致；对话模型仅在 API 提供
    const mtModels = models.filter((model) => model.kind === "mt");
    fillSeg("modelSeg", mtModels);
    const select = $("model");
    select.innerHTML = "";
    mtModels.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      select.appendChild(option);
    });
  }

  function setModel(id) {
    $("model").value = id;
    document.querySelectorAll("#modelSeg button").forEach((button) => {
      button.classList.toggle("on", button.dataset.m === id);
    });
    const model = models.find((item) => item.id === id);
    const label = model ? model.label : id;
    const byEl = $("instructBy");
    if (byEl) {
      byEl.dataset.zh = `由 ${label} 提供`;
      byEl.dataset.en = `served by ${label}`;
      byEl.textContent = getUILang() === "en" ? byEl.dataset.en : byEl.dataset.zh;
    }
  }

  function currentModel() {
    const id = $("model").value;
    return models.find((model) => model.id === id) || { id, kind: "mt", label: id };
  }

  // ---------- 语种下拉 ----------
  initLangSelects($("srcLang"), $("tgtLang"), $("moreLang"));

  function syncPaneLabs() {
    const s = $("srcLang");
    const t = $("tgtLang");
    $("srcLab").textContent = s.value === "auto" ? T("自动检测", "Auto detect") : s.selectedOptions[0].textContent;
    $("tgtLab").textContent = t.selectedOptions[0].textContent;
  }
  $("srcLang").addEventListener("change", syncPaneLabs);
  $("tgtLang").addEventListener("change", syncPaneLabs);
  syncPaneLabs();

  // ---------- 指令面板折叠 / 自动长高 ----------
  $("instructHead").onclick = () => {
    const body = $("instructBody");
    const open = body.style.display === "none";
    body.style.display = open ? "" : "none";
    $("instructCaret").textContent = open ? "▴" : "▾";
  };
  const insTa = $("instruct");
  const growIns = () => {
    insTa.style.height = "auto";
    insTa.style.height = Math.min(insTa.scrollHeight, 320) + "px";
  };
  insTa.addEventListener("input", growIns);

  $("instruct").addEventListener("input", () => {
    const on = !!$("instruct").value.trim();
    $("row1").classList.toggle("instruct-on", on);
    // 2B 不擅长指令遵循，自动升到对应的 9B
    if (on) {
      const current = $("model").value;
      if (current.endsWith("-2b")) setModel(current.replace("-2b", "-9b"));
    }
  });

  // ---------- 快捷预设 Case ----------
  const INST_CASES = [
    { name: "敬体日语", en: "Polite Japanese", srcLang: "zh", tgtLang: "ja",
      ins: "把下面的文本翻译成日语，使用敬体(です・ます调)，语气客气得体。",
      ins_en: "Translate the following text into Japanese, using polite register (desu/masu form) and a courteous tone.",
      text: "我明天想去东京塔看夜景，请问从这里出发怎么走最方便？" },
    { name: "保留 Markdown", en: "Keep Markdown", srcLang: "zh", tgtLang: "en",
      ins: "将以下文本翻译为英文，严格保留所有 Markdown 格式（标题、加粗、列表）。",
      ins_en: "Translate the following text into English, strictly keeping all Markdown formatting (headings, bold, lists) intact.",
      text: "# 产品特性\n\n**Index-Translate** 核心优势：\n\n- 支持 *100+ 语言* 互译\n- 深度遵循格式与语气约束\n- 准确理解网络俚语与文化热梗" },
    { name: "JSON 格式输出", en: "JSON Output", srcLang: "zh", tgtLang: "en",
      ins: "将以下文本翻译为英文，以合法的 JSON 格式输出，包含 source、translation 和 confidence 三个字段，不要包含其他说明。",
      ins_en: "Translate the following text into English, outputting valid JSON with fields: source, translation, and confidence. Do not include any other explanations.",
      text: "每一句表达，都值得被认真对待。" },
    { name: "数字转英文单词", en: "Numbers as Words", srcLang: "zh", tgtLang: "en",
      ins: "把下面的文本翻译成英语，并将译文中所有的阿拉伯数字全部拼写为英文单词。",
      ins_en: "Translate the following text into English, and spell out all Arabic numerals as English words.",
      text: "这间实验室里有3位研究员，管理着24台GPU服务器和100多个实验任务。" },
    { name: "指定术语约束", en: "Custom Glossary", srcLang: "zh", tgtLang: "en",
      ins: "翻译为英文，严格遵守术语规则：“大模型”必须译为“Frontier Model”，“落地”必须译为“Production Deployment”。",
      ins_en: "Translate into English, strictly adhering to terminology: '大模型' must be translated as 'Frontier Model', and '落地' must be translated as 'Production Deployment'.",
      text: "我们研发的全新大模型已经在多项业务场景中完成了规模化落地。" },
  ];

  const MEME_CASES = [
    { name: "白嫖与入库吃灰", en: "Gaming Freebies", srcLang: "zh", tgtLang: "en",
      ins: "请将这段游戏社区热帖翻译成地道、风趣的英语口语。“喜加一”指领取免费游戏，“白嫖”指零元白拿，“入库吃灰”指领了丢库里从不玩，“e宝”指 Epic Games 平台。",
      ins_en: "Translate this gaming community post into natural, witty English slang. '喜加一' means grabbing a free game, '白嫖' means freeloading, '入库吃灰' means letting it gather dust in your library, and 'e宝' refers to Epic Games.",
      text: "xdm关于e宝的喜加一活动，静观其变，白嫖就好，入库吃灰，能要就要！" },
    { name: "遥遥领先", en: "Far Ahead Meme", srcLang: "zh", tgtLang: "en",
      ins: "翻译成地道英语口语，保留原句中极具调侃喜感的科技圈网络热梗“遥遥领先”，语气生动自信。",
      ins_en: "Translate into idiomatic English, keeping the humorous buzzword vibe of '遥遥领先' (miles ahead) from Chinese tech circles with a lively, confident tone.",
      text: "新旗舰发布会刚开完，同行还在画PPT，我们的现货跑分和续航已经遥遥领先了！" },
    { name: "泰裤辣与绝绝子", en: "Gen-Z Slang", srcLang: "zh", tgtLang: "en",
      ins: "把以下当代网络流行语翻译为地道、自然的英语年轻人俚语（Gen-Z Slang），传达出夸张、喜悦的情绪氛围。",
      ins_en: "Translate these modern internet buzzwords into natural Gen-Z English slang, conveying an exaggerated sense of hype and joy.",
      text: "家人们谁懂啊！今天竟然抢到了线下内测资格，这波操作简直绝绝子，太酷啦！" },
    { name: "疯狂星期四", en: "Crazy Thursday", srcLang: "zh", tgtLang: "en",
      ins: "将这篇发疯文学段子翻译成地道英语。注意：“疯狂星期四，v我50”是经典网络反转梗，译文需保留前面严肃深沉、结尾突然无厘头求请客的反差喜感。",
      ins_en: "Translate this copypasta into natural English. 'Crazy Thursday, send me $50' is a classic meme with a dramatic buildup followed by an absurd request. Preserve the deadpan comedic contrast.",
      text: "其实我隐姓埋名这么多年，一直在暗中拯救世界，但现在能量快耗尽了。今天是疯狂星期四，谁v我50吃个炸鸡，明天我带你飞。" },
    { name: "打工人与摸鱼", en: "Workplace Slang", srcLang: "zh", tgtLang: "en",
      ins: "翻译为地道日常英语。“打工人”为自嘲努力工作的人，“摸鱼”指工作时间划水偷闲，“带薪拉屎”指利用上厕所偷得浮生半日闲。",
      ins_en: "Translate into idiomatic, humorous English. '打工人' refers to everyday wage-earning grinders, '摸鱼' means slacking off at work, and '带薪拉屎' refers to getting paid to poop on company time.",
      text: "早安打工人！今天也要保持好心态，适度摸鱼，享受带薪拉屎的快乐，下班准时开溜。" },
  ];

  function renderCaseChips(containerId, cases) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = "";
    cases.forEach((c) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = T(c.name, c.en);
      button.onclick = () => {
        document.querySelectorAll(".chip").forEach((el) => el.classList.remove("active"));
        button.classList.add("active");
        $("instruct").value = getUILang() === "en" && c.ins_en ? c.ins_en : c.ins;
        src.value = c.text;
        if (c.srcLang) $("srcLang").value = c.srcLang;
        if (c.tgtLang) $("tgtLang").value = c.tgtLang;
        syncPaneLabs();
        growIns();
        $("instruct").dispatchEvent(new Event("input"));
        src.dispatchEvent(new Event("input"));
        if ($("instructBody").style.display === "none") $("instructHead").click();
      };
      container.appendChild(button);
    });
  }
  renderCaseChips("chips-inst", INST_CASES);
  renderCaseChips("chips-meme", MEME_CASES);

  src.addEventListener("input", () => {
    $("charCount").textContent = `${src.value.length} / 8,000`;
  });

  // ---------- 界面语言切换 ----------
  document.addEventListener("atlang", () => {
    syncPaneLabs();
    if (out.classList.contains("empty")) out.textContent = T("译文将在这里呈现", "Translation will appear here");
    if (!$("status").dataset.busy) $("status").textContent = T("等待输入", "Waiting for input");
    renderCaseChips("chips-inst", INST_CASES);
    renderCaseChips("chips-meme", MEME_CASES);
    renderModels();
    setModel($("model").value);
  });

  // ---------- 交换语种 ----------
  $("swapBtn").onclick = () => {
    const s = $("srcLang");
    const t = $("tgtLang");
    if (s.value === "auto") s.value = t.value;
    else [s.value, t.value] = [t.value, s.value];
    syncPaneLabs();
    if (out.textContent && !out.classList.contains("empty")) {
      src.value = out.textContent;
      out.textContent = T("译文将在这里呈现", "Translation will appear here");
      out.classList.add("empty");
      $("charCount").textContent = `${src.value.length} / 8,000`;
    }
  };

  $("copyBtn").onclick = async () => {
    await navigator.clipboard.writeText(out.textContent);
    $("copyBtn").textContent = T("已复制", "Copied");
    setTimeout(() => ($("copyBtn").textContent = T("⧉ 复制译文", "⧉ Copy")), 1200);
  };
  $("pasteBtn").onclick = async () => {
    src.value = await navigator.clipboard.readText();
    src.dispatchEvent(new Event("input"));
  };
  $("clear").onclick = () => {
    src.value = "";
    $("instruct").value = "";
    growIns();
    $("instruct").dispatchEvent(new Event("input"));
    out.textContent = T("译文将在这里呈现", "Translation will appear here");
    out.classList.add("empty");
    src.dispatchEvent(new Event("input"));
    $("meta").textContent = "";
    $("status").textContent = T("等待输入", "Waiting for input");
    delete $("status").dataset.busy;
    document.querySelectorAll(".chip").forEach((el) => el.classList.remove("active"));
  };

  src.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") $("go").click();
  });

  // ---------- 翻译主流程 ----------
  $("go").onclick = async () => {
    const text = src.value.trim();
    const instruct = $("instruct").value.trim();
    if (!text && !instruct) return;

    const btn = $("go");
    btn.disabled = true;
    btn.querySelector("span").textContent = T("翻译中…", "Translating…");
    out.textContent = "";
    out.classList.remove("empty");
    out.classList.add("cursor");
    $("status").textContent = instruct ? T("指令模式", "Instruction mode") : T("翻译中…", "Translating…");
    $("status").dataset.busy = "1";
    $("meta").textContent = "";

    const model = currentModel();
    const t0 = performance.now();
    let firstTokenAt = null;

    // 完全复刻原网页：普通翻译走 translate_stream，指令模式走 chat/completions，均为直连上游
    const isInstruction = !!instruct;
    const endpoint = isInstruction ? "/v1/chat/completions" : "/translate_stream";
    const body = isInstruction
      ? {
          model: model.id, stream: true, temperature: 0.3,
          max_tokens: Math.max(1024, text.length * 3),
          chat_template_kwargs: { enable_thinking: false },
          messages: [{ role: "user", content: instruct + (text ? "\n\n" + text : "") }],
        }
      : {
          model: model.id, stream: true,
          source_lang: $("srcLang").value,
          target_lang: $("tgtLang").value,
          text,
        };

    abortController = new AbortController();
    try {
      const resp = await IT.upstreamFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
      if (!resp.ok) throw new Error(await IT.readError(resp));
      if (!resp.body) throw new Error("Empty response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            if (chunk.error) throw new Error(typeof chunk.error === "string" ? chunk.error : chunk.error.message);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
            if (delta) {
              if (firstTokenAt === null) firstTokenAt = performance.now();
              out.textContent += delta;
            }
          } catch (err) {
            if (err.message && !err.message.startsWith("Unexpected")) throw err;
          }
        }
      }

      const total = ((performance.now() - t0) / 1000).toFixed(2);
      const ttft = firstTokenAt ? ((firstTokenAt - t0) / 1000).toFixed(2) : "-";
      $("meta").textContent =
        T(`首 token ${ttft}s · 总耗时 ${total}s`, `first token ${ttft}s · total ${total}s`) + ` · ${model.id}`;
      $("status").textContent = T("已完成", "Done");
    } catch (err) {
      if (err.name === "AbortError") {
        $("status").textContent = T("已取消", "Cancelled");
      } else {
        const hint = /failed to fetch|networkerror|load failed/i.test(err.message)
          ? T("（请检查网络或上游服务是否可达）", " (check network / upstream availability)")
          : "";
        out.textContent = T("请求失败：", "Request failed: ") + err.message + hint;
        $("status").textContent = T("等待输入", "Waiting for input");
      }
    } finally {
      out.classList.remove("cursor");
      delete $("status").dataset.busy;
      btn.disabled = false;
      btn.querySelector("span").textContent = T("开始翻译", "Translate");
      abortController = null;
    }
  };

  // ---------- 初始化：从服务端读取模型与默认偏好 ----------
  (async () => {
    settings = await IT.getPublicConfig();
    if (Array.isArray(settings.models) && settings.models.length) models = settings.models;
    renderModels();

    const defaults = settings.defaults || {};
    const defaultModel = models.some((model) => model.id === defaults.model && model.kind === "mt")
      ? defaults.model
      : "index-mt-9b";
    setModel(defaultModel);
    if (defaults.sourceLang) $("srcLang").value = defaults.sourceLang;
    if (defaults.targetLang) $("tgtLang").value = defaults.targetLang;
    syncPaneLabs();
  })();
})();
