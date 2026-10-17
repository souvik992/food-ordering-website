// Cart and checkout
(function (A) {
  const { I, state, esc, money, byId, media, totals, option } = A;

  function summaryRows(t) {
    return `
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
        ${t.discount ? `<div class="disc"><dt>Discount (${state.voucher})</dt><dd>−${money(t.discount)}</dd></div>` : ''}
        <div><dt>Delivery Fee</dt><dd>${money(t.fee)}</dd></div>
        <div class="total"><dt>Total Amount</dt><dd>${money(t.total)}</dd></div>
      </dl>`;
  }

  /* ---------- Cart ---------- */
  A.route('cart', {
    tab: 'cart',
    render() {
      const entries = Object.entries(state.cart);
      const head = A.header('Cart', {
        right: `<button class="icon-btn soft" data-action="clear-cart" aria-label="Clear cart" ${entries.length ? '' : 'disabled'}>${I.trash}</button>`,
      });
      if (!entries.length) {
        return `<section class="page panel">${head}${A.empty('🛍️', 'Your cart is empty', 'Add something tasty to get started.', { href: '#/menu', label: 'Browse menu' })}</section>`;
      }
      const t = totals();
      return `
        <section class="page panel has-cta">
          ${head}
          <div class="split">
            <ul class="cart-list">
              ${entries.map(([id, q]) => {
                const item = byId(id);
                return `
                <li class="cart-item">
                  <a href="#/item/${item.id}">${media(item, 'thumb', 300)}</a>
                  <div class="grow">
                    <div class="ci-top">
                      <div><h3>${esc(item.name)}</h3><p class="muted">By ${esc(item.by)}</p></div>
                      <span class="rating">${I.star}${item.rating}</span>
                    </div>
                    <div class="ci-bottom">
                      <strong>${money(item.price * q)}</strong>
                      <div class="qty">
                        <button data-action="dec" data-id="${item.id}" aria-label="Decrease">${I.minus}</button>
                        <span>${q}</span>
                        <button class="plus" data-action="inc" data-id="${item.id}" aria-label="Increase">${I.plus}</button>
                      </div>
                    </div>
                  </div>
                </li>`;
              }).join('')}
            </ul>

            <aside class="summary">
              <form class="voucher" data-form="voucher">
                <span class="v-ico">${I.ticket}</span>
                <input name="code" placeholder="Enter your voucher code" value="${state.voucher || ''}" autocomplete="off" />
                <button aria-label="Apply voucher">${I.chevRight}</button>
              </form>
              ${state.voucher
                ? `<p class="voucher-ok">${I.check} ${state.voucher} applied: ${VOUCHERS[state.voucher] * 100}% off</p>`
                : '<p class="hint">Try <b>GOOD10</b> or <b>FOODIE20</b></p>'}
              ${summaryRows(t)}
              <div class="cta">
                <span class="cta-price">${money(t.total)}</span>
                <a class="cta-btn" href="#/checkout">Checkout</a>
              </div>
            </aside>
          </div>
        </section>`;
    },
  });

  A.action('inc', (el) => { state.cart[el.dataset.id]++; A.save(); A.refresh(); });
  A.action('dec', (el) => {
    const { id } = el.dataset;
    if (--state.cart[id] <= 0) delete state.cart[id];
    A.save(); A.refresh();
  });
  A.action('clear-cart', () => { state.cart = {}; state.voucher = null; A.save(); A.refresh(); });

  A.form('voucher', (form) => {
    const code = form.code.value.trim().toUpperCase();
    if (VOUCHERS[code]) { state.voucher = code; A.toast('Voucher applied'); }
    else { state.voucher = null; A.toast(code ? 'Invalid voucher code' : 'Voucher removed'); }
    A.refresh();
  });

  /* ---------- Checkout ---------- */
  function timeSlots() {
    const slots = [];
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    d.setHours(d.getHours() + 1);
    for (let i = 0; i < 6; i++) {
      slots.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      d.setMinutes(d.getMinutes() + 30);
    }
    return slots;
  }

  A.route('checkout', {
    tab: 'cart',
    render() {
      const head = A.header('Checkout');
      if (!Object.keys(state.cart).length) {
        return `<section class="page panel">${head}${A.empty('🧾', 'Nothing to check out', 'Your cart is empty.', { href: '#/menu', label: 'Browse menu' })}</section>`;
      }
      if (!state.user) {
        return `<section class="page panel">${head}${A.empty('🔐', 'Sign in to continue', 'You need an account to place an order.', { href: '#/login/checkout', label: 'Sign in' })}</section>`;
      }
      const t = totals();
      const addr = A.defaultAddress();
      const slots = timeSlots();
      const scheduled = state.schedule !== 'asap';
      if (scheduled && !slots.includes(state.schedule)) state.schedule = slots[0];

      return `
        <section class="page panel has-cta">
          ${head}
          <div class="split">
            <div class="stack">
              <section class="box">
                <div class="box-head"><h2 class="h-sm">Delivery address</h2><a class="link strong" href="#/addresses">Change</a></div>
                ${option({ action: 'noop', value: addr.id, selected: true, icon: A.ADDRESS_ICONS[addr.label] || I.pinO, title: esc(addr.label), sub: esc(addr.line + (addr.details ? ' · ' + addr.details : '')) })}
              </section>

              <section class="box">
                <div class="box-head"><h2 class="h-sm">Delivery time</h2></div>
                <div class="options">
                  ${option({ action: 'set-schedule', value: 'asap', selected: !scheduled, icon: I.bike, title: 'Standard', sub: 'As soon as possible · 25–35 min' })}
                  ${option({ action: 'set-schedule', value: slots[0], selected: scheduled, icon: I.calendar, title: 'Schedule', sub: 'Choose a delivery time' })}
                </div>
                ${scheduled ? `<div class="chips wrap slots">${slots.map((s) => `<button class="chip ${s === state.schedule ? 'active' : ''}" data-action="set-schedule" data-value="${s}">${s}</button>`).join('')}</div>` : ''}
              </section>

              <section class="box">
                <div class="box-head"><h2 class="h-sm">Payment method</h2><a class="link strong" href="#/payments">Manage</a></div>
                <div class="options">
                  ${PAYMENT_METHODS.map((p) => option({ action: 'set-payment', value: p.id, selected: state.payment === p.id, icon: A.PAYMENT_ICONS[p.type], title: p.title, sub: p.sub })).join('')}
                </div>
              </section>

              <section class="box">
                <div class="box-head"><h2 class="h-sm">Note for the courier</h2></div>
                <textarea class="input" rows="3" data-input="note" placeholder="E.g. ring the bell, leave at the door…">${esc(state.note)}</textarea>
              </section>
            </div>

            <aside class="summary">
              <h2 class="h-sm">Order summary</h2>
              <ul class="mini-list">
                ${Object.entries(state.cart).map(([id, q]) => {
                  const item = byId(id);
                  return `<li><span><b>${q}×</b> ${esc(item.name)}</span><span>${money(item.price * q)}</span></li>`;
                }).join('')}
              </ul>
              ${summaryRows(t)}
              <div class="cta">
                <span class="cta-price">${money(t.total)}</span>
                <button class="cta-btn" data-action="place-order">Place Order</button>
              </div>
            </aside>
          </div>
        </section>`;
    },
  });

  A.action('set-schedule', (el) => { state.schedule = el.dataset.value === 'asap' ? 'asap' : el.dataset.value; A.refresh(); });
  A.action('set-payment', (el) => { state.payment = el.dataset.value; A.save(); A.refresh(); });
  A.action('noop', () => {});
  A.input('note', (el) => { state.note = el.value; });

  A.action('place-order', () => {
    const t = totals();
    const addr = A.defaultAddress();
    const order = {
      id: Math.floor(100000 + Math.random() * 900000),
      date: Date.now(),
      items: Object.entries(state.cart).map(([id, qty]) => ({ id: Number(id), qty })),
      ...t,
      voucher: state.voucher,
      address: `${addr.label} · ${addr.line}`,
      payment: A.paymentById(state.payment).title,
      schedule: state.schedule,
      note: state.note,
    };
    state.orders.unshift(order);
    state.notifications.unshift({ id: Date.now(), title: `Order #${order.id} placed`, text: `We've sent your order to the restaurant. Total ${money(order.total)}.`, date: Date.now(), read: false });
    state.cart = {}; state.voucher = null; state.note = ''; state.schedule = 'asap';
    A.save();
    location.hash = `#/success/${order.id}`;
  });
})(App);
