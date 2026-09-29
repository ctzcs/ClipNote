/* ============================================================
 * ClipNote — 个人 Agent 提示词记事本
 * 纯前端实现，数据保存在浏览器 localStorage 中。
 * ============================================================ */
"use strict";

const STORE_KEY = "clipnote.prompts.v1";
const SETTINGS_KEY = "clipnote.settings.v1";

/* ---------------- 状态 ---------------- */
let prompts = [];               // 全部提示词
let editingId = null;           // 当前编辑的提示词 id（null 表示新建）
let deletingId = null;          // 待确认删除的提示词 id
let activeFilter = "__all__";   // __all__ | __pinned__ | 具体标签名
let searchText = "";

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const els = {
  searchInput: $("searchInput"),
  themeBtn: $("themeBtn"), themeIcon: $("themeIcon"),
  exportBtn: $("exportBtn"), importBtn: $("importBtn"), importFile: $("importFile"),
  newBtn: $("newBtn"), emptyNewBtn: $("emptyNewBtn"), clearSearchBtn: $("clearSearchBtn"),
  filterNav: $("filterNav"), tagNav: $("tagNav"),
  countAll: $("countAll"), countPinned: $("countPinned"),
  sortSelect: $("sortSelect"), statsLine: $("statsLine"),
  cardGrid: $("cardGrid"), emptyState: $("emptyState"), noResultState: $("noResultState"),
  editorOverlay: $("editorOverlay"), editorTitle: $("editorTitle"),
  editorClose: $("editorClose"), editorCancel: $("editorCancel"), editorSave: $("editorSave"),
  fTitle: $("fTitle"), fTags: $("fTags"), fContent: $("fContent"), charCount: $("charCount"),
  confirmOverlay: $("confirmOverlay"), confirmText: $("confirmText"),
  confirmOk: $("confirmOk"), confirmCancel: $("confirmCancel"),
  toast: $("toast"),
};

/* ---------------- 工具函数 ---------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function relTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = 60e3, h = 3600e3, d = 86400e3;
  if (diff < m) return "刚刚";
  if (diff < h) return Math.floor(diff / m) + " 分钟前";
  if (diff < d) return Math.floor(diff / h) + " 小时前";
  if (diff < d * 30) return Math.floor(diff / d) + " 天前";
  const dt = new Date(ts);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.hidden = true; }, 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // file:// 或旧浏览器的降级方案
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* 忽略 */ }
    ta.remove();
    return ok;
  }
}

function parseTags(input) {
  return [...new Set(
    String(input).split(/[\s,，、]+/).map((t) => t.trim()).filter(Boolean)
  )].slice(0, 10);
}

/* ---------------- 数据读写 ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    prompts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(prompts)) prompts = [];
  } catch {
    prompts = [];
  }
  if (!localStorage.getItem(STORE_KEY) && prompts.length === 0) seed();
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(prompts));
}

/* 首次打开时预置两条示例，方便了解用法 */
function seed() {
  prompts = [
    {
      id: uid(),
      title: "示例：代码审查助手",
      content: "你是一位资深代码审查员。请审查我贴出的代码，重点关注：\n1. 潜在 bug 与边界条件\n2. 安全隐患\n3. 可读性与命名\n\n按严重程度排列问题，最后给出修改后的完整代码。不要客套，直接指出问题。",
      tags: ["编码", "示例"],
      pinned: true,
      useCount: 0, lastUsedAt: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: uid(),
      title: "示例：周报生成",
      content: "根据我列出的本周工作流水账，生成一份结构化的周报，包含：本周完成、进行中、下周计划、风险与需要支持。语言简洁，用要点列表，不要夸大成果。",
      tags: ["写作", "示例"],
      pinned: false,
      useCount: 0, lastUsedAt: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    },
  ];
  save();
}

/* ---------------- 设置（主题 / 排序） ---------------- */
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { /* 忽略 */ }
  const theme = s.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  if (s.sort) els.sortSelect.value = s.sort;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    theme: document.documentElement.dataset.theme,
    sort: els.sortSelect.value,
  }));
}

/* ---------------- 渲染 ---------------- */
function allTags() {
  const map = new Map();
  for (const p of prompts) for (const t of p.tags || []) map.set(t, (map.get(t) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"));
}

function visiblePrompts() {
  let list = prompts;
  if (activeFilter === "__pinned__") list = list.filter((p) => p.pinned);
  else if (activeFilter !== "__all__") list = list.filter((p) => (p.tags || []).includes(activeFilter));

  const kw = searchText.trim().toLowerCase();
  if (kw) {
    list = list.filter((p) =>
      p.title.toLowerCase().includes(kw) ||
      p.content.toLowerCase().includes(kw) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(kw))
    );
  }

  const pinnedFirst = (a, b) => Number(b.pinned) - Number(a.pinned);
  const sort = els.sortSelect.value;
  const cmp = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
    used: (a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0),
    count: (a, b) => b.useCount - a.useCount,
  }[sort];
  return [...list].sort((a, b) => pinnedFirst(a, b) || cmp(a, b));
}

function renderSidebar() {
  els.countAll.textContent = prompts.length;
  els.countPinned.textContent = prompts.filter((p) => p.pinned).length;

  els.tagNav.innerHTML = "";
  for (const [tag, count] of allTags()) {
    const btn = document.createElement("button");
    btn.className = "filter-item" + (activeFilter === tag ? " active" : "");
    btn.dataset.filter = tag;
    btn.innerHTML = `<span># ${escapeHtml(tag)}</span><span class="count">${count}</span>`;
    els.tagNav.appendChild(btn);
  }
  // 若当前选中的标签已不存在，回到“全部”
  if (activeFilter !== "__all__" && activeFilter !== "__pinned__" &&
      !allTags().some(([t]) => t === activeFilter)) {
    activeFilter = "__all__";
  }
  els.filterNav.querySelectorAll(".filter-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.filter === activeFilter));
}

function cardHtml(p) {
  const tags = (p.tags || [])
    .map((t) => `<span class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`)
    .join("");
  return `
    <div class="card-head">
      <h3 class="card-title">${escapeHtml(p.title)}</h3>
      <button class="card-pin ${p.pinned ? "pinned" : ""}" data-act="pin" title="${p.pinned ? "取消收藏" : "收藏"}">${p.pinned ? "★" : "☆"}</button>
    </div>
    <pre class="card-content" data-act="expand" title="点击展开 / 收起">${escapeHtml(p.content)}</pre>
    ${tags ? `<div class="card-tags">${tags}</div>` : ""}
    <div class="card-foot">
      <div class="card-meta">
        <span>编辑于 ${relTime(p.updatedAt)}</span>
        <span>复制 ${p.useCount || 0} 次</span>
      </div>
      <div class="card-actions">
        <button class="card-btn copy-btn" data-act="copy" title="复制全文">⧉ 复制</button>
        <button class="card-btn" data-act="edit" title="编辑">编辑</button>
        <button class="card-btn del-btn" data-act="delete" title="删除">删除</button>
      </div>
    </div>`;
}

function render() {
  renderSidebar();

  const list = visiblePrompts();
  els.cardGrid.innerHTML = list.map((p) => `<article class="card" data-id="${p.id}">${cardHtml(p)}</article>`).join("");

  els.emptyState.hidden = prompts.length !== 0;
  els.noResultState.hidden = !(prompts.length > 0 && list.length === 0);

  const chars = prompts.reduce((n, p) => n + p.content.length, 0);
  const tagsCount = allTags().length;
  els.statsLine.textContent = `${prompts.length} 条提示词 · ${tagsCount} 个标签 · 共 ${chars} 字`;
}

/* ---------------- 编辑弹窗 ---------------- */
function openEditor(p) {
  editingId = p ? p.id : null;
  els.editorTitle.textContent = p ? "编辑提示词" : "新建提示词";
  els.fTitle.value = p ? p.title : "";
  els.fTags.value = p ? (p.tags || []).join(" ") : "";
  els.fContent.value = p ? p.content : "";
  updateCharCount();
  els.editorOverlay.hidden = false;
  els.fTitle.focus();
}

function closeEditor() {
  els.editorOverlay.hidden = true;
  editingId = null;
}

function updateCharCount() {
  els.charCount.textContent = `${els.fContent.value.length} 字`;
}

function saveEditor() {
  const title = els.fTitle.value.trim();
  const content = els.fContent.value.trim();
  if (!title) { els.fTitle.focus(); showToast("请填写标题"); return; }
  if (!content) { els.fContent.focus(); showToast("提示词内容不能为空"); return; }

  const now = Date.now();
  if (editingId) {
    const p = prompts.find((x) => x.id === editingId);
    Object.assign(p, { title, content, tags: parseTags(els.fTags.value), updatedAt: now });
  } else {
    prompts.unshift({
      id: uid(), title, content,
      tags: parseTags(els.fTags.value),
      pinned: false, useCount: 0, lastUsedAt: null,
      createdAt: now, updatedAt: now,
    });
  }
  save();
  closeEditor();
  render();
  showToast(editingId ? "已保存" : "已创建");
}

/* ---------------- 删除确认 ---------------- */
function askDelete(p) {
  deletingId = p.id;
  els.confirmText.textContent = `「${p.title}」将被删除，且无法恢复。`;
  els.confirmOverlay.hidden = false;
}

/* ---------------- 事件绑定 ---------------- */
// 侧栏筛选（事件委托，覆盖“全部/收藏/标签”两个容器）
function onFilterClick(e) {
  const btn = e.target.closest(".filter-item");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  render();
}
els.filterNav.addEventListener("click", onFilterClick);
els.tagNav.addEventListener("click", onFilterClick);

// 卡片操作（事件委托）
els.cardGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const p = prompts.find((x) => x.id === card.dataset.id);
  if (!p) return;

  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "copy") {
    if (await copyText(p.content)) {
      p.useCount = (p.useCount || 0) + 1;
      p.lastUsedAt = Date.now();
      save();
      render();
      showToast("已复制到剪贴板 ✓");
    } else {
      showToast("复制失败，请手动选择文本复制");
    }
  } else if (act === "edit") {
    openEditor(p);
  } else if (act === "delete") {
    askDelete(p);
  } else if (act === "pin") {
    p.pinned = !p.pinned;
    save();
    render();
  } else if (act === "expand") {
    e.target.classList.toggle("expanded");
  }
});

// 点击标签 → 按该标签筛选
els.cardGrid.addEventListener("click", (e) => {
  const tag = e.target.closest(".tag")?.dataset.tag;
  if (tag) { activeFilter = tag; render(); window.scrollTo({ top: 0 }); }
});

// 搜索
els.searchInput.addEventListener("input", () => {
  searchText = els.searchInput.value;
  render();
});
els.clearSearchBtn.addEventListener("click", () => {
  els.searchInput.value = "";
  searchText = "";
  render();
  els.searchInput.focus();
});

// 排序
els.sortSelect.addEventListener("change", () => { saveSettings(); render(); });

// 主题
els.themeBtn.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  saveSettings();
});

// 新建
els.newBtn.addEventListener("click", () => openEditor(null));
els.emptyNewBtn.addEventListener("click", () => openEditor(null));

// 编辑弹窗
els.editorSave.addEventListener("click", saveEditor);
els.editorCancel.addEventListener("click", closeEditor);
els.editorClose.addEventListener("click", closeEditor);
els.editorOverlay.addEventListener("mousedown", (e) => { if (e.target === els.editorOverlay) closeEditor(); });
els.fContent.addEventListener("input", updateCharCount);

// 删除确认
els.confirmOk.addEventListener("click", () => {
  prompts = prompts.filter((x) => x.id !== deletingId);
  save();
  els.confirmOverlay.hidden = true;
  deletingId = null;
  render();
  showToast("已删除");
});
els.confirmCancel.addEventListener("click", () => { els.confirmOverlay.hidden = true; deletingId = null; });
els.confirmOverlay.addEventListener("mousedown", (e) => {
  if (e.target === els.confirmOverlay) { els.confirmOverlay.hidden = true; deletingId = null; }
});

// 导出
els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `clipnote-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("已导出备份文件");
});

// 导入（与现有数据按 id 合并，同 id 覆盖）
els.importBtn.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", () => {
  const file = els.importFile.files[0];
  els.importFile.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("格式不对");
      const map = new Map(prompts.map((p) => [p.id, p]));
      let added = 0, updated = 0;
      for (const raw of data) {
        if (!raw || typeof raw.title !== "string" || typeof raw.content !== "string") continue;
        const item = {
          id: typeof raw.id === "string" ? raw.id : uid(),
          title: raw.title.slice(0, 100),
          content: raw.content,
          tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 10) : [],
          pinned: !!raw.pinned,
          useCount: Number(raw.useCount) || 0,
          lastUsedAt: Number(raw.lastUsedAt) || null,
          createdAt: Number(raw.createdAt) || Date.now(),
          updatedAt: Number(raw.updatedAt) || Date.now(),
        };
        if (map.has(item.id)) { updated++; } else { added++; }
        map.set(item.id, item);
      }
      prompts = [...map.values()];
      save();
      render();
      showToast(`导入完成：新增 ${added} 条，更新 ${updated} 条`);
    } catch {
      showToast("导入失败：不是有效的备份 JSON 文件");
    }
  };
  reader.readAsText(file);
});

// 快捷键
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && els.editorOverlay.hidden) {
    e.preventDefault();
    openEditor(null);
  } else if (e.key === "Escape") {
    if (!els.confirmOverlay.hidden) { els.confirmOverlay.hidden = true; deletingId = null; }
    else if (!els.editorOverlay.hidden) closeEditor();
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !els.editorOverlay.hidden) {
    saveEditor();
  }
});

/* ---------------- 启动 ---------------- */
load();
loadSettings();
render();
