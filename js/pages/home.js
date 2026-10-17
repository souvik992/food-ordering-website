// Home: promo, categories, and dish sections (horizontal rails on mobile, grid on larger screens)
(function (A) {
  const { I, state, esc, media, byId, cardHTML } = A;

  const RAILS = [
    { title: 'Picks For You', items: () => ITEMS },
    { title: "Today's Special", items: () => [8, 3, 1, 4, 7].map(byId) },
    { title: 'Top Rated', items: () => [...ITEMS].sort((a, b) => b.rating - a.rating) },
    { title: 'Most Popular', items: () => [...ITEMS].sort((a, b) => b.reviews - a.reviews) },
  ];

  A.route('', {
    tab: 'home',
    tabbar: true,
    render() {
      const addr = A.defaultAddress();
      return `
        <section class="page home">
          <header class="top">
            <a class="loc" href="#/addresses">
              <small>${I.pin} Deliver to · ${esc(addr.label)}</small>
              <span class="loc-btn">${esc(addr.line)} ${I.chevDown}</span>
            </a>
            <div class="row">
              <a class="icon-btn soft" href="#/notifications" aria-label="Notifications">${I.bell}${A.unreadCount() ? '<b class="dot"></b>' : ''}</a>
              ${A.cartButton()}
            </div>
          </header>

          <a class="search" href="#/menu" data-action="go-search">
            ${I.search}
            <span class="search-ph">Search dishes or restaurants</span>
            <span class="filter-btn">Filter <span>${I.filter}</span></span>
          </a>

          <div class="promo">
            <div class="promo-text">
              <h2>Gonna Be a Good Day!</h2>
              <p>Free delivery, lower fees &amp; <strong>10%</strong> cashback with code <strong>GOOD10</strong></p>
              <a class="btn-white" href="#/item/3">Order Now</a>
            </div>
            ${media(byId(3), 'promo-img', 500)}
          </div>

          <div class="section-head"><h2>Categories</h2><a class="link" href="#/menu" data-action="pick-cat" data-cat="all">See All</a></div>
          <div class="chips">
            ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
              <a class="cat" href="#/menu" data-action="pick-cat" data-cat="${c.id}">
                <span class="cat-ico">${c.emoji}</span>${c.name}
              </a>`).join('')}
          </div>

          <div class="rails">
            ${RAILS.map((r, i) => `
              <section>
                <div class="section-head">
                  <h2>${r.title}</h2>
                  <button class="icon-btn soft sm" data-action="rail-next" data-rail="${i}" aria-label="Scroll ${r.title}">${I.arrowRight}</button>
                </div>
                <div class="rail" id="rail-${i}">${r.items().map(cardHTML).join('')}</div>
              </section>`).join('')}
          </div>

          <section class="picks-section">
            <div class="section-head"><h2>Picks For You</h2><a class="link" href="#/menu">View full menu</a></div>
            <div class="grid">${ITEMS.map(cardHTML).join('')}</div>
          </section>
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
