// Router, header / footer / mobile cart bar, global event delegation, and loading the menu from the order hub
(function (A) {
  'use strict';

  const { I, state, esc, money } = A;
  const $app = document.getElementById('app');
  const $header = document.getElementById('site-header');
  const $footer = document.getElementById('site-footer');
  const $cartBar = document.getElementById('cart-bar');
  const C = window.TIFFIN_CONFIG;

  /* ---------- Header ---------- */
  function contextPill() {
    const f = A.shop.fulfilment || {};
    if (state.fulfilment === 'PICKUP') {
      return `
        <button class="ctx-pill" data-action="toggle-fulfilment" ${f.delivery ? '' : 'disabled'} title="${f.delivery ? 'Switch to delivery' : ''}">
          <span class="ctx-ico">${I.store}</span>
          <span class="grow"><small>Pickup from</small><b>${esc(C.address || A.shop.name)}</b></span>
          ${f.delivery ? `<span class="chev">${I.chevRight}</span>` : ''}
        </button>`;
    }
    const addr = A.defaultAddress();
    return `
      <a class="ctx-pill" href="#/addresses">
        <span class="ctx-ico">${I.nav}</span>
        <span class="grow"><small>Delivery to</small><b>${addr ? esc([addr.line1, addr.line2].filter(Boolean).join(', ')) : 'Add your address'}</b></span>
        <span class="chev">${I.chevRight}</span>
      </a>`;
  }

  function kitchenPill() {
    const s = A.shop;
    if (!s.open) {
      return `<div class="kitchen-pill closed" title="${esc(s.reason || '')}"><span class="ctx-ico">${I.clock}</span><span class="grow"><small>${esc(A.hoursToday() || 'Online orders')}</small><b><span class="xs-hide">Kitchen is closed</span><span class="xs-show">Closed</span></b></span></div>`;
    }
    const eta = A.etaMinutes();
    return `<div class="kitchen-pill"><span class="ctx-ico">${I.chef}</span><span class="grow"><small>${eta ? `≈ ${eta} minutes` : 'Order now'}</small><b><span class="xs-hide">Kitchen is open</span><span class="xs-show">${eta ? `≈${eta} min · ` : ''}Open</span></b></span></div>`;
  }

  A.renderHeader = () => {
    $header.innerHTML = `
      <div class="container hdr">
        <a class="logo" href="#/"><span class="logo-dot"></span><span>${esc(A.shop.name)}</span></a>
        <div class="hdr-ctx">${contextPill()}${kitchenPill()}</div>
        <div class="hdr-actions">
          <button class="icon-btn" data-action="toggle-search" aria-label="Search the menu">${I.search}</button>
          <a class="btn outline sm hide-sm" href="#/orders">${I.arrowRight} My orders</a>
          <a class="icon-btn" href="#/account" aria-label="Account">${I.user}${A.state.orders.some(A.isActive) ? '<b class="dot"></b>' : ''}</a>
        </div>
      </div>
      <div class="search-row container" ${searchOpen ? '' : 'hidden'}>
        <label class="search">${I.search}
          <input id="search-q" type="search" data-input="search" placeholder="Search dishes" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search" />
          <button class="icon-btn sm" data-action="toggle-search" aria-label="Close search">${I.close}</button>
        </label>
      </div>`;
  };

  let searchOpen = false;
  A.action('toggle-search', () => {
    searchOpen = !searchOpen;
    if (!searchOpen && state.query) { state.query = ''; A.routes[current]?.update?.(); }
    A.renderHeader();
    if (searchOpen) {
      if (current !== '') location.hash = '#/';
      document.getElementById('search-q')?.focus();
    }
  });
  A.input('search', (el) => {
    state.query = el.value;
    if (current !== '') location.hash = '#/';
    else A.routes['']?.update?.();
  });
  A.action('toggle-fulfilment', () => {
    state.fulfilment = state.fulfilment === 'DELIVERY' ? 'PICKUP' : 'DELIVERY';
    A.cartChanged();
  });

  /* ---------- Footer ---------- */
  function renderFooter() {
    const today = A.hoursToday();
    $footer.innerHTML = `
      <div class="container foot">
        <div class="foot-brand">
          <a class="logo" href="#/"><span class="logo-dot"></span><span>${esc(A.shop.name)}</span></a>
          ${C.about ? `<p>${esc(C.about)}</p>` : ''}
          <p class="muted">Cash on delivery or at pickup.</p>
        </div>
        <div class="foot-links">
          <strong>Useful links</strong>
          <a href="#/">Menu</a>
          <a href="#/checkout">Cart & checkout</a>
          <a href="#/orders">My orders</a>
          <a href="#/help">Help & support</a>
        </div>
        <div class="foot-contact">
          ${C.phone ? `<small class="muted">Call us</small><a class="foot-phone" href="tel:${esc(C.phone.replace(/\s+/g, ''))}">${esc(C.phone)}</a>` : ''}
          ${today ? `<span>${esc(today)}</span>` : ''}
          ${C.address ? `<span class="muted">${esc(C.address)}</span>` : ''}
        </div>
      </div>
      <div class="container foot-base">
        <span>© ${new Date().getFullYear()} ${esc(A.shop.name)}. All rights reserved.${A.demo ? ' · <a href="images/demo/CREDITS.md" target="_blank" rel="noopener">Demo photo credits</a>' : ''}</span>
        <span>Ordering powered by <b>Tiffin</b></span>
      </div>`;
  }

  /* ---------- Mobile cart bar ---------- */
  function renderCartBar() {
    const n = A.cartCount();
    const show = n > 0 && current === '' ;
    $cartBar.hidden = !show;
    document.body.classList.toggle('has-cart-bar', show);
    if (!show) return;
    const q = A.basketNow();
    $cartBar.innerHTML = `
      <a class="cart-bar-btn" href="#/checkout">
        <b class="cart-bar-n">${n}</b><span class="grow">View cart</span><span id="bar-total">${q ? money(q.itemsTotal) : ''}</span>
      </a>`;
    if (!q) A.getBasket().then((v) => { const el = document.getElementById('bar-total'); if (el && v) el.textContent = money(v.itemsTotal); }).catch(() => {});
  }

  A.updateChrome = () => {
    renderCartBar();
  };

  // After any cart change: update the page in place when it can, otherwise draw it again
  A.cartChanged = () => {
    state.checkoutKey = null;
    A.save();
    const route = A.routes[current];
    if (route?.update) route.update(); else A.refresh();
    A.renderHeader();
    A.updateChrome();
  };

  /* ---------- Router ---------- */
  let current = null;
  let timer = null;
  let cleanup = null;
  let navCount = 0;
  A.setTimer = (fn, ms) => { clearInterval(timer); timer = setInterval(fn, ms); };
  // A page can register something to stop when it is left (e.g. a live status stream)
  A.onLeave = (fn) => { cleanup = fn; };
  A.current = () => current;
  A.canGoBack = () => navCount > 0;

  const ALIASES = { menu: '', cart: 'checkout', track: 'orders', success: 'orders' };

  const notFound = {
    render: () => `<section class="page container">${A.empty('🤷', 'Page not found', 'The page you’re looking for doesn’t exist.', { href: '#/', label: 'Back to the menu' })}</section>`,
  };

  A.render = () => {
    clearInterval(timer);
    if (cleanup) { cleanup(); cleanup = null; }
    let [, name = '', ...rest] = (location.hash.slice(1) || '/').split('/');
    if (name in ALIASES) name = ALIASES[name];
    const param = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
    let route = A.routes[name];
    let html = route ? route.render(param) : null;
    if (html == null) { route = notFound; html = notFound.render(); }

    if (current !== name) { A.prevRoute = current; current = name; }
    document.body.dataset.page = name || 'home';
    $app.innerHTML = html;
    route.mount?.(param);
    A.renderHeader();
    A.updateChrome();
  };

  A.refresh = () => {
    const y = window.scrollY;
    A.render();
    window.scrollTo(0, y);
  };

  /* ---------- Global actions ---------- */
  A.action('back', () => (navCount > 0 ? history.back() : (location.hash = '#/')));

  A.action('add', (el, e) => {
    e.preventDefault();
    const item = A.byId(el.dataset.id);
    if (!item) return;
    if (!A.shop.open) return A.toast(A.shop.reason || 'The restaurant is not taking orders right now');
    A.addToCart(item.id, 1);
    A.cartChanged();
    A.toast(`${item.name} added to cart`);
  });

  // Stepper on a product card (dishes without options)
  A.action('card-qty', (el) => {
    const id = el.dataset.key;
    A.setLineQty(`${id}|`, A.qtyOf(id) + Number(el.dataset.d));
    A.cartChanged();
  });

  A.action('fav', (el, e) => {
    e.preventDefault();
    const { id } = el.dataset;
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    A.save();
    const on = state.favs.has(id);
    A.toast(on ? 'Saved to favourites' : 'Removed from favourites');
    if (current === 'favourites') return A.refresh();
    document.querySelectorAll(`[data-action="fav"][data-id="${CSS.escape(id)}"]`).forEach((b) => {
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = on ? I.heartF : I.heart;
    });
  });

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.disabled && A.actions[el.dataset.action]) A.actions[el.dataset.action](el, e);
  });

  document.addEventListener('submit', (e) => {
    const name = e.target.dataset.form;
    if (!name || !A.forms[name]) return;
    e.preventDefault();
    A.forms[name](e.target, e);
  });

  document.addEventListener('input', (e) => {
    const name = e.target.dataset.input;
    if (name && A.inputs[name]) A.inputs[name](e.target, e);
  });

  document.addEventListener('change', (e) => {
    const name = e.target.dataset.change;
    if (name && A.inputs[name]) A.inputs[name](e.target, e);
  });

  /* ---------- Demo mode: the hub cannot be reached ---------- */
  const realStore = Hub.store;
  function showDemoBanner() {
    const $b = document.getElementById('demo-banner');
    $b.innerHTML = `
      <div class="container demo-inner">
        <span class="demo-ico">!</span>
        <p><b>Demo mode.</b> <span class="xs-hide">We can’t reach the restaurant’s order system right now, so this is a preview with sample dishes. Orders placed here are <b>not sent to the restaurant</b>.</span><span class="xs-show">Restaurant offline: sample dishes, orders are <b>not sent</b>.</span></p>
        <button class="btn sm outline" data-action="reload">Try again</button>
      </div>`;
    $b.hidden = false;
    document.body.classList.add('is-demo');
  }
  // Keeps checking the real hub; offers to switch as soon as it answers
  function watchForHub() {
    const t = setInterval(async () => {
      try {
        await realStore();
        clearInterval(t);
        const $b = document.getElementById('demo-banner');
        $b.classList.add('back');
        $b.querySelector('p').innerHTML = '<b>The restaurant is back online.</b> Reload to see the real menu and order for real.';
        $b.querySelector('button').textContent = 'Reload';
      } catch { /* still unreachable */ }
    }, 30_000);
  }
  A.action('reload', () => location.reload());

  /* ---------- Start: load the store and its menu from the hub ---------- */
  async function start() {
    $app.innerHTML = `<section class="page container"><div class="loading"><span class="spinner"></span><p>Loading the menu…</p></div></section>`;
    try {
      A.setShop(await Hub.store());
    } catch (err) {
      // No hub: show the demo website (sample menu, everything works, nothing reaches the restaurant)
      console.warn('Order hub not reachable, showing the demo website:', err.message);
      A.enterDemo();
      A.setShop(await Hub.store());
      showDemoBanner();
      watchForHub();
    }
    document.title = `${A.shop.name} · Order online${A.demo ? ' (demo)' : ''}`;
    renderFooter();
    window.addEventListener('hashchange', () => { navCount++; A.closeModal?.(); A.render(); window.scrollTo(0, 0); });
    A.render();
    // Keep "open / closed" and the menu current without disturbing the page being used
    setInterval(async () => {
      try {
        const wasOpen = A.shop.open, version = A.shop.menu?.version;
        A.setShop(await Hub.store());
        A.clearQuote();
        if (wasOpen !== A.shop.open || version !== A.shop.menu?.version) {
          if (['', 'checkout'].includes(current) && document.getElementById('modal').hidden) A.refresh();
        }
        A.renderHeader();
        A.updateChrome();
      } catch { /* try again next time */ }
    }, 60_000);
  }

  start();
})(App);
