// Shared state, helpers, icons and UI components used by every page.
window.App = (function () {
  'use strict';

  /* ---------- Persistence ---------- */
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const DEFAULT_ADDRESSES = [
    { id: 1, label: 'Home', line: 'Al Safa Street, Al Wasl', details: 'Villa 12', isDefault: true },
    { id: 2, label: 'Work', line: 'Business Bay, Tower 2', details: 'Floor 18, Office 1804', isDefault: false },
  ];

  const DEFAULT_NOTIFICATIONS = [
    { id: 1, title: 'Welcome to Foodie 🎉', text: 'Use code GOOD10 for 10% off your next order.', date: Date.now() - 864e5, read: false },
    { id: 2, title: 'Weekend deal', text: 'FOODIE20 gives you 20% off everything this weekend.', date: Date.now() - 3 * 864e5, read: false },
  ];

  const state = {
    cart: store.get('fd_cart', {}), // { itemId: qty }
    favs: new Set(store.get('fd_favs', [])),
    orders: store.get('fd_orders', []),
    user: store.get('fd_user', null),
    addresses: store.get('fd_addresses', DEFAULT_ADDRESSES),
    payment: store.get('fd_payment', 'card'),
    notifications: store.get('fd_notifications', DEFAULT_NOTIFICATIONS),
    recent: store.get('fd_recent', []),
    voucher: null,
    menu: { query: '', cat: 'all', sort: 'popular' },
    schedule: 'asap',
    note: '',
    qty: 1,
    ordersTab: 'active',
    focusSearch: false,
  };

  function save() {
    store.set('fd_cart', state.cart);
    store.set('fd_favs', [...state.favs]);
    store.set('fd_orders', state.orders);
    store.set('fd_user', state.user);
    store.set('fd_addresses', state.addresses);
    store.set('fd_payment', state.payment);
    store.set('fd_notifications', state.notifications);
    store.set('fd_recent', state.recent);
  }

  /* ---------- Helpers ---------- */
  const money = (n) => '$' + n.toFixed(2);
  const byId = (id) => ITEMS.find((i) => i.id === Number(id));
  const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtReviews = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n);
  const fmtDate = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const defaultAddress = () => state.addresses.find((a) => a.isDefault) || state.addresses[0];
  const paymentById = (id) => PAYMENT_METHODS.find((p) => p.id === id) || PAYMENT_METHODS[0];
  const unreadCount = () => state.notifications.filter((n) => !n.read).length;

  // Image with an emoji fallback if the photo fails to load
  const media = (item, cls = '', w) =>
    `<div class="media ${cls}" data-emoji="${item.emoji}">
       <img src="${w ? item.image.replace('w=700', 'w=' + w) : item.image}" alt="${esc(item.name)}" loading="lazy" onerror="this.remove()">
     </div>`;

  function totals() {
    const subtotal = Object.entries(state.cart).reduce((sum, [id, q]) => sum + byId(id).price * q, 0);
    const discount = state.voucher ? subtotal * VOUCHERS[state.voucher] : 0;
    const fee = subtotal > 0 ? DELIVERY_FEE : 0;
    return { subtotal, discount, fee, total: subtotal - discount + fee };
  }

  const $toast = document.getElementById('toast');
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 1800);
  }

  /* ---------- Order status (simulated from time since order) ---------- */
  const STEPS = [
    { title: 'Order confirmed', sub: 'The restaurant has received your order' },
    { title: 'Preparing your food', sub: 'Your meal is being freshly made' },
    { title: 'On the way', sub: 'Your courier is heading to you' },
    { title: 'Delivered', sub: 'Enjoy your meal!' },
  ];
  function orderStep(order) {
    const s = (Date.now() - order.date) / 1000;
    return s < 30 ? 0 : s < 90 ? 1 : s < 240 ? 2 : 3;
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

  // Large photo card (home, favourites)
  function cardHTML(item) {
    const fav = state.favs.has(item.id);
    return `
      <article class="card">
        <a class="card-link" href="#/item/${item.id}" aria-label="${esc(item.name)}"></a>
        ${media(item, 'card-img')}
        <span class="chip-rating">${item.rating} (${fmtReviews(item.reviews)})</span>
        <button class="icon-btn fav ${fav ? 'on' : ''}" data-action="fav" data-id="${item.id}" aria-label="Favourite">${I.heart}</button>
        <div class="card-body">
          <div>
            <h3>${esc(item.name)}</h3>
            <p class="meta">${I.clock}${item.time} min · ${money(item.price)} · ${esc(item.by)}</p>
          </div>
          <button class="round-btn" data-action="add" data-id="${item.id}" aria-label="Add ${esc(item.name)} to cart">${I.arrow}</button>
        </div>
      </article>`;
  }

  // Compact row card (menu, search results), styled like cart rows
  function rowHTML(item) {
    return `
      <article class="row-card">
        <a class="card-link" href="#/item/${item.id}" aria-label="${esc(item.name)}"></a>
        ${media(item, 'thumb', 300)}
        <div class="grow">
          <div class="ci-top">
            <div><h3>${esc(item.name)}</h3><p class="muted">By ${esc(item.by)}</p></div>
            <span class="rating">${I.star}${item.rating}</span>
          </div>
          <div class="ci-bottom">
            <div><strong>${money(item.price)}</strong> <small class="muted">· ${item.time} min</small></div>
            <button class="add-btn" data-action="add" data-id="${item.id}" aria-label="Add ${esc(item.name)} to cart">${I.plus}</button>
          </div>
        </div>
      </article>`;
  }

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

  return {
    store, state, save, money, byId, cartCount, esc, fmtReviews, fmtDate, media, totals, toast,
    defaultAddress, paymentById, unreadCount, STEPS, orderStep, I, PAYMENT_ICONS, ADDRESS_ICONS,
    header, cartButton, empty, cardHTML, rowHTML, listRow, option,
    routes, actions, forms, inputs,
    route: (name, def) => { routes[name] = def; },
    action: (name, fn) => { actions[name] = fn; },
    form: (name, fn) => { forms[name] = fn; },
    input: (name, fn) => { inputs[name] = fn; },
  };
})();
