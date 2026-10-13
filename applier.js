// applier.js —— 注入当前页执行：按 popup 传入的映射把值填入对应控件。
// 入参通过 window.__QA_FILL__ 传递：[{ selector, value }]
// 返回成功填写数量。不联网。
(function () {
  const plan = window.__QA_FILL__ || [];
  if (!plan.length) return 0;

  function norm(s) {
    return String(s || "")
      .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .toLowerCase().replace(/[\s:：*·.。,，、()（）\[\]【】_\-/\\]/g, "");
  }

  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }

  function setValue(el, value) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      const opts = Array.from(el.options);
      let hit = opts.find(o => norm(o.text) === norm(value) || norm(o.value) === norm(value));
      if (!hit) hit = opts.find(o => norm(value) && norm(o.text).includes(norm(value)));
      if (!hit) return false;
      el.value = hit.value; fire(el, "change"); return true;
    }
    const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    fire(el, "input"); fire(el, "change"); fire(el, "blur");
    return true;
  }

  let filled = 0;
  for (const p of plan) {
    if (!p.value) continue;
    let el;
    try { el = document.querySelector(p.selector); } catch (e) { el = null; }
    if (!el) continue;
    if (el.disabled || el.readOnly) continue;
    if ((el.value || "").trim()) continue;   // 不覆盖已有内容
    if (setValue(el, p.value)) filled++;
  }
  return filled;
})();
