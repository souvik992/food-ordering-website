// Account pages: profile, addresses, favourites, notifications, help, and sign in (6-digit code from the hub).
// The sign-in and address forms are shared with checkout.
(function (A) {
  const { I, state, esc, fmtDate, cardHTML } = A;

  // Back button on phones only (on larger screens the side menu is there)
  const mBack = `<button class="icon-btn m-only" data-action="back" aria-label="Back">${I.back}</button>`;
  A.mBack = mBack;

  /* ---------- Mobile verification (shared with checkout) ---------- */
  A.otp = { pending: null, draftName: state.user?.name || '', draftPhone: '' }; // pending: { phone, devCode }

  async function sendCode(phone) {
    const r = await Hub.sendOtp(phone);
    A.otp.pending = { phone, devCode: r.devCode || null };
  }
  A.input('draft-name', (el) => { A.otp.draftName = el.value; });
  A.input('draft-phone', (el) => { A.otp.draftPhone = el.value; });

  A.form('otp-send', async (f) => {
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await sendCode(f.phone.value.trim());
      A.toast('Code sent');
      A.refresh();
      document.querySelector('[name="code"]')?.focus();
    } catch (e) { A.toast(e.message); btn.disabled = false; }
  });
  A.action('otp-resend', async () => {
    try { await sendCode(A.otp.pending.phone); A.toast('A new code is on its way'); A.refresh(); } catch (e) { A.toast(e.message); }
  });
  A.action('otp-reset', () => { A.otp.pending = null; A.refresh(); });
  A.form('otp-verify', async (f) => {
    if (!/^\d{6}$/.test(f.code.value)) return A.toast('Enter the 6-digit code');
    const btn = f.querySelector('button.btn'); btn.disabled = true;
    try {
      const r = await Hub.verifyOtp(A.otp.pending.phone, f.code.value);
      state.user = { name: A.otp.draftName.trim(), phone: r.mobile, otpToken: r.otpToken };
      A.otp.pending = null;
      A.save();
      A.toast(state.user.name ? `Welcome, ${state.user.name.split(' ')[0]}!` : 'Mobile number verified');
      const next = f.closest('[data-next]')?.dataset.next;
      if (next != null) goTo(next); else A.refresh();
    } catch (e) { A.toast(e.message); btn.disabled = false; }
  });
  A.action('change-number', () => {
    A.otp.draftName = state.user?.name || '';
    state.user = null; A.save(); A.refresh();
  });
  A.action('logout', () => {
    state.user = null; A.save();
    A.toast('Signed out');
    A.refresh();
  });

  /* ---------- Address form (the "Add delivery address" page). Delivery needs the map location: the hub uses it for distance and fee ---------- */
  let draftLoc = null;
  // The street address found for draftLoc (like Swiggy/Zomato): { title, line2, city, pincode }.
  // When it is complete, the customer only types the house / flat / floor.
  let draftGeo = null;
  const geoComplete = (g) => Boolean(g && g.city && /^[1-9]\d{5}$/.test(g.pincode));

  // next: the page to go back to once the address is saved (e.g. 'checkout')
  A.addressForm = ({ next = 'addresses' } = {}) => {
    const g = draftGeo, short = geoComplete(g);
    return `
    <form class="addr-form" data-form="address" data-next="${esc(next)}">
      <div class="addr-labels">
        ${['Home', 'Work', 'Other'].map((l, i) => `<label class="filter-radio"><input type="radio" name="label" value="${l}" ${i === 0 ? 'checked' : ''} /><span>${l}</span></label>`).join('')}
      </div>
      <div class="locate">
        <button type="button" class="btn outline sm" data-action="locate">${I.locate} Use my current location</button>
        <small class="muted" id="loc-text">${draftLoc ? `${I.check} Location set` : 'Needed for delivery. We fill in the address for you.'}</small>
      </div>
      <div class="detected" id="addr-detected" ${short ? '' : 'hidden'}>
        <span class="tile-ico">${I.pin}</span>
        <div class="grow"><strong id="det-title">${esc(g?.title || '')}</strong><small id="det-text">${esc(g ? [g.line2, g.city, g.pincode].filter(Boolean).join(', ') : '')}</small></div>
        <button type="button" class="link small" data-action="addr-edit">Edit</button>
      </div>
      <div class="fields">
        <label class="field"><span>House / flat / floor no.</span><input name="line1" required maxlength="120" autocomplete="address-line1" placeholder="e.g. Flat 302, 3rd floor, Sunrise Apartments" /></label>
      </div>
      <div id="addr-more" ${short ? 'hidden' : ''}>
        <div class="fields three">
          <label class="field"><span>Area / street</span><input name="line2" maxlength="120" autocomplete="address-line2" placeholder="Optional" value="${esc(g?.line2 || '')}" /></label>
          <label class="field"><span>City</span><input name="city" required maxlength="60" autocomplete="address-level2" value="${esc(g?.city || '')}" /></label>
          <label class="field"><span>PIN code</span><input name="pincode" required inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6" autocomplete="postal-code" value="${esc(g?.pincode || '')}" /></label>
        </div>
        <div class="fields">
          <label class="field"><span>Landmark</span><input name="landmark" maxlength="80" placeholder="Optional" /></label>
        </div>
        <details class="manual-loc">
          <summary class="link small">Enter the map position by hand</summary>
          <div class="fields two">
            <label class="field"><span>Latitude</span><input name="lat" inputmode="decimal" value="${draftLoc?.lat ?? ''}" placeholder="12.9716" /></label>
            <label class="field"><span>Longitude</span><input name="lng" inputmode="decimal" value="${draftLoc?.lng ?? ''}" placeholder="77.5946" /></label>
          </div>
        </details>
      </div>
      <div class="form-btns">
        <button type="button" class="btn soft" data-action="back">Cancel</button>
        <button class="btn">${next === 'checkout' ? 'Save and continue' : 'Save address'}</button>
      </div>
    </form>`;
  };

  // Map position -> street address, with OpenStreetMap's free lookup (no key; one request per tap)
  async function reverseGeocode({ lat, lng }) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`,
        { headers: { Accept: 'application/json' }, signal: ctl.signal });
      if (!r.ok) throw new Error('lookup failed');
      const a = (await r.json()).address || {};
      // no shop / building names: the phone's position often snaps to the place next door
      const parts = [a.road, a.neighbourhood || a.residential, a.suburb || a.quarter]
        .filter((p, i, all) => p && all.indexOf(p) === i);
      return {
        title: a.neighbourhood || a.suburb || a.quarter || a.road || a.city_district || a.city || a.town || '',
        line2: parts.join(', ').slice(0, 120),
        city: (a.city || a.town || a.village || a.municipality || a.state_district || a.county || '').slice(0, 60),
        pincode: String(a.postcode || '').replace(/\s/g, ''),
      };
    } finally { clearTimeout(timer); }
  }

  // Puts a found address into the form: complete -> show it as a card and leave only the house / flat field
  function showGeo(f, g) {
    f.line2.value = g.line2; f.city.value = g.city; f.pincode.value = g.pincode;
    const short = geoComplete(g);
    document.getElementById('det-title').textContent = g.title || g.city;
    document.getElementById('det-text').textContent = [g.line2, g.city, g.pincode].filter(Boolean).join(', ');
    document.getElementById('addr-detected').hidden = !short;
    document.getElementById('addr-more').hidden = short;
  }

  A.action('addr-edit', (el) => {
    document.getElementById('addr-more').hidden = false;
    el.closest('form').line2.focus();
  });

  A.action('locate', (el) => {
    const text = document.getElementById('loc-text');
    if (!navigator.geolocation) { text.textContent = 'This browser cannot share its location. Enter the address and map position by hand.'; return; }
    el.disabled = true; text.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(async (p) => {
      draftLoc = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
      const f = el.closest('form');
      f.lat.value = draftLoc.lat; f.lng.value = draftLoc.lng;
      text.textContent = 'Finding your address…';
      try {
        draftGeo = await reverseGeocode(draftLoc);
        if (!f.isConnected) return; // left the page meanwhile
        showGeo(f, draftGeo);
        text.innerHTML = geoComplete(draftGeo) ? `${I.check} Location set. Add your house / flat / floor.` : `${I.check} Location set. Check the address below.`;
        f.line1.focus();
      } catch {
        text.innerHTML = `${I.check} Location set. Type the address below.`;
      }
      el.disabled = false;
    }, () => {
      text.textContent = 'Could not read your location. Allow location access, or enter the address by hand.';
      el.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // Returns to the page that sent us here (e.g. the cart) by stepping back, so Back never lands on a finished form;
  // otherwise opens it in place of the current page
  const goTo = (page) => {
    if (A.canGoBack() && A.prevRoute === page.split('/')[0]) { history.back(); return; }
    history.replaceState(null, '', '#/' + page); A.render(); window.scrollTo(0, 0);
  };

  let addrNext = null; // the page that asked for an address to be chosen (e.g. 'checkout')
  A.action('addr-select', (el) => {
    state.addresses.forEach((a) => { a.isDefault = a.id === Number(el.dataset.value); });
    A.clearQuote(); A.save();
    A.toast('Delivery address updated');
    A.renderHeader();
    if (addrNext) goTo(addrNext); else A.refresh();
  });
  A.action('addr-del', (el, e) => {
    e.stopPropagation();
    const id = Number(el.dataset.id);
    const wasDefault = state.addresses.find((a) => a.id === id)?.isDefault;
    state.addresses = state.addresses.filter((a) => a.id !== id);
    if (wasDefault && state.addresses[0]) state.addresses[0].isDefault = true;
    A.clearQuote(); A.save(); A.refresh(); A.renderHeader();
  });
  A.form('address', (f) => {
    const lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
    if (hasLoc && (lat < 6 || lat > 38 || lng < 68 || lng > 98)) return A.toast('That map position is not in India. Check it and try again.');
    if (!/^[1-9]\d{5}$/.test(f.pincode.value.trim())) return A.toast('Enter a 6-digit PIN code');
    const addr = {
      id: Date.now(), label: f.label.value,
      line1: f.line1.value.trim(), line2: f.line2.value.trim() || null, landmark: f.landmark.value.trim() || null,
      city: f.city.value.trim(), pincode: f.pincode.value.trim(),
      lat: hasLoc ? lat : null, lng: hasLoc ? lng : null, isDefault: true,
    };
    state.addresses.forEach((a) => { a.isDefault = false; });
    state.addresses.push(addr);
    draftLoc = null; draftGeo = null;
    A.clearQuote(); A.save();
    A.toast(hasLoc || A.demo ? 'Address saved' : 'Address saved. Add its location before ordering delivery.');
    A.renderHeader();
    goTo(f.dataset.next || 'addresses'); // back to the cart (or the address list)
  });

  /* ---------- Profile (the mobile number is the verified one; change it by verifying again) ---------- */
  A.route('account', {
    render() {
      const u = A.signedIn() ? state.user : null;
      const body = u ? `
        <div class="page-head flat"><h1>Profile</h1></div>
        <form class="card" data-form="profile">
          <div class="profile-top"><span class="avatar lg">${A.initials(u.name || u.phone)}</span><div><strong>${esc(u.name || 'Add your name')}</strong><small class="muted">${esc(u.phone)} · verified</small></div></div>
          <div class="fields two">
            <label class="field"><span>Full name (shown to the restaurant)</span><input name="name" value="${esc(u.name || '')}" maxlength="60" autocomplete="name" /></label>
            <div class="field static"><span>Phone</span><div class="field-row"><b>${esc(u.phone)}</b><span class="tag soft green">${I.check} Verified</span><button type="button" class="link" data-action="change-number">Change</button></div></div>
          </div>
          <div class="form-btns"><button class="btn">Save changes</button></div>
        </form>`
        : signInHTML('account');
      return A.accountPage('account', body, 'is-home');
    },
  });
  A.form('profile', (f) => {
    state.user = { ...state.user, name: f.name.value.trim() };
    A.save();
    A.toast('Profile updated');
    A.refresh();
  });

  /* ---------- Sign in ---------- */
  function signInHTML(next) {
    const fromCart = next === 'checkout';
    return `
      <div class="page-head flat">${fromCart ? `<button class="icon-btn" data-action="back" aria-label="Back">${I.back}</button>` : ''}<h1>${fromCart ? 'Login to place your order' : 'Sign in'}</h1></div>
      <div class="card" data-next="${esc(next)}">
        <p class="muted">${fromCart ? 'Enter your mobile number. We send a 6-digit code to verify it, then take you back to your cart.' : 'Verify your mobile number to order and track your food. The restaurant only takes cash orders from verified numbers.'}</p>
        ${A.signedIn() ? `<p>You are signed in as <b>${esc(state.user.phone)}</b>.</p><a class="btn" href="#/${esc(next)}">Continue</a>` : A.contactHTML()}
      </div>`;
  }
  A.route('login', {
    render(next = 'account') {
      // already signed in (e.g. came back with Back): go straight on
      if (A.signedIn() && next === 'checkout') { setTimeout(() => goTo(next)); return ''; }
      return next === 'checkout'
        ? `<section class="page container narrow focus-page">${signInHTML(next)}</section>`
        : A.accountPage('account', signInHTML(next));
    },
    mount() { document.querySelector('.page input[type="tel"], .page [name="code"]')?.focus(); },
  });

  /* ---------- Add delivery address (its own page; saves and goes back) ---------- */
  A.route('address-new', {
    render(next = 'addresses') {
      if (next === 'checkout' && !A.signedIn()) { setTimeout(() => goTo('login/checkout')); return ''; }
      return `
        <section class="page container narrow focus-page">
          ${A.pageHead('Add delivery address')}
          <div class="card">
            ${next === 'checkout' ? '<p class="muted">Where should we deliver your order? We save it for next time.</p>' : ''}
            ${A.addressForm({ next })}
          </div>
        </section>`;
    },
    mount() {
      document.querySelector('[name="line1"]')?.focus();
      // Like the delivery apps: if location access is already allowed, fill the address straight away
      if (!draftLoc && navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((s) => { if (s.state === 'granted') document.querySelector('[data-action="locate"]')?.click(); })
          .catch(() => {});
      }
    },
  });

  /* ---------- Addresses ---------- */
  A.route('addresses', {
    render(next) {
      addrNext = next || null;
      const fromCart = next === 'checkout';
      return A.accountPage('addresses', `
        <div class="page-head flat">${fromCart ? `<button class="icon-btn" data-action="back" aria-label="Back">${I.back}</button>` : mBack}<h1>${fromCart ? 'Choose address' : 'Addresses'}</h1>
          <a class="btn sm" href="#/address-new/${fromCart ? 'checkout' : 'addresses'}">${I.plus} New<span class="xs-hide">&nbsp;address</span></a></div>
        ${state.addresses.length ? `<div class="tiles stack">
          ${state.addresses.map((a) => A.tile({
            action: 'addr-select', value: a.id, selected: a.isDefault, icon: A.ADDRESS_ICONS[a.label] || I.pin,
            title: esc(a.label) + (a.isDefault ? ' <span class="tag soft orange">Default</span>' : ''),
            sub: esc(A.addressText(a)) + (a.lat == null && !A.demo ? ' · <span class="err">no map location</span>' : ''),
            extra: `<button class="icon-btn sm" data-action="addr-del" data-id="${a.id}" aria-label="Delete address">${I.trash}</button>`,
          })).join('')}
        </div>` : A.empty('📍', 'No saved addresses', 'Add an address to get your food delivered.', { href: '#/address-new/addresses', label: 'Add address' })}`);
    },
  });

  /* ---------- Favourites ---------- */
  A.route('favourites', {
    render() {
      const favs = ITEMS.filter((i) => state.favs.has(i.id));
      return A.accountPage('favourites', `
        <div class="page-head flat">${mBack}<h1>Favourites</h1></div>
        ${favs.length ? `<div class="pgrid">${favs.map(cardHTML).join('')}</div>`
          : A.empty('❤️', 'No favourites yet', 'Tap the heart on any dish to save it here.', { href: '#/', label: 'Browse the menu' })}`);
    },
    update() { A.refresh(); },
  });

  /* ---------- Notifications ---------- */
  A.route('notifications', {
    render() {
      const list = state.notifications;
      return A.accountPage('notifications', `
        <div class="page-head flat">${mBack}<h1>Notifications</h1></div>
        ${list.length ? `<ul class="notes">${list.map((n) => `
          <li class="${n.read ? '' : 'unread'}">
            <span class="side-ico notifications">${I.bell}</span>
            <div class="grow"><strong>${esc(n.title)}</strong><p class="muted">${esc(n.text)}</p><small class="muted">${fmtDate(n.date)}</small></div>
          </li>`).join('')}</ul>`
        : A.empty('🔔', 'All caught up', 'Updates about your orders show up here.')}`);
    },
    mount() {
      // Mark as read after showing the unread highlight once
      if (A.unreadCount()) { state.notifications.forEach((n) => { n.read = true; }); A.save(); }
    },
  });

  /* ---------- Help ---------- */
  A.route('help', {
    render() {
      return A.accountPage('help', `
        <div class="page-head flat">${mBack}<h1>Help & support</h1></div>
        <div class="faq">
          ${FAQS.map((f) => `<details><summary>${esc(f.q)}${I.chevDown}</summary><p>${esc(f.a)}</p></details>`).join('')}
        </div>
        ${A.demo ? '<p class="muted small credits">Demo photos from Wikimedia Commons: <a class="link" href="images/demo/CREDITS.md" target="_blank" rel="noopener">photo credits</a>.</p>' : ''}`);
    },
  });
})(App);
