// Main page: hero, category chips, one section per menu category and a sticky cart (bottom cart bar on mobile)
(function (A) {
  const { I, state, esc, money, byId, cardHTML } = A;
  const C = window.TIFFIN_CONFIG;
  let noteClosed = false;

  const matches = (i, q) => !q || [i.name, i.category, i.description].some((s) => (s || '').toLowerCase().includes(q));

  function sectionsHTML() {
    const q = state.query.trim().toLowerCase();
    const sections = CATEGORIES
      .map((c) => ({ ...c, items: ITEMS.filter((i) => i.categoryId === c.id && matches(i, q)) }))
      .filter((s) => s.items.length);
    if (!sections.length) {
      return q ? `<div class="empty small"><span class="empty-ico">🔍</span><p>No dishes match “${esc(state.query)}”.</p></div>`
        : A.empty('📋', 'No menu yet', 'The restaurant has not published its menu online yet.');
    }
    return sections.map((s) => `
      <section class="menu-section" id="cat-${esc(s.id)}" data-cat="${esc(s.id)}">
        <div class="section-title"><h2>${esc(s.name)}</h2><small>${s.items.length} ${s.items.length === 1 ? 'dish' : 'dishes'}</small></div>
        <div class="pgrid">${s.items.map(cardHTML).join('')}</div>
      </section>`).join('');
  }

  // Sticky cart beside the menu (desktop)
  function cartHTML() {
    if (!state.cart.length) {
      return `
        <div class="cart-card">
          <div class="cart-head"><h2>Your cart</h2></div>
          <div class="cart-empty"><span>${I.bag}</span><p>Your cart is empty.<br>Add a dish to get started.</p></div>
        </div>`;
    }
    const q = A.basketNow();
    return `
      <div class="cart-card">
        <div class="cart-head"><h2>Your cart</h2><button class="link muted" data-action="clear-cart">Clear</button></div>
        <ul class="cart-lines">
          ${state.cart.map((l, i) => {
            const item = byId(l.itemId);
            const mods = A.modifierNames(l);
            return `
              <li>
                ${A.media(item, 'thumb')}
                <div class="grow">
                  <strong>${esc(item.name)}</strong>
                  ${mods.length ? `<small>${esc(mods.join(', '))}</small>` : ''}
                  <b class="line-price">${q?.lines?.[i] ? money(q.lines[i].lineTotal) : ''}</b>
                </div>
                ${A.stepper('line-qty', l.key, l.qty, 'sm')}
              </li>`;
          }).join('')}
        </ul>
        <div class="cart-sub"><span>Subtotal</span><strong id="cart-subtotal">${q ? money(q.itemsTotal) : ''}</strong></div>
        <p class="err small" id="cart-err"></p>
        <a class="btn block lg" href="#/checkout">Continue to checkout</a>
        <p class="cart-hint">${freeDeliveryHint(q)}</p>
      </div>`;
  }

  function freeDeliveryHint(q) {
    const z = A.shop.delivery?.zones?.find((x) => x.freeDeliveryAbove);
    if (state.fulfilment !== 'DELIVERY' || !z) return 'Delivery fee and packaging are added at checkout.';
    const near = `within ${z.upToKm} km`;
    if (q && q.itemsTotal >= z.freeDeliveryAbove) return `This order gets free delivery ${near}.`;
    return `Free delivery ${near} on orders over ${money(z.freeDeliveryAbove)}.`;
  }

  // Fills in line prices and the subtotal once the hub has priced the cart
  function priceCart() {
    if (!state.cart.length) return;
    A.getBasket().then((q) => {
      if (!q || !document.getElementById('cart-side')) return;
      document.getElementById('cart-side').innerHTML = cartHTML();
    }).catch((e) => {
      const err = document.getElementById('cart-err');
      if (err) err.textContent = e.message;
    });
  }

  // The hero's photo: the one chosen in the builder, else js/config.js, else the first dish photo
  function heroImage(s) {
    const own = A.imgSrc(s.image) || C.heroImage;
    if (own) return own;
    if (A.demo) return 'images/demo/hero.jpg';
    return ITEMS.find((i) => i.image)?.image || null;
  }

  function heroHTML(s) {
    const shop = A.shop;
    const img = heroImage(s);
    const today = A.hoursToday();
    const title = s.title || C.heroTitle || A.brandName();
    return `
      <div class="hero ${img ? '' : 'no-img'} ${s.align === 'center' ? 'center' : ''}" ${A.editAttr(s)}>
        ${A.editBadge(s)}
        ${img ? `<img class="hero-img" src="${esc(img)}" alt="" onerror="this.remove()">` : `<div class="hero-emoji" aria-hidden="true">${[...new Set(ITEMS.map((i) => i.emoji))].slice(0, 6).join('') || '🍛🥘🍜'}</div>`}
        ${noteClosed ? '' : `
        <div class="hero-note">
          <span class="hero-note-ico">${I.clock}</span>
          <div class="grow">
            <strong>${shop.open ? esc(today || 'Open now') : 'Not taking orders right now'}</strong>
            <p>${shop.open ? 'Order now — the kitchen starts your dishes the moment the restaurant confirms.' : esc(shop.reason || 'Please check back later.')}</p>
          </div>
          <button class="hero-note-x" data-action="close-note" aria-label="Close">${I.close}</button>
        </div>`}
        <div class="hero-text">
          <h1>${esc(title)}</h1>
          ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
          ${s.buttonText ? `<button class="btn hero-btn" data-action="go-menu">${esc(s.buttonText)}</button>` : ''}
        </div>
      </div>`;
  }

  // The menu with its category chips and the cart beside it (exactly one per page)
  function menuHTML(s) {
    return `
      <div class="menu-block" id="menu-start" ${A.editAttr(s)}>
        ${A.editBadge(s)}
        ${s.title ? `<div class="block-head"><h2>${esc(s.title)}</h2></div>` : ''}
        ${CATEGORIES.length > 1 && A.site.menu.showCategoryChips ? `
        <nav class="cats" id="cats" aria-label="Menu categories">
          <div class="cats-inner">
            ${CATEGORIES.map((c, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-action="go-cat" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}
          </div>
        </nav>` : ''}
        <div class="menu-layout">
          <div class="menu-main" id="sections" data-q="${esc(state.query)}">${sectionsHTML()}</div>
          <aside class="cart-side" id="cart-side">${cartHTML()}</aside>
        </div>
      </div>`;
  }

  A.route('', {
    render() {
      // while searching, only the menu: the results are what the customer wants
      const all = A.site.sections.filter((s) => !s.hidden || s.type === 'menu');
      const shown = state.query.trim() ? all.filter((s) => s.type === 'menu') : all;
      return `
        <section class="page container home">
          ${A.outletBar()}
          ${shown.map((s) => (s.type === 'hero' ? heroHTML(s) : s.type === 'menu' ? menuHTML(s) : A.blockHTML(s))).join('')}
        </section>`;
    },
    mount() {
      priceCart();
      spy();
    },
    // Cart or search changed: redraw the dishes and the cart, keep the scroll position
    update() {
      const sections = document.getElementById('sections');
      if (!sections) return;
      const q = state.query;
      // search started or ended: the other sections hide or come back
      if (Boolean(sections.dataset.q.trim()) !== Boolean(q.trim())) { A.render(); return; }
      if (sections.dataset.q !== q) { sections.innerHTML = sectionsHTML(); sections.dataset.q = q; spy(); }
      else ITEMS.forEach((item) => { const f = sections.querySelector(`[data-foot="${CSS.escape(item.id)}"]`); if (f) f.innerHTML = A.cardFoot(item); });
      document.getElementById('cart-side').innerHTML = cartHTML();
      priceCart();
    },
  });

  // Highlights the chip of the section being read
  let observer = null;
  function spy() {
    observer?.disconnect();
    const cats = document.getElementById('cats');
    if (!cats || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      const id = visible.target.dataset.cat;
      cats.querySelectorAll('.chip').forEach((c) => {
        const on = c.dataset.cat === id;
        c.classList.toggle('active', on);
        if (on) c.parentElement.scrollTo({ left: c.offsetLeft - 16, behavior: 'smooth' });
      });
    }, { rootMargin: '-140px 0px -60% 0px' });
    document.querySelectorAll('.menu-section').forEach((s) => observer.observe(s));
  }

  A.action('go-cat', (el) => {
    const s = document.getElementById(`cat-${el.dataset.cat}`);
    if (!s) return;
    const y = s.getBoundingClientRect().top + window.scrollY - (document.getElementById('site-header').offsetHeight + 64);
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
  A.action('go-menu', () => {
    const m = document.getElementById('menu-start');
    if (m) window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - document.getElementById('site-header').offsetHeight - 8, behavior: 'smooth' });
  });
  A.action('close-note', () => { noteClosed = true; document.querySelector('.hero-note')?.remove(); });

  // Stepper on a cart line (sidebar and checkout)
  A.action('line-qty', (el) => {
    const line = state.cart.find((l) => l.key === el.dataset.key);
    if (!line) return;
    A.setLineQty(line.key, line.qty + Number(el.dataset.d));
    A.cartChanged();
  });
  A.action('clear-cart', () => {
    if (!confirm('Remove everything from your cart?')) return;
    state.cart = [];
    A.cartChanged();
  });
})(App);
