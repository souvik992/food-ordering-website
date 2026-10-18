// Order history and order info with live tracking (status straight from the hub, which gets it from the POS)
(function (A) {
  const { I, state, esc, money, fmtDate, fmtTime } = A;

  const findOrder = (id) => state.orders.find((o) => o.id === id);
  const qty = (l) => l.qtyMilli / 1000;
  const itemCount = (o) => o.lines.reduce((a, l) => a + qty(l), 0);
  const itemSummary = (o) => o.lines.map((l) => `${qty(l)}× ${l.name}`).join(', ');
  const lineMedia = (l) => {
    const item = A.byId(l.itemId);
    return item ? A.media(item, 'thumb') : `<div class="media thumb" data-emoji="${(EMOJI_RULES.find(([re]) => re.test(l.name)) || [, '🍽️'])[1]}"></div>`;
  };

  // Steps shown on the timeline, and which hub states count as reaching each one
  const STEPS = {
    DELIVERY: [['Sent', ['PLACED', 'SENT_TO_STORE', 'RECEIVED']], ['Accepted', ['ACCEPTED']], ['Preparing', ['PREPARING']], ['Ready', ['READY']], ['On the way', ['OUT_FOR_DELIVERY']], ['Delivered', ['DELIVERED']]],
    PICKUP: [['Sent', ['PLACED', 'SENT_TO_STORE', 'RECEIVED']], ['Accepted', ['ACCEPTED']], ['Preparing', ['PREPARING']], ['Ready', ['READY']], ['Collected', ['PICKED_UP']]],
  };
  const stepIndex = (o) => STEPS[o.fulfilment].findIndex(([, states]) => states.includes(o.state));

  // Asks the hub for the latest status of every active order; re-draws when something changed
  async function refreshActive() {
    const active = state.orders.filter(A.isActive);
    const results = await Promise.allSettled(active.map((r) => Hub.order(r.id, r.token)));
    let changed = false;
    results.forEach((res) => { if (res.status === 'fulfilled' && A.updateOrder(res.value)) changed = true; });
    return changed;
  }

  const FILTERS = {
    all: ['All', () => true],
    active: ['In progress', (r) => A.isActive(r)],
    delivered: ['Delivered', (r) => ['DELIVERED', 'PICKED_UP'].includes(r.order.state)],
    other: ['Other', (r) => A.failed(r.order)],
  };

  /* ---------- Order history ---------- */
  function historyHTML() {
    const [, test] = FILTERS[state.ordersFilter] || FILTERS.all;
    const list = state.orders.filter(test);
    return `
      <div class="page-head flat">
        ${A.mBack}<h1>My orders</h1>
        ${state.orders.length ? `<div class="filters">
          ${Object.entries(FILTERS).map(([k, [label]]) => `<button class="filter ${state.ordersFilter === k ? 'on' : ''}" data-action="orders-filter" data-f="${k}">${label}</button>`).join('')}
        </div>` : ''}
      </div>
      ${!state.orders.length ? A.empty('🧾', 'No orders yet', 'Orders you place on this device show up here.', { href: '#/', label: 'Order now' })
      : !list.length ? `<div class="empty small"><span class="empty-ico">📦</span><p>No orders here.</p></div>`
      : `<div class="order-list">${list.map(({ order: o }) => `
        <article class="order-row">
          <div class="or-main">
            <div class="or-id"><strong>${esc(o.number)}</strong><small>${fmtDate(o.placedAt)}</small></div>
            <div class="or-thumbs">${o.lines.slice(0, 4).map(lineMedia).join('')}${o.lines.length > 4 ? `<span class="more">+${o.lines.length - 4}</span>` : ''}</div>
            <p class="or-items">${esc(itemSummary(o))}</p>
            <small class="muted">${itemCount(o)} items · ${o.lines.length} ${o.lines.length === 1 ? 'dish' : 'dishes'} · ${o.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</small>
          </div>
          <div class="or-side">
            <div class="or-total"><strong>${money(o.total)}</strong>${A.statusTag(o)}</div>
            <div class="or-btns">
              ${A.isActive({ order: o }) ? '' : `<button class="btn outline sm" data-action="reorder" data-id="${esc(o.id)}">${I.reorder} Reorder</button>`}
              <a class="btn soft sm" href="#/orders/${encodeURIComponent(o.id)}">${A.isActive({ order: o }) ? 'Track' : 'Details'}</a>
            </div>
          </div>
        </article>`).join('')}</div>`}`;
  }

  /* ---------- Order info ---------- */
  function detailHTML(rec) {
    const o = rec.order;
    const steps = STEPS[o.fulfilment];
    const at = stepIndex(o);
    const done = FINAL_STATES.includes(o.state);
    const bad = A.failed(o);
    const delivery = o.fulfilment === 'DELIVERY';
    const times = { PLACED: o.placedAt, ...rec.times };
    const stepTime = (i) => {
      const t = steps[i][1].map((s) => times[s]).find(Boolean);
      if (t && i <= at) return fmtTime(t);
      // the ready time the kitchen gave when it accepted
      if (steps[i][0] === 'Ready' && o.etaAt && i > at) return `by ${fmtTime(o.etaAt)}`;
      return '';
    };
    const heading = bad ? STATUS[o.state]
      : o.state === 'OUT_FOR_DELIVERY' ? 'On the way'
      : o.state === 'READY' ? (delivery ? 'Ready, leaving soon' : 'Ready to collect')
      : done ? STATUS[o.state]
      : o.etaAt ? `Ready by ${fmtTime(o.etaAt)}`
      : 'Waiting for the restaurant';
    return `
      ${state.justPlaced === o.id ? `
        ${A.demo
          ? `<div class="notice warn">${I.help}<span><b>Demo order placed.</b> ${esc(o.number)} was not sent to a restaurant. A pretend kitchen moves it along so you can see live tracking.</span></div>`
          : `<div class="notice ok">${I.check}<span><b>Order placed.</b> ${esc(o.number)} was sent to ${esc(A.shop.name)}. This page updates live when the kitchen accepts it.</span></div>`}` : ''}
      <div class="card od">
        <div class="od-head">
          <button class="icon-btn" data-action="back" aria-label="Back">${I.back}</button>
          <div class="grow"><h1>Order ${esc(o.number)}</h1><small class="muted">${fmtDate(o.placedAt)}</small></div>
          ${A.statusTag(o)}
        </div>

        <div class="od-status ${bad ? 'bad' : ''}">
          <div class="od-status-top">
            <span class="od-kind">${delivery ? I.bike : I.bag} ${delivery ? 'Courier delivery' : 'Pickup'}</span>
            <span class="muted">${I.clock} ${esc(heading)}</span>
          </div>
          ${bad ? `<p class="err">${esc(A.statusText(o))}</p>` : A.timeline(steps.map((s, i) => ({ label: s[0], at: stepTime(i) })), Math.max(0, at), done)}
          ${bad ? '' : `<p class="muted small">${esc(A.statusText(o))}</p>`}
        </div>

        ${o.rider && ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.state) ? `
        <div class="od-rider">
          <span class="avatar sm">${I.user}</span>
          <div class="grow"><small class="muted">Your courier</small><strong>${esc(o.rider.name)}</strong></div>
          ${o.rider.phone ? `<a class="btn soft sm" href="tel:${esc(o.rider.phone)}">${I.phone} Call</a>` : ''}
        </div>` : ''}

        <ul class="od-lines">
          ${o.lines.map((l) => `
            <li>
              ${lineMedia(l)}
              <div class="grow"><strong>${qty(l)} × ${esc(l.name)}</strong>${l.modifiers?.length ? `<small class="muted">${esc(l.modifiers.map((m) => m.name).join(', '))}</small>` : ''}</div>
              <b>${money(l.lineTotal)}</b>
            </li>`).join('')}
        </ul>

        <div class="od-cards">
          <div class="mini-card">
            <h3>Receipt</h3>
            <dl class="totals sm">
              <div><dt>Items (${itemCount(o)})</dt><dd>${money(o.itemsTotal)}</dd></div>
              ${o.deliveryFee ? `<div><dt>Delivery${o.distanceKm != null ? ` (${o.distanceKm} km)` : ''}</dt><dd>${money(o.deliveryFee)}</dd></div>` : ''}
              ${o.packagingFee ? `<div><dt>Packaging</dt><dd>${money(o.packagingFee)}</dd></div>` : ''}
              <div class="total"><dt>Total</dt><dd>${money(o.total)}</dd></div>
            </dl>
            <p class="muted small">Prices include GST.${o.posBillNo ? ` Bill no. ${esc(o.posBillNo)}.` : ''}</p>
          </div>
          <div class="mini-card">
            <h3>${delivery ? 'Delivery' : 'Pickup'} & payment</h3>
            <dl class="totals sm">
              <div><dt>Method</dt><dd>${delivery ? 'Cash on delivery' : 'Pay at the counter'}</dd></div>
              <div><dt>Amount</dt><dd>${money(o.total)}</dd></div>
              <div><dt>Status</dt><dd class="${o.paid ? 'ok' : 'accent'}">● ${o.paid ? 'Paid' : bad ? 'Not charged' : 'Pending'}</dd></div>
              <div><dt>${delivery ? 'Deliver to' : 'Pickup from'}</dt><dd>${esc(o.address ? A.addressText(o.address) : (window.TIFFIN_CONFIG.address || A.shop.name))}</dd></div>
              ${o.note ? `<div><dt>Note</dt><dd>${esc(o.note)}</dd></div>` : ''}
            </dl>
          </div>
        </div>

        <div class="od-actions">
          ${CANCELLABLE_STATES.includes(o.state) ? `<button class="btn outline danger" data-action="cancel-order" data-id="${esc(o.id)}">Cancel order</button>` : ''}
          ${done ? `<button class="btn" data-action="reorder" data-id="${esc(o.id)}">Order again</button>` : ''}
        </div>
      </div>`;
  }

  A.route('orders', {
    render(id) {
      if (id) {
        const rec = findOrder(id);
        if (!rec) return null;
        return A.accountPage('orders', detailHTML(rec), 'is-detail');
      }
      return A.accountPage('orders', historyHTML());
    },
    mount(id) {
      if (!id) {
        const tick = () => refreshActive().then((changed) => { if (changed) A.refresh(); });
        if (state.orders.some(A.isActive)) { tick(); A.setTimer(tick, 15000); }
        return;
      }
      const rec = findOrder(id);
      if (!rec || !A.isActive(rec)) return;
      // live updates from the hub; a slow poll as a safety net if the stream drops
      const stop = Hub.watch(rec.id, rec.token, (order) => { if (A.updateOrder(order)) A.refresh(); });
      A.onLeave(() => { stop(); if (state.justPlaced === id) state.justPlaced = null; });
      const poll = () => Hub.order(rec.id, rec.token).then((order) => { if (A.updateOrder(order)) A.refresh(); }).catch(() => {});
      poll();
      A.setTimer(poll, 30000);
    },
  });

  A.action('orders-filter', (el) => { state.ordersFilter = el.dataset.f; A.refresh(); });
  A.action('reorder', (el) => {
    const rec = findOrder(el.dataset.id);
    let missing = 0;
    rec.order.lines.forEach((l) => {
      if (A.byId(l.itemId)) A.addToCart(l.itemId, qty(l), (l.modifiers || []).map((m) => m.id));
      else missing++;
    });
    A.toast(missing ? `Added to cart. ${missing} dish(es) are no longer on the menu.` : 'Added to your cart');
    location.hash = '#/checkout';
  });

  A.action('cancel-order', async (el) => {
    const rec = findOrder(el.dataset.id);
    if (!rec || !confirm(`Cancel order ${rec.order.number}?`)) return;
    el.disabled = true;
    try {
      await Hub.cancel(rec.id, rec.token, 'Cancelled by the customer on the website');
      A.updateOrder(await Hub.order(rec.id, rec.token));
      A.toast('Order cancelled');
    } catch (e) {
      A.toast(e.message);
      try { A.updateOrder(await Hub.order(rec.id, rec.token)); } catch { /* keep what we have */ }
    }
    A.refresh();
  });
})(App);
