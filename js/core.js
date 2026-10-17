// Shared state, helpers, icons and UI components used by every page.
window.App = (function () {
  'use strict';
  const A = {};

  /* ---------- Persistence ---------- */
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  // Keys are prefixed per store, so one browser can order from two stores without mixing carts.
  const key = (k) => `tf_${Hub.slug}_${k}`;
  const list = (v) => (Array.isArray(v) ? v : []);

  const state = {
    // cart lines: { key, itemId, modifierIds: [], qty }
    cart: list(store.get(key('cart'), [])),
    favs: new Set(list(store.get(key('favs'), []))),
    // orders placed from this browser: { id, token, order } (order = latest copy from the hub)
    orders: list(store.get(key('orders'), [])),
    // signed-in customer: { name, phone, otpToken } (otpToken from the hub, valid 30 days)
    user: store.get(key('user'), null),
    // { id, label, line1, line2, landmark, city, pincode, lat, lng, isDefault }
    addresses: list(store.get(key('addresses'), [])),
    fulfilment: store.get(key('fulfilment'), 'DELIVERY'),
    notifications: list(store.get(key('notifications'), [])),
    recent: list(store.get(key('recent'), [])),
    menu: { query: '', cat: 'all', sort: 'menu' },
    note: '',
    ordersTab: 'active',
    focusSearch: false,
    checkoutKey: null, // idempotency key of the order being placed (a retry reuses it, so no double orders)
  };

  function save() {
    store.set(key('cart'), state.cart);
    store.set(key('favs'), [...state.favs]);
    store.set(key('orders'), state.orders.slice(0, 50));
    store.set(key('user'), state.user);
    store.set(key('addresses'), state.addresses);
    store.set(key('fulfilment'), state.fulfilment);
    store.set(key('notifications'), state.notifications.slice(0, 50));
    store.set(key('recent'), state.recent);
  }

  /* ---------- Helpers ---------- */
  // Amounts from the hub are in paise; this only formats them
  const money = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const byId = (id) => ITEMS.find((i) => i.id === String(id));
  const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const defaultAddress = () => state.addresses.find((a) => a.isDefault) || state.addresses[0] || null;
  const addressText = (a) => [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(', ');
  const unreadCount = () => state.notifications.filter((n) => !n.read).length;
  const notify = (title, text) => { state.notifications.unshift({ id: Date.now() + Math.random(), title, text, date: Date.now(), read: false }); };

  // Photo if one is set in js/config.js, otherwise the emoji
  const media = (item, cls = '') =>
    `<div class="media ${cls}" data-emoji="${item.emoji}">
       ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" onerror="this.remove()">` : ''}
     </div>`;
  const vegMark = (item) => (item.isVeg == null ? '' : `<span class="veg ${item.isVeg ? '' : 'non'}" title="${item.isVeg ? 'Veg' : 'Non-veg'}" aria-label="${item.isVeg ? 'Veg' : 'Non-veg'}"></span>`);

  /* ---------- Menu from the hub ---------- */
  const emojiFor = (...names) => (EMOJI_RULES.find(([re]) => names.some((n) => re.test(n || ''))) || [, '🍽️'])[1];

  // shop = GET /v1/stores/<slug>: name, open, reason, menu, fulfilment, payments, delivery, pickup, hours
  function setShop(shop) {
    A.shop = shop;
    const cats = shop.menu ? [...shop.menu.categories].sort((a, b) => a.sort - b.sort) : [];
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    window.CATEGORIES = [{ id: 'all', name: 'All', emoji: '🍽️' }]
      .concat(cats.filter((c) => shop.menu.items.some((i) => i.categoryId === c.id)).map((c) => ({ id: c.id, name: c.name, emoji: emojiFor(c.name) })));
    const order = new Map(cats.map((c, i) => [c.id, i]));
    window.ITEMS = (shop.menu?.items || []).map((i, n) => ({
      ...i,
      category: catName.get(i.categoryId) || 'More',
      emoji: emojiFor(i.name, catName.get(i.categoryId)),
      image: ITEM_PHOTOS[i.id] || (i.image ? Hub.imageUrl(i.image) : null),
      sort: (order.get(i.categoryId) ?? 999) * 10000 + n,
    }));
    // drop cart lines for items that left the menu
    const before = state.cart.length;
    state.cart = state.cart.filter((l) => byId(l.itemId));
    if (state.cart.length !== before) { save(); toast('Some items are no longer available and were removed from your cart'); }
    // choose a fulfilment the store offers
    const f = shop.fulfilment || {};
    if (state.fulfilment === 'DELIVERY' && !f.delivery && f.pickup) state.fulfilment = 'PICKUP';
    if (state.fulfilment === 'PICKUP' && !f.pickup && f.delivery) state.fulfilment = 'DELIVERY';
  }

  const modifierGroups = (item) => item.modifierGroupIds.map((id) => A.shop.menu.modifierGroups.find((g) => g.id === id)).filter(Boolean);
  const modifierNames = (line) => {
    const all = A.shop?.menu?.modifierGroups.flatMap((g) => g.modifiers) || [];
    return line.modifierIds.map((id) => all.find((m) => m.id === id)?.name).filter(Boolean);
  };

  // Price of one unit with its options, for display; the order total always comes from the hub
  const unitPrice = (itemId, modifierIds = []) => {
    const all = A.shop?.menu?.modifierGroups.flatMap((g) => g.modifiers) || [];
    return (byId(itemId)?.price || 0) + modifierIds.reduce((a, id) => a + (all.find((m) => m.id === id)?.price || 0), 0);
  };
  const lineKey = (itemId, mods) => `${itemId}|${mods.join(',')}`;
  // Quantity of the plain (no options) line for an item
  const plainQty = (itemId) => state.cart.find((l) => l.key === lineKey(itemId, []))?.qty || 0;

  function addToCart(itemId, qty = 1, modifierIds = []) {
    const mods = [...modifierIds].sort();
    const k = lineKey(itemId, mods);
    const line = state.cart.find((l) => l.key === k);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else state.cart.push({ key: k, itemId: String(itemId), modifierIds: mods, qty });
    state.checkoutKey = null;
    save();
  }

  // Changes a cart line's options and quantity in place (merging into an identical line if there is one)
  function replaceLine(oldKey, itemId, qty, modifierIds) {
    const mods = [...modifierIds].sort();
    const k = lineKey(itemId, mods);
    const i = state.cart.findIndex((l) => l.key === oldKey);
    const same = state.cart.find((l) => l.key === k && l.key !== oldKey);
    if (same) { same.qty = Math.min(99, same.qty + qty); if (i >= 0) state.cart.splice(i, 1); }
    else if (i >= 0) state.cart[i] = { key: k, itemId: String(itemId), modifierIds: mods, qty };
    else state.cart.push({ key: k, itemId: String(itemId), modifierIds: mods, qty });
    state.checkoutKey = null;
    save();
  }

  // Lines in the shape the hub expects
  const hubLines = () => state.cart.map((l) => ({ itemId: l.itemId, qtyMilli: l.qty * 1000, modifierIds: l.modifierIds }));

  /* ---------- Totals: always a quote from the hub ---------- */
  let quoteCache = { key: '', promise: null };
  function quoteRequest() {
    const addr = defaultAddress();
    const delivery = state.fulfilment === 'DELIVERY';
    return { fulfilment: state.fulfilment, location: delivery && addr && addr.lat != null ? { lat: addr.lat, lng: addr.lng } : null, lines: hubLines() };
  }
  function getQuote() {
    const req = quoteRequest();
    if (req.fulfilment === 'DELIVERY' && !req.location) return Promise.reject(Object.assign(new Error('Add a delivery address with its location to see the delivery fee.'), { code: 'NO_LOCATION' }));
    const k = JSON.stringify(req);
    if (quoteCache.key !== k) quoteCache = { key: k, promise: Hub.quote(req).catch((e) => { quoteCache = { key: '', promise: null }; throw e; }) };
    return quoteCache.promise;
  }
  const clearQuote = () => { quoteCache = { key: '', promise: null }; };

  function summaryRows(q) {
    return `
      <dl class="totals">
        <div><dt>Items</dt><dd>${money(q.itemsTotal)}</dd></div>
        ${q.deliveryFee ? `<div><dt>Delivery fee${q.distanceKm != null ? ` (${q.distanceKm} km)` : ''}</dt><dd>${money(q.deliveryFee)}</dd></div>` : ''}
        ${q.packagingFee ? `<div><dt>Packaging</dt><dd>${money(q.packagingFee)}</dd></div>` : ''}
        <div class="total"><dt>Total</dt><dd>${money(q.total)}</dd></div>
      </dl>
      <p class="muted small">Prices include GST.${q.etaMinutes ? ` Ready in about ${q.etaMinutes} min after the restaurant accepts.` : ''}</p>`;
  }

  const $toast = document.getElementById('toast');
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
  }

  /* ---------- Orders (status comes from the hub) ---------- */
  const isActive = (o) => !FINAL_STATES.includes(o.order.state);
  // Stores the latest copy of an order; tells the customer when its status changes
  function updateOrder(order) {
    const rec = state.orders.find((r) => r.id === order.id);
    if (!rec) return false;
    const changed = rec.order.state !== order.state || JSON.stringify(rec.order) !== JSON.stringify(order);
    if (rec.order.state !== order.state) notify(`Order ${order.number}: ${STATUS[order.state]}`, statusText(order));
    rec.order = order;
    if (changed) save();
    return changed;
  }
  function statusText(o) {
    switch (o.state) {
      case 'SENT_TO_STORE': case 'RECEIVED': return 'Waiting for the restaurant to accept your order.';
      case 'ACCEPTED': case 'PREPARING': return o.etaAt ? `Your food will be ready at about ${new Date(o.etaAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'The restaurant is preparing your order.';
      case 'READY': return o.fulfilment === 'PICKUP' ? 'Your order is ready to collect.' : 'Your order is ready and will leave soon.';
      case 'OUT_FOR_DELIVERY': return o.rider ? `${o.rider.name} is on the way.` : 'Your order is on the way.';
      case 'DELIVERED': return 'Delivered. Enjoy your meal!';
      case 'PICKED_UP': return 'Collected. Enjoy your meal!';
      case 'REJECTED': case 'AUTO_REJECTED': return `Sorry, the restaurant could not take this order.${o.reasonText ? ' ' + o.reasonText : ''}`;
      case 'CANCELLED': return `This order was cancelled.${o.reasonText ? ' ' + o.reasonText : ''}`;
      default: return STATUS[o.state] || o.state;
    }
  }

  /* ---------- Icons ---------- */
  const stroke = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const fill = (d) => `<svg viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
  const I = {
    pin: fill('<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>'),
    pinO: stroke('<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>'),
    chevDown: stroke('<path d="m6 9 6 6 6-6"/>', 2.2),
    chevRight: stroke('<path d="m9 6 6 6-6 6"/>', 2.2),
    back: stroke('<path d="m15 18-6-6 6-6"/>', 2.2),
    bag: fill('<path d="M7 7V6a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 1 .9l1.1 12A2 2 0 0 1 19.3 22H4.7a2 2 0 0 1-2-2.1l1.1-12a1 1 0 0 1 1-.9H7Zm2 0h6V6a3 3 0 0 0-6 0v1Z"/>'),
    search: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    filter: stroke('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    heart: stroke('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
    share: stroke('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    star: fill('<path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8L12 2.5Z"/>'),
    clock: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    arrow: stroke('<path d="M7 17 17 7M8 7h9v9"/>', 2.2),
    arrowRight: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.2),
    chat: fill('<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4 6.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/>'),
    phone: fill('<path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/>'),
    bike: stroke('<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M15 6h2l3 11M5.5 17 9 9h6l-3.5 8M9 9 7.5 6H6"/>'),
    box: stroke('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
    pot: stroke('<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5ZM2 10h20M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3"/>'),
    minus: stroke('<path d="M6 12h12"/>', 2.4),
    plus: stroke('<path d="M12 6v12M6 12h12"/>', 2.4),
    ticket: fill('<path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6V6Zm7 1v2h2V7h-2Zm0 4v2h2v-2h-2Zm0 4v2h2v-2h-2Z"/>'),
    trash: stroke('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    home: fill('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>'),
    homeO: stroke('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>'),
    grid: fill('<rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5"/><rect x="3" y="13" width="8" height="8" rx="2.5"/><rect x="13" y="13" width="8" height="8" rx="2.5"/>'),
    orders: fill('<path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 5v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z"/>'),
    ordersO: stroke('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
    user: fill('<circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0H3.5Z"/>'),
    check: stroke('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.6),
    card: stroke('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    cash: stroke('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>'),
    wallet: stroke('<path d="M17 7V5H5a2 2 0 0 0 0 4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16" cy="13.5" r="1.4"/>'),
    bell: stroke('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    help: stroke('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>'),
    edit: stroke('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>'),
    logout: stroke('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>'),
    work: stroke('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
    calendar: stroke('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    sort: stroke('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>'),
    mail: stroke('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    note: stroke('<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>'),
  };

  const PAYMENT_ICONS = { card: I.card, wallet: I.wallet, cash: I.cash };
  const ADDRESS_ICONS = { Home: I.homeO, Work: I.work, Other: I.pinO };

  /* ---------- Shared UI components ---------- */
  function header(title, { back = true, right = '' } = {}) {
    return `
      <header class="bar">
        ${back ? `<button class="icon-btn soft" data-action="back" aria-label="Back">${I.back}</button>` : '<span></span>'}
        <h1>${title}</h1>
        ${right || '<span></span>'}
      </header>`;
  }

  const cartButton = () =>
    `<a class="icon-btn soft" href="#/cart" aria-label="Cart">${I.bag}<b class="badge" data-cart-count></b></a>`;

  function empty(emoji, title, text, cta) {
    return `
      <div class="empty big">
        <span>${emoji}</span>
        <h2>${title}</h2>
        ${text ? `<p>${text}</p>` : ''}
        ${cta ? `<a class="btn" href="${cta.href}">${cta.label}</a>` : ''}
      </div>`;
  }

  // Quantity stepper; inc/dec are the actions, attrs identify the line
  const stepper = (qty, inc, dec, attrs, name) => `
    <div class="stepper">
      <button data-action="${dec}" ${attrs} aria-label="${qty === 1 ? `Remove ${name}` : `One less ${name}`}">${qty === 1 ? I.trash : I.minus}</button>
      <span aria-live="polite">${qty}</span>
      <button data-action="${inc}" ${attrs} aria-label="One more ${name}" ${qty >= 99 ? 'disabled' : ''}>${I.plus}</button>
    </div>`;

  // ADD button; becomes a stepper once a plain item is in the cart. Items with options open their page instead.
  function addControl(item) {
    const id = esc(item.id);
    const name = esc(item.name);
    if (item.modifierGroupIds.length) {
      return `<span class="add-wrap"><button class="add-pill" data-action="choose" data-id="${id}" aria-label="Add ${name} to cart">ADD ${I.plus}</button><small>Customisable</small></span>`;
    }
    const n = plainQty(item.id);
    return n
      ? `<span class="add-wrap">${stepper(n, 'item-inc', 'item-dec', `data-id="${id}"`, name)}</span>`
      : `<span class="add-wrap"><button class="add-pill" data-action="add" data-id="${id}" aria-label="Add ${name} to cart">ADD ${I.plus}</button></span>`;
  }

  // Large photo card (home, favourites)
  function cardHTML(item) {
    const fav = state.favs.has(item.id);
    return `
      <article class="card">
        <a class="card-link" href="#/item/${encodeURIComponent(item.id)}" aria-label="${esc(item.name)}"></a>
        ${media(item, 'card-img')}
        <button class="icon-btn fav ${fav ? 'on' : ''}" data-action="fav" data-id="${esc(item.id)}" aria-label="Favourite">${I.heart}</button>
        <div class="card-body">
          <div class="grow">
            <h3>${vegMark(item)}${esc(item.name)}</h3>
            <p class="meta">${esc(item.category)}</p>
            <strong class="price-tag">${money(item.price)}</strong>
          </div>
          ${addControl(item)}
        </div>
      </article>`;
  }

  // Compact row card (menu, search results), styled like cart rows
  function rowHTML(item) {
    return `
      <article class="row-card">
        <a class="card-link" href="#/item/${encodeURIComponent(item.id)}" aria-label="${esc(item.name)}"></a>
        ${media(item, 'thumb')}
        <div class="grow">
          <div class="ci-top">
            <div><h3>${vegMark(item)}${esc(item.name)}</h3><p class="muted">${esc(item.category)}</p></div>
          </div>
          <div class="ci-bottom">
            <strong class="price-tag">${money(item.price)}</strong>
            ${addControl(item)}
          </div>
        </div>
      </article>`;
  }

  // Banner when the restaurant is not taking orders
  const shopBanner = () => (A.shop && !A.shop.open ? `<div class="banner">${I.clock}<span>${esc(A.shop.reason || 'The restaurant is not taking online orders right now.')}</span></div>` : '');

  // Settings-style list row
  function listRow({ href, action, icon, title, sub, right = '', danger = false, attrs = '' }) {
    const inner = `
      <span class="lr-ico">${icon}</span>
      <span class="grow"><strong>${title}</strong>${sub ? `<small class="muted">${sub}</small>` : ''}</span>
      ${right}
      ${danger ? '' : `<span class="lr-chev">${I.chevRight}</span>`}`;
    const cls = `list-row ${danger ? 'danger' : ''}`;
    return href
      ? `<a class="${cls}" href="${href}" ${attrs}>${inner}</a>`
      : `<button class="${cls}" data-action="${action}" ${attrs}>${inner}</button>`;
  }

  // Selectable option card (address, payment, delivery time)
  function option({ action, value, selected, icon, title, sub, extra = '' }) {
    return `
      <div class="option ${selected ? 'selected' : ''}">
        <button class="option-hit" data-action="${action}" data-value="${value}" aria-pressed="${selected}"></button>
        <span class="lr-ico">${icon}</span>
        <span class="grow"><strong>${title}</strong>${sub ? `<small class="muted">${sub}</small>` : ''}</span>
        ${extra}
        <span class="radio" aria-hidden="true">${I.check}</span>
      </div>`;
  }

  /* ---------- Registry used by page files ---------- */
  const routes = {};
  const actions = {};
  const forms = {};
  const inputs = {};

  Object.assign(A, {
    store, state, save, money, byId, cartCount, esc, fmtDate, media, vegMark, toast, notify,
    defaultAddress, addressText, unreadCount, I, PAYMENT_ICONS, ADDRESS_ICONS,
    setShop, modifierGroups, modifierNames, addToCart, replaceLine, unitPrice, plainQty, lineKey, hubLines, getQuote, clearQuote, summaryRows,
    isActive, updateOrder, statusText,
    header, cartButton, empty, stepper, addControl, cardHTML, rowHTML, listRow, option, shopBanner,
    routes, actions, forms, inputs,
    route: (name, def) => { routes[name] = def; },
    action: (name, fn) => { actions[name] = fn; },
    form: (name, fn) => { forms[name] = fn; },
    input: (name, fn) => { inputs[name] = fn; },
  });
  return A;
})();
