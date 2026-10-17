// Router, navigation chrome, global event delegation, and loading the menu from the order hub
(function (A) {
  'use strict';

  const { I, state } = A;
  const $app = document.getElementById('app');
  const $tabbar = document.getElementById('tabbar');

  /* ---------- Tab bar / sidebar ---------- */
  const TABS = {
    home: ['Home', I.home], menu: ['Menu', I.grid], cart: ['Cart', I.bag],
    orders: ['Orders', I.orders], account: ['Account', I.user],
  };
  $tabbar.querySelectorAll('[data-tab]').forEach((a) => {
    const [label, icon] = TABS[a.dataset.tab];
    a.innerHTML = `<span class="tab-ico">${icon}</span><span>${label}</span>`;
  });

  let activeTab = '';
  A.updateChrome = (tab = activeTab) => {
    activeTab = tab;
    $tabbar.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    const n = A.cartCount();
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = n === 0; });
    $tabbar.querySelector('[data-tab="cart"] .tab-ico').dataset.count = n || '';
  };

  /* ---------- Router ---------- */
  let current = null;
  let timer = null;
  let cleanup = null;
  let navCount = 0;
  A.setTimer = (fn, ms) => { clearInterval(timer); timer = setInterval(fn, ms); };
  // A page can register something to stop when it is left (e.g. a live status stream)
  A.onLeave = (fn) => { cleanup = fn; };

  const notFound = {
    render: () => `<section class="page panel">${A.header('Not found')}${A.empty('🤷', 'Page not found', 'The page you’re looking for doesn’t exist.', { href: '#/', label: 'Go home' })}</section>`,
  };

  A.render = () => {
    clearInterval(timer);
    if (cleanup) { cleanup(); cleanup = null; }
    const [, name = '', ...rest] = (location.hash.slice(1) || '/').split('/');
    const param = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
    let route = A.routes[name];
    let html = route ? route.render(param) : null;
    if (html == null) { route = notFound; html = notFound.render(); }

    if (current !== name) { A.prevRoute = current; current = name; }
    document.body.dataset.page = name || 'home';
    document.body.classList.toggle('no-tabbar', !route.tabbar);
    $app.innerHTML = html;
    route.mount?.(param);
    A.updateChrome(route.tab || '');
  };

  A.refresh = () => {
    const y = window.scrollY;
    A.render();
    window.scrollTo(0, y);
  };

  /* ---------- Global actions ---------- */
  A.action('back', () => (navCount > 0 ? history.back() : (location.hash = '#/')));
  A.action('toast', (el) => A.toast(el.dataset.msg));

  A.action('add', (el, e) => {
    e.preventDefault();
    const { id } = el.dataset;
    A.addToCart(id, 1);
    A.toast(`${A.byId(id).name} added to cart`);
    A.refresh(); // the ADD button becomes a stepper
  });
  // Steppers on menu cards change the item's plain (no options) cart line
  A.action('item-inc', (el, e) => {
    e.preventDefault();
    A.addToCart(el.dataset.id, 1);
    A.refresh();
  });
  A.action('item-dec', (el, e) => {
    e.preventDefault();
    const i = state.cart.findIndex((l) => l.key === A.lineKey(el.dataset.id, []));
    if (i < 0) return;
    if (--state.cart[i].qty <= 0) state.cart.splice(i, 1);
    state.checkoutKey = null;
    A.save();
    A.refresh();
  });
  A.action('choose', (el, e) => {
    e.preventDefault();
    location.hash = `#/item/${encodeURIComponent(el.dataset.id)}`;
  });

  A.action('fav', (el, e) => {
    e.preventDefault();
    const { id } = el.dataset;
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    A.save();
    A.toast(state.favs.has(id) ? 'Saved to favourites' : 'Removed from favourites');
    if (current === 'favourites') A.refresh();
    else document.querySelectorAll('[data-action="fav"]').forEach((b) => { if (b.dataset.id === id) b.classList.toggle('on', state.favs.has(id)); });
  });

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && A.actions[el.dataset.action]) A.actions[el.dataset.action](el, e);
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

  /* ---------- Start: load the store and its menu from the hub ---------- */
  function showLoadError(err) {
    document.body.classList.add('no-tabbar');
    $app.innerHTML = `<section class="page panel">${A.empty('📡', 'Could not load the menu', A.esc(err.message), null)}
      <div class="center"><button class="btn" data-action="reload">Try again</button></div></section>`;
  }
  A.action('reload', () => location.reload());

  async function start() {
    $app.innerHTML = `<section class="page panel">${A.empty('⏳', 'Loading the menu…', '', null)}</section>`;
    try {
      A.setShop(await Hub.store());
    } catch (err) {
      showLoadError(err);
      return;
    }
    document.title = A.shop.name;
    document.getElementById('brand-name').textContent = A.shop.name;
    window.addEventListener('hashchange', () => { navCount++; A.render(); window.scrollTo(0, 0); });
    A.render();
    // Keep "open / closed" and the menu current without disturbing the page being used
    setInterval(async () => {
      try {
        const wasOpen = A.shop.open, version = A.shop.menu?.version;
        A.setShop(await Hub.store());
        A.clearQuote();
        if (wasOpen !== A.shop.open || version !== A.shop.menu?.version) {
          if (['', 'menu', 'cart'].includes(current)) A.refresh();
        }
        A.updateChrome();
      } catch { /* try again next time */ }
    }, 60_000);
  }

  start();
})(App);
