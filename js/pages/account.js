// Account hub and its sub-pages: profile, addresses, payments, favourites, notifications, help, sign in
(function (A) {
  const { I, state, esc, fmtDate, cardHTML, listRow, option } = A;

  const initials = (name) => name.split(' ').filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const signInPrompt = (next) =>
    A.empty('🔐', 'Sign in required', 'Sign in to manage your account.', { href: `#/login/${next}`, label: 'Sign in' });

  /* ---------- Account hub ---------- */
  A.route('account', {
    tab: 'account',
    tabbar: true,
    render() {
      const u = state.user;
      const unread = A.unreadCount();
      return `
        <section class="page panel account">
          ${A.header('My Account', { back: false })}
          ${u ? `
            <div class="profile-card">
              <div class="avatar lg">${initials(u.name)}</div>
              <div class="grow"><strong>${esc(u.name)}</strong><small>${esc(u.phone)}${u.email ? ' · ' + esc(u.email) : ''}</small></div>
              <a class="icon-btn glass" href="#/profile" aria-label="Edit profile">${I.edit}</a>
            </div>`
          : `
            <div class="profile-card">
              <div class="avatar lg">${I.user}</div>
              <div class="grow"><strong>Welcome to Foodie</strong><small>Sign in to order and track deliveries</small></div>
              <a class="btn-white" href="#/login/account">Sign in</a>
            </div>`}

          <div class="stats">
            <a href="#/orders"><strong>${state.orders.length}</strong><small>Orders</small></a>
            <a href="#/favourites"><strong>${state.favs.size}</strong><small>Favourites</small></a>
            <a href="#/addresses"><strong>${state.addresses.length}</strong><small>Addresses</small></a>
          </div>

          <div class="list-group">
            ${listRow({ href: '#/orders', icon: I.ordersO, title: 'My Orders', sub: 'Track, reorder and view receipts' })}
            ${listRow({ href: '#/favourites', icon: I.heart, title: 'Favourites', sub: 'Dishes you love' })}
            ${listRow({ href: '#/addresses', icon: I.pinO, title: 'Saved Addresses', sub: esc(A.defaultAddress().line) })}
            ${listRow({ href: '#/payments', icon: I.card, title: 'Payment Methods', sub: esc(A.paymentById(state.payment).title) })}
          </div>
          <div class="list-group">
            ${listRow({ href: '#/notifications', icon: I.bell, title: 'Notifications', right: unread ? `<b class="count">${unread}</b>` : '' })}
            ${listRow({ href: '#/profile', icon: I.edit, title: 'Edit Profile' })}
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

  /* ---------- Edit profile ---------- */
  A.route('profile', {
    tab: 'account',
    render() {
      const u = state.user;
      return `
        <section class="page panel narrow">
          ${A.header('Edit Profile')}
          ${!u ? signInPrompt('profile') : `
            <div class="avatar xl">${initials(u.name)}</div>
            <form class="form" data-form="profile">
              <label class="field"><span>Full name</span><input class="input" name="name" value="${esc(u.name)}" required autocomplete="name" /></label>
              <label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" value="${esc(u.phone)}" required autocomplete="tel" /></label>
              <label class="field"><span>Email</span><input class="input" name="email" type="email" value="${esc(u.email || '')}" placeholder="you@example.com" autocomplete="email" /></label>
              <button class="btn block">Save changes</button>
            </form>`}
        </section>`;
    },
  });

  A.form('profile', (f) => {
    state.user = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() };
    A.save();
    A.toast('Profile updated');
    location.hash = '#/account';
  });

  /* ---------- Addresses ---------- */
  A.route('addresses', {
    tab: 'account',
    render() {
      return `
        <section class="page panel narrow">
          ${A.header('Saved Addresses')}
          <div class="options">
            ${state.addresses.map((a) => option({
              action: 'addr-select', value: a.id, selected: a.isDefault,
              icon: A.ADDRESS_ICONS[a.label] || I.pinO, title: esc(a.label),
              sub: esc(a.line + (a.details ? ' · ' + a.details : '')),
              extra: state.addresses.length > 1 ? `<button class="icon-btn sm soft del" data-action="addr-del" data-id="${a.id}" aria-label="Delete address">${I.trash}</button>` : '',
            })).join('')}
          </div>

          <form class="form box" data-form="address">
            <h2 class="h-sm">Add new address</h2>
            <div class="chips wrap">
              ${['Home', 'Work', 'Other'].map((l, i) => `
                <label class="chip radio-chip"><input type="radio" name="label" value="${l}" ${i === 2 ? 'checked' : ''} /> ${l}</label>`).join('')}
            </div>
            <label class="field"><span>Street address</span><input class="input" name="line" required placeholder="E.g. Jumeirah Beach Road" autocomplete="street-address" /></label>
            <label class="field"><span>Apartment, floor, notes</span><input class="input" name="details" placeholder="Optional" /></label>
            <button class="btn block">Save address</button>
          </form>
        </section>`;
    },
  });

  A.action('addr-select', (el) => {
    state.addresses.forEach((a) => { a.isDefault = a.id === Number(el.dataset.value); });
    A.save(); A.toast('Delivery address updated');
    // Coming from checkout? Go back there.
    if (A.prevRoute === 'checkout') history.back(); else A.refresh();
  });
  A.action('addr-del', (el) => {
    const id = Number(el.dataset.id);
    const wasDefault = state.addresses.find((a) => a.id === id).isDefault;
    state.addresses = state.addresses.filter((a) => a.id !== id);
    if (wasDefault) state.addresses[0].isDefault = true;
    A.save(); A.refresh();
  });
  A.form('address', (f) => {
    const addr = { id: Date.now(), label: f.label.value, line: f.line.value.trim(), details: f.details.value.trim(), isDefault: true };
    state.addresses.forEach((a) => { a.isDefault = false; });
    state.addresses.push(addr);
    A.save(); A.toast('Address saved'); A.refresh();
  });

  /* ---------- Payment methods ---------- */
  A.route('payments', {
    tab: 'account',
    render() {
      return `
        <section class="page panel narrow">
          ${A.header('Payment Methods')}
          <div class="options">
            ${PAYMENT_METHODS.map((p) => option({ action: 'pay-select', value: p.id, selected: state.payment === p.id, icon: A.PAYMENT_ICONS[p.type], title: p.title, sub: p.sub })).join('')}
          </div>
          <p class="note">${I.help} Demo site: no real payments are processed. Your default method is pre-selected at checkout.</p>
        </section>`;
    },
  });
  A.action('pay-select', (el) => {
    state.payment = el.dataset.value; A.save();
    A.toast('Default payment updated');
    if (A.prevRoute === 'checkout') history.back(); else A.refresh();
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
          : A.empty('🔔', 'All caught up', 'We’ll let you know about orders and offers.')}
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
          <h2 class="h-sm gap">Contact us</h2>
          <div class="list-group">
            <div class="list-row static"><span class="lr-ico">${I.mail}</span><span class="grow"><strong>Email</strong><small class="muted">support@foodie.example</small></span></div>
            <div class="list-row static"><span class="lr-ico">${I.phone}</span><span class="grow"><strong>Phone</strong><small class="muted">+971 4 000 0000 · 8am–11pm</small></span></div>
            ${listRow({ action: 'toast', icon: I.chat, title: 'Live chat', sub: 'Usually replies in 2 minutes', attrs: 'data-msg="Live chat coming soon"' })}
          </div>
        </section>`;
    },
  });

  /* ---------- Sign in (demo: phone + any 4-digit code) ---------- */
  let pending = null;

  A.route('login', {
    render(next) {
      return `
        <section class="page panel narrow login">
          ${A.header('Sign In')}
          <div class="login-hero"><span class="brand-dot"></span><h1>Foodie</h1><p class="muted">Good food, delivered fast.</p></div>
          ${!pending ? `
            <form class="form" data-form="login" data-next="${esc(next || 'account')}">
              <label class="field"><span>Full name</span><input class="input" name="name" required placeholder="Your name" autocomplete="name" /></label>
              <label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" required placeholder="+971 50 123 4567" autocomplete="tel" /></label>
              <button class="btn block">Send code</button>
            </form>`
          : `
            <form class="form" data-form="otp" data-next="${esc(next || 'account')}">
              <p class="muted center">Enter the 4-digit code sent to <b>${esc(pending.phone)}</b></p>
              <input class="input otp" name="code" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="••••" autocomplete="one-time-code" />
              <button class="btn block">Verify &amp; continue</button>
              <button type="button" class="link center" data-action="login-reset">Use a different number</button>
            </form>`}
          <p class="note">${I.help} Demo sign-in: any 4-digit code works. Nothing is sent to a server.</p>
        </section>`;
    },
    mount() { document.querySelector('.login input')?.focus(); },
  });

  A.form('login', (f) => {
    pending = { name: f.name.value.trim(), phone: f.phone.value.trim() };
    A.toast('Code sent (demo: use any 4 digits)');
    A.refresh();
  });
  A.form('otp', (f) => {
    if (!/^\d{4}$/.test(f.code.value)) return A.toast('Enter a 4-digit code');
    state.user = { ...pending, email: '' };
    pending = null;
    A.save();
    A.toast(`Welcome, ${state.user.name.split(' ')[0]}!`);
    history.replaceState(null, '', '#/' + f.dataset.next);
    A.render();
  });
  A.action('login-reset', () => { pending = null; A.refresh(); });
})(App);
