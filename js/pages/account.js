// Account hub and its sub-pages: profile, addresses, payments, favourites, notifications, help, sign in (OTP from the hub)
(function (A) {
  const { I, state, esc, fmtDate, cardHTML, listRow, option } = A;

  const initials = (name) => (name || '?').split(' ').filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const signInPrompt = (next) =>
    A.empty('🔐', 'Sign in required', 'Sign in with your mobile number to continue.', { href: `#/login/${next}`, label: 'Sign in' });
  const signedIn = () => Boolean(state.user?.otpToken);

  /* ---------- Account hub ---------- */
  A.route('account', {
    tab: 'account',
    tabbar: true,
    render() {
      const u = signedIn() ? state.user : null;
      const unread = A.unreadCount();
      const addr = A.defaultAddress();
      return `
        <section class="page panel account">
          ${A.header('My Account', { back: false })}
          ${u ? `
            <div class="profile-card">
              <div class="avatar lg">${initials(u.name || u.phone)}</div>
              <div class="grow"><strong>${esc(u.name || 'Your name')}</strong><small>${esc(u.phone)} · verified</small></div>
              <a class="icon-btn glass" href="#/profile" aria-label="Edit profile">${I.edit}</a>
            </div>`
          : `
            <div class="profile-card">
              <div class="avatar lg">${I.user}</div>
              <div class="grow"><strong>Welcome to ${esc(A.shop.name)}</strong><small>Sign in to order and track your food</small></div>
              <a class="btn-white" href="#/login/account">Sign in</a>
            </div>`}

          <div class="stats">
            <a href="#/orders"><strong>${state.orders.length}</strong><small>Orders</small></a>
            <a href="#/favourites"><strong>${state.favs.size}</strong><small>Favourites</small></a>
            <a href="#/addresses"><strong>${state.addresses.length}</strong><small>Addresses</small></a>
          </div>

          <div class="list-group">
            ${listRow({ href: '#/orders', icon: I.ordersO, title: 'My Orders', sub: 'Track and reorder' })}
            ${listRow({ href: '#/favourites', icon: I.heart, title: 'Favourites', sub: 'Dishes you love' })}
            ${listRow({ href: '#/addresses', icon: I.pinO, title: 'Saved Addresses', sub: addr ? esc(addr.line1) : 'Add a delivery address' })}
            ${listRow({ href: '#/payments', icon: I.cash, title: 'Payment', sub: 'Cash on delivery or at pickup' })}
          </div>
          <div class="list-group">
            ${listRow({ href: '#/notifications', icon: I.bell, title: 'Notifications', right: unread ? `<b class="count">${unread}</b>` : '' })}
            ${u ? listRow({ href: '#/profile', icon: I.edit, title: 'Edit Profile' }) : ''}
            ${listRow({ href: '#/help', icon: I.help, title: 'Help & Support' })}
          </div>
          ${u ? `<div class="list-group">${listRow({ action: 'logout', icon: I.logout, title: 'Sign out', danger: true })}</div>` : ''}
        </section>`;
    },
  });

  A.action('logout', () => {
    state.user = null; A.save();
    A.toast('Signed out');
    A.refresh();
  });

  /* ---------- Edit profile (the mobile number is the verified one; change it by signing in again) ---------- */
  A.route('profile', {
    tab: 'account',
    render() {
      const u = state.user;
      return `
        <section class="page panel narrow">
          ${A.header('Edit Profile')}
          ${!signedIn() ? signInPrompt('profile') : `
            <div class="avatar xl">${initials(u.name || u.phone)}</div>
            <form class="form" data-form="profile">
              <label class="field"><span>Name (shown to the restaurant)</span><input class="input" name="name" value="${esc(u.name || '')}" maxlength="60" autocomplete="name" /></label>
              <label class="field"><span>Mobile number (verified)</span><input class="input" value="${esc(u.phone)}" disabled /></label>
              <button class="btn block">Save changes</button>
              <button type="button" class="link center" data-action="change-number">Use a different mobile number</button>
            </form>`}
        </section>`;
    },
  });

  A.form('profile', (f) => {
    state.user = { ...state.user, name: f.name.value.trim() };
    A.save();
    A.toast('Profile updated');
    history.back();
  });
  A.action('change-number', () => { state.user = null; A.save(); location.hash = '#/login/account'; });

  /* ---------- Addresses (delivery needs the map location; the hub uses it for distance and fee) ---------- */
  let draftLoc = null;

  A.route('addresses', {
    tab: 'account',
    render() {
      return `
        <section class="page panel narrow">
          ${A.header('Saved Addresses')}
          ${state.addresses.length ? `<div class="options">
            ${state.addresses.map((a) => option({
              action: 'addr-select', value: a.id, selected: a.isDefault,
              icon: A.ADDRESS_ICONS[a.label] || I.pinO, title: esc(a.label) + (a.lat == null ? ' <small class="err">· no location</small>' : ''),
              sub: esc(A.addressText(a)),
              extra: `<button class="icon-btn sm soft del" data-action="addr-del" data-id="${a.id}" aria-label="Delete address">${I.trash}</button>`,
            })).join('')}
          </div>` : '<p class="muted">No saved addresses yet.</p>'}

          <form class="form box" data-form="address">
            <h2 class="h-sm">Add new address</h2>
            <div class="chips wrap">
              ${['Home', 'Work', 'Other'].map((l, i) => `
                <label class="chip radio-chip"><input type="radio" name="label" value="${l}" ${i === 0 ? 'checked' : ''} /> ${l}</label>`).join('')}
            </div>
            <div class="loc-pick">
              <button type="button" class="btn ghost block" data-action="locate">${I.pinO} Use my current location</button>
              <small class="muted" id="loc-text">${draftLoc ? `Location set (${draftLoc.lat}, ${draftLoc.lng})` : 'Needed for delivery: stand at the address, or enter the map position below.'}</small>
              <details>
                <summary class="link">Enter the map position by hand</summary>
                <div class="row2">
                  <label class="field"><span>Latitude</span><input class="input" name="lat" inputmode="decimal" value="${draftLoc?.lat ?? ''}" placeholder="12.9716" /></label>
                  <label class="field"><span>Longitude</span><input class="input" name="lng" inputmode="decimal" value="${draftLoc?.lng ?? ''}" placeholder="77.5946" /></label>
                </div>
              </details>
            </div>
            <label class="field"><span>House / flat, building, street</span><input class="input" name="line1" required maxlength="120" autocomplete="address-line1" /></label>
            <label class="field"><span>Area (optional)</span><input class="input" name="line2" maxlength="120" autocomplete="address-line2" /></label>
            <label class="field"><span>Landmark (optional)</span><input class="input" name="landmark" maxlength="80" /></label>
            <div class="row2">
              <label class="field"><span>City</span><input class="input" name="city" required maxlength="60" autocomplete="address-level2" /></label>
              <label class="field"><span>PIN code</span><input class="input" name="pincode" required inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6" autocomplete="postal-code" /></label>
            </div>
            <button class="btn block">Save address</button>
          </form>
        </section>`;
    },
  });

  A.action('locate', (el) => {
    const text = document.getElementById('loc-text');
    if (!navigator.geolocation) { text.textContent = 'This browser cannot share its location. Enter the map position by hand.'; return; }
    el.disabled = true; text.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition((p) => {
      draftLoc = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
      const f = el.closest('form');
      f.lat.value = draftLoc.lat; f.lng.value = draftLoc.lng;
      text.textContent = `Location set (${draftLoc.lat}, ${draftLoc.lng})`;
      el.disabled = false;
    }, () => {
      text.textContent = 'Could not read your location. Allow location access, or enter the map position by hand.';
      el.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000 });
  });

  A.action('addr-select', (el) => {
    state.addresses.forEach((a) => { a.isDefault = a.id === Number(el.dataset.value); });
    A.clearQuote(); A.save(); A.toast('Delivery address updated');
    // Coming from checkout? Go back there.
    if (A.prevRoute === 'checkout') history.back(); else A.refresh();
  });
  A.action('addr-del', (el, e) => {
    e.stopPropagation();
    const id = Number(el.dataset.id);
    const wasDefault = state.addresses.find((a) => a.id === id)?.isDefault;
    state.addresses = state.addresses.filter((a) => a.id !== id);
    if (wasDefault && state.addresses[0]) state.addresses[0].isDefault = true;
    A.clearQuote(); A.save(); A.refresh();
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
    draftLoc = null;
    A.clearQuote(); A.save();
    A.toast(hasLoc ? 'Address saved' : 'Address saved. Add its location before ordering delivery.');
    if (A.prevRoute === 'checkout') history.back(); else A.refresh();
  });

  /* ---------- Payment ---------- */
  A.route('payments', {
    tab: 'account',
    render() {
      return `
        <section class="page panel narrow">
          ${A.header('Payment')}
          <div class="options">
            ${option({ action: 'noop', value: 'cod', selected: true, icon: I.cash, title: 'Cash', sub: 'Pay the rider on delivery, or at the counter when you pick up' })}
            <div class="option disabled"><span class="lr-ico">${I.card}</span><span class="grow"><strong>Online payment (UPI, cards)</strong><small class="muted">Coming soon</small></span></div>
          </div>
        </section>`;
    },
  });

  /* ---------- Favourites ---------- */
  A.route('favourites', {
    tab: 'account',
    render() {
      const favs = ITEMS.filter((i) => state.favs.has(i.id));
      return `
        <section class="page panel">
          ${A.header('Favourites')}
          ${favs.length ? `<div class="grid">${favs.map(cardHTML).join('')}</div>`
            : A.empty('❤️', 'No favourites yet', 'Tap the heart on any dish to save it here.', { href: '#/menu', label: 'Browse menu' })}
        </section>`;
    },
  });

  /* ---------- Notifications ---------- */
  A.route('notifications', {
    tab: 'account',
    render() {
      const list = state.notifications;
      return `
        <section class="page panel narrow">
          ${A.header('Notifications')}
          ${list.length ? `<ul class="notes">${list.map((n) => `
            <li class="${n.read ? '' : 'unread'}">
              <span class="lr-ico">${I.bell}</span>
              <div class="grow"><strong>${esc(n.title)}</strong><p class="muted">${esc(n.text)}</p><small class="muted">${fmtDate(n.date)}</small></div>
            </li>`).join('')}</ul>`
          : A.empty('🔔', 'All caught up', 'We’ll let you know about your orders here.')}
        </section>`;
    },
    mount() {
      // Mark as read after showing the unread highlight once
      if (A.unreadCount()) { state.notifications.forEach((n) => { n.read = true; }); A.save(); }
    },
  });

  /* ---------- Help ---------- */
  A.route('help', {
    tab: 'account',
    render() {
      return `
        <section class="page panel narrow">
          ${A.header('Help & Support')}
          <div class="faq">
            ${FAQS.map((f) => `<details><summary>${esc(f.q)}${I.chevDown}</summary><p>${esc(f.a)}</p></details>`).join('')}
          </div>
        </section>`;
    },
  });

  /* ---------- Sign in: mobile number + 6-digit code from the hub ---------- */
  let pending = null; // { name, phone, devCode }

  A.route('login', {
    render(next) {
      return `
        <section class="page panel narrow login">
          ${A.header('Sign In')}
          <div class="login-hero"><span class="brand-dot"></span><h1>${esc(A.shop.name)}</h1><p class="muted">Verify your mobile number to order.</p></div>
          ${!pending ? `
            <form class="form" data-form="login" data-next="${esc(next || 'account')}">
              <label class="field"><span>Name</span><input class="input" name="name" maxlength="60" placeholder="Your name" autocomplete="name" value="${esc(state.user?.name || '')}" /></label>
              <label class="field"><span>Mobile number</span><input class="input" name="phone" type="tel" required inputmode="numeric" maxlength="14" placeholder="98765 43210" autocomplete="tel" /></label>
              <button class="btn block">Send code</button>
            </form>`
          : `
            <form class="form" data-form="otp" data-next="${esc(next || 'account')}">
              <p class="muted center">Enter the 6-digit code sent to <b>${esc(pending.phone)}</b></p>
              <input class="input otp" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••" autocomplete="one-time-code" />
              ${pending.devCode ? `<p class="note">${I.help} Test mode: your code is <b>${esc(pending.devCode)}</b></p>` : ''}
              <button class="btn block">Verify &amp; continue</button>
              <button type="button" class="link center" data-action="login-resend">Send the code again</button>
              <button type="button" class="link center" data-action="login-reset">Use a different number</button>
            </form>`}
        </section>`;
    },
    mount() { document.querySelector('.login input')?.focus(); },
  });

  async function sendCode(name, phone) {
    const r = await Hub.sendOtp(phone);
    pending = { name, phone, devCode: r.devCode || null };
  }

  A.form('login', async (f) => {
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await sendCode(f.name.value.trim(), f.phone.value.trim());
      A.toast('Code sent');
      A.refresh();
    } catch (e) { A.toast(e.message); btn.disabled = false; }
  });
  A.action('login-resend', async () => {
    try { await sendCode(pending.name, pending.phone); A.toast('A new code is on its way'); A.refresh(); } catch (e) { A.toast(e.message); }
  });
  A.form('otp', async (f) => {
    if (!/^\d{6}$/.test(f.code.value)) return A.toast('Enter the 6-digit code');
    const btn = f.querySelector('button.btn'); btn.disabled = true;
    try {
      const r = await Hub.verifyOtp(pending.phone, f.code.value);
      state.user = { name: pending.name, phone: r.mobile, otpToken: r.otpToken };
      pending = null;
      A.save();
      A.toast(state.user.name ? `Welcome, ${state.user.name.split(' ')[0]}!` : 'Mobile number verified');
      history.replaceState(null, '', '#/' + f.dataset.next);
      A.render();
    } catch (e) { A.toast(e.message); btn.disabled = false; }
  });
  A.action('login-reset', () => { pending = null; A.refresh(); });
})(App);
