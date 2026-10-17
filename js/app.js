// Router, navigation chrome and global event delegation
(function (A) {
  'use strict';

  const { I, state } = A;
  const $app = document.getElementById('app');
  const $tabbar = document.getElementById('tabbar');

  // Older saved orders may miss newer fields
  state.orders.forEach((o) => {
    o.subtotal ??= o.total; o.fee ??= 0; o.discount ??= 0;
    o.address ??= '—'; o.payment ??= '—'; o.schedule ??= 'asap';
  });

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
  let navCount = 0;
  A.setTimer = (fn, ms) => { clearInterval(timer); timer = setInterval(fn, ms); };

  const notFound = {
    render: () => `<section class="page panel">${A.header('Not found')}${A.empty('🤷', 'Page not found', 'The page you’re looking for doesn’t exist.', { href: '#/', label: 'Go home' })}</section>`,
  };

  A.render = () => {
    clearInterval(timer);
    const [, name = '', param] = (location.hash.slice(1) || '/').split('/');
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

  window.addEventListener('hashchange', () => { navCount++; A.render(); window.scrollTo(0, 0); });

  /* ---------- Global actions ---------- */
  A.action('back', () => (navCount > 0 ? history.back() : (location.hash = '#/')));
  A.action('toast', (el) => A.toast(el.dataset.msg));

  A.action('add', (el, e) => {
    e.preventDefault();
    const { id } = el.dataset;
    state.cart[id] = (state.cart[id] || 0) + 1;
    A.save(); A.updateChrome();
    A.toast(`${A.byId(id).name} added to cart`);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  });

  A.action('fav', (el, e) => {
    e.preventDefault();
    const id = Number(el.dataset.id);
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    A.save();
    A.toast(state.favs.has(id) ? 'Saved to favourites' : 'Removed from favourites');
    if (current === 'favourites') A.refresh();
    else document.querySelectorAll(`[data-action="fav"][data-id="${id}"]`).forEach((b) => b.classList.toggle('on', state.favs.has(id)));
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

  A.render();
})(App);
