// The website design from the website builder (admin/): theme, logo and SEO, contact, menu display, announcement bar,
// and the home page sections. Customers get the published design with the store from the hub; the builder's preview
// (index.html?preview=1 inside admin/) gets the draft by postMessage and re-draws as the owner edits.
(function (A) {
  'use strict';
  const { esc } = A;
  const C = window.TIFFIN_CONFIG;
  const S = window.SiteSchema;
  const CONFIG = { ...C };
  const params = new URLSearchParams(location.search);
  A.preview = params.has('preview') && window.parent !== window;

  A.site = S.clone(S.DEFAULT);

  /** A photo in the design: hub:<name> (uploaded in the builder) or an https:// link. */
  A.imgSrc = (ref) => (!ref ? null : ref.startsWith('hub:') ? Hub.imageUrl(ref.slice(4)) : ref);
  /** The name customers see: the builder's, else the store's name on the hub. */
  A.brandName = () => A.site.brand.name || A.brand?.name || A.shop?.name || ''; // brand website: the brand, not the outlet
  const paras = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  /* ---------- Theme, brand, SEO, bar ---------- */
  const RADIUS = { square: [4, 4, 4], soft: [12, 10, 8], rounded: [20, 14, 12] };
  const loadedFonts = new Set(['Plus Jakarta Sans']);
  function loadFont(name) {
    if (!name || loadedFonts.has(name) || !S.FONTS.includes(name)) return;
    loadedFonts.add(name);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
    document.head.append(l);
  }
  function meta(attr, key, value) {
    let m = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!value) { m?.remove(); return; }
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.append(m); }
    m.setAttribute('content', value);
  }
  function favicon(href) {
    let l = document.head.querySelector('link[rel="icon"]');
    if (!href) { l?.remove(); return; }
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.append(l); }
    l.href = href;
  }

  A.applySite = (site) => {
    const s = (A.site = S.normalise(site));
    const t = s.theme, root = document.documentElement.style;
    const set = (k, v) => root.setProperty(k, v);
    set('--primary', t.primary); set('--primary-hover', `color-mix(in srgb, ${t.primary} 85%, #000)`); set('--accent', t.accent);
    set('--ink', t.text); set('--bg', t.background); set('--page', `color-mix(in srgb, ${t.background} 96%, ${t.primary})`);
    loadFont(t.font); loadFont(t.headingFont);
    set('--font', `'${t.font}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`);
    set('--font-heading', `'${t.headingFont}', var(--font)`);
    const [card, control, small] = RADIUS[t.radius] || RADIUS.rounded;
    set('--r-card', `${card}px`); set('--r-control', `${control}px`); set('--r-small', `${small}px`);
    set('--r-btn', t.buttons === 'pill' ? '999px' : t.buttons === 'square' ? '4px' : `${control}px`);
    set('--r-btn-sm', t.buttons === 'pill' ? '999px' : t.buttons === 'square' ? '4px' : `${Math.min(control, 10)}px`);
    const b = document.body.classList;
    b.toggle('hdr-dark', t.header === 'dark'); b.toggle('hdr-brand', t.header === 'brand');
    const m = s.menu;
    b.toggle('menu-list', m.layout === 'list'); b.toggle('no-photos', !m.showPhotos); b.toggle('no-desc', !m.showDescriptions); b.toggle('no-veg', !m.showVeg);

    // older pages read these from js/config.js; the design wins when it has a value
    C.phone = s.contact.phone || CONFIG.phone || '';
    C.address = s.contact.address || CONFIG.address || '';
    C.about = s.contact.footerText || CONFIG.about || '';

    if (A.shop) {
      const name = A.brandName();
      document.title = s.brand.seoTitle || `${name} · Order online${A.demo ? ' (demo)' : ''}`;
      meta('name', 'description', s.brand.seoDescription || s.brand.tagline);
      meta('property', 'og:title', s.brand.seoTitle || name);
      meta('property', 'og:description', s.brand.seoDescription || s.brand.tagline);
      meta('property', 'og:image', A.imgSrc(s.brand.shareImage || s.sections.find((x) => x.type === 'hero')?.image || ''));
      meta('name', 'theme-color', t.primary);
      favicon(A.imgSrc(s.brand.favicon || s.brand.logo));
    }
    const bar = document.getElementById('announce');
    const show = s.bar.show && s.bar.text;
    bar.hidden = !show;
    document.getElementById('announce-text').innerHTML = !show ? ''
      : s.bar.link ? `<a href="${esc(s.bar.link)}" target="_blank" rel="noopener">${esc(s.bar.text)} →</a>` : esc(s.bar.text);
  };

  /** The logo in the header and footer: the uploaded logo, else the dot and the name. */
  A.logoHTML = () => {
    const logo = A.imgSrc(A.site.brand.logo);
    return logo ? `<img class="logo-img" src="${esc(logo)}" alt="${esc(A.brandName())}"><span class="logo-name">${esc(A.brandName())}</span>`
      : `<span class="logo-dot"></span><span>${esc(A.brandName())}</span>`;
  };

  /* ---------- Home page sections (the menu section is drawn by pages/home.js) ---------- */
  const head = (s, extra = '') => (s.title ? `<div class="block-head"><h2>${esc(s.title)}</h2>${extra}</div>` : '');
  const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
  const hhmm = (t) => { const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const phoneHref = (p) => p.replace(/[^\d+]/g, '');
  const waHref = (p) => { const d = p.replace(/\D/g, ''); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };

  const RENDER = {
    featured(s) {
      const items = s.itemIds.map((id) => A.byId(id)).filter(Boolean);
      if (!items.length) return A.preview ? `${head(s)}<p class="muted block-empty">Pick dishes for this section in the builder.</p>` : '';
      return `${head(s)}<div class="pgrid">${items.map(A.cardHTML).join('')}</div>`;
    },
    about(s) {
      const img = A.imgSrc(s.image);
      return `<div class="about ${img ? '' : 'no-img'}">
        ${img ? `<img class="about-img" src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <div class="about-text">${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${paras(s.text)}</div></div>`;
    },
    gallery(s) {
      const imgs = s.images.map(A.imgSrc).filter(Boolean);
      if (!imgs.length) return A.preview ? `${head(s)}<p class="muted block-empty">Add photos to the gallery in the builder.</p>` : '';
      return `${head(s)}<div class="gallery">${imgs.map((src) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></a>`).join('')}</div>`;
    },
    reviews(s) {
      const items = s.items.filter((r) => r.text);
      if (!items.length) return A.preview ? `${head(s)}<p class="muted block-empty">Add reviews in the builder.</p>` : '';
      return `${head(s)}<div class="reviews">${items.map((r) => `
        <figure class="review"><div class="stars" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating)}<span>${'★'.repeat(5 - r.rating)}</span></div>
          <blockquote>${paras(r.text)}</blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div>`;
    },
    hours(s) {
      const hours = A.shop?.hours;
      if (!hours) return '';
      const today = new Date().getDay();
      return `${head(s)}<div class="hours">${DAYS.map(([d, name]) => {
        const slots = hours[String(d)] || [];
        return `<div class="${d === today ? 'today' : ''}"><span>${name}</span><span>${slots.length ? slots.map((x) => `${hhmm(x.open)} – ${hhmm(x.close)}`).join(', ') : '<span class="muted">Closed</span>'}</span></div>`;
      }).join('')}</div>`;
    },
    contact(s) {
      const c = A.site.contact, loc = A.shop?.delivery?.location;
      const map = s.showMap && loc ? `https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.006},${loc.lat - 0.004},${loc.lng + 0.006},${loc.lat + 0.004}&layer=mapnik&marker=${loc.lat},${loc.lng}` : null;
      const dirs = c.mapUrl || (loc ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : '');
      const rows = [
        c.address ? `<p class="contact-addr">${esc(c.address)}</p>` : '',
        `<div class="contact-btns">
          ${c.phone ? `<a class="btn sm" href="tel:${esc(phoneHref(c.phone))}">Call ${esc(c.phone)}</a>` : ''}
          ${c.whatsapp ? `<a class="btn sm outline" href="${esc(waHref(c.whatsapp))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${c.email ? `<a class="btn sm outline" href="mailto:${esc(c.email)}">Email</a>` : ''}
          ${dirs ? `<a class="btn sm outline" href="${esc(dirs)}" target="_blank" rel="noopener">Directions</a>` : ''}
        </div>`,
        socialHTML(),
      ].join('');
      return `${head(s)}<div class="contact ${map ? '' : 'no-map'}"><div class="contact-info">${rows}</div>
        ${map ? `<iframe class="contact-map" src="${esc(map)}" title="Map" loading="lazy" referrerpolicy="no-referrer"></iframe>` : ''}</div>`;
    },
    faq(s) {
      const items = s.items.filter((x) => x.q);
      if (!items.length) return A.preview ? `${head(s)}<p class="muted block-empty">Add questions in the builder.</p>` : '';
      return `${head(s)}<div class="faq">${items.map((x) => `<details><summary>${esc(x.q)}</summary>${paras(x.a)}</details>`).join('')}</div>`;
    },
    text(s) { return s.title || s.text ? `<div class="textblock">${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${paras(s.text)}</div>` : ''; },
  };

  function socialHTML() {
    const c = A.site.contact;
    const links = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube']].filter(([k]) => c[k]);
    return links.length ? `<div class="social">${links.map(([k, n]) => `<a href="${esc(c[k])}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>` : '';
  }
  A.socialHTML = socialHTML;

  /** One section of the home page (not the hero or the menu, which pages/home.js draws). Empty: nothing to show. */
  A.blockHTML = (s) => {
    const inner = RENDER[s.type]?.(s) || '';
    return inner ? `<section class="block block-${s.type}" ${editAttr(s)}>${editBadge(s)}${inner}</section>` : '';
  };

  /* ---------- Builder preview: draft by postMessage, click a section to edit it ---------- */
  const editAttr = (s) => (A.preview ? `data-edit="${esc(s.id)}"` : '');
  const editBadge = (s) => (A.preview ? `<button class="edit-badge" data-action="preview-edit" data-id="${esc(s.id)}">✎ ${esc(S.SECTIONS[s.type].label)}</button>` : '');
  A.editAttr = editAttr; A.editBadge = editBadge;

  if (A.preview) {
    document.documentElement.classList.add('is-preview');
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== window.parent || e.data?.type !== 'tiffin-site') return;
      A.applySite(e.data.site);
      if (!A.shop) return;
      A.renderHeader?.(); A.renderFooter?.();
      if ((location.hash.replace(/^#\/?/, '') || '') !== '') location.hash = '#/'; else A.render();
      if (e.data.focus) requestAnimationFrame(() => document.querySelector(`[data-edit="${CSS.escape(e.data.focus)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });
    A.action('preview-edit', (el) => window.parent.postMessage({ type: 'tiffin-edit', id: el.dataset.id }, location.origin));
  }
  A.previewReady = () => { if (A.preview) window.parent.postMessage({ type: 'tiffin-ready' }, location.origin); };
})(App);
