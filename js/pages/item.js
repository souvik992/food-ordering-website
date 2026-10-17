// Item detail: photo, courier, description, quantity and "You may also like"
(function (A) {
  const { I, state, esc, money, byId, media, cardHTML } = A;

  A.route('item', {
    tab: 'menu',
    render(id) {
      const item = byId(id);
      if (!item) return null;
      state.qty = 1;
      const fav = state.favs.has(item.id);
      const related = ITEMS.filter((i) => i.id !== item.id && i.category === item.category)
        .concat(ITEMS.filter((i) => i.category !== item.category)).slice(0, 5);
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
              <span class="rating">${I.star}${item.rating} <small class="muted">(${A.fmtReviews(item.reviews)})</small></span>
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

            <div class="qty-row">
              <strong>Quantity</strong>
              <div class="qty lg">
                <button data-action="qty-dec" aria-label="Decrease">${I.minus}</button>
                <span id="qty">1</span>
                <button class="plus" data-action="qty-inc" aria-label="Increase">${I.plus}</button>
              </div>
            </div>

            <div class="cta">
              <span class="cta-price" id="cta-price">${money(item.price)}</span>
              <button class="cta-btn" data-action="add-detail" data-id="${item.id}">Add to Cart</button>
            </div>
          </div>

          <section class="related">
            <div class="section-head"><h2>You may also like</h2></div>
            <div class="rail always">${related.map(cardHTML).join('')}</div>
          </section>
        </section>`;
    },
  });

  function setQty(n, id) {
    state.qty = Math.max(1, Math.min(20, n));
    document.getElementById('qty').textContent = state.qty;
    document.getElementById('cta-price').textContent = money(byId(id).price * state.qty);
  }
  const currentId = () => document.querySelector('[data-action="add-detail"]').dataset.id;

  A.action('qty-inc', () => setQty(state.qty + 1, currentId()));
  A.action('qty-dec', () => setQty(state.qty - 1, currentId()));
  A.action('add-detail', (el) => {
    const { id } = el.dataset;
    state.cart[id] = (state.cart[id] || 0) + state.qty;
    A.save(); A.updateChrome();
    A.toast(`${state.qty} × ${byId(id).name} added to cart`);
    setQty(1, id);
  });
  A.action('more', (el) => {
    const open = document.getElementById('desc').classList.toggle('clamp');
    el.textContent = open ? 'Read more' : 'Show less';
  });
  A.action('share', (el) => {
    const item = byId(el.dataset.id);
    if (navigator.share) navigator.share({ title: item.name, url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(location.href).then(() => A.toast('Link copied'), () => A.toast('Could not copy link'));
  });
})(App);
