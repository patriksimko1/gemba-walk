/* ============================================================
   GEMBA Walk — hlavná logika (vanilla JS, bez build kroku)
   v2 — presné miesto, foťák/galéria, mazanie fotiek, odoslanie e-mailu
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------- Konfigurácia ---------- */
const CFG = window.GEMBA_CONFIG || {};
const TOPICS = CFG.TOPICS && CFG.TOPICS.length ? CFG.TOPICS
  : ["5S", "Ergonómia", "Bezpečnosť", "Odpad", "Štandardizácia"];
const SITES = CFG.SITES && CFG.SITES.length ? CFG.SITES
  : ["Koridor", "CR2", "CR1", "Bake Rolls", "Sklad Surovín", "Sklad Hotových výrobkov"];

const STATUSES = ["Nový", "V riešení", "Vyriešený", "Zrušený"];
const PRIORITIES = ["Nízka", "Stredná", "Vysoká", "Kritická"];

const STATUS_COLOR = {
  "Nový": "var(--st-new)", "V riešení": "var(--st-prog)",
  "Vyriešený": "var(--st-done)", "Zrušený": "var(--st-cancel)"
};
const PRIORITY_COLOR = {
  "Nízka": "var(--pr-low)", "Stredná": "var(--pr-med)",
  "Vysoká": "var(--pr-high)", "Kritická": "var(--pr-crit)"
};
const TOPIC_COLOR = ["#F5A524", "#3B82F6", "#22C55E", "#EF4444", "#A78BFA", "#EC4899", "#14B8A6"];

const QUEUE_KEY = "gemba_pending_v1";

/* ---------- Supabase klient ---------- */
let supabase = null;
const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
if (configured) {
  supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
}

/* ---------- Stav ---------- */
const state = {
  user: null,
  view: "list",
  inspections: [],
  loading: true,
  selectedId: null,
  editing: null,
  formPhotos: [],
  filters: { q: "", status: "", site: "", priority: "" },
  authMode: "login"
};

/* ---------- Pomocné ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const appEl = $("#app");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function uid() { return "id" + Date.now() + Math.random().toString(36).slice(2, 8); }

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let toastTimer = null;
function toast(msg, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 3600);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.dataset.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Nepodarilo sa načítať knižnicu: " + src));
    document.head.appendChild(s);
  });
}

/* ---------- Ikony ---------- */
const I = {
  search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`,
  list: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  chart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/></svg>`,
  plus: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`,
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`,
  close: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  chev: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>`,
  camera: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  image: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/></svg>`,
  pdf: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  share: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`,
  inbox: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"/></svg>`
};

/* ---------- Badges ---------- */
function statusBadge(s) {
  const c = STATUS_COLOR[s] || "var(--muted)";
  return `<span class="badge dot" style="color:${c};background:color-mix(in srgb, ${c} 14%, transparent)">${esc(s)}</span>`;
}
function priorityBadge(p) {
  const c = PRIORITY_COLOR[p] || "var(--muted)";
  return `<span class="badge" style="color:${c};background:color-mix(in srgb, ${c} 14%, transparent)">${esc(p)}</span>`;
}

/* ============================================================
   DÁTA
   ============================================================ */
async function loadInspections() {
  state.loading = true;
  render();
  try {
    const { data, error } = await supabase
      .from("inspections").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    state.inspections = data || [];
  } catch (e) {
    if (!navigator.onLine) {
      toast("Si offline — zobrazujem len lokálne čakajúce záznamy", true);
      state.inspections = [];
    } else {
      toast("Chyba načítania: " + (e.message || e), true);
    }
  } finally {
    state.loading = false;
    render();
  }
}

async function saveInspection(payload, id) {
  const newUrls = await uploadPendingPhotos();
  const existing = id ? (state.formPhotos.filter(p => p.uploaded).map(p => p.url)) : [];
  const photos = [...existing, ...newUrls];

  const row = {
    gemba_topic: payload.gemba_topic,
    site: payload.site,
    site_detail: payload.site_detail,
    issue_found: payload.issue_found,
    possible_root_cause: payload.possible_root_cause,
    next_step: payload.next_step,
    assigned_to: payload.assigned_to,
    status: payload.status,
    priority: payload.priority,
    photos
  };

  if (id) {
    const { error } = await supabase.from("inspections").update(row).eq("id", id);
    if (error) throw error;
  } else {
    row.reported_by = state.user?.email || "";
    const { error } = await supabase.from("inspections").insert(row);
    if (error) throw error;
  }
}

async function removeInspection(id) {
  const { error } = await supabase.from("inspections").delete().eq("id", id);
  if (error) throw error;
}

/* ============================================================
   FOTKY
   ============================================================ */
function compressImage(file, maxW = 1080, maxKB = 500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        let q = 0.78;
        const tryExport = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", q);
          const kb = Math.round((dataUrl.length * 3 / 4) / 1024);
          if (kb > maxKB && q > 0.3) { q -= 0.12; return tryExport(); }
          resolve(dataUrl);
        };
        tryExport();
      };
      img.onerror = () => reject(new Error("Neplatný obrázok"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Nepodarilo sa načítať súbor"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadPendingPhotos() {
  const urls = [];
  for (const p of state.formPhotos) {
    if (p.uploaded) continue;
    const blob = dataUrlToBlob(p.dataUrl);
    const path = `${state.user?.id || "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, {
      contentType: "image/jpeg", upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

/* ============================================================
   OFFLINE FRONTA
   ============================================================ */
function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch { return []; }
}
function setQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

function queueInspection(payload, photoDataUrls) {
  const q = getQueue();
  q.push({
    localId: uid(),
    payload: { ...payload, reported_by: state.user?.email || "" },
    photoDataUrls,
    created_at: new Date().toISOString()
  });
  setQueue(q);
}

async function flushQueue() {
  const q = getQueue();
  if (!q.length || !navigator.onLine || !state.user) return;
  showBanner("syncing", "Synchronizujem čakajúce záznamy…");
  const remaining = [];
  for (const item of q) {
    try {
      const urls = [];
      for (const du of (item.photoDataUrls || [])) {
        const blob = dataUrlToBlob(du);
        const path = `${state.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        urls.push(supabase.storage.from("photos").getPublicUrl(path).data.publicUrl);
      }
      const { error } = await supabase.from("inspections").insert({ ...item.payload, photos: urls });
      if (error) throw error;
    } catch (e) {
      remaining.push(item);
    }
  }
  setQueue(remaining);
  hideBanner();
  if (remaining.length === 0 && q.length) toast("Čakajúce záznamy odoslané ✓");
  await loadInspections();
}

/* ---------- Banner ---------- */
function showBanner(kind, text) {
  let b = $("#banner");
  if (!b) return;
  b.className = "banner show " + kind;
  b.innerHTML = `<span class="spin"></span><span>${esc(text)}</span>`;
}
function hideBanner() { const b = $("#banner"); if (b) b.className = "banner"; }
function updateConnBanner() {
  if (!navigator.onLine) {
    const n = getQueue().length;
    showBanner("offline", n ? `Offline — ${n} záznam(ov) čaká na odoslanie` : "Si offline — záznamy sa uložia lokálne");
  } else hideBanner();
}

/* ============================================================
   MODÁLNE OKNO
   ============================================================ */
function openModal(html) {
  let m = $("#modalRoot");
  if (!m) {
    m = document.createElement("div");
    m.id = "modalRoot";
    document.body.appendChild(m);
  }
  m.innerHTML = `<div class="modal-overlay" data-action="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">${html}</div>
    </div>`;
}
function closeModal() {
  const m = $("#modalRoot");
  if (m) m.innerHTML = "";
}

/* ============================================================
   AUTENTIFIKÁCIA
   ============================================================ */
function renderAuth() {
  const m = state.authMode;
  appEl.innerHTML = `
    <div class="auth"><div class="box">
      <div class="logo">
        <div class="mark">${I.list.replace('currentColor', '#1a1205')}</div>
        <div><h1>GEMBA Walk</h1></div>
      </div>
      <p class="tag">${m === "login" ? "Prihlás sa do tímového priestoru" : "Vytvor si konto"}</p>
      <div id="authMsg"></div>
      <form id="authForm" class="form" autocomplete="on">
        <div class="group">
          <label>E-mail</label>
          <input type="email" id="email" required placeholder="meno@firma.sk" />
        </div>
        <div class="group">
          <label>Heslo</label>
          <input type="password" id="password" required minlength="6" placeholder="••••••••" />
        </div>
        <button class="btn primary" type="submit" id="authBtn">
          ${m === "login" ? "Prihlásiť sa" : "Vytvoriť konto"}
        </button>
      </form>
      <div class="switch">
        ${m === "login" ? "Nemáš konto?" : "Už máš konto?"}
        <button data-action="toggle-auth" type="button">${m === "login" ? "Zaregistruj sa" : "Prihlás sa"}</button>
      </div>
    </div></div>`;

  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const btn = $("#authBtn");
    const msg = $("#authMsg");
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span>`;
    msg.innerHTML = "";
    try {
      if (state.authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          msg.innerHTML = `<div class="ok">Konto vytvorené. Ak máš zapnuté potvrdenie e-mailu, klikni na odkaz v schránke a potom sa prihlás.</div>`;
          state.authMode = "login";
          btn.disabled = false;
          return renderAuth();
        }
      }
    } catch (err) {
      msg.innerHTML = `<div class="err">${esc(err.message || "Prihlásenie zlyhalo")}</div>`;
      btn.disabled = false;
      btn.textContent = state.authMode === "login" ? "Prihlásiť sa" : "Vytvoriť konto";
    }
  });
}

/* ============================================================
   ZOZNAM
   ============================================================ */
function pendingAsCards() {
  return getQueue().map(item => ({
    id: "pending-" + item.localId,
    _pending: true,
    gemba_topic: item.payload.gemba_topic,
    site: item.payload.site,
    site_detail: item.payload.site_detail,
    issue_found: item.payload.issue_found,
    status: "Čaká na synchronizáciu",
    priority: item.payload.priority,
    photos: item.photoDataUrls || [],
    created_at: item.created_at
  }));
}

function filtered() {
  const f = state.filters;
  const all = [...pendingAsCards(), ...state.inspections];
  return all.filter(it => {
    if (f.status && it.status !== f.status) return false;
    if (f.site && it.site !== f.site) return false;
    if (f.priority && it.priority !== f.priority) return false;
    if (f.q) {
      const hay = `${it.site} ${it.site_detail || ""} ${it.gemba_topic} ${it.issue_found} ${it.possible_root_cause || ""} ${it.next_step || ""}`.toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

function listHTML() {
  const items = filtered();
  const f = state.filters;
  const statusChips = ["", ...STATUSES].map(s =>
    `<button class="chip ${f.status === s ? "active" : ""}" data-action="filter-status" data-val="${esc(s)}">${s === "" ? "Všetky stavy" : esc(s)}</button>`).join("");

  let body;
  if (state.loading) {
    body = `<div class="list">${`<div class="skeleton"></div>`.repeat(4)}</div>`;
  } else if (!items.length) {
    body = `<div class="empty">${I.inbox}
      <div class="big">${f.q || f.status || f.site || f.priority ? "Žiadne výsledky" : "Zatiaľ žiadne záznamy"}</div>
      <div>${f.q || f.status || f.site || f.priority ? "Skús zmeniť filter alebo hľadanie." : "Klikni na + a zaznamenaj prvý nález z obhliadky."}</div>
    </div>`;
  } else {
    body = `<div class="list">${items.map(cardHTML).join("")}</div>`;
  }

  return `
    <div class="toolbar">
      <div class="search">${I.search}
        <input id="searchInput" type="search" placeholder="Hľadať nález, miesto, popis…" value="${esc(f.q)}" />
      </div>
      <div class="filters">
        ${statusChips}
        <div class="select-wrap">
          <select id="siteFilter">
            <option value="">Všetky lokality</option>
            ${SITES.map(s => `<option ${f.site === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
          </select>
        </div>
        <div class="select-wrap">
          <select id="prioFilter">
            <option value="">Všetky priority</option>
            ${PRIORITIES.map(p => `<option ${f.priority === p ? "selected" : ""}>${esc(p)}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
    ${body}`;
}

function cardHTML(it) {
  const spine = it._pending ? "var(--st-cancel)" : (PRIORITY_COLOR[it.priority] || "var(--muted)");
  const nPhotos = (it.photos || []).length;
  return `
    <div class="card" data-action="open" data-id="${esc(it.id)}">
      <div class="spine" style="background:${spine}"></div>
      <div class="body">
        <div class="row1">
          <span class="site">${esc(it.site)}</span>
          ${it.site_detail ? `<span class="sitedetail">· ${esc(it.site_detail)}</span>` : ""}
          <span class="topic">${esc(it.gemba_topic)}</span>
        </div>
        <div class="issue">${esc(it.issue_found || "(bez popisu)")}</div>
        <div class="meta">
          ${it._pending
      ? `<span class="badge dot" style="color:var(--st-cancel);background:color-mix(in srgb,var(--st-cancel) 16%,transparent)">${esc(it.status)}</span>`
      : statusBadge(it.status)}
          ${nPhotos ? `<span class="thumbcount">${I.camera} ${nPhotos}</span>` : ""}
          <span class="date">${fmtDate(it.created_at)}</span>
        </div>
      </div>
      <div class="chev">${I.chev}</div>
    </div>`;
}

/* ============================================================
   DETAIL
   ============================================================ */
function detailHTML(it) {
  const field = (label, val) =>
    `<div class="field"><div class="label">${label}</div>
      <div class="value ${val ? "" : "empty-val"}">${val ? esc(val) : "—"}</div></div>`;
  const photos = it.photos || [];
  return `
    <div class="detail">
      <div class="headblock">
        <span class="topic">${esc(it.gemba_topic)}</span>
        ${statusBadge(it.status)} ${priorityBadge(it.priority)}
      </div>
      ${field("Lokalita", it.site)}
      ${field("Presné miesto", it.site_detail)}
      ${field("Popis nálezu", it.issue_found)}
      ${field("Možná príčina", it.possible_root_cause)}
      ${field("Ďalší krok", it.next_step)}
      ${field("Priradené", it.assigned_to)}
      ${field("Nahlásil", it.reported_by)}
      ${field("Vytvorené", fmtDate(it.created_at))}
      ${field("Upravené", fmtDate(it.updated_at))}
      ${photos.length ? `<div class="field"><div class="label">Fotografie (${photos.length})</div>
        <div class="gallery">${photos.map(u => `<img src="${esc(u)}" loading="lazy" alt="foto" />`).join("")}</div></div>` : ""}
      <div class="detail-actions">
        <button class="btn" data-action="edit" data-id="${esc(it.id)}">${I.edit} Upraviť</button>
        <button class="btn" data-action="email" data-id="${esc(it.id)}">${I.mail} Odoslať e-mailom</button>
        <button class="btn" data-action="pdf" data-id="${esc(it.id)}">${I.pdf} PDF</button>
        <button class="btn danger" data-action="delete" data-id="${esc(it.id)}">${I.trash} Zmazať</button>
      </div>
    </div>`;
}

/* ============================================================
   FORMULÁR
   ============================================================ */
function formHTML() {
  const e = state.editing || {};
  const seg = (name, list, current) => `
    <div class="seg" data-seg="${name}">
      ${list.map(v => `<button type="button" data-action="seg" data-seg="${name}" data-val="${esc(v)}"
        class="${(current || (name === "status" ? "Nový" : "Stredná")) === v ? "sel" : ""}"
        style="${(current || (name === "status" ? "Nový" : "Stredná")) === v ? `border-color:${(name === "status" ? STATUS_COLOR : PRIORITY_COLOR)[v]};background:color-mix(in srgb, ${(name === "status" ? STATUS_COLOR : PRIORITY_COLOR)[v]} 22%, var(--surface-2))` : ""}">${esc(v)}</button>`).join("")}
    </div>`;

  const photos = state.formPhotos;
  return `
    <form class="form" id="inspForm">
      <div class="group">
        <label>Kategória (Gemba Topic)</label>
        <select id="f_topic">${TOPICS.map(t => `<option ${e.gemba_topic === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
      </div>
      <div class="group">
        <label>Lokalita (Site)</label>
        <select id="f_site">${SITES.map(s => `<option ${e.site === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      </div>
      <div class="group">
        <label class="label-row">Presné miesto
          <button type="button" class="info-btn" data-action="info-site" aria-label="Pomoc k presnému miestu">${I.info}</button>
        </label>
        <input type="text" id="f_site_detail" placeholder="napr. pri stroji XY, regál 3, vstup do haly" value="${esc(e.site_detail || "")}" />
      </div>
      <div class="group">
        <label>Popis nálezu</label>
        <textarea id="f_issue" placeholder="Čo si našiel?">${esc(e.issue_found || "")}</textarea>
      </div>
      <div class="group">
        <label>Možná príčina</label>
        <textarea id="f_cause" placeholder="Možná koreňová príčina">${esc(e.possible_root_cause || "")}</textarea>
      </div>
      <div class="group">
        <label>Ďalší krok</label>
        <textarea id="f_next" placeholder="Navrhované riešenie">${esc(e.next_step || "")}</textarea>
      </div>
      <div class="group">
        <label>Priradené (e-mail riešiteľa)</label>
        <input type="text" id="f_assigned" placeholder="meno@firma.sk" value="${esc(e.assigned_to || "")}" />
      </div>
      <div class="group">
        <label>Stav</label>
        ${seg("status", STATUSES, e.status)}
      </div>
      <div class="group">
        <label>Priorita</label>
        ${seg("priority", PRIORITIES, e.priority)}
      </div>
      <div class="group">
        <label>Fotografie</label>
        <div class="photo-actions">
          <button type="button" class="btn primary" data-action="pick-camera">${I.camera} Odfotiť</button>
          <button type="button" class="btn" data-action="pick-gallery">${I.image} Pridať fotku</button>
        </div>
        <div class="hint">„Odfotiť" otvorí fotoaparát, „Pridať fotku" galériu. Fotka sa automaticky zmenší.</div>
        <div class="photo-grid" id="photoGrid">
          ${photos.map(p => photoTile(p)).join("")}
        </div>
      </div>
      <button type="submit" class="btn primary" id="saveBtn">Uložiť záznam</button>
    </form>`;
}

function photoTile(p) {
  return `
    <div class="ph">
      <img src="${esc(p.dataUrl || p.url)}" alt="" />
      ${p.uploading ? `<div class="up"><span class="spin"></span></div>` : ""}
      <button type="button" class="rm" data-action="rm-photo" data-id="${esc(p.id)}" aria-label="Zmazať fotku">${I.trash}</button>
    </div>`;
}

function readForm() {
  const segVal = (name, def) => {
    const sel = document.querySelector(`.seg[data-seg="${name}"] button.sel`);
    return sel ? sel.dataset.val : def;
  };
  return {
    gemba_topic: $("#f_topic").value,
    site: $("#f_site").value,
    site_detail: $("#f_site_detail").value.trim(),
    issue_found: $("#f_issue").value.trim(),
    possible_root_cause: $("#f_cause").value.trim(),
    next_step: $("#f_next").value.trim(),
    assigned_to: $("#f_assigned").value.trim(),
    status: segVal("status", "Nový"),
    priority: segVal("priority", "Stredná")
  };
}

/* ============================================================
   DASHBOARD + GRAFY
   ============================================================ */
function pieSVG(data) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return `<div class="empty" style="padding:20px">Žiadne dáta</div>`;
  const cx = 90, cy = 90, r = 78;
  let angle = -Math.PI / 2;
  const arcs = data.filter(d => d.value > 0).map((d) => {
    const frac = d.value / total;
    const a2 = angle + frac * 2 * Math.PI;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const path = frac >= 0.9999
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${d.color}"/>`
      : `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${d.color}"/>`;
    angle = a2;
    return path;
  }).join("");
  return `<svg viewBox="0 0 180 180" width="170" height="170" style="display:block;margin:0 auto">
    ${arcs}<circle cx="${cx}" cy="${cy}" r="44" fill="var(--surface-1)"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--text)" font-size="26" font-weight="800" font-family="monospace">${total}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="var(--muted)" font-size="11">celkom</text>
  </svg>`;
}

function lineSVG(points) {
  const W = 480, H = 160, pad = 28;
  const max = Math.max(1, ...points.map(p => p.value));
  const stepX = (W - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (p.value / max) * (H - pad * 2);
    return [x, y];
  });
  const line = coords.map((c, i) => (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H - pad} L${coords[0][0].toFixed(1)} ${H - pad} Z`;
  const ticks = [0, Math.ceil(max / 2), max];
  const grid = ticks.map(t => {
    const y = H - pad - (t / max) * (H - pad * 2);
    return `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
            <text x="4" y="${y + 4}" fill="var(--faint)" font-size="10" font-family="monospace">${t}</text>`;
  }).join("");
  const labels = points.map((p, i) => {
    if (points.length > 10 && i % Math.ceil(points.length / 6) !== 0) return "";
    return `<text x="${(pad + i * stepX).toFixed(1)}" y="${H - 8}" fill="var(--faint)" font-size="9" text-anchor="middle">${p.label}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
    ${grid}
    <path d="${area}" fill="rgba(245,165,36,.12)"/>
    <path d="${line}" fill="none" stroke="var(--amber)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${coords.map(c => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3" fill="var(--amber)"/>`).join("")}
    ${labels}
  </svg>`;
}

function dashboardHTML() {
  const data = state.inspections;
  const open = data.filter(d => d.status === "Nový" || d.status === "V riešení").length;
  const done = data.filter(d => d.status === "Vyriešený").length;

  const byTopic = TOPICS.map((t, i) => ({
    label: t, value: data.filter(d => d.gemba_topic === t).length, color: TOPIC_COLOR[i % TOPIC_COLOR.length]
  }));

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const count = data.filter(x => {
      const t = new Date(x.created_at); return t >= d && t < next;
    }).length;
    days.push({ label: `${d.getDate()}.${d.getMonth() + 1}.`, value: count });
  }

  const legend = byTopic.filter(d => d.value > 0).map(d =>
    `<div class="li"><span class="sw" style="background:${d.color}"></span><span class="nm">${esc(d.label)}</span><span class="vl">${d.value}</span></div>`).join("")
    || `<div class="li"><span class="nm" style="color:var(--faint)">Žiadne dáta</span></div>`;

  return `
    <div class="section-title">Prehľad</div>
    <div class="stats">
      <div class="stat"><div class="num">${data.length}</div><div class="cap">Záznamov spolu</div></div>
      <div class="stat"><div class="num" style="color:var(--st-prog)">${open}</div><div class="cap">Otvorené</div></div>
      <div class="stat"><div class="num" style="color:var(--st-done)">${done}</div><div class="cap">Vyriešené</div></div>
      <div class="stat"><div class="num" style="color:var(--pr-crit)">${data.filter(d => d.priority === "Kritická").length}</div><div class="cap">Kritické</div></div>
    </div>
    <div class="panel">
      <h3>Problémy podľa kategórie</h3>
      ${pieSVG(byTopic)}
      <div class="legend">${legend}</div>
    </div>
    <div class="panel">
      <h3>Nahlásené nálezy — posledných 30 dní</h3>
      ${lineSVG(days)}
    </div>
    <button class="btn" data-action="export-xlsx" style="margin-bottom:10px">${I.download} Stiahnuť Excel (.xlsx)</button>
    <button class="btn ghost" data-action="export-csv">${I.download} Stiahnuť CSV</button>`;
}

/* ============================================================
   EXPORTY
   ============================================================ */
function rowsForExport() {
  return state.inspections.map(it => ({
    ID: it.id, Kategória: it.gemba_topic, Lokalita: it.site, "Presné miesto": it.site_detail,
    "Popis nálezu": it.issue_found, "Možná príčina": it.possible_root_cause,
    "Ďalší krok": it.next_step, Priradené: it.assigned_to, Nahlásil: it.reported_by,
    Stav: it.status, Priorita: it.priority, "Počet fotiek": (it.photos || []).length,
    "Odkazy na fotky": (it.photos || []).join(" | "),
    Vytvorené: fmtDate(it.created_at), Upravené: fmtDate(it.updated_at)
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCSV() {
  const rows = rowsForExport();
  if (!rows.length) return toast("Žiadne dáta na export", true);
  const cols = Object.keys(rows[0]);
  const escCsv = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => escCsv(r[c])).join(","))].join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `gemba-export-${Date.now()}.csv`);
  toast("CSV stiahnuté ✓");
}

async function exportXLSX() {
  const rows = rowsForExport();
  if (!rows.length) return toast("Žiadne dáta na export", true);
  toast("Pripravujem Excel…");
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const XLSX = window.XLSX;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GEMBA");
    XLSX.writeFile(wb, `gemba-report-${Date.now()}.xlsx`);
    toast("Excel stiahnutý ✓");
  } catch (e) { toast("Export Excelu zlyhal: " + e.message, true); }
}

async function exportPDF(it) {
  toast("Generujem PDF…");
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 40; let y = 50;
    doc.setFontSize(20); doc.setTextColor(20); doc.text("GEMBA Walk — záznam", M, y); y += 8;
    doc.setDrawColor(245, 165, 36); doc.setLineWidth(2); doc.line(M, y, 555, y); y += 24;
    const line = (label, val) => {
      doc.setFontSize(9); doc.setTextColor(130); doc.text(String(label).toUpperCase(), M, y); y += 13;
      doc.setFontSize(12); doc.setTextColor(20);
      const txt = doc.splitTextToSize(String(val || "—"), 515);
      doc.text(txt, M, y); y += txt.length * 15 + 8;
      if (y > 760) { doc.addPage(); y = 50; }
    };
    line("Kategória", it.gemba_topic);
    line("Lokalita", it.site);
    line("Presné miesto", it.site_detail);
    line("Stav / Priorita", `${it.status}  •  ${it.priority}`);
    line("Popis nálezu", it.issue_found);
    line("Možná príčina", it.possible_root_cause);
    line("Ďalší krok", it.next_step);
    line("Priradené", it.assigned_to);
    line("Nahlásil", it.reported_by);
    line("Vytvorené", fmtDate(it.created_at));

    const photos = (it.photos || []).slice(0, 4);
    if (photos.length) {
      if (y > 560) { doc.addPage(); y = 50; }
      doc.setFontSize(9); doc.setTextColor(130); doc.text("FOTOGRAFIE", M, y); y += 14;
      let x = M;
      for (const url of photos) {
        try {
          const dataUrl = await urlToDataUrl(url);
          doc.addImage(dataUrl, "JPEG", x, y, 120, 120);
        } catch { /* preskočíme */ }
        x += 130;
        if (x > 430) { x = M; y += 130; if (y > 680) { doc.addPage(); y = 50; } }
      }
    }
    doc.save(`gemba-${(it.site || "zaznam")}-${Date.now()}.pdf`);
    toast("PDF stiahnuté ✓");
  } catch (e) { toast("Generovanie PDF zlyhalo: " + e.message, true); }
}

function urlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("img load"));
    img.src = url;
  });
}

/* ============================================================
   E-MAIL (priame odoslanie + záloha cez mailto)
   ============================================================ */
function emailSubject(it) {
  return `[GEMBA ${it.priority}] ${it.gemba_topic} — ${it.site}${it.site_detail ? " (" + it.site_detail + ")" : ""}`;
}
function emailText(it) {
  return `Nález z obhliadky GEMBA:

Kategória: ${it.gemba_topic}
Lokalita: ${it.site}
Presné miesto: ${it.site_detail || "—"}
Stav: ${it.status}
Priorita: ${it.priority}

Popis nálezu:
${it.issue_found || "—"}

Možná príčina:
${it.possible_root_cause || "—"}

Ďalší krok:
${it.next_step || "—"}

Nahlásil: ${it.reported_by || "—"}
Vytvorené: ${fmtDate(it.created_at)}
${(it.photos || []).length ? "\nFotografie:\n" + it.photos.join("\n") : ""}`;
}
function buildMailto(it, to) {
  return `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(emailSubject(it))}&body=${encodeURIComponent(emailText(it))}`;
}

function openEmailModal(it) {
  const def = (it.assigned_to && it.assigned_to.includes("@")) ? it.assigned_to : "";
  openModal(`
    <div class="modal-head">${I.mail}<h3>Odoslať e-mailom</h3></div>
    <p class="modal-sub">Záznam sa odošle ako e-mail na zadanú adresu.</p>
    <input type="email" id="emailTo" placeholder="prijemca@firma.sk" value="${esc(def)}" />
    <div class="hint">Viac adries oddeľ čiarkou.</div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="modal-close">Zrušiť</button>
      <button class="btn primary" data-action="send-email-now" data-id="${esc(it.id)}">Odoslať</button>
    </div>`);
  setTimeout(() => { const i = $("#emailTo"); if (i) i.focus(); }, 50);
}

async function sendEmailNow(it) {
  const input = $("#emailTo");
  const raw = (input?.value || "").trim();
  if (!raw || !raw.includes("@")) { toast("Zadaj platnú e-mailovú adresu", true); return; }
  const to = raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);

  const btn = $('[data-action="send-email-now"]');
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Odosielam…`; }

  try {
    const r = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: emailSubject(it), text: emailText(it) })
    });
    if (r.ok) { closeModal(); toast("E-mail odoslaný ✓"); return; }
    // 501 = služba nie je nastavená → otvor mailového klienta
    closeModal();
    window.location.href = buildMailto(it, to.join(","));
    toast("Otváram mailového klienta — odoslanie potvrď tam");
  } catch (e) {
    // žiadny server / offline → otvor mailového klienta
    closeModal();
    window.location.href = buildMailto(it, to.join(","));
    toast("Otváram mailového klienta — odoslanie potvrď tam");
  }
}

/* ============================================================
   ZDIEĽANIE + INŠTALÁCIA NA PLOCHU
   ============================================================ */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function appLink() {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

function openShareModal() {
  const link = appLink();
  openModal(`
    <div class="modal-head">${I.share}<h3>Zdieľať / Inštalovať</h3></div>
    <p class="modal-sub">Pošli kolegom tento odkaz. Po otvorení si appku pridajú na plochu telefónu ako ikonku.</p>
    <div class="linkbox" id="appLink">${esc(link)}</div>
    <div class="modal-actions">
      <button class="btn" data-action="copy-link" data-link="${esc(link)}">Kopírovať odkaz</button>
      <button class="btn primary" data-action="share-link" data-link="${esc(link)}">${I.share} Zdieľať…</button>
    </div>
    ${deferredInstallPrompt ? `<button class="btn primary" style="margin-top:10px" data-action="install-app">${I.phone} Inštalovať na tento telefón</button>` : ""}
    <div class="install-help">
      <div class="ih"><b>📱 iPhone (Safari):</b> dole klikni na ikonu Zdieľať (štvorček so šípkou nahor) → posuň zoznam a vyber <b>Pridať na plochu</b> → <b>Pridať</b>.</div>
      <div class="ih"><b>🤖 Android (Chrome):</b> vpravo hore klikni na menu <b>⋮</b> → <b>Pridať na plochu</b> (alebo <b>Inštalovať aplikáciu</b>) → potvrď.</div>
    </div>
    <button class="btn ghost" style="margin-top:10px" data-action="modal-close">Zavrieť</button>`);
}

async function copyLink(link) {
  try { await navigator.clipboard.writeText(link); toast("Odkaz skopírovaný ✓"); }
  catch { toast("Skopíruj odkaz ručne z políčka vyššie"); }
}
async function shareLink(link) {
  if (navigator.share) {
    try { await navigator.share({ title: "GEMBA Walk", text: "Otvor a pridaj si na plochu telefónu:", url: link }); }
    catch { /* používateľ zrušil */ }
  } else { copyLink(link); }
}
async function installApp() {
  if (!deferredInstallPrompt) { toast("Inštaláciu spustíš cez menu prehliadača (viď návod nižšie)"); return; }
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch { /* ignore */ }
  deferredInstallPrompt = null;
  closeModal();
}

/* ============================================================
   RENDER (shell + router)
   ============================================================ */
function render() {
  if (!configured) return renderConfigNotice();
  if (!state.user) return renderAuth();

  let title = "GEMBA Walk", sub = "", left = "", content = "";
  if (state.view === "list") { sub = `${state.inspections.length} záznamov`; content = listHTML(); }
  else if (state.view === "dashboard") { title = "Dashboard"; content = dashboardHTML(); }
  else if (state.view === "detail") {
    const it = state.inspections.find(x => x.id === state.selectedId);
    title = "Detail nálezu";
    left = `<button class="iconbtn" data-action="back">${I.back}</button>`;
    content = it ? detailHTML(it) : `<div class="empty"><div class="big">Záznam sa nenašiel</div></div>`;
  } else if (state.view === "form") {
    title = state.editing ? "Upraviť záznam" : "Nový záznam";
    left = `<button class="iconbtn" data-action="back">${I.close}</button>`;
    content = formHTML();
  }

  const showNav = state.view === "list" || state.view === "dashboard";

  appEl.innerHTML = `
    <div class="shell">
      <div class="topbar">
        ${left || `<div class="brand"><span class="dot"></span><div><div>${esc(title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div></div>`}
        ${left ? `<div class="brand" style="font-size:16px">${esc(title)}</div>` : ""}
        <div class="spacer"></div>
        ${showNav ? `<button class="iconbtn" data-action="share-open" title="Zdieľať / Inštalovať">${I.share}</button>` : ""}
        ${showNav ? `<button class="iconbtn" data-action="logout" title="Odhlásiť">${I.logout}</button>` : ""}
      </div>
      <div id="banner" class="banner"></div>
      <div class="content">${content}</div>
      ${showNav ? navHTML() : ""}
    </div>`;

  updateConnBanner();
  wireView();
}

function navHTML() {
  return `
    <div class="nav">
      <button class="tab ${state.view === "list" ? "active" : ""}" data-action="go-list">${I.list}<span>Zoznam</span></button>
      <button class="fab" data-action="new">${I.plus}</button>
      <button class="tab ${state.view === "dashboard" ? "active" : ""}" data-action="go-dash">${I.chart}<span>Dashboard</span></button>
    </div>`;
}

function renderConfigNotice() {
  appEl.innerHTML = `
    <div class="shell"><div class="content config-notice">
      <h2>⚙️ Treba doplniť pripojenie</h2>
      <p>Appka beží, ale ešte nie je napojená na databázu. Otvor súbor
      <code>js/config.js</code> a doplň údaje zo Supabase (URL + publishable kľúč).</p>
      <p>Podrobný návod nájdeš v súbore <code>README.md</code>.</p>
    </div></div>`;
}

function wireView() {
  if (state.view === "list") {
    const s = $("#searchInput");
    if (s) s.addEventListener("input", e => {
      state.filters.q = e.target.value;
      const holder = document.createElement("div");
      holder.innerHTML = listHTML();
      $(".content").replaceChildren(...holder.childNodes);
      wireView();
      const ns = $("#searchInput"); if (ns) { ns.focus(); ns.setSelectionRange(ns.value.length, ns.value.length); }
    });
    const sf = $("#siteFilter");
    if (sf) sf.addEventListener("change", e => { state.filters.site = e.target.value; render(); });
    const pf = $("#prioFilter");
    if (pf) pf.addEventListener("change", e => { state.filters.priority = e.target.value; render(); });
  }
  if (state.view === "form") {
    const form = $("#inspForm");
    if (form) form.addEventListener("submit", onSubmitForm);
  }
}

/* ============================================================
   EVENT DELEGATION
   ============================================================ */
document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case "toggle-auth":
      state.authMode = state.authMode === "login" ? "signup" : "login"; renderAuth(); break;

    case "logout":
      await supabase.auth.signOut(); state.user = null; render(); break;

    case "go-list": state.view = "list"; render(); break;
    case "go-dash": state.view = "dashboard"; render(); break;

    case "new":
      state.editing = null; state.formPhotos = []; state.view = "form"; render(); break;

    case "back":
      state.view = "list"; render(); break;

    case "open": {
      if (id.startsWith("pending-")) { toast("Záznam čaká na synchronizáciu — detail bude po odoslaní."); break; }
      state.selectedId = id; state.view = "detail"; render(); break;
    }

    case "filter-status":
      state.filters.status = el.dataset.val; render(); break;

    case "edit": {
      const it = state.inspections.find(x => x.id === id);
      if (!it) break;
      state.editing = it;
      state.formPhotos = (it.photos || []).map(u => ({ id: uid(), url: u, uploaded: true }));
      state.view = "form"; render(); break;
    }

    case "delete": {
      if (!confirm("Naozaj zmazať tento záznam? Túto akciu nie je možné vrátiť.")) break;
      try { await removeInspection(id); toast("Záznam zmazaný"); state.view = "list"; await loadInspections(); }
      catch (e) { toast("Mazanie zlyhalo: " + e.message, true); }
      break;
    }

    case "email": {
      const it = state.inspections.find(x => x.id === id);
      if (it) openEmailModal(it);
      break;
    }
    case "send-email-now": {
      const it = state.inspections.find(x => x.id === id);
      if (it) sendEmailNow(it);
      break;
    }
    case "modal-close": closeModal(); break;
    case "modal-backdrop": if (ev.target === el) closeModal(); break;

    case "share-open": openShareModal(); break;
    case "copy-link": copyLink(el.dataset.link); break;
    case "share-link": shareLink(el.dataset.link); break;
    case "install-app": installApp(); break;

    case "pdf": {
      const it = state.inspections.find(x => x.id === id);
      if (it) exportPDF(it);
      break;
    }
    case "export-csv": exportCSV(); break;
    case "export-xlsx": exportXLSX(); break;

    case "info-site":
      toast("Sem napíš presné miesto — napr. „pri stroji XY", regál 3, alebo vstup do haly.");
      break;

    case "seg": {
      const name = el.dataset.seg;
      document.querySelectorAll(`.seg[data-seg="${name}"] button`).forEach(b => {
        b.classList.remove("sel"); b.style.cssText = "";
      });
      el.classList.add("sel");
      const map = name === "status" ? STATUS_COLOR : PRIORITY_COLOR;
      const c = map[el.dataset.val];
      el.style.cssText = `border-color:${c};background:color-mix(in srgb, ${c} 22%, var(--surface-2))`;
      break;
    }

    case "pick-camera":
      { const fp = $("#filePicker"); fp.setAttribute("capture", "environment"); fp.click(); }
      break;
    case "pick-gallery":
      { const fp = $("#filePicker"); fp.removeAttribute("capture"); fp.click(); }
      break;

    case "rm-photo":
      state.formPhotos = state.formPhotos.filter(p => p.id !== id);
      refreshPhotoGrid(); break;
  }
});

/* ---------- Výber fotiek ---------- */
$("#filePicker").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const ph = { id: uid(), dataUrl: "", uploading: true, uploaded: false };
    state.formPhotos.push(ph);
    refreshPhotoGrid();
    try {
      ph.dataUrl = await compressImage(f);
      ph.uploading = false;
    } catch {
      state.formPhotos = state.formPhotos.filter(p => p.id !== ph.id);
      toast("Fotku sa nepodarilo spracovať", true);
    }
    refreshPhotoGrid();
  }
});

function refreshPhotoGrid() {
  const grid = $("#photoGrid");
  if (!grid) return;
  grid.innerHTML = state.formPhotos.map(p => photoTile(p)).join("");
}

/* ---------- Uloženie formulára ---------- */
async function onSubmitForm(e) {
  e.preventDefault();
  const payload = readForm();
  if (!payload.issue_found) { toast("Vyplň aspoň popis nálezu", true); return; }

  const btn = $("#saveBtn");
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Ukladám…`;

  if (!navigator.onLine && !state.editing) {
    const photoDataUrls = state.formPhotos.filter(p => !p.uploaded && p.dataUrl).map(p => p.dataUrl);
    queueInspection(payload, photoDataUrls);
    toast("Si offline — uložené lokálne, odošle sa po pripojení");
    state.view = "list"; render(); return;
  }

  try {
    await saveInspection(payload, state.editing?.id);
    toast(state.editing ? "Záznam upravený ✓" : "Záznam uložený ✓");
    state.editing = null; state.formPhotos = [];
    state.view = "list";
    await loadInspections();
  } catch (err) {
    btn.disabled = false; btn.textContent = "Uložiť záznam";
    toast("Uloženie zlyhalo: " + (err.message || err), true);
  }
}

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener("online", () => { updateConnBanner(); flushQueue(); });
window.addEventListener("offline", updateConnBanner);

async function init() {
  if (!configured) { renderConfigNotice(); return; }

  const { data: { session } } = await supabase.auth.getSession();
  state.user = session?.user || null;

  supabase.auth.onAuthStateChange((_e, sess) => {
    const was = state.user?.id;
    state.user = sess?.user || null;
    if (state.user && state.user.id !== was) {
      state.view = "list";
      loadInspections().then(flushQueue);
    } else if (!state.user) {
      render();
    }
  });

  if (state.user) {
    render();
    await loadInspections();
    await flushQueue();
    try {
      supabase.channel("inspections-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, () => {
          if (state.view === "list" || state.view === "dashboard") loadInspections();
        }).subscribe();
    } catch { /* realtime nie je kritické */ }
  } else {
    render();
  }
}

init();
