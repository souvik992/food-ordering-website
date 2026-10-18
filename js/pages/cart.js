// Checkout: order review, delivery details, mobile verification and payment on one page with a sticky summary.
// Totals come from the hub (a quote); the order goes to the hub, which sends it to the restaurant's POS (ODS screen).
(function (A) {
  const { I, state, esc, money, byId } = A;
  const C = window.TIFFIN_CONFIG;
  let addingAddress = false;
  let lastQuote = null; // the full quote the Place Order button was enabled with

  function linesHTML() {
    return state.cart.map((l, i) => {
      const item = byId(l.itemId);
      const mods = A.modifierNames(l);
      return `
        <li class="co-line">
          ${A.media(item, 'thumb')}
          <div class="grow">
            <strong>${esc(item.name)}</strong>
            <small id="lu-${i}">${mods.length ? esc(mods.join(', ')) + ' · ' : ''}${money(item.price)}</small>
          </div>
          ${A.stepper('line-qty', l.key, l.qty, 'sm')}
          <b class="co-line-total" id="lt-${i}"></b>
        </li>`;
    }).join('');
  }

  function fulfilmentTiles() {
    const f = A.shop.fulfilment || {};
    const z = A.shop.delivery?.zones?.[0];
    const p = A.shop.pickup;
    return `
      <div class="tiles">
        ${f.delivery ? A.tile({ action: 'set-fulfilment', value: 'DELIVERY', selected: state.fulfilment === 'DELIVERY', icon: I.home, title: 'Delivery', sub: z?.etaMinutes ? `To your door in ≈${z.etaMinutes} min` : 'To your door' }) : ''}
        ${f.pickup ? A.tile({ action: 'set-fulfilment', value: 'PICKUP', selected: state.fulfilment === 'PICKUP', icon: I.bag, title: 'Pickup', sub: [p?.etaMinutes ? `Ready in ≈${p.etaMinutes} min` : '', C.address].filter(Boolean).join(' · ') || 'Collect from the restaurant' }) : ''}
      </div>`;
  }

  // Name + mobile number, verified with a 6-digit code from the hub
  function contactHTML() {
    if (A.signedIn()) {
      return `
        <div class="fields two">
          <label class="field"><span>Full name</span><input name="name" data-input="cust-name" value="${esc(state.user.name || '')}" maxlength="60" autocomplete="name" placeholder="Your name" /></label>
          <div class="field static">
            <span>Phone</span>
            <div class="field-row"><b>${esc(state.user.phone)}</b><span class="tag soft green">${I.check} Verified</span><button class="link" data-action="change-number">Change</button></div>
          </div>
        </div>`;
    }
    const p = A.otp.pending;
    return `
      <div class="fields two">
        <label class="field"><span>Full name</span><input data-input="draft-name" value="${esc(A.otp.draftName)}" maxlength="60" autocomplete="name" placeholder="Your name" /></label>
        ${p ? `
          <div class="field static">
            <span>Phone</span>
            <div class="field-row"><b>${esc(p.phone)}</b><button class="link" data-action="otp-reset">Change</button></div>
          </div>` : `
          <form class="field with-btn" data-form="otp-send">
            <span>Phone</span>
            <input name="phone" type="tel" required inputmode="numeric" maxlength="14" placeholder="98765 43210" autocomplete="tel" value="${esc(A.otp.draftPhone)}" data-input="draft-phone" />
            <button class="btn sm">Send code</button>
          </form>`}
      </div>
      ${p ? `
        <form class="otp-box" data-form="otp-verify">
          <p>Enter the 6-digit code sent to <b>${esc(p.phone)}</b>.</p>
          <div class="field with-btn">
            <span>Verification code</span>
            <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••" autocomplete="one-time-code" />
            <button class="btn sm">Verify</button>
          </div>
          ${p.devCode ? `<p class="notice">${I.help}<span>Test mode: your code is <b>${esc(p.devCode)}</b></span></p>` : ''}
          <button type="button" class="link small" data-action="otp-resend">Send the code again</button>
        </form>` : '<p class="muted small">We send a 6-digit code to verify your number. You verify once on this device.</p>'}`;
  }

  A.contactHTML = contactHTML;

  function addressHTML() {
    const showForm = addingAddress || !state.addresses.length;
    return `
      <div class="addr-block">
        <div class="sub-head"><h3>Delivery address</h3>${state.addresses.length && !showForm ? '<button class="link" data-action="add-address">+ New address</button>' : ''}</div>
        ${state.addresses.length ? `<div class="tiles stack">
          ${state.addresses.map((a) => A.tile({
            action: 'addr-select', value: a.id, selected: a.isDefault, icon: A.ADDRESS_ICONS[a.label] || I.pin,
            title: esc(a.label), sub: esc(A.addressText(a)) + (a.lat == null ? ' · <span class="err">no map location</span>' : ''),
          })).join('')}
        </div>` : ''}
        ${showForm ? A.addressForm({ cancel: state.addresses.length > 0 }) : ''}
      </div>`;
  }

  /* ---------- Checkout ---------- */
  A.route('checkout', {
    render() {
      if (!state.cart.length) {
        return `<section class="page container narrow">${A.pageHead('Checkout')}${A.empty('🛍️', 'Your cart is empty', 'Add something tasty to get started.', { href: '#/', label: 'Browse the menu' })}</section>`;
      }
      const delivery = state.fulfilment === 'DELIVERY';
      const n = A.cartCount();
      return `
        <section class="page container checkout">
          ${A.pageHead('Checkout')}
          ${A.shopBanner()}
          <div class="co-layout">
            <div class="co-main">
              <section class="card">
                <div class="card-head"><h2>Your order (${n})</h2><a class="link accent" href="#/">Add more</a></div>
                <ul class="co-lines">${linesHTML()}</ul>
                <label class="field note-field">${I.note}<input data-input="note" maxlength="300" placeholder="Note for the kitchen — e.g. less spicy, no onion" value="${esc(state.note)}" /></label>
              </section>

              <section class="card">
                <div class="card-head"><h2>${delivery ? 'Delivery' : 'Pickup'}</h2></div>
                ${fulfilmentTiles()}
                ${contactHTML()}
                ${delivery ? addressHTML() : `<p class="muted small">Collect from <b>${esc(C.address || A.shop.name)}</b>. We show you when it is ready.</p>`}
              </section>

              <section class="card">
                <div class="card-head"><h2>Payment</h2></div>
                <div class="pay-chips">
                  <button class="pay-chip on" aria-pressed="true">${I.cash} ${delivery ? 'Cash on delivery' : 'Pay at the counter'}</button>
                  <button class="pay-chip" disabled>${I.card} UPI / Card <small>Soon</small></button>
                </div>
              </section>
            </div>

            <aside class="co-side">
              <div class="card summary">
                <h2>Summary</h2>
                <dl class="totals" id="totals"><div><dt class="muted">Working out the total…</dt></div></dl>
                <p class="err small" id="place-err"></p>
                <button class="btn block lg place-btn" data-action="place-order" disabled>Place Order</button>
                <p class="fine">${A.signedIn() ? 'Prices include GST. By placing the order you agree to pay on ' + (delivery ? 'delivery.' : 'pickup.') : 'Verify your phone number to place the order.'}</p>
              </div>
            </aside>
          </div>
          <div class="co-bar">
            <small id="bar-breakdown"></small>
            <button class="btn block lg place-btn" data-action="place-order" disabled><span>Place Order</span><b id="bar-total"></b></button>
          </div>
        </section>`;
    },
    mount() { if (state.cart.length) price(); },
  });

  // Shows the hub's prices: per line, the summary and the totals
  function fill(q, note) {
    if (!document.getElementById('totals')) return;
    state.cart.forEach((l, i) => {
      const ql = q?.lines?.[i];
      const lt = document.getElementById(`lt-${i}`);
      if (lt) lt.textContent = ql ? money(ql.lineTotal) : '';
    });
    const rows = [];
    if (q) {
      rows.push(['Subtotal', money(q.itemsTotal)]);
      if (state.fulfilment === 'DELIVERY') rows.push([`Delivery${q.distanceKm != null && !note ? ` (${q.distanceKm} km)` : ''}`, note ? '—' : q.deliveryFee ? money(q.deliveryFee) : 'Free']);
      if (q.packagingFee) rows.push(['Packaging', money(q.packagingFee)]);
    }
    document.getElementById('totals').innerHTML = `
      ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      ${q && !note ? `<div class="total"><dt>Total</dt><dd>${money(q.total)}</dd></div>` : ''}
      ${q?.etaMinutes && !note ? `<div class="eta"><dt>${I.clock} Ready in about ${q.etaMinutes} min after the restaurant accepts</dt></div>` : ''}`;
    const err = document.getElementById('place-err');
    err.textContent = note || '';
    const bar = document.getElementById('bar-breakdown');
    if (bar) bar.textContent = q ? rows.map(([k, v]) => `${k.replace(/ \(.*\)/, '')} ${v}`).join(' · ') : '';
    const total = document.getElementById('bar-total');
    if (total) total.textContent = q && !note ? money(q.total) : '';
  }

  function setPlaceEnabled(on) {
    document.querySelectorAll('.place-btn').forEach((b) => { b.disabled = !on; });
  }

  async function price() {
    lastQuote = null;
    setPlaceEnabled(false);
    try {
      const q = await A.getQuote();
      fill(q, null);
      lastQuote = q;
      setPlaceEnabled(A.shop.open && A.signedIn());
    } catch (e) {
      if (e.code === 'NO_LOCATION') {
        const b = await A.getBasket().catch(() => null);
        fill(b, state.addresses.length ? 'This address has no map location. Add it again with “Use my current location”.' : 'Add your delivery address to see the delivery fee.');
      } else {
        fill(A.basketNow(), e.message);
      }
    }
  }

  A.action('set-fulfilment', (el) => { state.fulfilment = el.dataset.value; A.cartChanged(); });
  A.action('add-address', () => { addingAddress = true; A.refresh(); });
  A.action('addr-cancel', () => { addingAddress = false; A.refresh(); });
  A.addressSaved = () => { addingAddress = false; };

  A.input('note', (el) => { state.note = el.value; });
  A.input('cust-name', (el) => { state.user = { ...state.user, name: el.value.trim() }; A.save(); });

  let placing = false;
  A.action('place-order', async () => {
    if (placing) return;
    const err = document.getElementById('place-err');
    err.textContent = '';
    if (!A.signedIn()) { err.textContent = 'Verify your phone number first.'; return; }
    const buttons = document.querySelectorAll('.place-btn');
    placing = true;
    buttons.forEach((b) => { b.disabled = true; b.classList.add('busy'); });
    try {
      const quote = lastQuote || await A.getQuote();
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
      state.cart = []; state.note = ''; state.checkoutKey = null; state.justPlaced = r.order.id;
      placing = false;
      A.clearQuote();
      A.save();
      location.hash = `#/orders/${encodeURIComponent(r.order.id)}`;
    } catch (e) {
      placing = false;
      buttons.forEach((b) => b.classList.remove('busy'));
      if (['PRICE_CHANGED', 'ITEM_UNAVAILABLE', 'OPTION_INVALID', 'VALIDATION', 'BELOW_MINIMUM', 'OUT_OF_AREA'].includes(e.code)) {
        state.checkoutKey = null; // a changed order is a new order
      }
      if (e.code === 'OTP_REQUIRED') {
        state.user = { ...state.user, otpToken: null }; A.save();
        A.toast(e.message);
        A.refresh();
        return;
      }
      if (e.code === 'PRICE_CHANGED' || e.code === 'ITEM_UNAVAILABLE') {
        // reload the menu and prices, then show the new total
        try { A.setShop(await Hub.store()); } catch { /* keep the old one */ }
        A.clearQuote(); A.refresh();
        document.getElementById('place-err').textContent = e.message;
        return;
      }
      document.getElementById('place-err').textContent = e.message;
      buttons.forEach((b) => { b.disabled = false; });
    }
  });
})(App);
