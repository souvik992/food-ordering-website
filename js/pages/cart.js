// Cart and checkout. Totals come from the hub (a quote); the order goes to the hub, which sends it to the restaurant's POS.
(function (A) {
  const { I, state, esc, money, byId, media, option } = A;

  const lineName = (l) => {
    const mods = A.modifierNames(l);
    return mods.length ? `<small class="muted">${esc(mods.join(', '))}</small>` : '';
  };

  // Fills #quote with the hub's total (or the reason there is none) and enables the button that needs it
  function showQuote(buttonSelector) {
    const box = document.getElementById('quote');
    const btn = document.querySelector(buttonSelector);
    if (!box) return;
    box.innerHTML = '<p class="muted">Working out the total…</p>';
    if (btn) btn.disabled = true;
    A.getQuote().then((q) => {
      if (!document.body.contains(box)) return;
      box.innerHTML = A.summaryRows(q);
      const price = document.getElementById('cta-price');
      if (price) price.textContent = money(q.total);
      if (btn) btn.disabled = !A.shop.open;
    }).catch((e) => {
      if (!document.body.contains(box)) return;
      box.innerHTML = `<p class="err">${esc(e.message)}</p>`;
      const price = document.getElementById('cta-price');
      if (price) price.textContent = '';
      // the cart page can still go on to checkout to fix the address
      if (btn && buttonSelector === '#to-checkout') btn.disabled = !A.shop.open || e.code !== 'NO_LOCATION';
    });
  }

  function fulfilmentChips() {
    const f = A.shop.fulfilment || {};
    if (!(f.delivery && f.pickup)) return `<p class="muted">${f.delivery ? 'Delivery only' : 'Pickup only'}</p>`;
    return `<div class="seg">
      <button class="${state.fulfilment === 'DELIVERY' ? 'active' : ''}" data-action="set-fulfilment" data-value="DELIVERY">${I.bike} Delivery</button>
      <button class="${state.fulfilment === 'PICKUP' ? 'active' : ''}" data-action="set-fulfilment" data-value="PICKUP">${I.bag} Pickup</button>
    </div>`;
  }

  /* ---------- Cart ---------- */
  A.route('cart', {
    tab: 'cart',
    render() {
      const head = A.header('Cart', {
        right: `<button class="icon-btn soft" data-action="clear-cart" aria-label="Clear cart" ${state.cart.length ? '' : 'disabled'}>${I.trash}</button>`,
      });
      if (!state.cart.length) {
        return `<section class="page panel">${head}${A.empty('🛍️', 'Your cart is empty', 'Add something tasty to get started.', { href: '#/menu', label: 'Browse menu' })}</section>`;
      }
      return `
        <section class="page panel has-cta">
          ${head}
          ${A.shopBanner()}
          <div class="split">
            <ul class="cart-list">
              ${state.cart.map((l, i) => {
                const item = byId(l.itemId);
                return `
                <li class="cart-item">
                  <a href="#/item/${encodeURIComponent(item.id)}">${media(item, 'thumb')}</a>
                  <div class="grow">
                    <div class="ci-top">
                      <div><h3>${A.vegMark(item)}${esc(item.name)}</h3>${lineName(l)}</div>
                    </div>
                    <div class="ci-bottom">
                      <span class="muted">${money(item.price)}${l.modifierIds.length ? ' + options' : ''} each</span>
                      <div class="qty">
                        <button data-action="dec" data-i="${i}" aria-label="Decrease">${I.minus}</button>
                        <span>${l.qty}</span>
                        <button class="plus" data-action="inc" data-i="${i}" aria-label="Increase">${I.plus}</button>
                      </div>
                    </div>
                  </div>
                </li>`;
              }).join('')}
            </ul>

            <aside class="summary">
              ${fulfilmentChips()}
              <div id="quote"></div>
              <div class="cta">
                <span class="cta-price" id="cta-price"></span>
                <button class="cta-btn" id="to-checkout" data-action="go-checkout" disabled>Checkout</button>
              </div>
            </aside>
          </div>
        </section>`;
    },
    mount() { if (state.cart.length) showQuote('#to-checkout'); },
  });

  const cartChanged = () => { state.checkoutKey = null; A.save(); A.refresh(); };
  A.action('inc', (el) => { const l = state.cart[el.dataset.i]; l.qty = Math.min(99, l.qty + 1); cartChanged(); });
  A.action('dec', (el) => {
    const i = Number(el.dataset.i);
    if (--state.cart[i].qty <= 0) state.cart.splice(i, 1);
    cartChanged();
  });
  A.action('clear-cart', () => { state.cart = []; cartChanged(); });
  A.action('set-fulfilment', (el) => { state.fulfilment = el.dataset.value; cartChanged(); });
  A.action('go-checkout', () => { location.hash = '#/checkout'; });

  /* ---------- Checkout ---------- */
  A.route('checkout', {
    tab: 'cart',
    render() {
      const head = A.header('Checkout');
      if (!state.cart.length) {
        return `<section class="page panel">${head}${A.empty('🧾', 'Nothing to check out', 'Your cart is empty.', { href: '#/menu', label: 'Browse menu' })}</section>`;
      }
      if (!state.user?.otpToken) {
        return `<section class="page panel">${head}${A.empty('🔐', 'Verify your mobile number', 'The restaurant needs a verified mobile number for cash orders.', { href: '#/login/checkout', label: 'Sign in' })}</section>`;
      }
      const delivery = state.fulfilment === 'DELIVERY';
      const addr = A.defaultAddress();
      const payLabel = delivery ? 'Cash on delivery' : 'Pay at the counter';

      return `
        <section class="page panel has-cta">
          ${head}
          ${A.shopBanner()}
          <div class="split">
            <div class="stack">
              <section class="box">
                <div class="box-head"><h2 class="h-sm">How do you want it?</h2></div>
                ${fulfilmentChips()}
              </section>

              ${delivery ? `
              <section class="box">
                <div class="box-head"><h2 class="h-sm">Delivery address</h2><a class="link strong" href="#/addresses">${addr ? 'Change' : 'Add'}</a></div>
                ${addr
                  ? option({ action: 'go-addresses', value: addr.id, selected: true, icon: A.ADDRESS_ICONS[addr.label] || I.pinO, title: esc(addr.label), sub: esc(A.addressText(addr)) })
                    + (addr.lat == null ? `<p class="err">This address has no map location. Open it and press “Use my current location”.</p>` : '')
                  : `<a class="btn block ghost" href="#/addresses">Add a delivery address</a>`}
              </section>` : `
              <section class="box">
                <div class="box-head"><h2 class="h-sm">Pickup from</h2></div>
                <p><strong>${esc(A.shop.name)}</strong></p>
              </section>`}

              <section class="box">
                <div class="box-head"><h2 class="h-sm">Payment</h2></div>
                <div class="options">
                  ${option({ action: 'noop', value: 'cod', selected: true, icon: I.cash, title: payLabel, sub: delivery ? 'Pay the rider in cash' : 'Pay when you collect' })}
                  <div class="option disabled"><span class="lr-ico">${I.card}</span><span class="grow"><strong>Online payment</strong><small class="muted">Coming soon</small></span></div>
                </div>
              </section>

              <section class="box">
                <div class="box-head"><h2 class="h-sm">Note for the restaurant</h2></div>
                <textarea class="input" rows="3" maxlength="300" data-input="note" placeholder="E.g. less spicy, ring the bell…">${esc(state.note)}</textarea>
              </section>

              <p class="muted small">Ordering as ${esc(state.user.name || '')} · ${esc(state.user.phone)} · <a class="link" href="#/profile">Change</a></p>
            </div>

            <aside class="summary">
              <h2 class="h-sm">Order summary</h2>
              <ul class="mini-list">
                ${state.cart.map((l) => {
                  const item = byId(l.itemId);
                  const mods = A.modifierNames(l);
                  return `<li><span><b>${l.qty}×</b> ${esc(item.name)}${mods.length ? ` <small class="muted">(${esc(mods.join(', '))})</small>` : ''}</span></li>`;
                }).join('')}
              </ul>
              <div id="quote"></div>
              <p class="err" id="place-err"></p>
              <div class="cta">
                <span class="cta-price" id="cta-price"></span>
                <button class="cta-btn" id="place" data-action="place-order" disabled>Place Order</button>
              </div>
            </aside>
          </div>
        </section>`;
    },
    mount() { if (state.cart.length && state.user?.otpToken) showQuote('#place'); },
  });

  A.action('noop', () => {});
  A.action('go-addresses', () => { location.hash = '#/addresses'; });
  A.input('note', (el) => { state.note = el.value; });

  let placing = false;
  A.action('place-order', async (el) => {
    if (placing) return;
    const err = document.getElementById('place-err');
    err.textContent = '';
    placing = true; el.disabled = true; el.textContent = 'Placing…';
    try {
      const quote = await A.getQuote();
      const addr = A.defaultAddress();
      const delivery = state.fulfilment === 'DELIVERY';
      const body = {
        fulfilment: state.fulfilment,
        payment: 'COD',
        customer: { name: state.user.name || null, mobile: state.user.phone },
        otpToken: state.user.otpToken,
        lines: A.hubLines(),
        note: state.note.trim() || null,
        menuVersion: A.shop.menu.version,
        expectedTotal: quote.total,
        channel: 'website',
        location: delivery ? { lat: addr.lat, lng: addr.lng } : null,
        address: delivery ? { line1: addr.line1, line2: addr.line2 || null, landmark: addr.landmark || null, city: addr.city, pincode: addr.pincode } : null,
      };
      // the same key on a retry, so a network hiccup never creates two orders
      state.checkoutKey ||= Hub.newKey();
      const r = await Hub.placeOrder(body, state.checkoutKey);
      state.orders = [{ id: r.order.id, token: r.accessToken, order: r.order }, ...state.orders.filter((o) => o.id !== r.order.id)];
      A.notify(`Order ${r.order.number} placed`, `Sent to ${A.shop.name}. Total ${money(r.order.total)}, ${delivery ? 'cash on delivery' : 'pay at pickup'}.`);
      state.cart = []; state.note = ''; state.checkoutKey = null;
      placing = false;
      A.clearQuote();
      A.save();
      location.hash = `#/success/${encodeURIComponent(r.order.id)}`;
    } catch (e) {
      placing = false; el.textContent = 'Place Order';
      if (['PRICE_CHANGED', 'ITEM_UNAVAILABLE', 'OPTION_INVALID', 'VALIDATION', 'BELOW_MINIMUM', 'OUT_OF_AREA'].includes(e.code)) {
        state.checkoutKey = null; // a changed order is a new order
      }
      if (e.code === 'OTP_REQUIRED') {
        state.user = { ...state.user, otpToken: null }; A.save();
        A.toast(e.message);
        location.hash = '#/login/checkout';
        return;
      }
      if (e.code === 'PRICE_CHANGED' || e.code === 'ITEM_UNAVAILABLE') {
        // reload the menu and prices, then show the new total
        try { A.setShop(await Hub.store()); } catch { /* keep the old one */ }
        A.clearQuote(); A.refresh();
        document.getElementById('place-err').textContent = e.message;
        return;
      }
      err.textContent = e.message;
      el.disabled = false;
    }
  });
})(App);
