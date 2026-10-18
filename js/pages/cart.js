// Cart & checkout: order review, delivery or pickup, payment and a sticky summary. Signing in and adding the delivery
// address happen on their own pages (#/login/checkout, #/address-new/checkout), which come back here.
// Totals come from the hub (a quote); the order goes to the hub, which sends it to the restaurant's POS (ODS screen).
(function (A) {
  const { I, state, esc, money, byId } = A;
  const C = window.TIFFIN_CONFIG;
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

  // Name + mobile number, verified with a 6-digit code from the hub (used by the sign-in page)
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

  // What is still missing before the order can be placed: sign in, then (for delivery) an address
  function nextStep() {
    if (!A.signedIn()) return { label: 'Login to place order', href: '#/login/checkout', icon: I.user };
    if (state.fulfilment === 'DELIVERY' && !A.defaultAddress()) return { label: 'Add delivery address', href: '#/address-new/checkout', icon: I.pin };
    return null;
  }

  // Who is ordering and where it goes (read-only here; changed on their own pages)
  function detailsHTML(delivery) {
    if (!A.signedIn()) {
      return `<div class="step-hint">${I.user}<span>Log in with your mobile number to ${delivery ? 'add your delivery address and ' : ''}place the order.</span></div>`;
    }
    const u = state.user;
    const addr = A.defaultAddress();
    return `
      <div class="detail-row">
        <span class="tile-ico">${I.user}</span>
        <div class="grow"><small>Ordering as</small><strong>${esc(u.name || 'Add your name')} · ${esc(u.phone)}</strong></div>
        <a class="link accent" href="#/account">Edit</a>
      </div>
      ${delivery ? (addr ? `
      <div class="detail-row">
        <span class="tile-ico">${A.ADDRESS_ICONS[addr.label] || I.pin}</span>
        <div class="grow"><small>Deliver to · ${esc(addr.label)}</small><strong>${esc(A.addressText(addr))}</strong>${addr.lat == null && !A.demo ? '<small class="err">This address has no map location. Add it again with “Use my current location”.</small>' : ''}</div>
        <a class="link accent" href="#/addresses/checkout">Change</a>
      </div>` : `
      <a class="add-row" href="#/address-new/checkout">${I.plus}<span>Add a delivery address</span></a>`)
      : `<p class="muted small">Collect from <b>${esc(C.address || A.shop.name)}</b>. We show you when it is ready.</p>`}`;
  }

  // The main button: the next step, or Place Order once everything is there
  function mainButton(bar) {
    const step = nextStep();
    if (step) return `<a class="btn block lg next-btn" href="${step.href}">${step.icon}<span>${step.label}</span>${bar ? '<b id="bar-total"></b>' : ''}</a>`;
    return `<button class="btn block lg place-btn" data-action="place-order" disabled><span>Place Order</span>${bar ? '<b id="bar-total"></b>' : ''}</button>`;
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
          ${A.demo ? `<div class="notice warn">${I.help}<span><b>Demo checkout.</b> Everything works, but this order is not sent to the restaurant. The login code is shown on screen.</span></div>` : ''}
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
                <div class="details">${detailsHTML(delivery)}</div>
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
                ${mainButton(false)}
                <p class="fine">${nextStep() ? 'Prices include GST.' : 'Prices include GST. By placing the order you agree to pay on ' + (delivery ? 'delivery.' : 'pickup.')}</p>
              </div>
            </aside>
          </div>
          <div class="co-bar">
            <small id="bar-breakdown"></small>
            ${mainButton(true)}
          </div>
        </section>`;
    },
    mount() { if (state.cart.length) price(); },
  });

  // Shows the hub's prices: per line, the summary and the totals
  function fill(q, note, soft = false) {
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
    err.className = soft ? 'muted small' : 'err small';
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
      setPlaceEnabled(A.shop.open && !nextStep());
    } catch (e) {
      if (e.code === 'NO_LOCATION') {
        const b = await A.getBasket().catch(() => null);
        if (A.defaultAddress()) fill(b, 'This address has no map location, so the delivery fee cannot be worked out.');
        else fill(b, 'The delivery fee is added once you add your address.', true);
      } else {
        fill(A.basketNow(), e.message);
      }
    }
  }

  A.action('set-fulfilment', (el) => { state.fulfilment = el.dataset.value; A.cartChanged(); });

  A.input('note', (el) => { state.note = el.value; });
  A.input('cust-name', (el) => { state.user = { ...state.user, name: el.value.trim() }; A.save(); });

  let placing = false;
  A.action('place-order', async () => {
    if (placing) return;
    const err = document.getElementById('place-err');
    err.textContent = '';
    if (nextStep()) { location.hash = nextStep().href; return; }
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
        location: delivery ? A.addrLocation(addr) : null,
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
      document.getElementById('place-err').textContent = e.message;
      buttons.forEach((b) => { b.disabled = false; });
    }
  });
})(App);
