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
    query: '',
    note: '',
    ordersFilter: 'all',
    justPlaced: null, // id of the order placed a moment ago (shows the "sent to the restaurant" banner)
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
  }

  /* ---------- Helpers ---------- */
  // Amounts from the hub are in paise; this only formats them
  const money = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const byId = (id) => ITEMS.find((i) => i.id === String(id));
  const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (t) => `${new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${fmtTime(t)}`;
  const fmtTime = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const defaultAddress = () => state.addresses.find((a) => a.isDefault) || state.addresses[0] || null;
  const addressText = (a) => [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(', ');
  const unreadCount = () => state.notifications.filter((n) => !n.read).length;
  const notify = (title, text) => { state.notifications.unshift({ id: Date.now() + Math.random(), title, text, date: Date.now(), read: false }); };
  const signedIn = () => Boolean(state.user?.otpToken);

  // Photo (from the POS through the hub, or js/config.js), otherwise the emoji on a warm tile
  const media = (item, cls = '') =>
    `<div class="media ${cls}" data-emoji="${item.emoji}">
       ${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
     </div>`;
  const vegTag = (item) => (item.isVeg == null ? '' : `<span class="tag ${item.isVeg ? 'green' : 'red'}">${item.isVeg ? 'Veg' : 'Non-veg'}</span>`);

  /* ---------- Menu from the hub ---------- */
  const emojiFor = (...names) => (EMOJI_RULES.find(([re]) => names.some((n) => re.test(n || ''))) || [, '🍽️'])[1];

  // shop = GET /v1/stores/<slug>: name, open, reason, menu, fulfilment, payments, delivery, pickup, hours
  function setShop(shop) {
    A.shop = shop;
    const cats = shop.menu ? [...shop.menu.categories].sort((a, b) => a.sort - b.sort) : [];
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    window.CATEGORIES = cats.filter((c) => shop.menu.items.some((i) => i.categoryId === c.id))
      .map((c) => ({ id: c.id, name: c.name, emoji: emojiFor(c.name) }));
    const order = new Map(cats.map((c, i) => [c.id, i]));
    window.ITEMS = (shop.menu?.items || []).map((i, n) => ({
      ...i,
      category: catName.get(i.categoryId) || 'More',
      emoji: emojiFor(i.name, catName.get(i.categoryId)),
      image: i.image ? Hub.imageUrl(i.image) : ITEM_PHOTOS[i.id] || null,
      sort: (order.get(i.categoryId) ?? 999) * 10000 + n,
    })).sort((a, b) => a.sort - b.sort);
    // drop cart lines for items that left the menu
    const before = state.cart.length;
    state.cart = state.cart.filter((l) => byId(l.itemId));
    if (state.cart.length !== before) { save(); toast('Some items are no longer available and were removed from your cart'); }
    // choose a fulfilment the store offers
    const f = shop.fulfilment || {};
    if (state.fulfilment === 'DELIVERY' && !f.delivery && f.pickup) state.fulfilment = 'PICKUP';
    if (state.fulfilment === 'PICKUP' && !f.pickup && f.delivery) state.fulfilment = 'DELIVERY';
  }

  // Minutes the kitchen usually needs for the chosen way of ordering
  function etaMinutes() {
    const s = A.shop;
    if (!s?.menu) return null;
    if (state.fulfilment === 'PICKUP') return s.pickup?.etaMinutes ?? null;
    return s.delivery?.zones?.[0]?.etaMinutes ?? null;
  }

  // "Open today until 11:00 PM" from the opening hours set in the POS (0 = Sunday)
  function hoursToday() {
    const slots = A.shop?.hours?.[String(new Date().getDay())];
    if (!slots) return null;
    if (!slots.length) return 'Closed today';
    const [h, m] = slots[slots.length - 1].close.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return `Open today until ${fmtTime(d)}`;
  }

  const modifierGroups = (item) => item.modifierGroupIds.map((id) => A.shop.menu.modifierGroups.find((g) => g.id === id)).filter(Boolean);
  const modifierNames = (line) => {
    const all = A.shop?.menu?.modifierGroups.flatMap((g) => g.modifiers) || [];
    return line.modifierIds.map((id) => all.find((m) => m.id === id)?.name).filter(Boolean);
  };

  function addToCart(itemId, qty = 1, modifierIds = []) {
    const mods = [...modifierIds].sort();
    const k = `${itemId}|${mods.join(',')}`;
    const line = state.cart.find((l) => l.key === k);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else state.cart.push({ key: k, itemId: String(itemId), modifierIds: mods, qty });
    state.checkoutKey = null;
    save();
  }
  // Changes the quantity of a cart line; 0 removes it
  function setLineQty(lineKey, qty) {
    const i = state.cart.findIndex((l) => l.key === lineKey);
    if (i < 0) return;
    if (qty <= 0) state.cart.splice(i, 1);
    else state.cart[i].qty = Math.min(99, qty);
    state.checkoutKey = null;
    save();
  }
  // How many of a dish are in the cart (all option combinations)
  const qtyOf = (itemId) => state.cart.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.qty, 0);

  // Lines in the shape the hub expects
  const hubLines = () => state.cart.map((l) => ({ itemId: l.itemId, qtyMilli: l.qty * 1000, modifierIds: l.modifierIds }));

  /* ---------- Totals: always a quote from the hub ---------- */
  const quotes = new Map(); // request -> { promise, value }
  function ask(req) {
    const k = JSON.stringify(req);
    let q = quotes.get(k);
    if (!q) {
      q = { promise: null, value: null };
      q.promise = Hub.quote(req).then((v) => { q.value = v; return v; }).catch((e) => { quotes.delete(k); throw e; });
      quotes.set(k, q);
      if (quotes.size > 30) quotes.delete(quotes.keys().next().value);
    }
    return q;
  }
  function quoteRequest() {
    const addr = defaultAddress();
    const delivery = state.fulfilment === 'DELIVERY';
    return { fulfilment: state.fulfilment, location: delivery && addr && addr.lat != null ? { lat: addr.lat, lng: addr.lng } : null, lines: hubLines() };
  }
  // The full quote for placing the order (needs the delivery location)
  function getQuote() {
    const req = quoteRequest();
    if (req.fulfilment === 'DELIVERY' && !req.location) return Promise.reject(Object.assign(new Error('Add a delivery address with its location to see the delivery fee.'), { code: 'NO_LOCATION' }));
    return ask(req).promise;
  }
  // Line prices and subtotal for the cart. Item prices do not depend on how the food is collected,
  // so without a delivery location this prices the cart as a pickup (when the store offers pickup).
  function basketRequest() {
    const req = quoteRequest();
    if (req.fulfilment === 'DELIVERY' && !req.location && A.shop.fulfilment?.pickup) return { ...req, fulfilment: 'PICKUP' };
    return req;
  }
  const getBasket = () => (state.cart.length ? ask(basketRequest()).promise : Promise.resolve(null));
  // The last basket price, if it is already known for the cart as it is now
  const basketNow = () => (state.cart.length ? quotes.get(JSON.stringify(basketRequest()))?.value || null : null);
  const clearQuote = () => quotes.clear();

  const $toast = document.getElementById('toast');
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 2800);
  }

  /* ---------- Orders (status comes from the hub) ---------- */
  const isActive = (o) => !FINAL_STATES.includes(o.order.state);
  // Stores the latest copy of an order; tells the customer when its status changes
  function updateOrder(order) {
    const rec = state.orders.find((r) => r.id === order.id);
    if (!rec) return false;
    const changed = rec.order.state !== order.state || JSON.stringify(rec.order) !== JSON.stringify(order);
    if (rec.order.state !== order.state) {
      notify(`Order ${order.number}: ${STATUS[order.state]}`, statusText(order));
      // when each step happened, for the status timeline
      rec.times = { ...rec.times, [order.state]: order.updatedAt || Date.now() };
    }
    rec.order = order;
    if (changed) save();
    return changed;
  }
  function statusText(o) {
    switch (o.state) {
      case 'PLACED': case 'SENT_TO_STORE': case 'RECEIVED': return 'Waiting for the restaurant to accept your order.';
      case 'ACCEPTED': case 'PREPARING': return o.etaAt ? `Your food will be ready at about ${fmtTime(o.etaAt)}.` : 'The restaurant is preparing your order.';
      case 'READY': return o.fulfilment === 'PICKUP' ? 'Your order is ready to collect.' : 'Your order is ready and will leave soon.';
      case 'OUT_FOR_DELIVERY': return o.rider ? `${o.rider.name} is on the way.` : 'Your order is on the way.';
      case 'DELIVERED': return 'Delivered. Enjoy your meal!';
      case 'PICKED_UP': return 'Collected. Enjoy your meal!';
      case 'REJECTED': case 'AUTO_REJECTED': return `Sorry, the restaurant could not take this order.${o.reasonText ? ' ' + o.reasonText : ''}`;
      case 'CANCELLED': return `This order was cancelled.${o.reasonText ? ' ' + o.reasonText : ''}`;
      default: return STATUS[o.state] || o.state;
    }
  }
  const failed = (o) => ['REJECTED', 'AUTO_REJECTED', 'CANCELLED', 'PAYMENT_FAILED'].includes(o.state);
  // Status tag colours from the design: in progress (orange), delivered (green), cancelled (grey)
  function statusTag(o) {
    const cls = failed(o) ? 'grey' : FINAL_STATES.includes(o.state) ? 'green' : 'orange';
    const text = failed(o) ? STATUS[o.state] : FINAL_STATES.includes(o.state) ? STATUS[o.state] : 'In progress';
    return `<span class="tag soft ${cls}">${esc(text)}</span>`;
  }

  /* ---------- Icons ---------- */
  const stroke = (d, w = 1.9) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const fill = (d) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
  const I = {
    pin: stroke('<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>'),
    nav: stroke('<path d="M3 11 21 3l-8 18-2-8-8-2Z"/>'),
    chevDown: stroke('<path d="m6 9 6 6 6-6"/>', 2),
    chevRight: stroke('<path d="m9 6 6 6-6 6"/>', 2),
    back: stroke('<path d="m15 18-6-6 6-6"/>', 2),
    close: stroke('<path d="M6 6l12 12M18 6 6 18"/>', 2),
    bag: stroke('<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>'),
    search: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    heart: stroke('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
    heartF: fill('<path d="M12 20.5s-7.5-4.6-7.5-10.6A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.9c0 6-7.5 10.6-7.5 10.6Z"/>'),
    clock: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    arrowRight: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>', 2),
    phone: stroke('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
    bike: stroke('<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M15 6h2l3 11M5.5 17 9 9h6l-3.5 8M9 9 7.5 6H6"/>'),
    pot: stroke('<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5ZM2 10h20M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3"/>'),
    chef: stroke('<path d="M7 14a4 4 0 1 1 1.5-7.7A4 4 0 0 1 15.5 6.3 4 4 0 1 1 17 14v6H7v-6Z"/><path d="M7 17h10"/>'),
    minus: stroke('<path d="M6 12h12"/>', 2.2),
    plus: stroke('<path d="M12 6v12M6 12h12"/>', 2.2),
    trash: stroke('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    home: stroke('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>'),
    store: stroke('<path d="M4 9h16l-1.5-5h-13L4 9Zm0 0v11h16V9M9 20v-6h6v6"/>'),
    orders: stroke('<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    check: stroke('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.4),
    cash: stroke('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>'),
    card: stroke('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    bell: stroke('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    help: stroke('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>'),
    edit: stroke('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>'),
    logout: stroke('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>'),
    work: stroke('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
    note: stroke('<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>'),
    reorder: stroke('<path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4"/>'),
    locate: stroke('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>'),
    shield: stroke('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>'),
  };
  const ADDRESS_ICONS = { Home: I.home, Work: I.work, Other: I.pin };

  /* ---------- Shared UI components ---------- */
  // Quantity stepper: [−] n [+]
  const stepper = (action, keyAttr, qty, size = '') => `
    <div class="stepper ${size}">
      <button data-action="${action}" data-key="${esc(keyAttr)}" data-d="-1" aria-label="One less">${I.minus}</button>
      <span>${qty}</span>
      <button data-action="${action}" data-key="${esc(keyAttr)}" data-d="1" aria-label="One more">${I.plus}</button>
    </div>`;

  // The card's price row: "Add", or a stepper once the dish is in the cart (dishes with options open their options)
  function cardFoot(item) {
    const q = qtyOf(item.id);
    const simple = !item.modifierGroupIds.length;
    let right;
    if (!A.shop.open) right = '';
    else if (q && simple) right = stepper('card-qty', item.id, q, 'sm');
    else right = `<button class="btn sm" data-action="${simple ? 'add' : 'choose'}" data-id="${esc(item.id)}">${q ? `Add more · ${q}` : 'Add'}</button>`;
    return `<strong class="price">${money(item.price)}</strong>${right}`;
  }

  // Product card (menu)
  function cardHTML(item) {
    const fav = state.favs.has(item.id);
    return `
      <article class="pcard" data-item="${esc(item.id)}">
        <button class="pcard-media" data-action="choose" data-id="${esc(item.id)}" aria-label="${esc(item.name)}">
          ${media(item)}
          ${vegTag(item)}
        </button>
        <button class="fav ${fav ? 'on' : ''}" data-action="fav" data-id="${esc(item.id)}" aria-label="Favourite" aria-pressed="${fav}">${fav ? I.heartF : I.heart}</button>
        <div class="pcard-body">
          <div class="pcard-title"><h3>${esc(item.name)}</h3>${item.modifierGroupIds.length ? '<small>Options</small>' : ''}</div>
          ${item.description ? `<p class="pcard-desc">${esc(item.description)}</p>` : ''}
          <div class="pcard-foot" data-foot="${esc(item.id)}">${cardFoot(item)}</div>
        </div>
      </article>`;
  }

  function empty(emoji, title, text, cta) {
    return `
      <div class="empty">
        <span class="empty-ico">${emoji}</span>
        <h2>${title}</h2>
        ${text ? `<p>${text}</p>` : ''}
        ${cta ? `<a class="btn" href="${cta.href}">${cta.label}</a>` : ''}
      </div>`;
  }

  // Selection tile (Delivery / Pickup, saved address)
  function tile({ action, value, selected, icon, title, sub, disabled = false, extra = '' }) {
    return `
      <div class="tile ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}">
        <button class="tile-hit" data-action="${action}" data-value="${esc(value)}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}></button>
        <span class="tile-ico">${icon}</span>
        <span class="grow"><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ''}</span>
        ${extra}
      </div>`;
  }

  // Segmented status timeline: steps = [{ label, at }] ; current = index reached
  function timeline(steps, current, done) {
    return `
      <ol class="timeline" style="--n:${steps.length}">
        ${steps.map((s, i) => {
          const cls = i < current || (done && i === current) ? 'done' : i === current ? 'current' : '';
          return `<li class="${cls}"><span class="bar"></span><span class="dot"></span><strong>${esc(s.label)}</strong><small>${s.at ? esc(s.at) : ''}</small></li>`;
        }).join('')}
      </ol>`;
  }

  // Banner when the restaurant is not taking orders
  const shopBanner = () => (A.shop && !A.shop.open ? `<div class="notice warn">${I.clock}<span>${esc(A.shop.reason || 'The restaurant is not taking online orders right now.')}</span></div>` : '');

  const initials = (name) => (name || '?').split(' ').filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  // Account pages: side menu on desktop (the account page itself is this menu on mobile)
  function accountNav(active) {
    const u = signedIn() ? state.user : null;
    const row = (href, icon, label, key, right = '') => `
      <a class="side-row ${active === key ? 'active' : ''}" href="${href}">
        <span class="side-ico ${key}">${icon}</span><span class="grow">${label}</span>${right}<span class="chev">${I.chevRight}</span>
      </a>`;
    const unread = unreadCount();
    return `
      <aside class="side">
        <a class="side-profile" href="${u ? '#/account' : '#/login/account'}">
          <span class="avatar">${u ? initials(u.name || u.phone) : I.user}</span>
          <span class="grow"><strong>${u ? esc(u.name || 'Add your name') : 'Sign in'}</strong><small>${u ? esc(u.phone) : 'Verify your mobile number'}</small></span>
          <span class="edit">${u ? I.edit : I.chevRight}</span>
        </a>
        <nav class="side-menu">
          ${row('#/orders', I.orders, 'Orders', 'orders', state.orders.some(isActive) ? '<b class="count">' + state.orders.filter(isActive).length + '</b>' : '')}
          ${row('#/favourites', I.heart, 'Favourites', 'favourites')}
          ${row('#/addresses', I.pin, 'Addresses', 'addresses')}
          ${row('#/notifications', I.bell, 'Notifications', 'notifications', unread ? `<b class="count">${unread}</b>` : '')}
          ${row('#/help', I.help, 'Help & support', 'help')}
          ${u ? `<button class="side-row" data-action="logout"><span class="side-ico logout">${I.logout}</span><span class="grow">Log out</span><span class="chev">${I.chevRight}</span></button>` : ''}
        </nav>
      </aside>`;
  }
  // Two-column account layout
  const accountPage = (active, body, cls = '') => `
    <section class="page container account-layout ${cls}">
      ${accountNav(active)}
      <div class="account-main">${body}</div>
    </section>`;

  const pageHead = (title, { back = true, right = '' } = {}) => `
    <div class="page-head">
      ${back ? `<button class="icon-btn" data-action="back" aria-label="Back">${I.back}</button>` : ''}
      <h1>${title}</h1>
      ${right}
    </div>`;

  /* ---------- Registry used by page files ---------- */
  const routes = {};
  const actions = {};
  const forms = {};
  const inputs = {};

  Object.assign(A, {
    store, state, save, money, byId, cartCount, esc, fmtDate, fmtTime, media, vegTag, toast, notify,
    defaultAddress, addressText, unreadCount, signedIn, I, ADDRESS_ICONS, initials,
    setShop, etaMinutes, hoursToday, modifierGroups, modifierNames, addToCart, setLineQty, qtyOf, hubLines,
    getQuote, getBasket, basketNow, clearQuote,
    isActive, updateOrder, statusText, failed, statusTag,
    stepper, cardFoot, cardHTML, empty, tile, timeline, shopBanner, accountNav, accountPage, pageHead,
    routes, actions, forms, inputs,
    route: (name, def) => { routes[name] = def; },
    action: (name, fn) => { actions[name] = fn; },
    form: (name, fn) => { forms[name] = fn; },
    input: (name, fn) => { inputs[name] = fn; },
  });
  return A;
})();
