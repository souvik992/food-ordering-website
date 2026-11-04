// Website builder: sign in with the store's website editor password, change the design beside a live preview, Publish.
// The design is kept on the order hub (a draft while you work, and the published copy customers see).
(function () {
  'use strict';
  const C = window.TIFFIN_CONFIG, S = window.SiteSchema;
  const params = new URLSearchParams(location.search);
  const base = (params.get('hub') || C.hubUrl).replace(/\/+$/, '');
  const slug = params.get('store') || C.store;
  const sitePath = `/v1/site/${encodeURIComponent(slug)}`;
  const TOKEN = `tf_site_token_${slug}`;
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private window */ } },
  };
  const $root = document.getElementById('root');

  let token = ls.get(TOKEN);
  let st = null;            // { store, draft, published, unpublished, publishedAt }
  let draft = null;         // the design being edited
  let menu = [];            // dishes from the POS (for Featured dishes)
  const ui = { tab: 'sections', open: null, adding: false, device: 'desktop', showPreview: false, status: '', statusKind: '', drag: null };
  const undo = [], redo = [];

  /* ---------- small helpers ---------- */
  /** DOM helper: text only, never HTML (everything typed in the builder is shown as text). */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = Boolean(v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(4)) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  }
  const imgUrl = (ref) => (!ref ? '' : ref.startsWith('hub:') ? `${base}/v1/stores/${encodeURIComponent(slug)}/images/${encodeURIComponent(ref.slice(4))}` : ref);
  let toastT;
  function toast(msg, err = false) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.toggle('err', err); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 6000 : 2600);
  }
  const newId = (type) => `${type}-${Math.random().toString(36).slice(2, 7)}`;

  async function api(method, path, body) {
    let r;
    try {
      r = await fetch(base + path, { method, headers: { ...(token ? { 'X-Site-Token': token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw new Error('Could not reach the order hub. Check your internet connection.'); }
    const j = await r.json().catch(() => null);
    if (r.status === 401 && path !== `${sitePath}/login`) { signOut('You were signed out. Sign in again.'); throw new Error('Signed out.'); }
    if (!r.ok) { const e = new Error(j?.error?.message || `Something went wrong (${r.status}).`); e.fields = j?.error?.details?.fields; throw e; }
    return j;
  }

  /* ---------- sign in ---------- */
  function signOut(msg) {
    if (token) fetch(base + `${sitePath}/logout`, { method: 'POST', headers: { 'X-Site-Token': token } }).catch(() => {});
    token = null; ls.set(TOKEN, null); st = null; draft = null;
    renderLogin(msg);
  }
  function renderLogin(msg = '') {
    const err = h('p', { class: 'hint', style: { color: 'var(--red)', minHeight: '18px' } }, msg);
    const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, placeholder: 'XXXX-XXXX-XXXX', 'aria-label': 'Website editor password' });
    const btn = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%', marginTop: '12px', height: '42px' } }, 'Sign in');
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; err.textContent = '';
      try {
        const r = await api('POST', `${sitePath}/login`, { password: pw.value });
        token = r.token; ls.set(TOKEN, token); await start();
      } catch (x) { err.textContent = x.message; btn.disabled = false; pw.select(); }
    } }, h('div', { class: 'field' }, h('label', {}, 'Website editor password'), pw), btn, err);
    $root.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-card' },
      h('h1', {}, 'Website builder'), h('p', {}, `Design your ordering website (${slug}). Ask your order hub admin for the password.`), form)));
    pw.focus();
  }

  /* ---------- changes, undo, saving, preview ---------- */
  let lastKey = null, lastAt = 0;
  /** Every edit goes through here. Typing in one field within 1.5 s counts as one step for Undo. */
  function change(fn, key = null, rerender = true) {
    const now = Date.now();
    if (!(key && key === lastKey && now - lastAt < 1500)) { undo.push(JSON.stringify(draft)); if (undo.length > 100) undo.shift(); redo.length = 0; }
    lastKey = key; lastAt = now;
    fn(draft);
    st.unpublished = true;
    preview(); scheduleSave();
    if (rerender) renderPanel(); else renderTop();
  }
  function step(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(draft)); draft = JSON.parse(from.pop()); lastKey = null;
    st.unpublished = true; preview(); scheduleSave(); renderPanel();
  }

  let saveT = null, saving = null;
  function scheduleSave() { clearTimeout(saveT); setStatus('Unsaved changes', 'warn'); saveT = setTimeout(save, 900); }
  async function save() {
    clearTimeout(saveT); saveT = null;
    if (saving) { await saving; if (!saveT) return save(); }
    setStatus('Saving…');
    const body = JSON.parse(JSON.stringify(draft));
    saving = api('PUT', `${sitePath}/draft`, { site: body }).then((r) => {
      st.unpublished = r.unpublished; st.publishedAt = r.publishedAt;
      setStatus(r.unpublished ? 'Draft saved · not published yet' : 'Saved · same as the live website', r.unpublished ? 'warn' : '');
    }).catch((e) => {
      setStatus('Not saved', 'err');
      toast(e.fields ? describe(e.fields) : e.message, true);
    }).finally(() => { saving = null; });
    return saving;
  }
  /** "sections.2.title: Keep it under 80 characters." → "Hero banner › Headline: Keep it …" */
  function describe(fields) {
    const [path, msg] = Object.entries(fields)[0];
    const p = path.split('.');
    if (p[0] === 'sections') {
      const sec = draft.sections[Number(p[1])], def = sec && S.SECTIONS[sec.type];
      const f = def?.fields.find(([k]) => k === p[2]);
      return `${def?.label || 'Section'}${f ? ` › ${f[1]}` : ''}: ${msg}`;
    }
    const TAB = { theme: 'Theme', brand: 'Brand & SEO', contact: 'Contact', menu: 'Menu', bar: 'Announcement bar' };
    return `${TAB[p[0]] || p[0]}${p[1] ? ` › ${p[1]}` : ''}: ${msg}`;
  }
  function setStatus(text, kind = '') { ui.status = text; ui.statusKind = kind; const el = document.getElementById('status'); if (el) { el.textContent = text; el.className = `status ${kind}`; } renderTop(); }

  let frame = null, ready = false, raf = 0, focusId = null;
  function preview(focus) {
    if (focus) focusId = focus;
    if (!frame || !ready) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { frame.contentWindow.postMessage({ type: 'tiffin-site', site: draft, focus: focusId }, location.origin); focusId = null; });
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'tiffin-ready') { ready = true; preview(); }
    if (e.data?.type === 'tiffin-edit') { ui.tab = 'sections'; ui.open = e.data.id; ui.adding = false; ui.showPreview = false; renderPanel(); document.querySelector(`[data-sec="${CSS.escape(e.data.id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  });
  window.addEventListener('beforeunload', (e) => { if (saveT || saving) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start ---------- */
  async function start() {
    $root.replaceChildren(h('div', { class: 'login' }, h('p', { class: 'hint' }, 'Loading your website…')));
    try {
      st = await api('GET', sitePath);
      draft = S.normalise(st.draft);
    } catch (e) { if (token) renderLogin(e.message); return; }
    try {
      const shop = await fetch(`${base}/v1/stores/${encodeURIComponent(slug)}`).then((r) => r.json());
      const cats = new Map((shop.menu?.categories || []).map((c) => [c.id, c.name]));
      menu = (shop.menu?.items || []).map((i) => ({ id: i.id, name: i.name, category: cats.get(i.categoryId) || '', price: i.price }));
    } catch { menu = []; }
    setStatus(st.unpublished ? 'Draft saved · not published yet' : 'Same as the live website', st.unpublished ? 'warn' : '');
    renderApp();
  }

  /* ---------- the builder ---------- */
  function renderApp() {
    const q = new URLSearchParams({ preview: '1' });
    if (params.get('hub')) q.set('hub', params.get('hub'));
    if (params.get('store')) q.set('store', params.get('store'));
    ready = false;
    frame = h('iframe', { src: `../index.html?${q}`, title: 'Website preview' });
    $root.replaceChildren(h('div', { class: `app ${ui.showPreview ? 'show-preview' : ''}`, id: 'app' },
      h('header', { class: 'top', id: 'top' }),
      h('div', { class: 'main' },
        h('aside', { class: 'panel' }, h('nav', { class: 'tabs', id: 'tabs' }), h('div', { class: 'panel-body', id: 'panel' })),
        h('div', { class: `stage ${ui.device}`, id: 'stage' }, h('div', { class: 'frame' }, frame)))));
    renderPanel();
  }

  function renderTop() {
    const top = document.getElementById('top');
    if (!top || !st) return;
    const dev = (k, label) => h('button', { class: ui.device === k ? 'on' : '', 'aria-pressed': String(ui.device === k), onclick: () => { ui.device = k; document.getElementById('stage').className = `stage ${k}`; renderTop(); } }, label);
    top.replaceChildren(
      h('div', { class: 'title' }, h('b', {}, 'Website builder'), h('small', {}, `${st.store.name} · ${st.publishedAt ? `published ${new Date(st.publishedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'not published yet'}`)),
      h('span', { class: `status ${ui.statusKind}`, id: 'status' }, ui.status),
      h('div', { class: 'history' },
        h('button', { class: 'icon', title: 'Undo', 'aria-label': 'Undo', disabled: !undo.length, onclick: () => step(undo, redo) }, '↶'),
        h('button', { class: 'icon', title: 'Redo', 'aria-label': 'Redo', disabled: !redo.length, onclick: () => step(redo, undo) }, '↷')),
      h('div', { class: 'devices seg' }, dev('desktop', 'Computer'), dev('tablet', 'Tablet'), dev('phone', 'Phone')),
      h('button', { class: 'btn sm mobile-switch', onclick: () => { ui.showPreview = !ui.showPreview; document.getElementById('app').classList.toggle('show-preview', ui.showPreview); renderTop(); } }, ui.showPreview ? 'Edit' : 'Preview'),
      h('a', { class: 'btn sm ghost hide-m', href: `../index.html${params.get('hub') || params.get('store') ? `?${new URLSearchParams([...params].filter(([k]) => k === 'hub' || k === 'store'))}` : ''}`, target: '_blank', rel: 'noopener' }, 'View live'),
      h('button', { class: 'btn sm ghost hide-m', disabled: !st.unpublished, title: 'Throw away the changes since the last Publish', onclick: discard }, 'Discard'),
      h('button', { class: 'btn sm primary', disabled: !st.unpublished, onclick: publish }, 'Publish'),
      h('button', { class: 'btn sm ghost', onclick: () => { if (!saveT || confirm('Changes from the last second are not saved yet. Sign out anyway?')) signOut(); } }, 'Sign out'));
  }

  async function publish(e) {
    const b = e.currentTarget; b.disabled = true;
    try {
      if (saveT || saving) await save();
      if (ui.statusKind === 'err') throw new Error('Fix the problem shown first: the draft could not be saved.');
      const r = await api('POST', `${sitePath}/publish`);
      st.unpublished = r.unpublished; st.publishedAt = r.publishedAt;
      setStatus('Live · customers see this now');
      toast('Published. Customers see the new website when they open or reload it.');
    } catch (x) { toast(x.message, true); renderTop(); }
  }
  async function discard() {
    if (!confirm('Throw away every change since the last Publish? The builder goes back to the live website.')) return;
    clearTimeout(saveT); saveT = null;
    try {
      if (saving) await saving;
      const r = await api('POST', `${sitePath}/discard`);
      st.unpublished = r.unpublished; draft = S.normalise(r.draft); undo.length = 0; redo.length = 0;
      setStatus('Same as the live website'); preview(); renderPanel();
    } catch (x) { toast(x.message, true); }
  }

  const TABS = [['sections', 'Sections'], ['theme', 'Theme'], ['brand', 'Brand & SEO'], ['contact', 'Contact'], ['menu', 'Menu']];
  function renderPanel() {
    renderTop();
    const tabs = document.getElementById('tabs'), panel = document.getElementById('panel');
    if (!tabs) return;
    tabs.replaceChildren(...TABS.map(([k, label]) => h('button', { class: ui.tab === k ? 'on' : '', onclick: () => { ui.tab = k; renderPanel(); } }, label)));
    const scroll = panel.scrollTop;
    panel.replaceChildren(...({ sections: sectionsTab, theme: themeTab, brand: brandTab, contact: contactTab, menu: menuTab }[ui.tab])());
    panel.scrollTop = scroll;
  }

  /* ---------- field editors ---------- */
  // get/put read and write one value of the draft; key groups typing for Undo
  function textField(label, get, put, { max, multiline, placeholder, hint, key } = {}) {
    const count = max ? h('span', { class: 'count' }, `${(get() || '').length}/${max}`) : null;
    const input = h(multiline ? 'textarea' : 'input', { class: 'input', maxlength: max, placeholder, value: get() || '', rows: multiline ? '4' : null,
      oninput: (e) => { if (count) count.textContent = `${e.target.value.length}/${max}`; change(() => put(e.target.value), key, false); } });
    return h('div', { class: 'field' }, h('label', {}, label, count), input, hint ? h('p', { class: 'hint' }, hint) : null);
  }
  function choiceField(label, options, get, put) {
    return h('div', { class: 'field' }, h('span', { class: 'label' }, label),
      h('div', { class: 'seg' }, options.map(([v, l]) => h('button', { class: get() === v ? 'on' : '', type: 'button', onclick: () => change(() => put(v)) }, l))));
  }
  function toggleField(label, get, put, hint) {
    return h('div', {}, h('label', { class: 'switch' }, label, h('input', { type: 'checkbox', checked: get(), onchange: (e) => change(() => put(e.target.checked)) })), hint ? h('p', { class: 'hint', style: { marginTop: '-4px' } }, hint) : null);
  }
  function colorField(label, get, put, key) {
    const hex = h('input', { class: 'input', value: get(), maxlength: '7', oninput: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { pick.value = e.target.value; change(() => put(e.target.value.toLowerCase()), key, false); } } });
    const pick = h('input', { type: 'color', value: get(), 'aria-label': label, oninput: (e) => { hex.value = e.target.value; change(() => put(e.target.value), key, false); } });
    return h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'color' }, pick, hex));
  }
  function fontField(label, get, put) {
    return h('div', { class: 'field' }, h('label', {}, label),
      h('select', { class: 'input', style: { fontFamily: `'${get()}'` }, onchange: (e) => change(() => put(e.target.value)) },
        S.FONTS.map((f) => h('option', { value: f, selected: f === get(), style: { fontFamily: `'${f}'` } }, f))));
  }
  function imageField(label, get, put, { kind = 'wide', hint } = {}) {
    const wrap = h('div', { class: 'field' });
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      wrap.classList.add('busy');
      try { const ref = await upload(f, kind); change(() => put(ref)); toast('Photo uploaded.'); } catch (x) { toast(x.message, true); } finally { wrap.classList.remove('busy'); }
    } });
    const v = get();
    wrap.append(...[h('label', {}, label),
      h('div', { class: 'img-field' },
        h('div', { class: `thumb ${kind === 'wide' ? '' : 'square'}`, style: v ? { backgroundImage: `url("${imgUrl(v).replace(/"/g, '%22')}")`, backgroundSize: kind === 'wide' ? 'cover' : 'contain' } : {} }, v ? '' : '🖼'),
        h('div', { class: 'img-actions' }, h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, v ? 'Change' : 'Upload'),
          v ? h('button', { class: 'btn sm ghost danger', type: 'button', onclick: () => change(() => put('')) }, 'Remove') : null)),
      file,
      h('details', { class: 'img-link' }, h('summary', {}, 'or use an image link'),
        h('input', { class: 'input', placeholder: 'https://…', value: v.startsWith('https://') ? v : '', onchange: (e) => { const u = e.target.value.trim(); if (!u || /^https:\/\/\S+$/.test(u)) change(() => put(u)); else toast('Use an https:// link.', true); } })),
      hint ? h('p', { class: 'hint' }, hint) : null].filter(Boolean));
    return wrap;
  }
  function imagesField(label, get, put, max) {
    const wrap = h('div', { class: 'field' });
    const list = get();
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onchange: async (e) => {
      const files = [...e.target.files].slice(0, max - list.length); e.target.value = '';
      if (!files.length) return;
      wrap.classList.add('busy');
      const refs = [];
      for (const f of files) { try { refs.push(await upload(f, 'wide')); } catch (x) { toast(x.message, true); } }
      wrap.classList.remove('busy');
      if (refs.length) { change(() => put([...get(), ...refs].slice(0, max))); toast(`${refs.length} photo${refs.length > 1 ? 's' : ''} added.`); }
    } });
    wrap.append(...[h('label', {}, label, h('span', { class: 'count' }, `${list.length}/${max}`)),
      list.length ? h('div', { class: 'thumbs' }, list.map((ref, i) => h('div', { class: 'thumb', style: { backgroundImage: `url("${imgUrl(ref).replace(/"/g, '%22')}")` } },
        h('button', { class: 'x', type: 'button', title: 'Remove', 'aria-label': 'Remove photo', onclick: () => change(() => put(get().filter((_, j) => j !== i))) }, '✕')))) : null,
      list.length < max ? h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, list.length ? 'Add more photos' : 'Add photos') : null, file].filter(Boolean));
    return wrap;
  }
  function starsField(label, get, put) {
    return h('div', { class: 'field' }, h('span', { class: 'label' }, label),
      h('div', { class: 'stars-pick' }, [1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: n <= get() ? 'on' : '', 'aria-label': `${n} stars`, onclick: () => change(() => put(n)) }, '★'))));
  }
  function dishesField(label, get, put, max) {
    const chosen = get();
    const search = h('input', { class: 'input', placeholder: 'Search dishes', style: { marginBottom: '6px' } });
    const list = h('div', { class: 'dishes' });
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      const rows = menu.filter((d) => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
      list.replaceChildren(...(rows.length ? rows.map((d) => {
        const on = chosen.includes(d.id);
        return h('label', { class: 'dish' }, h('input', { type: 'checkbox', checked: on, disabled: !on && chosen.length >= max,
          onchange: (e) => change(() => put(e.target.checked ? [...get(), d.id] : get().filter((x) => x !== d.id))) }), d.name, h('small', {}, d.category));
      }) : [h('p', { class: 'hint', style: { padding: '10px' } }, menu.length ? 'No dish matches.' : 'No menu on the hub yet: dishes appear here once the POS publishes its menu.')]));
    };
    search.addEventListener('input', fill); fill();
    const names = chosen.map((id) => menu.find((d) => d.id === id)?.name).filter(Boolean);
    return h('div', { class: 'field' }, h('label', {}, label, h('span', { class: 'count' }, `${chosen.length}/${max}`)),
      names.length ? h('div', { class: 'chips' }, names.map((n) => h('span', {}, n))) : null, search, list);
  }
  function listField(label, get, put, spec, keyBase) {
    const items = get();
    const move = (i, d) => change(() => { const a = [...get()]; [a[i], a[i + d]] = [a[i + d], a[i]]; put(a); });
    return h('div', { class: 'field' }, h('span', { class: 'label' }, label, h('span', { class: 'count' }, `${items.length}/${spec.max}`)),
      h('div', { class: 'items' }, items.map((it, i) => h('div', { class: 'item' },
        h('div', { class: 'item-tools' },
          h('button', { class: 'icon', type: 'button', title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          h('button', { class: 'icon', type: 'button', title: 'Move down', disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓'),
          h('button', { class: 'icon', type: 'button', title: 'Remove', onclick: () => change(() => put(get().filter((_, j) => j !== i))) }, '✕')),
        spec.fields.map(([k, l, kind, extra]) => editor(l, kind, extra, () => get()[i][k], (v) => { get()[i][k] = v; }, `${keyBase}.${i}.${k}`))))),
      items.length < spec.max ? h('button', { class: 'btn sm', type: 'button', onclick: () => change(() => put([...get(), S.clone(spec.blank)])) }, `+ ${spec.add}`) : null);
  }
  /** One field of a section, by its kind in js/site-schema.js. */
  function editor(label, kind, extra, get, put, key) {
    switch (kind) {
      case 'text': return textField(label, get, put, { max: extra, key });
      case 'textarea': return textField(label, get, put, { max: extra, multiline: true, key });
      case 'image': return imageField(label, get, put, { kind: extra || 'wide' });
      case 'images': return imagesField(label, get, put, extra);
      case 'choice': return choiceField(label, extra, get, put);
      case 'toggle': return toggleField(label, get, put);
      case 'stars': return starsField(label, get, put);
      case 'dishes': return dishesField(label, get, put, extra);
      case 'list': return listField(label, get, put, extra, key);
      default: return null;
    }
  }

  /* ---------- photos: made smaller in the browser, then uploaded to the hub ---------- */
  async function upload(file, kind) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
    if (!crypto.subtle) throw new Error('Open the builder over https:// to upload photos.');
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This photo could not be opened.')); i.src = URL.createObjectURL(file); });
    const maxSide = kind === 'wide' ? 1800 : 512;
    const keepPng = file.type === 'image/png' && kind !== 'wide'; // logos keep a see-through background
    let blob = null;
    for (const [side, q] of [[maxSide, 0.86], [maxSide, 0.72], [Math.round(maxSide * 0.7), 0.7]]) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const g = c.getContext('2d');
      if (!keepPng) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      blob = await new Promise((r) => c.toBlob(r, keepPng ? 'image/png' : 'image/jpeg', q));
      if (blob && blob.size <= 1_400_000) break;
    }
    URL.revokeObjectURL(img.src);
    if (!blob || blob.size > 1_400_000) throw new Error('This photo is too large even after shrinking it. Try a smaller one.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const name = `${hex}.${keepPng ? 'png' : 'jpg'}`;
    return (await api('PUT', `${sitePath}/images/${name}`, { dataBase64: btoa(bin) })).ref;
  }

  /* ---------- tabs ---------- */
  function sectionsTab() {
    const b = draft.bar;
    const bar = h('div', { class: 'group' }, h('h3', {}, 'Announcement bar'),
      toggleField('Show a bar above the header', () => b.show, (v) => { b.show = v; }),
      b.show ? [textField('Message', () => b.text, (v) => { b.text = v; }, { max: 200, placeholder: 'Free delivery above ₹499 this week', key: 'bar.text' }),
        textField('Link (optional)', () => b.link, (v) => { b.link = v.trim(); }, { max: 500, placeholder: 'https://…', key: 'bar.link' })] : null);

    const list = h('div', { class: 'sections' }, draft.sections.map((s, i) => sectionRow(s, i)));
    const adder = ui.adding
      ? h('div', {}, h('div', { class: 'add-grid' }, Object.entries(S.SECTIONS).filter(([, d]) => !d.fixed).map(([type, d]) => h('button', { type: 'button', onclick: () => {
        const sec = S.newSection(type, newId(type));
        change(() => { const at = ui.open ? draft.sections.findIndex((x) => x.id === ui.open) + 1 : draft.sections.length; draft.sections.splice(at || draft.sections.length, 0, sec); });
        ui.open = sec.id; ui.adding = false; renderPanel(); preview(sec.id);
      } }, h('span', {}, d.icon), h('b', {}, d.label), h('small', {}, d.about)))),
        h('button', { class: 'btn sm ghost', style: { marginTop: '8px' }, onclick: () => { ui.adding = false; renderPanel(); } }, 'Cancel'))
      : draft.sections.length < 20 ? h('button', { class: 'btn add-btn', onclick: () => { ui.adding = true; renderPanel(); } }, '+ Add section') : h('p', { class: 'hint' }, 'A page can have up to 20 sections.');
    return [bar, h('div', { class: 'group' }, h('h3', {}, 'Page sections'), h('p', { class: 'hint', style: { margin: '-4px 0 10px' } }, 'Drag ⋮⋮ to reorder. Click a section, or ✎ in the preview, to edit it.'), list, adder)];
  }

  function sectionRow(s, i) {
    const def = S.SECTIONS[s.type], open = ui.open === s.id;
    const summary = s.title || (s.type === 'hero' ? 'No headline' : def.about);
    const row = h('div', { class: `sec ${open ? 'open' : ''} ${s.hidden ? 'hidden-sec' : ''}`, 'data-sec': s.id,
      ondragover: (e) => { if (!ui.drag || ui.drag === s.id) return; e.preventDefault(); const r = row.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; row.classList.toggle('drop-after', after); row.classList.toggle('drop-before', !after); },
      ondragleave: () => row.classList.remove('drop-before', 'drop-after'),
      ondrop: (e) => {
        e.preventDefault(); const after = row.classList.contains('drop-after'); row.classList.remove('drop-before', 'drop-after');
        const from = draft.sections.findIndex((x) => x.id === ui.drag); if (from < 0) return;
        change(() => { const [m] = draft.sections.splice(from, 1); let to = draft.sections.findIndex((x) => x.id === s.id); if (after) to++; draft.sections.splice(to, 0, m); });
        preview(ui.drag);
      } },
      h('div', { class: 'sec-row' },
        h('span', { class: 'handle', draggable: 'true', title: 'Drag to move', ondragstart: (e) => { ui.drag = s.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.setDragImage(row, 20, 20); row.classList.add('dragging'); },
          ondragend: () => { ui.drag = null; row.classList.remove('dragging'); } }, '⋮⋮'),
        h('button', { class: 'sec-name', onclick: () => { ui.open = open ? null : s.id; ui.adding = false; renderPanel(); if (!open) preview(s.id); } },
          h('span', { class: 'ic' }, def.icon), h('span', {}, h('b', {}, def.label), h('small', {}, summary))),
        def.fixed ? null : h('button', { class: 'icon', title: s.hidden ? 'Show on the website' : 'Hide from the website', 'aria-label': s.hidden ? 'Show' : 'Hide', onclick: () => change(() => { s.hidden = !s.hidden; }) }, s.hidden ? '🙈' : '👁')));
    if (open) {
      const move = (d) => { change(() => { const [m] = draft.sections.splice(i, 1); draft.sections.splice(i + d, 0, m); }); preview(s.id); };
      row.append(h('div', { class: 'sec-body' },
        h('div', { class: 'sec-tools' },
          h('button', { class: 'btn sm', disabled: i === 0, onclick: () => move(-1) }, '↑ Up'),
          h('button', { class: 'btn sm', disabled: i === draft.sections.length - 1, onclick: () => move(1) }, '↓ Down'),
          def.fixed ? null : h('button', { class: 'btn sm', disabled: draft.sections.length >= 20, onclick: () => { const c = { ...S.clone(s), id: newId(s.type) }; change(() => draft.sections.splice(i + 1, 0, c)); ui.open = c.id; renderPanel(); preview(c.id); } }, 'Duplicate'),
          def.fixed ? null : h('button', { class: 'btn sm danger', onclick: () => { if (confirm(`Remove the ${def.label} section?`)) { change(() => draft.sections.splice(i, 1)); ui.open = null; renderPanel(); } } }, 'Remove')),
        h('p', { class: 'hint', style: { margin: '0 0 12px' } }, def.about),
        def.fields.map(([k, label, kind, extra, hint]) => {
          if (kind === 'text') return textField(label, () => s[k], (v) => { s[k] = v; }, { max: extra, hint, key: `${s.id}.${k}` });
          return editor(label, kind, extra, () => s[k], (v) => { s[k] = v; }, `${s.id}.${k}`);
        })));
    }
    return row;
  }

  function themeTab() {
    const t = draft.theme;
    const same = (p) => Object.entries(p.theme).every(([k, v]) => t[k] === v);
    return [
      h('div', { class: 'group' }, h('h3', {}, 'Ready-made looks'),
        h('div', { class: 'presets' }, S.PRESETS.map((p) => h('button', { class: `preset ${same(p) ? 'on' : ''}`, type: 'button', onclick: () => change(() => { draft.theme = { ...p.theme }; }) },
          h('div', { class: 'sw' }, [p.theme.primary, p.theme.accent, p.theme.text, p.theme.background].map((c) => h('span', { style: { background: c } }))),
          h('b', { style: { fontFamily: `'${p.theme.headingFont}'` } }, p.name))))),
      h('div', { class: 'group' }, h('h3', {}, 'Colours'),
        h('div', { class: 'colors' },
          colorField('Main colour', () => t.primary, (v) => { t.primary = v; }, 'theme.primary'),
          colorField('Second colour', () => t.accent, (v) => { t.accent = v; }, 'theme.accent'),
          colorField('Text', () => t.text, (v) => { t.text = v; }, 'theme.text'),
          colorField('Background', () => t.background, (v) => { t.background = v; }, 'theme.background')),
        h('p', { class: 'hint' }, 'Buttons use the main colour with white text: pick one dark enough to read.')),
      h('div', { class: 'group' }, h('h3', {}, 'Fonts'),
        fontField('Headings', () => t.headingFont, (v) => { t.headingFont = v; }),
        fontField('Text', () => t.font, (v) => { t.font = v; })),
      h('div', { class: 'group' }, h('h3', {}, 'Shapes'),
        choiceField('Corners', [['square', 'Square'], ['soft', 'Soft'], ['rounded', 'Round']], () => t.radius, (v) => { t.radius = v; }),
        choiceField('Buttons', [['square', 'Square'], ['rounded', 'Rounded'], ['pill', 'Pill']], () => t.buttons, (v) => { t.buttons = v; })),
      h('div', { class: 'group' }, h('h3', {}, 'Header'),
        choiceField('Header style', [['light', 'Light'], ['dark', 'Dark'], ['brand', 'Main colour']], () => t.header, (v) => { t.header = v; })),
    ];
  }

  function brandTab() {
    const b = draft.brand;
    const t = (label, k, max, o = {}) => textField(label, () => b[k], (v) => { b[k] = v; }, { max, key: `brand.${k}`, ...o });
    const name = b.name || st.store.name;
    const serp = h('div', { class: 'serp' }, h('div', { class: 'u' }, location.host || 'your-website'), h('div', { class: 't' }, b.seoTitle || `${name} · Order online`), h('div', { class: 'd' }, b.seoDescription || b.tagline || 'Add a description so people know what you serve.'));
    return [
      h('div', { class: 'group' }, h('h3', {}, 'Name and logo'),
        t('Restaurant name', 'name', 60, { placeholder: st.store.name, hint: 'Empty: the name on the order hub.' }),
        t('Tagline', 'tagline', 80, { placeholder: 'Home-style biryani since 1998' }),
        imageField('Logo', () => b.logo, (v) => { b.logo = v; }, { kind: 'logo', hint: 'Shown in the header instead of the name. A PNG with a see-through background looks best.' }),
        imageField('Browser tab icon', () => b.favicon, (v) => { b.favicon = v; }, { kind: 'icon', hint: 'A small square picture. Empty: the logo.' })),
      h('div', { class: 'group' }, h('h3', {}, 'Google and sharing'),
        t('Page title', 'seoTitle', 70, { placeholder: `${name} · Order online` }),
        t('Description', 'seoDescription', 160, { multiline: true, placeholder: 'Order biryani, kebabs and thalis online for delivery or pickup in Bengaluru.' }),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'How it can look on Google'), serp),
        imageField('Picture when the link is shared', () => b.shareImage, (v) => { b.shareImage = v; }, { hint: 'On WhatsApp, Facebook and others. Empty: the hero photo.' })),
    ];
  }

  function contactTab() {
    const c = draft.contact;
    const t = (label, k, max, o = {}) => textField(label, () => c[k], (v) => { c[k] = v; }, { max, key: `contact.${k}`, ...o });
    return [
      h('div', { class: 'group' }, h('h3', {}, 'Contact'),
        t('Phone', 'phone', 20, { placeholder: '+91 98765 43210' }),
        t('WhatsApp number', 'whatsapp', 20, { placeholder: '98765 43210' }),
        t('Email', 'email', 100, { placeholder: 'hello@restaurant.in' }),
        t('Address', 'address', 200, { multiline: true, placeholder: '12, 80 Feet Road, Kalyan Nagar, Bengaluru 560043', hint: 'Also shown for pickup orders.' }),
        t('Google Maps link', 'mapUrl', 500, { placeholder: 'https://maps.app.goo.gl/…', hint: 'For the Directions button. Empty: the store location from the POS.' })),
      h('div', { class: 'group' }, h('h3', {}, 'Social media'),
        t('Instagram', 'instagram', 500, { placeholder: 'https://instagram.com/…' }),
        t('Facebook', 'facebook', 500, { placeholder: 'https://facebook.com/…' }),
        t('YouTube', 'youtube', 500, { placeholder: 'https://youtube.com/@…' })),
      h('div', { class: 'group' }, h('h3', {}, 'Footer'),
        t('Text in the footer', 'footerText', 200, { multiline: true, placeholder: 'Home-style food cooked fresh in our kitchen every day.' })),
    ];
  }

  function menuTab() {
    const m = draft.menu;
    return [h('div', { class: 'group' }, h('h3', {}, 'How dishes show'),
      choiceField('Layout', [['grid', 'Cards'], ['list', 'List']], () => m.layout, (v) => { m.layout = v; }),
      toggleField('Dish photos', () => m.showPhotos, (v) => { m.showPhotos = v; }),
      toggleField('Descriptions', () => m.showDescriptions, (v) => { m.showDescriptions = v; }),
      toggleField('Veg / non-veg marks', () => m.showVeg, (v) => { m.showVeg = v; }),
      toggleField('Category buttons above the menu', () => m.showCategoryChips, (v) => { m.showCategoryChips = v; })),
    h('p', { class: 'hint' }, 'Dishes, prices, photos and what is available come from your POS. Change them there.')];
  }

  document.addEventListener('keydown', (e) => {
    if (!draft || !(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? step(redo, undo) : step(undo, redo); }
    if (e.key.toLowerCase() === 'y') { e.preventDefault(); step(redo, undo); }
  });

  token ? start() : renderLogin();
})();
