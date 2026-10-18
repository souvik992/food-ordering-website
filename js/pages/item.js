// Dish details in a dialog (bottom sheet on mobile): photo, description, options set up in the POS, quantity
(function (A) {
  const { I, state, esc, money, byId } = A;
  const $modal = document.getElementById('modal');

  // What the customer is choosing
  let pick = { itemId: null, qty: 1, mods: [] };

  function groupRule(g) {
    if (g.minSelect === 0 && g.maxSelect === 1) return 'Optional · choose 1';
    if (g.minSelect === 0) return `Optional · up to ${g.maxSelect}`;
    if (g.minSelect === g.maxSelect) return `Required · choose ${g.minSelect}`;
    return `Required · choose ${g.minSelect} to ${g.maxSelect}`;
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

  function dialogHTML(item) {
    const groups = A.modifierGroups(item);
    const fav = state.favs.has(item.id);
    return `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-label="${esc(item.name)}">
        <div class="modal-media">
          ${A.media(item)}
          ${A.vegTag(item)}
          <button class="fav ${fav ? 'on' : ''}" data-action="fav" data-id="${esc(item.id)}" aria-label="Favourite" aria-pressed="${fav}">${fav ? I.heartF : I.heart}</button>
          <button class="modal-x" data-action="close-modal" aria-label="Close">${I.close}</button>
        </div>
        <div class="modal-body">
          <div class="modal-title">
            <h2>${esc(item.name)}</h2>
            <strong class="price">${money(item.price)}</strong>
          </div>
          <p class="muted">${esc(item.description || item.category)}</p>
          ${groups.map((g) => `
            <section class="mod-group">
              <div class="mod-head"><h3>${esc(g.name)}</h3><small class="${g.minSelect ? 'req' : ''}">${groupRule(g)}</small></div>
              <div class="mod-list">
                ${g.modifiers.map((m) => {
                  const on = pick.mods.includes(m.id);
                  return `
                    <button class="mod ${on ? 'on' : ''} ${g.maxSelect === 1 ? 'radio' : ''}" data-action="mod" data-value="${esc(g.id)}|${esc(m.id)}" aria-pressed="${on}">
                      <span class="mod-box">${I.check}</span>
                      <span class="grow">${esc(m.name)}</span>
                      <span class="muted">${m.price ? `+ ${money(m.price)}` : 'Free'}</span>
                    </button>`;
                }).join('')}
              </div>
            </section>`).join('')}
        </div>
        <div class="modal-foot">
          ${A.shop.open ? `
            <div class="stepper lg">
              <button data-action="pick-qty" data-d="-1" aria-label="One less">${I.minus}</button>
              <span id="pick-qty">${pick.qty}</span>
              <button data-action="pick-qty" data-d="1" aria-label="One more">${I.plus}</button>
            </div>
            <button class="btn lg grow" data-action="add-picked">Add to cart</button>`
          : `<p class="muted grow">${esc(A.shop.reason || 'The restaurant is not taking orders right now.')}</p>`}
        </div>
      </div>`;
  }

  function draw() {
    const item = byId(pick.itemId);
    if (!item) return A.closeModal();
    const body = $modal.querySelector('.modal-body');
    const scroll = body ? body.scrollTop : 0;
    $modal.innerHTML = dialogHTML(item);
    $modal.querySelector('.modal-body').scrollTop = scroll;
  }

  function onKey(e) { if (e.key === 'Escape') A.closeModal(); }

  A.openItem = (id) => {
    const item = byId(id);
    if (!item) return;
    pick = { itemId: item.id, qty: 1, mods: [] };
    draw();
    $modal.hidden = false;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', onKey);
    $modal.querySelector('.modal-x')?.focus({ preventScroll: true });
  };
  A.closeModal = () => {
    if ($modal.hidden) return;
    $modal.hidden = true;
    $modal.innerHTML = '';
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
  };

  A.action('choose', (el, e) => { e.preventDefault(); A.openItem(el.dataset.id); });
  A.action('close-modal', () => A.closeModal());

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
    draw();
  });

  A.action('pick-qty', (el) => {
    pick.qty = Math.max(1, Math.min(20, pick.qty + Number(el.dataset.d)));
    document.getElementById('pick-qty').textContent = pick.qty;
  });

  A.action('add-picked', () => {
    const item = byId(pick.itemId);
    const problem = optionProblem(item);
    if (problem) return A.toast(problem);
    A.addToCart(item.id, pick.qty, pick.mods);
    A.closeModal();
    A.cartChanged();
    A.toast(`${pick.qty} × ${item.name} added to cart`);
  });
})(App);
