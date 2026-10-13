// options.js —— 资料库管理：多模板命名、增删条目、每条多格式、导入导出。全部本地存储。
const $ = (s) => document.querySelector(s);
const tplSelect = $("#tplSelect");
const entriesEl = $("#entries");
const msgEl = $("#msg");
let state = null, tpl = null;

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showMsg(t,type="ok"){msgEl.textContent=t;msgEl.className="msg "+type;if(t)setTimeout(()=>{if(msgEl.textContent===t){msgEl.textContent="";msgEl.className="msg";}},2500);}

async function init(){
  state = await Store.load();
  tpl = Store.activeTemplate(state);
  renderTplSelect();
  renderEntries();
}

function renderTplSelect(){
  tplSelect.innerHTML = state.templates.map(t=>`<option value="${t.id}" ${t.id===state.activeId?"selected":""}>${esc(t.name)}</option>`).join("");
}

function renderEntries(){
  entriesEl.innerHTML="";
  $("#entryCount").textContent = `（共 ${tpl.entries.length} 条）`;
  tpl.entries.forEach(entry => entriesEl.appendChild(buildEntry(entry)));
}

function buildEntry(entry){
  const node = $("#entryTpl").content.cloneNode(true);
  const root = node.querySelector(".entry");
  const labelInp = node.querySelector(".e-label");
  const kwInp = node.querySelector(".e-keywords");
  labelInp.value = entry.label || "";
  kwInp.value = (entry.keywords||[]).join(",");

  labelInp.addEventListener("input", ()=>{ entry.label = labelInp.value; save(); });
  kwInp.addEventListener("input", ()=>{ entry.keywords = kwInp.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean); save(); });
  node.querySelector(".e-del").addEventListener("click", ()=>{
    if(!confirm(`删除「${entry.label||"该条"}」？`)) return;
    tpl.entries = tpl.entries.filter(e=>e!==entry); save(); renderEntries();
  });

  const formatsEl = node.querySelector(".formats");
  entry.formats.forEach(f => formatsEl.appendChild(buildFormat(entry, f)));
  node.querySelector(".add-format").addEventListener("click", ()=>{
    const f = Store.newFormat("",""); entry.formats.push(f);
    formatsEl.appendChild(buildFormat(entry,f)); save();
  });
  return root;
}

function buildFormat(entry, f){
  const node = $("#formatTpl").content.cloneNode(true);
  const star = node.querySelector(".star");
  const valInp = node.querySelector(".f-value");
  const noteInp = node.querySelector(".f-note");
  valInp.value = f.value||""; noteInp.value = f.note||"";
  const refreshStar = ()=>{ star.textContent = entry.defaultFormatId===f.id ? "★" : "☆"; star.classList.toggle("on", entry.defaultFormatId===f.id); };
  refreshStar();
  star.addEventListener("click", ()=>{ entry.defaultFormatId=f.id; save();
    // 刷新同条目所有星
    star.closest(".formats").querySelectorAll(".star").forEach(s=>{s.textContent="☆";s.classList.remove("on");});
    refreshStar();
  });
  valInp.addEventListener("input", ()=>{ f.value=valInp.value; save(); });
  noteInp.addEventListener("input", ()=>{ f.note=noteInp.value; save(); });
  node.querySelector(".f-del").addEventListener("click", ()=>{
    if(entry.formats.length<=1){ showMsg("每条至少保留一个格式","err"); return; }
    entry.formats = entry.formats.filter(x=>x!==f);
    if(entry.defaultFormatId===f.id) entry.defaultFormatId=entry.formats[0].id;
    save(); renderEntries();
  });
  return node.querySelector(".format-row");
}

async function save(){ await Store.save(state); }

// ---------- 模板操作 ----------
tplSelect.addEventListener("change", async ()=>{
  state.activeId = tplSelect.value; await save();
  tpl = Store.activeTemplate(state); renderEntries();
});
$("#newTplBtn").addEventListener("click", async ()=>{
  const name = prompt("新资料库名称：", "新资料库");
  if(!name) return;
  const t = Store.newTemplate(name.trim());
  state.templates.push(t); state.activeId=t.id; await save();
  tpl=t; renderTplSelect(); renderEntries(); showMsg("已创建并切换到新资料库 ✓");
});
$("#dupTplBtn").addEventListener("click", async ()=>{
  const copy = JSON.parse(JSON.stringify(tpl));
  copy.id = Store.uid(); copy.name = tpl.name + " 副本";
  state.templates.push(copy); state.activeId=copy.id; await save();
  tpl=copy; renderTplSelect(); renderEntries(); showMsg("已复制 ✓");
});
$("#renameBtn").addEventListener("click", async ()=>{
  const name = prompt("重命名为：", tpl.name);
  if(!name) return;
  tpl.name = name.trim(); await save(); renderTplSelect(); showMsg("已重命名 ✓");
});
$("#delTplBtn").addEventListener("click", async ()=>{
  if(state.templates.length<=1){ showMsg("至少保留一个资料库","err"); return; }
  if(!confirm(`删除资料库「${tpl.name}」及其全部条目？`)) return;
  state.templates = state.templates.filter(t=>t!==tpl);
  state.activeId = state.templates[0].id; await save();
  tpl = Store.activeTemplate(state); renderTplSelect(); renderEntries(); showMsg("已删除");
});
$("#addEntryBtn").addEventListener("click", async ()=>{
  const e = Store.newEntry("","");
  tpl.entries.unshift(e); await save(); renderEntries();
  entriesEl.querySelector(".e-label")?.focus();
});

// ---------- 导入导出 ----------
$("#exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="报价助手-资料库备份.json"; a.click();
  URL.revokeObjectURL(url); showMsg("已导出 ✓");
});
$("#importBtn").addEventListener("click", ()=> $("#importFile").click());
$("#importFile").addEventListener("change", e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(!obj.templates || !Array.isArray(obj.templates)) throw new Error("格式不符");
      if(!confirm("导入会覆盖当前全部资料库，确定继续？")) return;
      state = obj; if(!state.activeId || !state.templates.find(t=>t.id===state.activeId)) state.activeId=state.templates[0].id;
      await save(); tpl=Store.activeTemplate(state); renderTplSelect(); renderEntries(); showMsg("已导入 ✓");
    }catch(err){ showMsg("文件格式不正确","err"); }
  };
  reader.readAsText(file);
});

init();
