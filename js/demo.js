// Demo mode: used only when the order hub cannot be reached. A stand-in for js/hub.js with a sample menu and photos,
// so the whole website can be tried: menu, options, cart, checkout, sign-in, ordering and tracking.
// Nothing here reaches a restaurant. Orders are kept in this browser and a pretend kitchen moves them along.
window.DemoHub = (function () {
  'use strict';

  const LOCATION = { lat: 12.9716, lng: 77.5946 };
  const DEMO_DISTANCE_KM = 2.4; // every demo address counts as nearby
  const CODE = '123456';

  const item = (id, categoryId, name, price, isVeg, description, extra = {}) =>
    ({ id, categoryId, name, price, unit: 'pcs', isVeg, modifierGroupIds: [], available: true, description, image: `${id}.jpg`, ...extra });
  const allDay = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, [{ open: '00:00', close: '23:59' }]]));

  const MENU = {
    version: 1,
    categories: [
      { id: 'biryani', name: 'Biryani', sort: 1 }, { id: 'curries', name: 'Curries & Thalis', sort: 2 }, { id: 'breads', name: 'Breads', sort: 3 },
      { id: 'starters', name: 'Starters', sort: 4 }, { id: 'south', name: 'South Indian', sort: 5 }, { id: 'sweet', name: 'Chai & Desserts', sort: 6 },
    ],
    items: [
      item('chk-biryani', 'biryani', 'Chicken Dum Biryani', 28900, false, 'Slow-cooked basmati, tender chicken, saffron and fried onions', { modifierGroupIds: ['portion', 'extras'] }),
      item('mutton-biryani', 'biryani', 'Mutton Biryani', 36900, false, 'Hyderabadi style, layered and sealed with dough', { modifierGroupIds: ['portion', 'extras'] }),
      item('veg-biryani', 'biryani', 'Veg Biryani', 21900, true, 'Seasonal vegetables, basmati, mint and whole spices', { modifierGroupIds: ['portion'] }),
      item('paneer-bm', 'curries', 'Paneer Butter Masala', 24900, true, 'Cottage cheese in a rich tomato and butter gravy'),
      item('butter-chicken', 'curries', 'Butter Chicken', 29900, false, 'Tandoori chicken simmered in makhani sauce'),
      item('dal-makhani', 'curries', 'Dal Makhani', 19900, true, 'Black lentils cooked overnight with butter and cream'),
      item('rajasthani-thali', 'curries', 'Rajasthani Thali', 34900, true, 'Dal, two sabzis, missi roti, papad, salad and chaas'),
      item('butter-naan', 'breads', 'Garlic Butter Naan', 6900, true, 'Soft tandoor bread with garlic and coriander'),
      item('tandoori-roti', 'breads', 'Tandoori Roti', 3900, true, 'Whole wheat, straight from the tandoor'),
      item('chicken-65', 'starters', 'Chicken 65', 22900, false, 'Crisp, spicy, curry-leaf tempered chicken'),
      item('paneer-tikka', 'starters', 'Paneer Tikka', 23900, true, 'Chargrilled cottage cheese, peppers and onion'),
      item('veg-samosa', 'starters', 'Samosa (4 pcs)', 8900, true, 'Crisp pastry with spiced potato filling and mint chutney'),
      item('masala-dosa', 'south', 'Masala Dosa', 12900, true, 'Rice and lentil crepe with potato masala, sambar and chutney', { modifierGroupIds: ['dosa'] }),
      item('masala-chai', 'sweet', 'Masala Chai', 4900, true, 'Ginger, cardamom, slow-brewed'),
      item('gulab-jamun', 'sweet', 'Gulab Jamun', 8900, true, 'Two warm dumplings in rose and cardamom syrup'),
    ],
    modifierGroups: [
      { id: 'portion', name: 'Portion', minSelect: 1, maxSelect: 1, modifiers: [{ id: 'portion-half', name: 'Half', price: 0 }, { id: 'portion-full', name: 'Full', price: 10000 }] },
      { id: 'extras', name: 'Add-ons', minSelect: 0, maxSelect: 2, modifiers: [{ id: 'x-raita', name: 'Raita', price: 3000 }, { id: 'x-egg', name: 'Boiled egg', price: 2000 }, { id: 'x-salan', name: 'Mirchi ka salan', price: 4000 }] },
      { id: 'dosa', name: 'Make it', minSelect: 0, maxSelect: 1, modifiers: [{ id: 'dosa-ghee', name: 'Ghee roast', price: 3000 }, { id: 'dosa-cheese', name: 'Cheese', price: 4000 }] },
    ],
  };
  const ZONES = [
    { upToKm: 3, deliveryFee: 3000, minOrder: 10000, freeDeliveryAbove: 50000, etaMinutes: 30 },
    { upToKm: 6, deliveryFee: 5000, minOrder: 20000, freeDeliveryAbove: null, etaMinutes: 45 },
  ];
  const PICKUP = { minOrder: 0, etaMinutes: 20 };
  const PACKAGING = 1000;

  const SHOP = {
    slug: 'demo', name: 'Tiffin Demo Kitchen', open: true, reason: null, menu: MENU,
    fulfilment: { pickup: true, delivery: true }, payments: { cod: true, online: false },
    delivery: { location: LOCATION, zones: ZONES, packagingFee: PACKAGING }, pickup: PICKUP, hours: allDay, acceptMode: 'manual',
  };

  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  const rupees = (p) => `Rs ${(p / 100).toFixed(2)}`;
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Prices a cart the way the hub does: item and option prices, delivery fee by zone, packaging
  function price(body) {
    const groups = new Map(MENU.modifierGroups.map((g) => [g.id, g]));
    const lines = (body.lines || []).map((l) => {
      const it = MENU.items.find((i) => i.id === l.itemId);
      if (!it) fail('ITEM_UNAVAILABLE', 'An item in your cart is no longer available.');
      const mods = (l.modifierIds || []).map((id) => {
        const g = it.modifierGroupIds.map((gid) => groups.get(gid)).find((x) => x?.modifiers.some((m) => m.id === id));
        if (!g) fail('OPTION_INVALID', `An option for ${it.name} is not available.`);
        return g.modifiers.find((m) => m.id === id);
      });
      for (const gid of it.modifierGroupIds) {
        const g = groups.get(gid);
        const n = mods.filter((m) => g.modifiers.includes(m)).length;
        if (n < g.minSelect || n > g.maxSelect) fail('OPTION_INVALID', `Choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect} to ${g.maxSelect}`} option(s) for ${g.name} (${it.name}).`);
      }
      const unitPrice = it.price + mods.reduce((a, m) => a + m.price, 0);
      return { itemId: it.id, name: it.name, qtyMilli: l.qtyMilli, unitPrice, modifiers: mods.map((m) => ({ id: m.id, name: m.name, price: m.price })), note: l.note || null, lineTotal: Math.round(unitPrice * l.qtyMilli / 1000) };
    });
    const itemsTotal = lines.reduce((a, l) => a + l.lineTotal, 0);
    let deliveryFee = 0, distanceKm = null, etaMinutes = PICKUP.etaMinutes, minOrder = PICKUP.minOrder;
    if (body.fulfilment === 'DELIVERY') {
      const z = ZONES[0];
      distanceKm = DEMO_DISTANCE_KM;
      deliveryFee = z.freeDeliveryAbove && itemsTotal >= z.freeDeliveryAbove ? 0 : z.deliveryFee;
      etaMinutes = z.etaMinutes; minOrder = z.minOrder;
    }
    if (itemsTotal < minOrder) fail('BELOW_MINIMUM', `Add items worth ${rupees(minOrder - itemsTotal)} more (minimum order ${rupees(minOrder)}).`);
    return { ok: true, lines, itemsTotal, deliveryFee, packagingFee: PACKAGING, total: itemsTotal + deliveryFee + PACKAGING, distanceKm, etaMinutes, minOrder, menuVersion: MENU.version };
  }

  /* ---------- Orders: kept in this browser; a pretend kitchen moves them along ---------- */
  const KEY = 'tf_demo_hub_orders';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const keep = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ } };
  // Seconds after placing when each step happens
  const TIMELINE = {
    DELIVERY: [['ACCEPTED', 8], ['PREPARING', 18], ['READY', 40], ['OUT_FOR_DELIVERY', 55], ['DELIVERED', 90]],
    PICKUP: [['ACCEPTED', 8], ['PREPARING', 18], ['READY', 40], ['PICKED_UP', 70]],
  };

  // The order as it stands now
  function current(o) {
    if (o.cancelledAt) return { ...o, state: 'CANCELLED', updatedAt: o.cancelledAt };
    const t = (Date.now() - o.placedAt) / 1000;
    let state = 'SENT_TO_STORE', at = o.placedAt;
    for (const [s, sec] of TIMELINE[o.fulfilment]) if (t >= sec) { state = s; at = o.placedAt + sec * 1000; }
    const accepted = state !== 'SENT_TO_STORE';
    return {
      ...o, state, updatedAt: at,
      label: window.STATUS?.[state] || state,
      etaAt: accepted ? o.placedAt + TIMELINE[o.fulfilment].find(([st]) => st === 'READY')[1] * 1000 : null,
      posBillNo: accepted ? `DEMO-${o.number.slice(2)}` : null,
      rider: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(state) ? { name: 'Demo Rider', phone: null } : null,
      paid: ['DELIVERED', 'PICKED_UP'].includes(state),
    };
  }

  let seq = Number(localStorage.getItem('tf_demo_hub_seq') || 1000);

  return {
    base: 'demo', slug: 'demo-preview',
    newKey: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    imageUrl: (name) => `images/demo/${encodeURIComponent(name)}`,
    location: LOCATION,
    async store() { await wait(150); return clone(SHOP); },
    async quote(body) { await wait(); return price(body); },
    async sendOtp(mobile) {
      await wait();
      const digits = String(mobile).replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(digits)) fail('VALIDATION', 'Enter a 10-digit mobile number.');
      return { sent: true, devCode: CODE };
    },
    async verifyOtp(mobile, otp) {
      await wait();
      if (otp !== CODE) fail('OTP_INVALID', 'That code is not right. Try again.');
      return { mobile: String(mobile).replace(/\D/g, '').slice(-10), otpToken: `demo-${Date.now()}` };
    },
    async placeOrder(body, key) {
      await wait(500);
      if (!body.otpToken) fail('OTP_REQUIRED', 'Verify your mobile number to place the order.');
      const all = load();
      const existing = Object.values(all).find((o) => o.key === key);
      if (existing) return { order: current(existing), accessToken: existing.token };
      const q = price(body);
      if (q.total !== body.expectedTotal) fail('PRICE_CHANGED', `The total changed to ${rupees(q.total)}. Check your order and try again.`);
      seq += 1; try { localStorage.setItem('tf_demo_hub_seq', String(seq)); } catch { /* ignore */ }
      const o = {
        key, id: `demo-${seq}-${Math.random().toString(36).slice(2, 8)}`, token: Math.random().toString(36).slice(2), number: `D-${seq}`,
        store: { slug: 'demo', name: SHOP.name }, channel: 'website', fulfilment: body.fulfilment, payment: 'COD',
        customerName: body.customer?.name || null, lines: q.lines, address: body.address, distanceKm: q.distanceKm, note: body.note,
        itemsTotal: q.itemsTotal, deliveryFee: q.deliveryFee, packagingFee: q.packagingFee, total: q.total,
        placedAt: Date.now(), cancelledAt: null, reasonText: null,
      };
      all[o.id] = o; keep(all);
      return { order: current(o), accessToken: o.token };
    },
    async order(id) {
      await wait(100);
      const o = load()[id];
      if (!o) fail('NOT_FOUND', 'Order not found.');
      return current(o);
    },
    async cancel(id, token, reasonText) {
      await wait();
      const all = load(); const o = all[id];
      if (!o) fail('NOT_FOUND', 'Order not found.');
      if (current(o).state !== 'SENT_TO_STORE') fail('NOT_CANCELLABLE', 'The restaurant has already accepted this order.');
      o.cancelledAt = Date.now(); o.reasonText = reasonText; keep(all);
      return { ok: true };
    },
    // Live status: checks every 2 seconds. Returns a function that stops it.
    watch(id, token, onOrder) {
      const t = setInterval(() => { const o = load()[id]; if (o) onOrder(current(o)); }, 2000);
      return () => clearInterval(t);
    },
  };
})();
