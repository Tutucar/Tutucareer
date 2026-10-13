// store.js —— 本地数据层。所有数据存 chrome.storage.local，绝不联网。
// 数据结构：
//   state = { templates: [Template], activeId: string }
//   Template = { id, name, entries: [Entry] }
//   Entry    = { id, label, keywords: [string], formats: [Format], defaultFormatId }
//   Format   = { id, note, value }   // 同一信息的不同写法，note 是格式说明（如"YYYY-MM-DD"），value 是具体内容
window.Store = (function () {
  const KEY = "qa_state_v2";

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function newFormat(value = "", note = "") { return { id: uid(), note, value }; }

  function newEntry(label, keywords, value = "") {
    const f = newFormat(value, "");
    return { id: uid(), label, keywords: keywords ? keywords.slice() : [label], formats: [f], defaultFormatId: f.id };
  }

  function newTemplate(name) {
    const seeds = (window.SEED_ENTRIES || []).map(s => newEntry(s.label, s.keywords, ""));
    return { id: uid(), name: name || "默认模板", entries: seeds };
  }

  async function load() {
    const res = await chrome.storage.local.get(KEY);
    let state = res[KEY];
    if (!state || !Array.isArray(state.templates) || !state.templates.length) {
      const t = newTemplate("默认模板");
      state = { templates: [t], activeId: t.id };
      await save(state);
    }
    if (!state.templates.find(t => t.id === state.activeId)) {
      state.activeId = state.templates[0].id;
    }
    return state;
  }

  async function save(state) {
    await chrome.storage.local.set({ [KEY]: state });
  }

  function activeTemplate(state) {
    return state.templates.find(t => t.id === state.activeId) || state.templates[0];
  }

  // 取条目当前应使用的值：优先 defaultFormat，否则第一个非空
  function entryValue(entry, preferFormatId) {
    if (!entry || !entry.formats || !entry.formats.length) return "";
    if (preferFormatId) {
      const f = entry.formats.find(x => x.id === preferFormatId);
      if (f && f.value) return f.value;
    }
    const def = entry.formats.find(f => f.id === entry.defaultFormatId);
    if (def && def.value) return def.value;
    const first = entry.formats.find(f => f.value);
    return first ? first.value : "";
  }

  return { KEY, uid, newFormat, newEntry, newTemplate, load, save, activeTemplate, entryValue };
})();
