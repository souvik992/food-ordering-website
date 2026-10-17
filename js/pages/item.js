// Item detail: photo, options (sizes, add-ons) as set up in the POS, quantity and "You may also like"
(function (A) {
  const { I, state, esc, money, byId, media, cardHTML, vegMark } = A;

  // What the customer is choosing on this page; editKey is set when changing a cart line
  let pick = { itemId: null, qty: 1, mods: [], editKey: null };
  const pickTotal = () => A.unitPrice(pick.itemId, pick.mods) * pick.qty;

  function groupRule(g) {
    if (g.minSelect === 0 && g.maxSelect === 1) return 'Optional · choose 1';
    if (g.minSelect === 0) return `Optional · up to ${g.maxSelect}`;
    if (g.minSelect === g.maxSelect) return `Required · choose ${g.minSelect}`;
    return `Required · choose ${g.minSelect} to ${g.maxSelect}`;
  }

  function optionsHTML(item) {
    return A.modifierGroups(item).map((g) => `
      <section class="mod-group">
        <div class="box-head"><h2 class="h-sm">${esc(g.name)}</h2><small class="muted">${groupRule(g)}</small></div>
        <div class="options">
          ${g.modifiers.map((m) => A.option({
            action: 'mod', value: `${esc(g.id)}|${esc(m.id)}`, selected: pick.mods.includes(m.id),
            icon: I.plus, title: esc(m.name), sub: m.price ? `+ ${money(m.price)}` : 'No extra charge',
          })).join('')}
        </div>
      </section>`).join('');
  }

  // First problem with the chosen options, or null
  function optionProblem(item) {
    for (const g of A.modifierGroups(item)) {
      const n = g.modifiers.filter((m) => pick.mods.includes(m.id)).length;
      if (n < g.minSelect) return `Choose ${g.minSelect === g.maxSelect ? g.minSelect : `at least ${g.minSelect}`} for ${g.name}`;
      if (n > g.maxSelect) return `Choose up to ${g.maxSelect} for ${g.name}`;
    }
    return null;
  }

  A.route('item', {
    tab: 'menu',
    render(id) {
      const item = byId(id);
      if (!item) return null;
      if (pick.itemId !== item.id || pick.editKey) pick = { itemId: item.id, qty: 1, mods: [], editKey: null };
      return pageHTML(item);
    },
  });

  // Change a cart line's options and quantity: #/edit/<line key>
  A.route('edit', {
    tab: 'cart',
    render(key) {
      const line = state.cart.find((l) => l.key === key);
      const item = line && byId(line.itemId);
      if (!item) return null;
      if (pick.editKey !== key) pick = { itemId: item.id, qty: line.qty, mods: [...line.modifierIds], editKey: key };
      return pageHTML(item);
    },
  });

  function pageHTML(item) {
    const fav = state.favs.has(item.id);
    const editing = !!pick.editKey;
    const related = editing ? [] : ITEMS.filter((i) => i.id !== item.id && i.categoryId === item.categoryId)
      .concat(ITEMS.filter((i) => i.categoryId !== item.categoryId)).slice(0, 6);
    return `
      <section class="page detail">
        <div class="detail-hero">
          ${media(item, 'hero-img')}
          <div class="hero-bar">
            <button class="icon-btn glass" data-action="back" aria-label="Back">${I.back}</button>
            <div class="row">
              <button class="icon-btn glass fav ${fav ? 'on' : ''}" data-action="fav" data-id="${esc(item.id)}" aria-label="Favourite">${I.heart}</button>
              <button class="icon-btn glass" data-action="share" data-id="${esc(item.id)}" aria-label="Share">${I.share}</button>
            </div>
          </div>
        </div>

        <div class="sheet">
          <div class="title-row">
            <div>
              <h1>${vegMark(item)}${esc(item.name)}</h1>
              <p class="muted">${esc(item.category)}${item.isVeg == null ? '' : item.isVeg ? ' · Veg' : ' · Non-veg'}</p>
            </div>
            <strong class="price">${money(item.price)}</strong>
          </div>

          ${A.shopBanner()}
          ${optionsHTML(item)}

          <div class="qty-row">
            <strong>Quantity</strong>
            <div class="qty lg">
              <button data-action="qty-dec" aria-label="Decrease">${I.minus}</button>
              <span id="qty">${pick.qty}</span>
              <button class="plus" data-action="qty-inc" aria-label="Increase">${I.plus}</button>
            </div>
          </div>

          <div class="cta">
            <span class="cta-price"><small>Total</small><b id="cta-total" class="mono">${money(pickTotal())}</b></span>
            <button class="cta-btn" data-action="add-detail" data-id="${esc(item.id)}">${I.bag} ${editing ? 'Update cart' : 'Add to Cart'}</button>
          </div>
        </div>

        ${related.length ? `
        <section class="related">
          <div class="section-head"><h2>You may also like</h2></div>
          <div class="rail always">${related.map(cardHTML).join('')}</div>
        </section>` : ''}
      </section>`;
  }

  const currentItem = () => byId(pick.itemId);

  A.action('mod', (el) => {
    const [groupId, modId] = el.dataset.value.split('|');
    const g = A.shop.menu.modifierGroups.find((x) => x.id === groupId);
    if (!g) return;
    if (pick.mods.includes(modId)) {
      pick.mods = pick.mods.filter((m) => m !== modId);
    } else if (g.maxSelect === 1) {
      // one choice in this group: replace the earlier one
      pick.mods = pick.mods.filter((m) => !g.modifiers.some((x) => x.id === m)).concat(modId);
    } else if (g.modifiers.filter((m) => pick.mods.includes(m.id)).length < g.maxSelect) {
      pick.mods.push(modId);
    } else {
      A.toast(`You can choose up to ${g.maxSelect} for ${g.name}`);
      return;
    }
    A.refresh();
  });

  function setQty(n) {
    pick.qty = Math.max(1, Math.min(99, n));
    document.getElementById('qty').textContent = pick.qty;
    document.getElementById('cta-total').textContent = money(pickTotal());
  }
  A.action('qty-inc', () => setQty(pick.qty + 1));
  A.action('qty-dec', () => setQty(pick.qty - 1));
  A.action('add-detail', () => {
    const item = currentItem();
    const problem = optionProblem(item);
    if (problem) return A.toast(problem);
    if (pick.editKey) {
      A.replaceLine(pick.editKey, item.id, pick.qty, pick.mods);
      pick = { itemId: null, qty: 1, mods: [], editKey: null };
      A.toast('Cart updated');
      location.hash = '#/cart';
      return;
    }
    A.addToCart(item.id, pick.qty, pick.mods);
    A.updateChrome();
    A.toast(`${pick.qty} × ${item.name} added to cart`);
    pick = { itemId: item.id, qty: 1, mods: [], editKey: null };
    A.refresh();
  });
  A.action('share', (el) => {
    const item = byId(el.dataset.id);
    if (navigator.share) navigator.share({ title: item.name, url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(location.href).then(() => A.toast('Link copied'), () => A.toast('Could not copy link'));
  });
})(App);
