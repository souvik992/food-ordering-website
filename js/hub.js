// Talks to the Tiffin order hub (customer API, order contract v1).
// The menu, prices, totals and order status always come from the hub; this site never works out a total itself.
window.Hub = (function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const base = (params.get('hub') || TIFFIN_CONFIG.hubUrl).replace(/\/+$/, '');
  const slug = params.get('store') || TIFFIN_CONFIG.store;
  const storePath = `/v1/stores/${encodeURIComponent(slug)}`;

  async function call(method, path, body, headers = {}) {
    let r;
    try {
      r = await fetch(base + path, {
        method,
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

  return {
    base, slug, newKey,
    // Menu photo published by the POS (item.image is "<sha256>.<jpg|png|webp>")
    imageUrl: (name) => `${base}${storePath}/images/${encodeURIComponent(name)}`,
    store: () => call('GET', storePath),
    quote: (body) => call('POST', `${storePath}/quote`, body),
    sendOtp: (mobile) => call('POST', '/v1/otp/send', { mobile }),
    verifyOtp: (mobile, otp) => call('POST', '/v1/otp/verify', { mobile, otp }),
    placeOrder: (body, key) => call('POST', `${storePath}/orders`, body, { 'idempotency-key': key }),
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
})();
