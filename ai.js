// ai.js —— 可选的 AI 语义匹配模块。
// 作用：当"关键词规则"认不出某个网页字段时，把【字段名】和【资料库里的类别名】
//       发给大模型，让它用语义理解判断该字段对应哪一条资料。
//
// 隐私底线（务必理解）：
//   · AI 默认关闭。关闭时本扩展完全不联网，和原来一样。
//   · 开启后，发给模型的只有两样东西：
//       1) 网页上这个输入框"叫什么"（标签/提示文字，如"贵司全称"）
//       2) 你资料库里的"类别名"（如"公司名称""法定代表人"）
//     —— 绝不包含姓名、身份证、银行账号等任何【具体内容】。
//   · 模型只负责"归类"，真正的填值永远在本机完成。
//   · 模型地址/密钥由你自己配置，只发往你指定的服务。
window.AI = (function () {
  const CFG_KEY = "qa_ai_config_v1";
  const DEFAULT = { enabled: false, api: "openai-completions", baseUrl: "", apiKey: "", model: "" };

  async function getConfig() {
    const r = await chrome.storage.local.get(CFG_KEY);
    return Object.assign({}, DEFAULT, r[CFG_KEY] || {});
  }
  async function setConfig(cfg) {
    await chrome.storage.local.set({ [CFG_KEY]: Object.assign({}, DEFAULT, cfg) });
  }
  // Ollama 本机服务可不填 Key；其余都要 Key。
  async function isEnabled() {
    const c = await getConfig();
    const keyOk = c.api === "ollama" ? true : !!c.apiKey;
    return !!(c.enabled && c.baseUrl && c.model && keyOk);
  }

  function buildPrompt(fields, labels) {
    const sys =
      "你是表单字段归类助手。给你一组网页表单的【字段名】，和一份【可选类别清单】。" +
      "请判断每个字段最可能对应哪个类别。只能从清单里选，语义明显对不上就返回 null。" +
      "你只看字段的名称语义，不涉及任何具体内容。必须严格只输出一个 JSON 数组，不要任何解释文字。";
    const user = JSON.stringify({
      字段清单: fields.map(f => ({ 序号: f.i, 字段名: f.name })),
      可选类别: labels,
      输出格式: '[{"序号":0,"类别":"公司名称"},{"序号":1,"类别":null}]'
    });
    return { sys, user };
  }

  async function callOpenAI(cfg, sys, user) {
    const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }]
      })
    });
    if (!res.ok) throw new Error("模型服务返回 " + res.status + "（检查地址/密钥/模型 ID）");
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async function callAnthropic(cfg, sys, user) {
    const url = cfg.baseUrl.replace(/\/+$/, "") + "/v1/messages";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: cfg.model, max_tokens: 1024, temperature: 0,
        system: sys, messages: [{ role: "user", content: user }]
      })
    });
    if (!res.ok) throw new Error("模型服务返回 " + res.status + "（检查地址/密钥/模型 ID）");
    const data = await res.json();
    return (data.content || []).map(b => b.text || "").join("");
  }

  function parseArray(text) {
    const m = String(text || "").match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { return JSON.parse(m[0]); } catch (e) { return []; }
  }

  // 主入口：unmatchedControls=规则没认出的控件；entries=资料库条目。
  // 返回 [{control, entry}]：AI 认为能对上的建议（值仍在本机取）。
  async function suggest(unmatchedControls, entries) {
    const cfg = await getConfig();
    if (!cfg.enabled) return [];
    const labels = entries.map(e => e.label).filter(Boolean);
    const fields = unmatchedControls.map((c, i) => ({
      i, name: (c.title + " " + (c.hints || "")).replace(/\s+/g, " ").trim().slice(0, 80), _c: c
    }));
    if (!fields.length || !labels.length) return [];

    const { sys, user } = buildPrompt(fields.map(f => ({ i: f.i, name: f.name })), labels);
    const content = cfg.api === "anthropic-messages"
      ? await callAnthropic(cfg, sys, user)
      : await callOpenAI(cfg, sys, user);

    const arr = parseArray(content);
    const out = [];
    for (const item of arr) {
      const idx = item.序号 ?? item.index ?? item.i;
      const label = item.类别 ?? item.label ?? item.category;
      if (idx == null || !label || label === "null" || label === null) continue;
      const control = fields.find(f => f.i === idx)?._c;
      const entry = entries.find(e => e.label === label);
      if (control && entry) out.push({ control, entry });
    }
    return out;
  }

  // 用当前配置做一次最小连通性测试
  async function testConnection() {
    const cfg = await getConfig();
    const { sys, user } = buildPrompt([{ i: 0, name: "公司名称" }], ["公司名称", "姓名"]);
    const content = cfg.api === "anthropic-messages"
      ? await callAnthropic(cfg, sys, user)
      : await callOpenAI(cfg, sys, user);
    return content;
  }

  return { CFG_KEY, DEFAULT, getConfig, setConfig, isEnabled, suggest, testConnection };
})();
