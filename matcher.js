// matcher.js —— 把"本页扫描清单"与"资料库模板"做匹配，并为每个控件自动挑选最合适的格式值。
// 纯逻辑、在 popup 中运行，不碰页面、不联网。
window.Matcher = (function () {
  function norm(s) {
    return String(s || "")
      .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .toLowerCase().replace(/[\s:：*·.。,，、()（）\[\]【】_\-/\\]/g, "");
  }

  // 给某个控件在模板里找最匹配的条目，返回 {entry, score}
  function matchEntry(control, entries) {
    const hintNorm = norm(control.hints || control.title);
    let best = null, bestScore = 0;
    for (const entry of entries) {
      const kws = (entry.keywords && entry.keywords.length) ? entry.keywords : [entry.label];
      for (const kw of kws) {
        const k = norm(kw);
        if (k && hintNorm.includes(k) && k.length > bestScore) {
          bestScore = k.length; best = entry;
        }
      }
    }
    return best ? { entry: best, score: bestScore } : null;
  }

  // 根据控件的格式线索，从条目的多个 formats 里自动挑一个最合适的
  // 规则：1) 控件是 select → 挑能对上选项的；2) 看 placeholder/hints 里的格式特征（日期分隔符等）；3) 否则用默认格式
  function pickFormat(control, entry) {
    const formats = entry.formats.filter(f => f.value);
    if (!formats.length) return null;
    if (formats.length === 1) return formats[0];

    const hint = (control.placeholder || "") + " " + (control.hints || "");

    // 下拉：挑 value 能匹配到某个 option 的格式
    if (control.tag === "select" && control.options) {
      const optNorm = control.options.map(norm);
      const hit = formats.find(f => optNorm.some(o => o === norm(f.value) || o.includes(norm(f.value))));
      if (hit) return hit;
    }

    // 日期类格式特征：根据提示里的分隔符/样例，挑分隔符一致的格式值
    const sepInHint =
      /yyyy[\/.]mm|年.*月.*日|\d{4}[\/.]\d{1,2}/i.test(hint) ? guessSep(hint) : null;
    if (sepInHint) {
      const hit = formats.find(f => detectSep(f.value) === sepInHint);
      if (hit) return hit;
    }

    // 提示里出现某格式的 note 关键词
    const hn = norm(hint);
    if (hn) {
      const byNote = formats.find(f => f.note && hn.includes(norm(f.note)));
      if (byNote) return byNote;
    }

    // 默认格式
    const def = entry.formats.find(f => f.id === entry.defaultFormatId && f.value);
    return def || formats[0];
  }

  function detectSep(v) {
    if (/\d{4}-\d/.test(v)) return "-";
    if (/\d{4}\/\d/.test(v)) return "/";
    if (/\d{4}\.\d/.test(v)) return ".";
    if (/\d{4}年/.test(v)) return "cn";
    if (/^\d{8}$/.test(v)) return "none";
    return "";
  }
  function guessSep(hint) {
    if (/年.*月.*日/.test(hint)) return "cn";
    if (/\d{4}\/\d|yyyy\/mm/i.test(hint)) return "/";
    if (/\d{4}\.\d|yyyy\.mm/i.test(hint)) return ".";
    if (/\d{4}-\d|yyyy-mm/i.test(hint)) return "-";
    return "";
  }

  // 主流程：返回 { matched:[{control, entry, format, value}], unmatched:[control] }
  function run(controls, entries) {
    const matched = [], unmatched = [];
    for (const c of controls) {
      const m = matchEntry(c, entries);
      if (m) {
        const fmt = pickFormat(c, m.entry);
        matched.push({ control: c, entry: m.entry, format: fmt, value: fmt ? fmt.value : "" });
      } else {
        unmatched.push(c);
      }
    }
    return { matched, unmatched };
  }

  return { run, norm };
})();
