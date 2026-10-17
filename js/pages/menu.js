// Menu & search: live search, category chips, sorting, recent searches
(function (A) {
  const { I, state, esc, rowHTML } = A;

  const SORTS = {
    popular: ['Most popular', (a, b) => b.reviews - a.reviews],
    rating: ['Top rated', (a, b) => b.rating - a.rating],
    fastest: ['Fastest delivery', (a, b) => a.time - b.time],
    'price-asc': ['Price: low to high', (a, b) => a.price - b.price],
    'price-desc': ['Price: high to low', (a, b) => b.price - a.price],
  };

  function results() {
    const { query, cat, sort } = state.menu;
    const q = query.trim().toLowerCase();
    return ITEMS
      .filter((i) => (cat === 'all' || i.category === cat) &&
        (!q || [i.name, i.by, i.category].some((s) => s.toLowerCase().includes(q))))
      .sort(SORTS[sort][1]);
  }

  function renderResults() {
    const list = results();
    const { query, cat } = state.menu;
    document.getElementById('menu-count').textContent = `${list.length} ${list.length === 1 ? 'dish' : 'dishes'}`;
    document.querySelectorAll('#menu-cats .chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === cat));

    const recent = document.getElementById('menu-recent');
    recent.innerHTML = !query && state.recent.length ? `
      <div class="section-head"><h2 class="h-sm">Recent searches</h2><button class="link" data-action="clear-recent">Clear</button></div>
      <div class="chips wrap">${state.recent.map((r) => `<button class="chip" data-action="use-recent" data-q="${esc(r)}">${I.clock}${esc(r)}</button>`).join('')}</div>` : '';

    document.getElementById('menu-results').innerHTML = list.length
      ? list.map(rowHTML).join('')
      : `<div class="empty"><span>🔍</span><p>No dishes match “${esc(query)}”. Try another search.</p></div>`;
  }

  A.route('menu', {
    tab: 'menu',
    tabbar: true,
    render() {
      const { query, sort } = state.menu;
      return `
        <section class="page panel menu">
          ${A.header('Menu', { back: false, right: A.cartButton() })}
          <label class="search solo">
            ${I.search}
            <input id="menu-q" type="search" data-input="menu-q" data-change="menu-q-commit" placeholder="Search dishes or restaurants" value="${esc(query)}" autocomplete="off" enterkeyhint="search" />
          </label>
          <div class="chips" id="menu-cats">
            ${CATEGORIES.map((c) => `<button class="chip" data-action="menu-cat" data-cat="${c.id}">${c.emoji} ${c.name}</button>`).join('')}
          </div>
          <div class="toolbar">
            <span class="muted" id="menu-count"></span>
            <label class="select">${I.sort}
              <select data-change="menu-sort" aria-label="Sort">
                ${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </label>
          </div>
          <div id="menu-recent"></div>
          <div class="row-grid" id="menu-results"></div>
        </section>`;
    },
    mount() {
      renderResults();
      if (state.focusSearch) { document.getElementById('menu-q').focus(); state.focusSearch = false; }
    },
  });

  A.input('menu-q', (el) => { state.menu.query = el.value; renderResults(); });
  A.input('menu-q-commit', (el) => {
    const q = el.value.trim();
    if (q.length < 2) return;
    state.recent = [q, ...state.recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    A.save();
  });
  A.input('menu-sort', (el) => { state.menu.sort = el.value; renderResults(); });
  A.action('menu-cat', (el) => { state.menu.cat = el.dataset.cat; renderResults(); });
  A.action('use-recent', (el) => {
    state.menu.query = el.dataset.q;
    document.getElementById('menu-q').value = el.dataset.q;
    renderResults();
  });
  A.action('clear-recent', () => { state.recent = []; A.save(); renderResults(); });
})(App);
