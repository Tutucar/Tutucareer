// scanner.js —— 注入当前页执行：扫描本页所有可填写控件，返回结构化清单。
// 只读页面、不修改任何内容、不联网。返回数组，每项描述一个控件。
(function () {
  function getLabelText(el) {
    const parts = [];
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) parts.push(lab.textContent);
    }
    const wrapLab = el.closest("label");
    if (wrapLab) {
      // 去掉控件自身的值，只取标签文字
      const clone = wrapLab.cloneNode(true);
      clone.querySelectorAll("input,select,textarea").forEach(n => n.remove());
      parts.push(clone.textContent);
    }
    parts.push(el.getAttribute("aria-label") || "");
    parts.push(el.getAttribute("title") || "");
    // 栅格/上方文字
    let p = el.parentElement, hops = 0, found = "";
    while (p && hops < 3) {
      const t = precedingText(p, el);
      if (t) { found = t; break; }
      p = p.parentElement; hops++;
    }
    if (found) parts.push(found);
    // 主提示文本：优先 label/aria/包裹/上方；下面单独保留 placeholder/name 作为补充线索
    const main = parts.map(s => (s || "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return main;
  }

  function precedingText(container, target) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const texts = []; let node;
    while ((node = walker.nextNode())) {
      if (target.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) {
        const t = node.textContent.trim();
        if (t) texts.push(t);
      }
    }
    return texts.length ? texts[texts.length - 1] : "";
  }

  function fillable(el) {
    if (el.disabled || el.readOnly) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.type === "hidden") return false;
    if (el.tagName.toLowerCase() === "input") {
      const t = (el.type || "text").toLowerCase();
      const skip = ["checkbox","radio","file","hidden","submit","button","image","reset","password","range","color"];
      if (skip.includes(t)) return false;
    }
    return true;
  }

  // 给控件打一个稳定的定位路径（用于后续填写时重新找到它）
  function cssPath(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let sel = node.tagName.toLowerCase();
      if (node.getAttribute("name")) {
        sel += `[name="${CSS.escape(node.getAttribute("name"))}"]`;
        parts.unshift(sel);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  const controls = Array.from(document.querySelectorAll("input, textarea, select")).filter(fillable);
  const list = [];
  let idx = 0;
  for (const el of controls) {
    const tag = el.tagName.toLowerCase();
    const labelText = getLabelText(el);
    const placeholder = el.getAttribute("placeholder") || "";
    const name = el.getAttribute("name") || "";
    const title = labelText || placeholder || name;      // 展示给用户看的项目名
    if (!title) continue;                                // 完全无线索的框跳过
    const item = {
      idx: idx++,
      selector: cssPath(el),
      tag,
      type: tag === "input" ? (el.type || "text").toLowerCase() : tag,
      title: title.slice(0, 40),
      hints: [labelText, placeholder, name, el.id].filter(Boolean).join(" | "),
      placeholder,
      currentValue: (el.value || "").trim(),
      options: tag === "select" ? Array.from(el.options).map(o => o.text.trim()).filter(Boolean) : null
    };
    list.push(item);
  }
  return list;
})();
