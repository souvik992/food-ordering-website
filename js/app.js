(function () {
  'use strict';

  const $app = document.getElementById('app');
  const $tabbar = document.getElementById('tabbar');
  const $toast = document.getElementById('toast');

  /* ---------- Persistence ---------- */
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const state = {
    cart: store.get('fd_cart', {}), // { itemId: qty }
    favs: new Set(store.get('fd_favs', [])),
    orders: store.get('fd_orders', []),
    voucher: null,
    category: 'all',
    query: '',
  };

  const save = () => {
    store.set('fd_cart', state.cart);
    store.set('fd_favs', [...state.favs]);
    store.set('fd_orders', state.orders);
  };

  /* ---------- Helpers ---------- */
  const money = (n) => '$' + n.toFixed(2);
  const byId = (id) => ITEMS.find((i) => i.id === Number(id));
  const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtReviews = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n);

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

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 1800);
  }

  /* ---------- Icons ---------- */
  const I = {
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
    chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    chevRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7V6a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 1 .9l1.1 12A2 2 0 0 1 19.3 22H4.7a2 2 0 0 1-2-2.1l1.1-12a1 1 0 0 1 1-.9H7Zm2 0h6V6a3 3 0 0 0-6 0v1Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8L12 2.5Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4 6.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/></svg>',
    bike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M15 6h2l3 11M5.5 17 9 9h6l-3.5 8M9 9 7.5 6H6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6V6Zm7 1v2h2V7h-2Zm0 4v2h2v-2h-2Zm0 4v2h2v-2h-2Z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 5v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0H3.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  };

  /* ---------- Tab bar ---------- */
  const TABS = { home: ['Home', I.home], orders: ['Orders', I.orders], cart: ['Cart', I.bag], profile: ['Profile', I.user] };
  $tabbar.querySelectorAll('[data-tab]').forEach((a) => {
    const [label, icon] = TABS[a.dataset.tab];
    a.innerHTML = `<span class="tab-ico">${icon}</span><span>${label}</span>`;
  });

  function updateChrome(active) {
    $tabbar.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === active));
    const n = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = n;
      el.hidden = n === 0;
    });
    const cartTab = $tabbar.querySelector('.tab-cart .tab-ico');
    cartTab.dataset.count = n || '';
  }

  /* ---------- Views ---------- */
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

  function filteredItems() {
    const q = state.query.trim().toLowerCase();
    return ITEMS.filter((i) =>
      (state.category === 'all' || i.category === state.category) &&
      (!q || i.name.toLowerCase().includes(q) || i.by.toLowerCase().includes(q))
    );
  }

  function renderPicks() {
    const list = filteredItems();
    const el = document.getElementById('picks');
    if (!el) return;
    el.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : `<div class="empty"><span>🔍</span><p>No dishes match “${esc(state.query)}”.</p></div>`;
  }

  function viewHome() {
    return `
      <section class="page home">
        <header class="top">
          <div class="loc">
            <small>${I.pin} Location</small>
            <button class="loc-btn">Al Safa Street, Al Wasl ${I.chevDown}</button>
          </div>
          <a class="icon-btn bag" href="#/cart" aria-label="Cart">${I.bag}<b class="badge" data-cart-count></b></a>
        </header>

        <div class="search">
          ${I.search}
          <input id="q" type="search" placeholder="Search dishes or restaurants" value="${esc(state.query)}" autocomplete="off" />
          <button class="filter-btn" data-action="filter">Filter <span>${I.filter}</span></button>
        </div>

        <div class="promo">
          <div class="promo-text">
            <h2>Gonna Be a Good Day!</h2>
            <p>Free delivery, lower fees &amp; <strong>10%</strong> cashback with code <strong>GOOD10</strong></p>
            <a class="btn-white" href="#/item/3">Order Now</a>
          </div>
          ${media(byId(3), 'promo-img', 500)}
        </div>

        <div class="section-head"><h2>Categories</h2><button class="link" data-action="cat" data-cat="all">See All</button></div>
        <div class="cats" role="tablist">
          ${CATEGORIES.map((c) => `
            <button class="cat ${state.category === c.id ? 'active' : ''}" data-action="cat" data-cat="${c.id}" role="tab" aria-selected="${state.category === c.id}">
              <span class="cat-ico">${c.emoji}</span>${c.name}
            </button>`).join('')}
        </div>

        <div class="section-head"><h2>Picks For You</h2><span class="muted" id="pick-count"></span></div>
        <div class="grid" id="picks"></div>
      </section>`;
  }

  function viewItem(id) {
    const item = byId(id);
    if (!item) return viewNotFound();
    const fav = state.favs.has(item.id);
    return `
      <section class="page detail">
        <div class="detail-hero">
          ${media(item, 'hero-img', 1100)}
          <div class="hero-bar">
            <button class="icon-btn glass" data-action="back" aria-label="Back">${I.back}</button>
            <div class="row">
              <button class="icon-btn glass fav ${fav ? 'on' : ''}" data-action="fav" data-id="${item.id}" aria-label="Favourite">${I.heart}</button>
              <button class="icon-btn glass" data-action="share" data-id="${item.id}" aria-label="Share">${I.share}</button>
            </div>
          </div>
        </div>

        <div class="sheet">
          <div class="title-row">
            <div>
              <h1>${esc(item.name)}</h1>
              <p class="muted">By ${esc(item.by)}</p>
            </div>
            <span class="rating">${I.star}${item.rating}</span>
          </div>

          <div class="courier">
            <div class="avatar">${COURIER.name.split(' ').map((s) => s[0]).join('')}</div>
            <div class="grow">
              <strong>${COURIER.name}</strong>
              <small class="muted">ID: ${COURIER.id}</small>
            </div>
            <button class="icon-btn soft" data-action="toast" data-msg="Chat coming soon" aria-label="Chat">${I.chat}</button>
            <button class="icon-btn soft" data-action="toast" data-msg="Calling courier…" aria-label="Call">${I.phone}</button>
          </div>

          <h2 class="h-sm">Description</h2>
          <p class="desc clamp" id="desc">${esc(item.description)}</p>
          <button class="link strong" data-action="more">Read more</button>

          <div class="info-tiles">
            <div class="tile"><span class="tile-ico">${I.bike}</span><div><small>Delivery Time</small><strong>${item.time} min</strong></div></div>
            <div class="tile"><span class="tile-ico">${I.box}</span><div><small>Delivery Type</small><strong>${item.type}</strong></div></div>
          </div>

          <div class="cta">
            <span class="cta-price">${money(item.price)}</span>
            <button class="cta-btn" data-action="add" data-id="${item.id}">Add to Cart</button>
          </div>
        </div>
      </section>`;
  }

  function viewCart() {
    const entries = Object.entries(state.cart);
    const t = totals();
    const head = `
      <header class="bar">
        <button class="icon-btn soft" data-action="back" aria-label="Back">${I.back}</button>
        <h1>Cart</h1>
        <button class="icon-btn soft" data-action="clear" aria-label="Clear cart" ${entries.length ? '' : 'disabled'}>${I.trash}</button>
      </header>`;

    if (!entries.length) {
      return `<section class="page cart">${head}
        <div class="empty big"><span>🛍️</span><h2>Your cart is empty</h2><p>Add something tasty to get started.</p><a class="cta-btn solid" href="#/">Browse food</a></div>
      </section>`;
    }

    return `
      <section class="page cart">
        ${head}
        <div class="cart-layout">
          <ul class="cart-list">
            ${entries.map(([id, q]) => {
              const item = byId(id);
              return `
              <li class="cart-item">
                <a href="#/item/${item.id}">${media(item, 'thumb', 300)}</a>
                <div class="grow">
                  <div class="ci-top">
                    <div><h3>${esc(item.name)}</h3><p class="muted">By ${esc(item.by)}</p></div>
                    <span class="rating">${I.star}${item.rating}</span>
                  </div>
                  <div class="ci-bottom">
                    <strong>${money(item.price * q)}</strong>
                    <div class="qty">
                      <button data-action="dec" data-id="${item.id}" aria-label="Decrease">${I.minus}</button>
                      <span>${q}</span>
                      <button class="plus" data-action="inc" data-id="${item.id}" aria-label="Increase">${I.plus}</button>
                    </div>
                  </div>
                </div>
              </li>`;
            }).join('')}
          </ul>

          <aside class="summary">
            <form class="voucher" data-form="voucher">
              <span class="v-ico">${I.ticket}</span>
              <input name="code" placeholder="Enter your voucher code" value="${state.voucher || ''}" autocomplete="off" />
              <button aria-label="Apply voucher">${I.chevRight}</button>
            </form>
            ${state.voucher ? `<p class="voucher-ok">${I.check} ${state.voucher} applied: ${VOUCHERS[state.voucher] * 100}% off</p>` : '<p class="hint">Try <b>GOOD10</b> or <b>FOODIE20</b></p>'}
            <dl>
              <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
              ${t.discount ? `<div class="disc"><dt>Discount</dt><dd>−${money(t.discount)}</dd></div>` : ''}
              <div><dt>Delivery Fee</dt><dd>${money(t.fee)}</dd></div>
              <div class="total"><dt>Total Amount</dt><dd>${money(t.total)}</dd></div>
            </dl>
            <div class="cta">
              <span class="cta-price">${money(t.total)}</span>
              <button class="cta-btn" data-action="checkout">Checkout</button>
            </div>
          </aside>
        </div>
      </section>`;
  }

  function viewOrders() {
    return `
      <section class="page simple">
        <header class="bar"><span></span><h1>Orders</h1><span></span></header>
        ${state.orders.length ? `<ul class="orders">${state.orders.map((o) => `
          <li class="order">
            <div class="order-thumbs">${o.items.slice(0, 3).map((it) => media(byId(it.id), 'mini', 200)).join('')}</div>
            <div class="grow">
              <strong>Order #${o.id}</strong>
              <small class="muted">${new Date(o.date).toLocaleString()} · ${o.items.reduce((a, b) => a + b.qty, 0)} items</small>
            </div>
            <div class="order-right"><strong>${money(o.total)}</strong><span class="pill">On the way</span></div>
          </li>`).join('')}</ul>`
        : '<div class="empty big"><span>🧾</span><h2>No orders yet</h2><p>Your past orders will show up here.</p><a class="cta-btn solid" href="#/">Order now</a></div>'}
      </section>`;
  }

  function viewProfile() {
    const favs = ITEMS.filter((i) => state.favs.has(i.id));
    return `
      <section class="page simple">
        <header class="bar"><span></span><h1>Profile</h1><span></span></header>
        <div class="profile-card">
          <div class="avatar lg">YO</div>
          <div><strong>Your Name</strong><small class="muted">Al Safa Street, Al Wasl</small></div>
        </div>
        <div class="section-head"><h2>Favourites</h2><span class="muted">${favs.length}</span></div>
        ${favs.length ? `<div class="grid">${favs.map(cardHTML).join('')}</div>`
          : '<div class="empty"><span>❤️</span><p>Tap the heart on a dish to save it here.</p></div>'}
      </section>`;
  }

  function viewNotFound() {
    return `<section class="page simple"><div class="empty big"><span>🤷</span><h2>Page not found</h2><a class="cta-btn solid" href="#/">Go home</a></div></section>`;
  }

  /* ---------- Router ---------- */
  function render() {
    const [, page = '', id] = (location.hash.slice(1) || '/').split('/');
    const views = {
      '': ['home', viewHome],
      item: ['item', () => viewItem(id)],
      cart: ['cart', viewCart],
      orders: ['orders', viewOrders],
      profile: ['profile', viewProfile],
    };
    const [name, view] = views[page] || ['', viewNotFound];
    document.body.dataset.page = name;
    $app.innerHTML = view();
    if (name === 'home') {
      renderPicks();
      document.getElementById('pick-count').textContent = filteredItems().length + ' dishes';
    }
    updateChrome(name);
  }

  function rerenderKeepScroll() {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- Events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;

    switch (action) {
      case 'add':
        e.preventDefault();
        state.cart[id] = (state.cart[id] || 0) + 1;
        save(); updateChrome(document.body.dataset.page);
        toast(`${byId(id).name} added to cart`);
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        break;
      case 'inc':
        state.cart[id]++; save(); rerenderKeepScroll();
        break;
      case 'dec':
        if (--state.cart[id] <= 0) delete state.cart[id];
        save(); rerenderKeepScroll();
        break;
      case 'clear':
        state.cart = {}; state.voucher = null; save(); render();
        break;
      case 'fav': {
        e.preventDefault();
        const n = Number(id);
        state.favs.has(n) ? state.favs.delete(n) : state.favs.add(n);
        save();
        el.classList.toggle('on', state.favs.has(n));
        if (document.body.dataset.page === 'profile') rerenderKeepScroll();
        break;
      }
      case 'cat':
        state.category = el.dataset.cat;
        document.querySelectorAll('.cat').forEach((c) => {
          const on = c.dataset.cat === state.category;
          c.classList.toggle('active', on);
          c.setAttribute('aria-selected', on);
        });
        renderPicks();
        document.getElementById('pick-count').textContent = filteredItems().length + ' dishes';
        break;
      case 'filter':
        document.querySelector('.cats').scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 'more': {
        const d = document.getElementById('desc');
        const open = d.classList.toggle('clamp');
        el.textContent = open ? 'Read more' : 'Show less';
        break;
      }
      case 'back':
        history.length > 1 ? history.back() : (location.hash = '#/');
        break;
      case 'share': {
        const item = byId(id);
        if (navigator.share) navigator.share({ title: item.name, url: location.href }).catch(() => {});
        else navigator.clipboard?.writeText(location.href).then(() => toast('Link copied'), () => toast('Could not copy link'));
        break;
      }
      case 'checkout': {
        const t = totals();
        state.orders.unshift({
          id: Math.floor(100000 + Math.random() * 900000),
          date: Date.now(),
          total: t.total,
          items: Object.entries(state.cart).map(([i, qty]) => ({ id: Number(i), qty })),
        });
        state.cart = {}; state.voucher = null; save();
        toast('Order placed! 🎉');
        location.hash = '#/orders';
        break;
      }
      case 'toast':
        toast(el.dataset.msg);
        break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.dataset.form !== 'voucher') return;
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if (VOUCHERS[code]) { state.voucher = code; toast('Voucher applied'); }
    else { state.voucher = null; toast(code ? 'Invalid voucher code' : 'Voucher removed'); }
    rerenderKeepScroll();
  });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'q') return;
    state.query = e.target.value;
    renderPicks();
    document.getElementById('pick-count').textContent = filteredItems().length + ' dishes';
  });

  render();
})();
