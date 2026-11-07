// Brand website only: where the customer is, so the hub can choose the outlet that gets the order
// (delivery: the nearest outlet that delivers there; pickup: the nearest open outlet).
(function (A) {
  const { I, state, esc } = A;
  let draft = null; // a location from the phone, not yet used

  A.route('where', {
    render() {
      if (!Hub.brand || A.demo) return null;
      const f = A.brand?.fulfilment || { delivery: true, pickup: true };
      if (state.fulfilment === 'DELIVERY' && !f.delivery) state.fulfilment = 'PICKUP';
      if (state.fulfilment === 'PICKUP' && !f.pickup) state.fulfilment = 'DELIVERY';
      const delivery = state.fulfilment === 'DELIVERY';
      const loc = draft || state.near;
      // a delivery goes to the delivery address: when it has a location, that is what chooses the outlet
      const addr = A.defaultAddress();
      const byAddress = delivery && addr && addr.lat != null;
      const saved = state.addresses.filter((a) => a.lat != null);
      const err = `<p class="err" id="where-err">${esc(A.whereError || '')}</p>`;
      return `
        <section class="page container narrow">
          ${A.pageHead('Where are you?', { back: Boolean(A.shop) })}
          <p class="muted">${esc(A.brand?.name || '')}: ${delivery ? 'we send your order to our nearest outlet that delivers to you.' : 'we send your order to our nearest open outlet; you collect it there.'}</p>
          ${f.delivery && f.pickup ? `<div class="addr-labels">
            <label class="filter-radio"><input type="radio" name="where-mode" data-change="where-mode" value="DELIVERY" ${delivery ? 'checked' : ''} /><span>Delivery</span></label>
            <label class="filter-radio"><input type="radio" name="where-mode" data-change="where-mode" value="PICKUP" ${delivery ? '' : 'checked'} /><span>Pickup</span></label>
          </div>` : ''}
          ${byAddress ? `
          <div class="tiles stack">${A.tile({ action: 'where-addr', value: addr.id, selected: true, icon: A.ADDRESS_ICONS[addr.label] || I.pin, title: `Deliver to ${esc(addr.label)}`, sub: esc(A.addressText(addr)) })}</div>
          ${err}
          <div class="form-btns">
            <a class="btn soft" href="#/addresses">Deliver somewhere else</a>
            <button class="btn" id="where-find" data-action="where-addr" data-value="${esc(addr.id)}">Find my outlet</button>
          </div>` : `
          <form class="addr-form" data-form="where">
            <div class="locate">
              <button type="button" class="btn outline sm" data-action="where-gps">${I.locate} Use my current location</button>
              <small class="muted" id="where-text">${loc ? `${I.check} Location set` : 'Or enter the map position below.'}</small>
            </div>
            <details class="manual-loc" ${loc ? '' : 'open'}>
              <summary class="link small">Enter the map position by hand</summary>
              <div class="fields two">
                <label class="field"><span>Latitude</span><input name="lat" inputmode="decimal" value="${loc?.lat ?? ''}" placeholder="12.9716" /></label>
                <label class="field"><span>Longitude</span><input name="lng" inputmode="decimal" value="${loc?.lng ?? ''}" placeholder="77.5946" /></label>
              </div>
            </details>
            ${err}
            <div class="form-btns"><button class="btn" id="where-find">Find my outlet</button></div>
          </form>
          ${saved.length ? `<h2 class="h-sm">Or use a saved address</h2>
          <div class="tiles stack">${saved.map((a) => A.tile({ action: 'where-addr', value: a.id, selected: false, icon: A.ADDRESS_ICONS[a.label] || I.pin, title: esc(a.label), sub: esc(A.addressText(a)) })).join('')}</div>` : ''}`}
        </section>`;
    },
  });

  async function find(loc) {
    const err = document.getElementById('where-err');
    const btn = document.getElementById('where-find');
    if (err) err.textContent = '';
    if (btn) { btn.disabled = true; btn.classList.add('busy'); }
    const before = state.near, first = !A.shop;
    state.near = loc;
    try {
      await A.chooseOutlet();
      A.whereError = ''; draft = null;
      A.save();
      if (first) A.renderFooter();
      if (location.hash === '#/' || location.hash === '') A.render(); else location.hash = '#/';
    } catch (e) {
      state.near = before;
      A.whereError = e.message;
      if (err) err.textContent = e.message;
      if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
    }
  }

  A.input('where-mode', (el) => { state.fulfilment = el.value; A.save(); A.refresh(); });
  A.action('where-gps', (el) => {
    const text = document.getElementById('where-text');
    if (!navigator.geolocation) { text.textContent = 'This browser cannot share its location. Enter the map position by hand.'; return; }
    el.disabled = true; text.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition((p) => {
      draft = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
      const f = el.closest('form');
      f.lat.value = draft.lat; f.lng.value = draft.lng;
      text.innerHTML = `${I.check} Location set`;
      el.disabled = false;
      find(draft);
    }, () => {
      text.textContent = 'Could not read your location. Allow location access, or enter the map position by hand.';
      el.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000 });
  });
  A.action('where-addr', (el) => {
    const a = state.addresses.find((x) => String(x.id) === el.dataset.value);
    if (!a) return;
    state.addresses.forEach((x) => { x.isDefault = x === a; });
    find({ lat: a.lat, lng: a.lng });
  });
  A.form('where', (f) => {
    const lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
    const say = (m) => { document.getElementById('where-err').textContent = m; };
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return say('Share your location, or enter the map position.');
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) return say('That map position is not in India. Check it and try again.');
    find({ lat, lng });
  });
})(App);
