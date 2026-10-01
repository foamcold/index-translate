// 语种表（与上游模型训练语种一致），常用 22 默认展示，可展开全部 100+
(function () {
  const COMMON_LANGS = ["en", "zh", "de", "fr", "es", "ja", "ko", "pt", "ru", "ar", "it", "nl", "pl", "ro", "sv", "tr", "hi", "vi", "th", "id", "ms", "fil"];
  const LANGS = {
    "en": "英语", "zh": "中文", "de": "德语", "fr": "法语", "es": "西班牙语", "ja": "日语",
    "ko": "韩语", "pt": "葡萄牙语", "ru": "俄语", "ar": "阿拉伯语", "it": "意大利语", "nl": "荷兰语",
    "pl": "波兰语", "ro": "罗马尼亚语", "sv": "瑞典语", "tr": "土耳其语", "hi": "印地语", "vi": "越南语",
    "th": "泰语", "id": "印尼语", "ms": "马来语", "fil": "菲律宾语", "eng_Latn": "英语", "zho_Hans": "中文",
    "ukr_Cyrl": "乌克兰语", "fas_Arab": "波斯语", "ces_Latn": "捷克语", "ell_Grek": "希腊语", "dan_Latn": "丹麦语", "hun_Latn": "匈牙利语",
    "fin_Latn": "芬兰语", "nob_Latn": "书面挪威语", "slk_Latn": "斯洛伐克语", "bul_Cyrl": "保加利亚语", "bos_Latn": "波斯尼亚语", "cat_Latn": "加泰罗尼亚语",
    "ben_Beng": "孟加拉语", "heb_Hebr": "希伯来语", "lit_Latn": "立陶宛语", "slv_Latn": "斯洛文尼亚语", "ekk_Latn": "爱沙尼亚语", "als_Latn": "阿尔巴尼亚语",
    "lvs_Latn": "拉脱维亚语", "azj_Latn": "阿塞拜疆语", "hrv_Latn": "克罗地亚语", "tam_Taml": "泰米尔语", "npi_Deva": "尼泊尔语", "urd_Arab": "乌尔都语",
    "mkd_Cyrl": "马其顿语", "srp_Cyrl": "塞尔维亚语（西里尔）", "mar_Deva": "马拉地语", "kat_Geor": "格鲁吉亚语", "mal_Mlym": "马拉雅拉姆语", "kaz_Cyrl": "哈萨克语",
    "isl_Latn": "冰岛语", "glg_Latn": "加利西亚语", "kan_Knda": "卡纳达语", "ary_Arab": "摩洛哥阿拉伯语", "guj_Gujr": "古吉拉特语", "bel_Cyrl": "白俄罗斯语",
    "afr_Latn": "南非荷兰语", "hye_Armn": "亚美尼亚语", "khk_Cyrl": "蒙古语", "khm_Khmr": "高棉语", "eus_Latn": "巴斯克语", "mya_Mymr": "缅甸语",
    "lat_Latn": "拉丁语", "uzn_Cyrl": "乌兹别克语（西里尔）", "tel_Telu": "泰卢固语", "ory_Orya": "奥里亚语", "nno_Latn": "新挪威语", "uzn_Latn": "乌兹别克语",
    "swh_Latn": "斯瓦希里语", "sin_Sinh": "僧伽罗语", "kir_Cyrl": "吉尔吉斯语", "som_Latn": "索马里语", "pan_Guru": "旁遮普语", "arz_Arab": "埃及阿拉伯语",
    "cym_Latn": "威尔士语", "nrm_Latn": "诺曼语", "pbt_Arab": "普什图语", "gle_Latn": "爱尔兰语", "srp_Latn": "塞尔维亚语（拉丁）", "hau_Latn": "豪萨语",
    "ckb_Arab": "中库尔德语", "mlt_Latn": "马耳他语", "yue_Hani": "粤语", "tgk_Cyrl": "塔吉克语", "kmr_Latn": "北库尔德语", "bew_Latn": "贝塔维语",
    "amh_Ethi": "阿姆哈拉语", "lao_Laoo": "老挝语", "ltz_Latn": "卢森堡语", "fry_Latn": "弗里西语", "div_Thaa": "迪维希语", "epo_Latn": "世界语",
    "kin_Latn": "卢旺达语", "ars_Arab": "内志阿拉伯语", "fao_Latn": "法罗语", "plt_Latn": "马达加斯加语", "asm_Beng": "阿萨姆语", "snd_Arab": "信德语",
    "xho_Latn": "科萨语", "tuk_Latn": "土库曼语", "hat_Latn": "海地克里奥尔语", "gla_Latn": "苏格兰盖尔语", "ceb_Latn": "宿务语", "ydd_Hebr": "意第绪语",
    "jav_Latn": "爪哇语", "bak_Cyrl": "巴什基尔语", "pap_Latn": "帕皮阿门托语", "mri_Latn": "毛利语", "uig_Arab": "维吾尔语", "tat_Cyrl": "鞑靼语",
    "bod_Tibt": "藏语", "mww_Latn": "白苗语", "hyw_Armn": "西亚美尼亚语", "yor_Latn": "约鲁巴语", "zul_Latn": "祖鲁语", "sdh_Arab": "南库尔德语",
    "smo_Latn": "萨摩亚语", "cos_Latn": "科西嘉语", "hif_Latn": "斐济印地语", "sun_Latn": "巽他语", "nya_Latn": "齐切瓦语", "ibo_Latn": "伊博语",
    "haw_Latn": "夏威夷语", "sot_Latn": "塞索托语", "lus_Latn": "米佐语", "sna_Latn": "绍纳语", "chv_Cyrl": "楚瓦什语", "azb_Arab": "南阿塞拜疆语",
    "roh_Latn": "罗曼什语", "run_Latn": "基隆迪语", "hin_Latn": "印地语（拉丁）", "sah_Cyrl": "雅库特语", "tir_Ethi": "提格利尼亚语", "ast_Latn": "阿斯图里亚斯语",
    "oci_Latn": "奥克语", "cnh_Latn": "钦语（哈卡）", "sme_Latn": "北萨米语", "nds_Latn": "低地德语", "oss_Cyrl": "奥塞梯语", "urd_Latn": "乌尔都语（拉丁）",
    "gsw_Latn": "瑞士德语", "anp_Deva": "昂加语", "apc_Arab": "黎凡特阿拉伯语", "gaz_Latn": "奥罗莫语", "nap_Latn": "那不勒斯语", "hsb_Latn": "上索布语",
    "hil_Latn": "希利盖农语", "kal_Latn": "格陵兰语", "pes_Arab": "波斯语", "yue_Hant": "粤语",
  };
  const LANGS_EN = {
    "en": "English", "zh": "Chinese", "de": "German", "fr": "French", "es": "Spanish", "ja": "Japanese",
    "ko": "Korean", "pt": "Portuguese", "ru": "Russian", "ar": "Arabic", "it": "Italian", "nl": "Dutch",
    "pl": "Polish", "ro": "Romanian", "sv": "Swedish", "tr": "Turkish", "hi": "Hindi", "vi": "Vietnamese",
    "th": "Thai", "id": "Indonesian", "ms": "Malay", "fil": "Filipino", "eng_Latn": "English", "zho_Hans": "Chinese",
    "ukr_Cyrl": "Ukrainian", "fas_Arab": "Persian", "ces_Latn": "Czech", "ell_Grek": "Greek", "dan_Latn": "Danish", "hun_Latn": "Hungarian",
    "fin_Latn": "Finnish", "nob_Latn": "Norwegian Bokmål", "slk_Latn": "Slovak", "bul_Cyrl": "Bulgarian", "bos_Latn": "Bosnian", "cat_Latn": "Catalan",
    "ben_Beng": "Bengali", "heb_Hebr": "Hebrew", "lit_Latn": "Lithuanian", "slv_Latn": "Slovenian", "ekk_Latn": "Estonian", "als_Latn": "Albanian",
    "lvs_Latn": "Latvian", "azj_Latn": "Azerbaijani", "hrv_Latn": "Croatian", "tam_Taml": "Tamil", "npi_Deva": "Nepali", "urd_Arab": "Urdu",
    "mkd_Cyrl": "Macedonian", "srp_Cyrl": "Serbian (Cyrillic)", "mar_Deva": "Marathi", "kat_Geor": "Georgian", "mal_Mlym": "Malayalam", "kaz_Cyrl": "Kazakh",
    "isl_Latn": "Icelandic", "glg_Latn": "Galician", "kan_Knda": "Kannada", "ary_Arab": "Moroccan Arabic", "guj_Gujr": "Gujarati", "bel_Cyrl": "Belarusian",
    "afr_Latn": "Afrikaans", "hye_Armn": "Armenian", "khk_Cyrl": "Mongolian", "khm_Khmr": "Khmer", "eus_Latn": "Basque", "mya_Mymr": "Burmese",
    "lat_Latn": "Latin", "uzn_Cyrl": "Uzbek (Cyrillic)", "tel_Telu": "Telugu", "ory_Orya": "Odia", "nno_Latn": "Norwegian Nynorsk", "uzn_Latn": "Uzbek",
    "swh_Latn": "Swahili", "sin_Sinh": "Sinhala", "kir_Cyrl": "Kyrgyz", "som_Latn": "Somali", "pan_Guru": "Punjabi", "arz_Arab": "Egyptian Arabic",
    "cym_Latn": "Welsh", "nrm_Latn": "Norman", "pbt_Arab": "Pashto", "gle_Latn": "Irish", "srp_Latn": "Serbian (Latin)", "hau_Latn": "Hausa",
    "ckb_Arab": "Central Kurdish", "mlt_Latn": "Maltese", "yue_Hani": "Cantonese", "tgk_Cyrl": "Tajik", "kmr_Latn": "Northern Kurdish", "bew_Latn": "Betawi",
    "amh_Ethi": "Amharic", "lao_Laoo": "Lao", "ltz_Latn": "Luxembourgish", "fry_Latn": "Frisian", "div_Thaa": "Dhivehi", "epo_Latn": "Esperanto",
    "kin_Latn": "Kinyarwanda", "ars_Arab": "Najdi Arabic", "fao_Latn": "Faroese", "plt_Latn": "Malagasy", "asm_Beng": "Assamese", "snd_Arab": "Sindhi",
    "xho_Latn": "Xhosa", "tuk_Latn": "Turkmen", "hat_Latn": "Haitian Creole", "gla_Latn": "Scottish Gaelic", "ceb_Latn": "Cebuano", "ydd_Hebr": "Yiddish",
    "jav_Latn": "Javanese", "bak_Cyrl": "Bashkir", "pap_Latn": "Papiamento", "mri_Latn": "Māori", "uig_Arab": "Uyghur", "tat_Cyrl": "Tatar",
    "bod_Tibt": "Tibetan", "mww_Latn": "Hmong Daw", "hyw_Armn": "Western Armenian", "yor_Latn": "Yoruba", "zul_Latn": "Zulu", "sdh_Arab": "Southern Kurdish",
    "smo_Latn": "Samoan", "cos_Latn": "Corsican", "hif_Latn": "Fiji Hindi", "sun_Latn": "Sundanese", "nya_Latn": "Chichewa", "ibo_Latn": "Igbo",
    "haw_Latn": "Hawaiian", "sot_Latn": "Sesotho", "lus_Latn": "Mizo", "sna_Latn": "Shona", "chv_Cyrl": "Chuvash", "azb_Arab": "South Azerbaijani",
    "roh_Latn": "Romansh", "run_Latn": "Rundi", "hin_Latn": "Hindi (Latin)", "sah_Cyrl": "Yakut", "tir_Ethi": "Tigrinya", "ast_Latn": "Asturian",
    "oci_Latn": "Occitan", "cnh_Latn": "Hakha Chin", "sme_Latn": "Northern Sami", "nds_Latn": "Low German", "oss_Cyrl": "Ossetian", "urd_Latn": "Urdu (Latin)",
    "gsw_Latn": "Swiss German", "anp_Deva": "Angika", "apc_Arab": "Levantine Arabic", "gaz_Latn": "Oromo", "nap_Latn": "Neapolitan", "hsb_Latn": "Upper Sorbian",
    "hil_Latn": "Hiligaynon", "kal_Latn": "Greenlandic", "pes_Arab": "Persian", "yue_Hant": "Cantonese",
  };

  function langName(code) {
    const en = typeof window.getUILang === "function" && window.getUILang() === "en";
    return (en ? LANGS_EN[code] : LANGS[code]) || LANGS[code] || code;
  }

  // 所有语种下拉的重新渲染函数，共用一个 atlang 监听，避免重复注册
  const populateFns = new Set();
  document.addEventListener("atlang", () => populateFns.forEach((fn) => fn()));

  function _opt(code, label) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    return option;
  }

  // srcSel 可为 null（无源语种下拉）；moreBtn 可为 null（始终全量）
  function initLangSelects(srcSel, tgtSel, moreBtn) {
    let full = false;
    const populate = () => {
      const prevSrc = srcSel ? srcSel.value || "auto" : null;
      const prevTgt = tgtSel.value || "zh";
      if (srcSel) srcSel.innerHTML = "";
      tgtSel.innerHTML = "";
      const fill = (select, withAuto) => {
        if (withAuto) select.appendChild(_opt("auto", typeof window.T === "function" ? window.T("自动检测", "Auto detect") : "自动检测"));
        if (full) {
          const common = document.createElement("optgroup");
          common.label = typeof window.T === "function" ? window.T("常用", "Common") : "常用";
          for (const code of COMMON_LANGS) common.appendChild(_opt(code, langName(code)));
          const more = document.createElement("optgroup");
          more.label = typeof window.T === "function" ? window.T("其他语种", "More languages") : "其他语种";
          for (const code of Object.keys(LANGS)) if (!COMMON_LANGS.includes(code)) more.appendChild(_opt(code, langName(code)));
          select.appendChild(common);
          select.appendChild(more);
        } else {
          for (const code of COMMON_LANGS) select.appendChild(_opt(code, langName(code)));
        }
      };
      if (srcSel) fill(srcSel, true);
      fill(tgtSel, false);
      if (srcSel) srcSel.value = [...srcSel.options].some((o) => o.value === prevSrc) ? prevSrc : "auto";
      tgtSel.value = [...tgtSel.options].some((o) => o.value === prevTgt) ? prevTgt : "zh";
      if (moreBtn) {
        moreBtn.textContent = full
          ? (typeof window.T === "function" ? window.T("－ 收起小语种", "－ Fewer languages") : "－ 收起小语种")
          : (typeof window.T === "function" ? window.T("＋ 全部语种 (100+)", "＋ All languages (100+)") : "＋ 全部语种 (100+)");
      }
    };
    populate();
    populateFns.add(populate);
    if (moreBtn) moreBtn.onclick = () => { full = !full; populate(); };
  }

  window.initLangSelects = initLangSelects;
  window.langName = langName;
  window.IT_LANGS = { COMMON_LANGS, LANGS, LANGS_EN };
})();
