// Orders list, order placed confirmation, and live order tracking
(function (A) {
  const { I, state, esc, money, byId, media, fmtDate, STEPS, orderStep } = A;

  const findOrder = (id) => state.orders.find((o) => o.id === Number(id));
  const itemCount = (o) => o.items.reduce((a, b) => a + b.qty, 0);
  const itemSummary = (o) => o.items.map((it) => `${it.qty}× ${byId(it.id).name}`).join(', ');
  const etaMin = (o) => Math.max(1, Math.ceil(30 - (Date.now() - o.date) / 60000 * 7.5));
  const STEP_ICONS = [I.check, I.pot, I.bike, I.homeO];

  function statusPill(o) {
    const step = orderStep(o);
    return `<span class="pill ${step === 3 ? 'done' : ''}">${['Confirmed', 'Preparing', 'On the way', 'Delivered'][step]}</span>`;
  }

  /* ---------- Orders list ---------- */
  A.route('orders', {
    tab: 'orders',
    tabbar: true,
    render() {
      const head = A.header('My Orders', { back: false });
      if (!state.orders.length) {
        return `<section class="page panel">${head}${A.empty('🧾', 'No orders yet', 'Your orders will show up here.', { href: '#/menu', label: 'Order now' })}</section>`;
      }
      const active = state.orders.filter((o) => orderStep(o) < 3);
      const past = state.orders.filter((o) => orderStep(o) === 3);
      const list = state.ordersTab === 'active' ? active : past;
      return `
        <section class="page panel">
          ${head}
          <div class="seg" role="tablist">
            <button class="${state.ordersTab === 'active' ? 'active' : ''}" data-action="orders-tab" data-tab="active" role="tab">Active (${active.length})</button>
            <button class="${state.ordersTab === 'past' ? 'active' : ''}" data-action="orders-tab" data-tab="past" role="tab">Past (${past.length})</button>
          </div>
          ${list.length ? `<div class="order-grid">${list.map((o) => `
            <article class="order-card">
              <div class="oc-head">
                <div><strong>Order #${o.id}</strong><small class="muted">${fmtDate(o.date)} · ${itemCount(o)} items</small></div>
                ${statusPill(o)}
              </div>
              <div class="oc-body">
                <div class="order-thumbs">${o.items.slice(0, 3).map((it) => media(byId(it.id), 'mini', 200)).join('')}</div>
                <p class="muted clamp-2">${esc(itemSummary(o))}</p>
              </div>
              <div class="oc-foot">
                <strong>${money(o.total)}</strong>
                <div class="row">
                  ${orderStep(o) < 3
                    ? `<a class="btn sm" href="#/track/${o.id}">Track order</a>`
                    : `<a class="btn sm ghost" href="#/track/${o.id}">Details</a><button class="btn sm" data-action="reorder" data-id="${o.id}">Reorder</button>`}
                </div>
              </div>
            </article>`).join('')}</div>`
          : `<div class="empty"><span>${state.ordersTab === 'active' ? '🛵' : '📦'}</span><p>No ${state.ordersTab} orders.</p></div>`}
        </section>`;
    },
  });

  A.action('orders-tab', (el) => { state.ordersTab = el.dataset.tab; A.refresh(); });
  A.action('reorder', (el) => {
    findOrder(el.dataset.id).items.forEach((it) => { state.cart[it.id] = (state.cart[it.id] || 0) + it.qty; });
    A.save();
    A.toast('Items added to cart');
    location.hash = '#/cart';
  });

  /* ---------- Order placed ---------- */
  A.route('success', {
    tab: 'orders',
    render(id) {
      const o = findOrder(id);
      if (!o) return null;
      return `
        <section class="page panel success">
          <div class="success-badge">${I.check}</div>
          <h1>Order placed!</h1>
          <p class="muted">Thanks${state.user ? ', ' + esc(state.user.name.split(' ')[0]) : ''}! Your order <b>#${o.id}</b> has been sent to the restaurant.</p>
          <div class="box receipt">
            <div><span class="muted">Estimated delivery</span><strong>${o.schedule === 'asap' ? '25–35 min' : 'At ' + o.schedule}</strong></div>
            <div><span class="muted">Deliver to</span><strong>${esc(o.address)}</strong></div>
            <div><span class="muted">Payment</span><strong>${esc(o.payment)}</strong></div>
            <div><span class="muted">Total paid</span><strong>${money(o.total)}</strong></div>
          </div>
          <div class="btn-stack">
            <a class="btn block" href="#/track/${o.id}">Track order</a>
            <a class="btn block ghost" href="#/">Back to home</a>
          </div>
        </section>`;
    },
  });

  /* ---------- Tracking ---------- */
  A.route('track', {
    tab: 'orders',
    render(id) {
      const o = findOrder(id);
      if (!o) return null;
      const step = orderStep(o);
      const done = step === 3;
      return `
        <section class="page panel">
          ${A.header('Track Order', { right: `<span class="muted mono">#${o.id}</span>` })}
          <div class="split">
            <div class="stack">
              <div class="eta-card">
                <div>
                  <small>${done ? 'Delivered' : 'Estimated arrival'}</small>
                  <strong>${done ? 'Enjoy your meal! 🎉' : etaMin(o) + ' min'}</strong>
                </div>
                <span class="eta-ico">${STEP_ICONS[step]}</span>
                <div class="progress"><span style="width:${(step / 3) * 100}%"></span></div>
              </div>

              <div class="courier box">
                <div class="avatar">${COURIER.name.split(' ').map((s) => s[0]).join('')}</div>
                <div class="grow"><strong>${COURIER.name}</strong><small class="muted">Your courier · ID ${COURIER.id}</small></div>
                <button class="icon-btn soft" data-action="toast" data-msg="Chat coming soon" aria-label="Chat">${I.chat}</button>
                <button class="icon-btn soft" data-action="toast" data-msg="Calling courier…" aria-label="Call">${I.phone}</button>
              </div>

              <ol class="steps">
                ${STEPS.map((s, i) => `
                  <li class="${i < step ? 'done' : i === step ? 'current' : ''}">
                    <span class="step-ico">${i < step ? I.check : STEP_ICONS[i]}</span>
                    <div><strong>${s.title}</strong><small class="muted">${s.sub}</small></div>
                  </li>`).join('')}
              </ol>
            </div>

            <aside class="summary">
              <h2 class="h-sm">Order details</h2>
              <ul class="mini-list">
                ${o.items.map((it) => `<li><span><b>${it.qty}×</b> ${esc(byId(it.id).name)}</span><span>${money(byId(it.id).price * it.qty)}</span></li>`).join('')}
              </ul>
              <dl class="totals">
                <div><dt>Subtotal</dt><dd>${money(o.subtotal)}</dd></div>
                ${o.discount ? `<div class="disc"><dt>Discount</dt><dd>−${money(o.discount)}</dd></div>` : ''}
                <div><dt>Delivery Fee</dt><dd>${money(o.fee)}</dd></div>
                <div class="total"><dt>Total</dt><dd>${money(o.total)}</dd></div>
              </dl>
              <div class="kv"><span class="muted">Deliver to</span><span>${esc(o.address)}</span></div>
              <div class="kv"><span class="muted">Payment</span><span>${esc(o.payment)}</span></div>
              ${o.note ? `<div class="kv"><span class="muted">Note</span><span>${esc(o.note)}</span></div>` : ''}
              ${done ? `<button class="btn block" data-action="reorder" data-id="${o.id}">Reorder</button>` : ''}
            </aside>
          </div>
        </section>`;
    },
    // Re-render every few seconds so the demo status advances
    mount(id) {
      const o = findOrder(id);
      if (o && orderStep(o) < 3) A.setTimer(() => A.refresh(), 5000);
    },
  });
})(App);
