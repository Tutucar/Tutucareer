// popup.js —— 主交互：自动扫描本页 → 匹配资料库 → 展示清单 → 填入网页 → 学习新项目。
const $ = (s) => document.querySelector(s);
const listEl = $("#list");
const msgEl = $("#msg");
const statusEl = $("#status");
const emptyHint = $("#emptyHint");
const tplSelect = $("#tplSelect");

let state = null;         // 全局数据
let tpl = null;           // 当前模板
let controls = [];        // 本页扫描到的控件
let rows = [];            // 清单渲染数据：{control, entry, value, isNew, learn, formatNote}
let tabId = null;

function showMsg(text, type = "ok") {
  msgEl.textContent = text; msgEl.className = "msg " + type;
  if (text) setTimeout(() => { if (msgEl.textContent === text) { msgEl.textContent = ""; msgEl.className = "msg"; } }, 3000);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------- 初始化 ----------
async function init() {
  state = await Store.load();
  renderTplSelect();
  tpl = Store.activeTemplate(state);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:|^file:/.test(tab.url || "")) {
    statusEl.textContent = "当前不是可填写的网页。请在报价网站上使用。";
    return;
  }
  tabId = tab.id;
  await scan();
}

function renderTplSelect() {
  tplSelect.innerHTML = state.templates.map(t =>
    `<option value="${t.id}" ${t.id === state.activeId ? "selected" : ""}>${esc(t.name)}</option>`).join("");
}

// ---------- 扫描本页 ----------
async function scan() {
  statusEl.textContent = "正在扫描本页…";
  listEl.innerHTML = ""; emptyHint.hidden = true;
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true }, files: ["scanner.js"]
    });
  } catch (e) {
    statusEl.textContent = "无法扫描此页面：" + (e.message || e);
    return;
  }
  // 合并所有 frame 的结果，并给跨 frame 的 idx 去重后重新编号
  controls = [];
  results.forEach((r, fi) => {
    if (Array.isArray(r.result)) r.result.forEach(c => {
      controls.push({ ...c, frame: fi });
    });
  });
  if (!controls.length) { statusEl.textContent = ""; emptyHint.hidden = false; return; }

  const { matched, unmatched } = Matcher.run(controls, tpl.entries);
  // 组装清单行
  rows = [];
  for (const m of matched) {
    rows.push({
      control: m.control, entry: m.entry, value: m.value, isNew: false,
      learn: false, formatNote: m.format ? (m.format.note || "") : "", bySource: "rule"
    });
  }

  // AI 补一轮：把规则没认出的字段交给大模型做语义归类（仅在已配置并开启时）
  let aiUsed = false, aiMatchedControls = new Set();
  try {
    if (await AI.isEnabled() && unmatched.length) {
      statusEl.textContent = "规则匹配完成，正在用 AI 识别其余字段…";
      const suggestions = await AI.suggest(unmatched, tpl.entries);
      aiUsed = true;
      for (const s of suggestions) {
        const val = Store.entryValue(s.entry);
        rows.push({
          control: s.control, entry: s.entry, value: val, isNew: false,
          learn: false, formatNote: "", bySource: "ai"
        });
        aiMatchedControls.add(s.control);
      }
    }
  } catch (e) {
    showMsg("AI 识别失败：" + (e.message || e) + "（已回退为纯规则匹配）", "err");
  }

  // 剩下 AI 也没认出的，才算新项目
  for (const c of unmatched) {
    if (aiMatchedControls.has(c)) continue;
    rows.push({ control: c, entry: null, value: "", isNew: true, learn: true, formatNote: "", bySource: "rule" });
  }
  // 维持页面顺序
  rows.sort((a, b) => controls.indexOf(a.control) - controls.indexOf(b.control));

  const autoCount = rows.filter(r => !r.isNew && r.value).length;
  const aiCount = rows.filter(r => r.bySource === "ai" && r.value).length;
  const newCount = rows.filter(r => r.isNew).length;
  statusEl.innerHTML = `本页共 <b>${controls.length}</b> 项：已自动匹配 <b>${autoCount}</b> 项` +
    (aiCount ? `（含 AI 识别 <b>${aiCount}</b> 项）` : "") +
    (newCount ? `，发现 <b>${newCount}</b> 个新项目（下方可填写并学习）` : "") +
    (aiUsed && !aiCount ? "，AI 未发现可补充的字段" : "");
  renderList();
}

// ---------- 渲染清单 ----------
function renderList() {
  listEl.innerHTML = "";
  rows.forEach((row, i) => {
    const c = row.control;
    const div = document.createElement("div");
    div.className = "scan-row" + (row.isNew ? " is-new" : "") + (!row.isNew && !row.value ? " is-empty" : "");

    const typeBadge = row.isNew
      ? `<span class="badge badge-new">新项目</span>`
      : (row.bySource === "ai"
          ? `<span class="badge badge-ai" title="由 AI 语义识别，请重点核对">AI 识别</span>`
          : (row.value ? `<span class="badge badge-ok">已匹配</span>` : `<span class="badge badge-empty">库中无值</span>`));

    // 多格式下拉（仅已匹配且该条目有多个格式时显示）
    let fmtSelect = "";
    if (!row.isNew && row.entry && row.entry.formats.filter(f => f.value).length > 1) {
      const opts = row.entry.formats.filter(f => f.value).map(f =>
        `<option value="${f.id}" ${f.value === row.value ? "selected" : ""}>${esc(f.value)}${f.note ? "（" + esc(f.note) + "）" : ""}</option>`).join("");
      fmtSelect = `<select class="fmt-select" data-i="${i}" title="该信息有多种格式，自动挑选，可手动切换">${opts}</select>`;
    }

    div.innerHTML = `
      <div class="sr-head">
        <span class="sr-title" title="${esc(c.hints)}">${esc(c.title)}</span>
        ${typeBadge}
      </div>
      <div class="sr-body">
        <input type="text" class="sr-value" data-i="${i}" value="${esc(row.value)}" placeholder="${esc(c.placeholder || '在此填写内容')}">
        ${fmtSelect}
      </div>
      ${row.isNew ? `
      <label class="sr-learn"><input type="checkbox" class="learn-chk" data-i="${i}" ${row.learn ? "checked" : ""}> 学习：把「${esc(c.title)}」存入资料库，下次自动认识</label>
      ` : ""}
    `;
    listEl.appendChild(div);
  });

  listEl.querySelectorAll(".sr-value").forEach(inp => inp.addEventListener("input", e => {
    rows[+e.target.dataset.i].value = e.target.value;
  }));
  listEl.querySelectorAll(".fmt-select").forEach(sel => sel.addEventListener("change", e => {
    const row = rows[+e.target.dataset.i];
    const f = row.entry.formats.find(x => x.id === e.target.value);
    if (f) { row.value = f.value; const inp = listEl.querySelector(`.sr-value[data-i="${e.target.dataset.i}"]`); if (inp) inp.value = f.value; }
  }));
  listEl.querySelectorAll(".learn-chk").forEach(chk => chk.addEventListener("change", e => {
    rows[+e.target.dataset.i].learn = e.target.checked;
  }));
}

// ---------- 填入网页 ----------
async function fillPage() {
  const plan = rows.filter(r => r.value).map(r => ({ selector: r.control.selector, value: r.value }));
  if (!plan.length) { showMsg("没有可填写的内容，请先填写或匹配信息", "err"); return; }

  // 先学习：把勾选的新项目 + 用户手填的值写入资料库
  await learnAndSave();

  let total = 0;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (plan) => { window.__QA_FILL__ = plan; },
      args: [plan]
    });
    const r2 = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true }, files: ["applier.js"]
    });
    r2.forEach(r => { if (typeof r.result === "number") total += r.result; });
  } catch (e) {
    showMsg("填写失败：" + (e.message || e), "err"); return;
  }
  showMsg(total > 0 ? `已填入 ${total} 项，请核对后提交 ✓` : "未能填入（可能页面结构已变，试试重新扫描）", total > 0 ? "ok" : "err");
}

// ---------- 学习：新项目入库 + 已匹配项的手填值回存 ----------
async function learnAndSave() {
  let changed = false;
  for (const row of rows) {
    if (row.isNew && row.learn && row.value) {
      // 新建条目，关键词取项目标题 + 原始线索里的词
      const kw = buildKeywords(row.control);
      const entry = Store.newEntry(row.control.title, kw, row.value);
      tpl.entries.push(entry);
      row.entry = entry; row.isNew = false;
      changed = true;
    } else if (!row.isNew && row.entry && row.value) {
      // 已匹配项：若用户改了值且库里没有这个值，作为新格式补充（自动丰富多格式）
      const exists = row.entry.formats.some(f => f.value === row.value);
      if (!exists && row.value) {
        const f = Store.newFormat(row.value, "");
        row.entry.formats.push(f);
        changed = true;
      }
    }
  }
  if (changed) { await Store.save(state); showMsg("已更新资料库 ✓", "ok"); }
}

function buildKeywords(control) {
  const set = new Set([control.title]);
  (control.hints || "").split(/[|\s]+/).forEach(w => { w = w.trim(); if (w && w.length <= 30) set.add(w); });
  if (control.placeholder) set.add(control.placeholder.replace(/^请输入|^请填写|^请选择/, "").trim());
  return Array.from(set).filter(Boolean);
}

// ---------- 事件 ----------
tplSelect.addEventListener("change", async () => {
  state.activeId = tplSelect.value;
  await Store.save(state);
  tpl = Store.activeTemplate(state);
  await scan();
});
$("#rescanBtn").addEventListener("click", scan);
$("#fillBtn").addEventListener("click", fillPage);
$("#manageBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
