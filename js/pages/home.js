// Home: store banner, categories, and one section per menu category (horizontal rails on mobile, grid on larger screens)
(function (A) {
  const { I, state, esc, cardHTML } = A;

  const fulfilText = () => {
    const f = A.shop.fulfilment || {};
    return f.delivery && f.pickup ? 'delivery or pickup' : f.delivery ? 'delivery' : 'pickup';
  };

  A.route('', {
    tab: 'home',
    tabbar: true,
    render() {
      const shop = A.shop;
      const addr = A.defaultAddress();
      const rails = CATEGORIES.filter((c) => c.id !== 'all')
        .map((c) => ({ id: c.id, title: c.name, items: ITEMS.filter((i) => i.categoryId === c.id) }))
        .filter((r) => r.items.length);
      const firstItem = ITEMS[0];
      return `
        <section class="page home">
          <header class="top">
            <a class="loc" href="#/addresses">
              <small>${I.pin} ${addr ? `Deliver to · ${esc(addr.label)}` : esc(shop.name)}</small>
              <span class="loc-btn">${addr ? esc(addr.line1) : 'Add a delivery address'} ${I.chevDown}</span>
            </a>
            <div class="row">
              <a class="icon-btn soft" href="#/notifications" aria-label="Notifications">${I.bell}${A.unreadCount() ? '<b class="dot"></b>' : ''}</a>
              ${A.cartButton()}
            </div>
          </header>

          ${A.shopBanner()}

          <a class="search" href="#/menu" data-action="go-search">
            ${I.search}
            <span class="search-ph">Search the menu</span>
            <span class="filter-btn">Filter <span>${I.filter}</span></span>
          </a>

          <div class="promo">
            <div class="promo-text">
              <h2>${esc(shop.name)}</h2>
              <p>${shop.open ? `Open now. Order for ${fulfilText()}, pay in cash.` : esc(shop.reason || 'Not taking orders right now.')}</p>
              <a class="btn-white" href="#/menu">${shop.open ? 'Order Now' : 'See the menu'}</a>
            </div>
            ${firstItem ? A.media(firstItem, 'promo-img') : ''}
          </div>

          ${ITEMS.length ? `
            <div class="section-head"><h2>Categories</h2><a class="link" href="#/menu" data-action="pick-cat" data-cat="all">See All</a></div>
            <div class="chips">
              ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
                <a class="cat" href="#/menu" data-action="pick-cat" data-cat="${esc(c.id)}">
                  <span class="cat-ico">${c.emoji}</span>${esc(c.name)}
                </a>`).join('')}
            </div>

            <div class="rails">
              ${rails.map((r, i) => `
                <section>
                  <div class="section-head">
                    <h2>${esc(r.title)}</h2>
                    <button class="icon-btn soft sm" data-action="rail-next" data-rail="${i}" aria-label="Scroll ${esc(r.title)}">${I.arrowRight}</button>
                  </div>
                  <div class="rail" id="rail-${i}">${r.items.map(cardHTML).join('')}</div>
                </section>`).join('')}
            </div>

            <section class="picks-section">
              <div class="section-head"><h2>Full menu</h2><a class="link" href="#/menu">Search the menu</a></div>
              <div class="grid">${ITEMS.map(cardHTML).join('')}</div>
            </section>`
          : A.empty('📋', 'No menu yet', 'The restaurant has not published its menu online yet.')}
        </section>`;
    },
  });

  A.action('go-search', () => { state.focusSearch = true; });
  A.action('pick-cat', (el) => { state.menu.cat = el.dataset.cat; state.menu.query = ''; });
  A.action('rail-next', (el) => {
    const rail = document.getElementById('rail-' + el.dataset.rail);
    const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + rail.clientWidth * 0.8, behavior: 'smooth' });
  });
})(App);
