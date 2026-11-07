// Talks to the Tiffin order hub (customer API, order contract v1).
// The menu, prices, totals and order status always come from the hub; this site never works out a total itself.
//
// Two ways to run (js/config.js):
//   store: one restaurant; every order goes to that store.
//   brand: several outlets of one brand. The hub chooses the outlet from where the customer is (the nearest one that
//          can take the order); the site then shows that outlet's menu and sends the order there.
window.Hub = (function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const base = (params.get('hub') || TIFFIN_CONFIG.hubUrl).replace(/\/+$/, '');
  const brand = params.get('brand') || (params.get('store') ? '' : TIFFIN_CONFIG.brand || '');
  const brandPath = `/v1/brands/${encodeURIComponent(brand)}`;
  // H.slug: the store orders go to (brand mode: the outlet the hub chose; empty until it has chosen one)
  const storePath = () => `/v1/stores/${encodeURIComponent(H.slug)}`;

  async function call(method, path, body, headers = {}) {
    let r;
    try {
      r = await fetch(base + path, {
        method,
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error('Could not reach the restaurant. Check your internet and try again.'), { code: 'NETWORK' });
    }
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      throw Object.assign(new Error(j?.error?.message || 'Something went wrong. Please try again.'), {
        code: j?.error?.code, details: j?.error?.details, status: r.status,
      });
    }
    return j;
  }

  // crypto.randomUUID needs https (or localhost); fall back elsewhere
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);

  const H = {
    base, brand, newKey,
    slug: brand ? '' : params.get('store') || TIFFIN_CONFIG.store,
    // Item photos uploaded from the POS
    imageUrl: (name) => `${base}${storePath()}/images/${encodeURIComponent(name)}`,
    store: () => call('GET', storePath()),
    // brand mode
    brandInfo: () => call('GET', brandPath),
    /** Which outlet gets an order from here now: { outlet (its store page), distanceKm, label }, or NO_OUTLET. */
    async outlet(fulfilment, location) {
      const r = await call('POST', `${brandPath}/outlet`, { fulfilment, location });
      H.slug = r.outlet.slug;
      return r;
    },
    quote: (body) => call('POST', `${storePath()}/quote`, body),
    sendOtp: (mobile) => call('POST', '/v1/otp/send', { mobile }),
    verifyOtp: (mobile, otp) => call('POST', '/v1/otp/verify', { mobile, otp }),
    /** near: where the customer is (brand mode: the hub checks the outlet is still the one that gets the order). */
    placeOrder: (body, key, near) => (brand
      ? call('POST', `${brandPath}/orders`, { ...body, store: H.slug, near: near || null }, { 'idempotency-key': key })
      : call('POST', `${storePath()}/orders`, body, { 'idempotency-key': key })),
    order: (id, token) => call('GET', `/v1/orders/${encodeURIComponent(id)}`, null, { 'x-order-token': token }),
    cancel: (id, token, reasonText) => call('POST', `/v1/orders/${encodeURIComponent(id)}/cancel`, { reasonText }, { 'x-order-token': token }),
    // Live status (Server-Sent Events). Returns a function that stops listening.
    watch(id, token, onOrder) {
      const es = new EventSource(`${base}/v1/orders/${encodeURIComponent(id)}/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('order.state', (e) => {
        try { const d = JSON.parse(e.data); if (d.order) onOrder(d.order); } catch { /* ignore a bad event */ }
      });
      return () => es.close();
    },
  };
  return H;
})();
