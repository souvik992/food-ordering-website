// Orders list, order placed confirmation, and live order tracking (status straight from the hub)
(function (A) {
  const { I, state, esc, money, fmtDate } = A;

  const findOrder = (id) => state.orders.find((o) => o.id === id);
  const itemCount = (o) => o.lines.reduce((a, l) => a + l.qtyMilli / 1000, 0);
  const itemSummary = (o) => o.lines.map((l) => `${l.qtyMilli / 1000}× ${l.name}`).join(', ');
  const failed = (o) => ['REJECTED', 'AUTO_REJECTED', 'CANCELLED'].includes(o.state);
  const qty = (l) => l.qtyMilli / 1000;

  const STEPS = {
    PICKUP: [['SENT_TO_STORE', 'Sent to the restaurant', I.check], ['ACCEPTED', 'Accepted', I.check], ['PREPARING', 'Being prepared', I.pot], ['READY', 'Ready to collect', I.bag], ['PICKED_UP', 'Collected', I.homeO]],
    DELIVERY: [['SENT_TO_STORE', 'Sent to the restaurant', I.check], ['ACCEPTED', 'Accepted', I.check], ['PREPARING', 'Being prepared', I.pot], ['READY', 'Ready', I.bag], ['OUT_FOR_DELIVERY', 'On the way', I.bike], ['DELIVERED', 'Delivered', I.homeO]],
  };
  const stepIndex = (o) => STEPS[o.fulfilment].findIndex(([s]) => s === (o.state === 'RECEIVED' ? 'SENT_TO_STORE' : o.state));

  function statusPill(o) {
    const cls = failed(o) ? 'bad' : FINAL_STATES.includes(o.state) ? 'done' : '';
    return `<span class="pill ${cls}">${esc(STATUS[o.state] || o.state)}</span>`;
  }

  // Asks the hub for the latest status of every active order; re-draws when something changed
  async function refreshActive() {
    const active = state.orders.filter(A.isActive);
    const results = await Promise.allSettled(active.map((r) => Hub.order(r.id, r.token)));
    let changed = false;
    results.forEach((res) => { if (res.status === 'fulfilled' && A.updateOrder(res.value)) changed = true; });
    return changed;
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
      const active = state.orders.filter(A.isActive);
      const past = state.orders.filter((r) => !A.isActive(r));
      const list = state.ordersTab === 'active' ? active : past;
      return `
        <section class="page panel">
          ${head}
          <div class="seg" role="tablist">
            <button class="${state.ordersTab === 'active' ? 'active' : ''}" data-action="orders-tab" data-tab="active" role="tab">Active (${active.length})</button>
            <button class="${state.ordersTab === 'past' ? 'active' : ''}" data-action="orders-tab" data-tab="past" role="tab">Past (${past.length})</button>
          </div>
          ${list.length ? `<div class="order-grid">${list.map(({ order: o }) => `
            <article class="order-card">
              <div class="oc-head">
                <div><strong>Order ${esc(o.number)}</strong><small class="muted">${fmtDate(o.placedAt)} · ${itemCount(o)} items · ${o.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</small></div>
                ${statusPill(o)}
              </div>
              <div class="oc-body">
                <p class="muted clamp-2">${esc(itemSummary(o))}</p>
              </div>
              <div class="oc-foot">
                <strong>${money(o.total)}</strong>
                <div class="row">
                  ${A.isActive({ order: o })
                    ? `<a class="btn sm" href="#/track/${encodeURIComponent(o.id)}">Track order</a>`
                    : `<a class="btn sm ghost" href="#/track/${encodeURIComponent(o.id)}">Details</a><button class="btn sm" data-action="reorder" data-id="${esc(o.id)}">Reorder</button>`}
                </div>
              </div>
            </article>`).join('')}</div>`
          : `<div class="empty"><span>${state.ordersTab === 'active' ? '🛵' : '📦'}</span><p>No ${state.ordersTab} orders.</p></div>`}
        </section>`;
    },
    mount() {
      const tick = () => refreshActive().then((changed) => { if (changed) A.refresh(); });
      if (state.orders.some(A.isActive)) { tick(); A.setTimer(tick, 15000); }
    },
  });

  A.action('orders-tab', (el) => { state.ordersTab = el.dataset.tab; A.refresh(); });
  A.action('reorder', (el) => {
    const rec = findOrder(el.dataset.id);
    let missing = 0;
    rec.order.lines.forEach((l) => {
      if (A.byId(l.itemId)) A.addToCart(l.itemId, qty(l), l.modifiers.map((m) => m.id));
      else missing++;
    });
    A.toast(missing ? `Added to cart. ${missing} item(s) are no longer on the menu.` : 'Items added to cart');
    location.hash = '#/cart';
  });

  /* ---------- Order placed ---------- */
  A.route('success', {
    tab: 'orders',
    render(id) {
      const rec = findOrder(id);
      if (!rec) return null;
      const o = rec.order;
      return `
        <section class="page panel success">
          <div class="success-badge">${I.check}</div>
          <h1>Order placed!</h1>
          <p class="muted">Thanks${state.user?.name ? ', ' + esc(state.user.name.split(' ')[0]) : ''}! Your order <b>${esc(o.number)}</b> has been sent to ${esc(A.shop.name)}. We will show you here when they accept it.</p>
          <div class="box receipt">
            <div><span class="muted">${o.fulfilment === 'DELIVERY' ? 'Deliver to' : 'Pickup from'}</span><strong>${esc(o.address ? A.addressText(o.address) : A.shop.name)}</strong></div>
            <div><span class="muted">Payment</span><strong>${o.fulfilment === 'DELIVERY' ? 'Cash on delivery' : 'Pay at the counter'}</strong></div>
            <div><span class="muted">Total</span><strong>${money(o.total)}</strong></div>
          </div>
          <div class="btn-stack">
            <a class="btn block" href="#/track/${encodeURIComponent(o.id)}">Track order</a>
            <a class="btn block ghost" href="#/">Back to home</a>
          </div>
        </section>`;
    },
  });

  /* ---------- Tracking ---------- */
  A.route('track', {
    tab: 'orders',
    render(id) {
      const rec = findOrder(id);
      if (!rec) return null;
      const o = rec.order;
      const steps = STEPS[o.fulfilment];
      const at = stepIndex(o);
      const done = FINAL_STATES.includes(o.state);
      const etaMin = o.etaAt ? Math.max(0, Math.round((o.etaAt - Date.now()) / 60000)) : null;
      const heading = failed(o) ? STATUS[o.state]
        : done ? 'Enjoy your meal! 🎉'
        : o.state === 'OUT_FOR_DELIVERY' ? 'On the way'
        : o.state === 'READY' ? (o.fulfilment === 'PICKUP' ? 'Ready to collect' : 'Ready')
        : etaMin != null ? `Ready in about ${etaMin} min`
        : 'Waiting for the restaurant';
      return `
        <section class="page panel">
          ${A.header('Track Order', { right: `<span class="muted mono">${esc(o.number)}</span>` })}
          <div class="split">
            <div class="stack">
              <div class="eta-card ${failed(o) ? 'bad' : ''}">
                <div>
                  <small>${esc(STATUS[o.state] || o.state)}</small>
                  <strong>${esc(heading)}</strong>
                </div>
                <span class="eta-ico">${failed(o) ? '✕' : (steps[Math.max(0, at)] || steps[0])[2]}</span>
                ${failed(o) ? '' : `<div class="progress"><span style="width:${(Math.max(0, at) / (steps.length - 1)) * 100}%"></span></div>`}
              </div>
              <p class="muted">${esc(A.statusText(o))}</p>

              ${o.rider && o.state === 'OUT_FOR_DELIVERY' ? `
              <div class="courier box">
                <div class="avatar">${esc(o.rider.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase())}</div>
                <div class="grow"><strong>${esc(o.rider.name)}</strong><small class="muted">Your rider</small></div>
                ${o.rider.phone ? `<a class="icon-btn soft" href="tel:${esc(o.rider.phone)}" aria-label="Call the rider">${I.phone}</a>` : ''}
              </div>` : ''}

              ${failed(o) ? '' : `
              <ol class="steps">
                ${steps.map(([, title, icon], i) => `
                  <li class="${i < at || (done && i === at) ? 'done' : i === at ? 'current' : ''}">
                    <span class="step-ico">${i < at || (done && i === at) ? I.check : icon}</span>
                    <div><strong>${title}</strong></div>
                  </li>`).join('')}
              </ol>`}

              ${CANCELLABLE_STATES.includes(o.state) ? `<button class="btn block ghost" data-action="cancel-order" data-id="${esc(o.id)}">Cancel order</button>` : ''}
            </div>

            <aside class="summary">
              <h2 class="h-sm">Order details</h2>
              <ul class="mini-list">
                ${o.lines.map((l) => `<li><span><b>${qty(l)}×</b> ${esc(l.name)}${l.modifiers.length ? ` <small class="muted">(${esc(l.modifiers.map((m) => m.name).join(', '))})</small>` : ''}</span><span>${money(l.lineTotal)}</span></li>`).join('')}
              </ul>
              ${A.summaryRows({ ...o, etaMinutes: null })}
              <div class="kv"><span class="muted">${o.fulfilment === 'DELIVERY' ? 'Deliver to' : 'Pickup from'}</span><span>${esc(o.address ? A.addressText(o.address) : A.shop.name)}</span></div>
              <div class="kv"><span class="muted">Payment</span><span>${o.fulfilment === 'DELIVERY' ? 'Cash on delivery' : 'Pay at the counter'}</span></div>
              ${o.posBillNo ? `<div class="kv"><span class="muted">Bill no.</span><span>${esc(o.posBillNo)}</span></div>` : ''}
              ${o.note ? `<div class="kv"><span class="muted">Note</span><span>${esc(o.note)}</span></div>` : ''}
              <div class="kv"><span class="muted">Placed</span><span>${fmtDate(o.placedAt)}</span></div>
              ${done ? `<button class="btn block" data-action="reorder" data-id="${esc(o.id)}">Reorder</button>` : ''}
            </aside>
          </div>
        </section>`;
    },
    mount(id) {
      const rec = findOrder(id);
      if (!rec || !A.isActive(rec)) return;
      // live updates from the hub; a slow poll as a safety net if the stream drops
      const stop = Hub.watch(rec.id, rec.token, (order) => { if (A.updateOrder(order)) A.refresh(); });
      A.onLeave(stop);
      A.setTimer(() => Hub.order(rec.id, rec.token).then((order) => { if (A.updateOrder(order)) A.refresh(); }).catch(() => {}), 30000);
    },
  });

  A.action('cancel-order', async (el) => {
    const rec = findOrder(el.dataset.id);
    if (!rec || !confirm(`Cancel order ${rec.order.number}?`)) return;
    el.disabled = true;
    try {
      await Hub.cancel(rec.id, rec.token, 'Cancelled by the customer on the website');
      const order = await Hub.order(rec.id, rec.token);
      A.updateOrder(order);
      A.toast('Order cancelled');
    } catch (e) {
      A.toast(e.message);
      try { A.updateOrder(await Hub.order(rec.id, rec.token)); } catch { /* keep what we have */ }
    }
    A.refresh();
  });
})(App);
