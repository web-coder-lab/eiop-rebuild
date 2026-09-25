const apiBase = '/api/v1';
const publicRoutes = new Set(['/welcome', '/login', '/register', '/help', '/legal', '/download']);
const aliases = { '/': null, '/privacy': '/legal', '/terms': '/legal', '/privacy-terms': '/legal' };
const workspace = new Set(['/reels','/videos','/live','/store','/events','/wallet','/coins','/subscriptions','/seller','/creator','/business','/developer','/community-control','/explore','/search','/saved','/notifications','/communities','/messages']);

const state = {
  route: location.pathname || '/welcome',
  user: null,
  theme: localStorage.getItem('eiop_theme') || 'system',
  banner: '',
  auth: { mode: 'login', step: 'email', email: '', otp: '', fullName: '', username: '', password: '', message: '', error: '' },
  busy: false,
  feed: [],
  communities: [],
  community: null,
  conversations: [],
  conversation: null,
  messages: [],
  notifications: [],
  profile: null,
  search: { q: '', posts: [], communities: [], users: [] },
  media: [],
  mediaItem: null,
  apk: { status: 'checking', message: '', available: false, bytes: 0 },
  products: [],
  events: [],
  wallet: null,
  orders: [],
  dash: null,
  controlList: [],
  control: null,
  settingsAccount: { readReceipts: true, onlineVisible: true, notifyMessages: true, notifyCommunity: true },
  loadError: '',
};

function applyTheme() {
  const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme === 'system' ? sys : state.theme;
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.addEventListener('online', () => { state.banner = ''; render(); });
window.addEventListener('offline', () => { state.banner = 'You are offline. This page stays open.'; render(); });

async function api(path, opts = {}) {
  const res = await fetch(apiBase + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code || String(res.status);
    err.status = res.status;
    throw err;
  }
  return data.data;
}

function go(path) {
  const next = aliases[path] || path;
  const resolved = next === null ? (state.user ? '/home' : '/welcome') : next;
  state.route = resolved;
  if (location.pathname !== resolved) history.pushState({ route: resolved }, '', resolved);
  render();
}
window.addEventListener('popstate', () => { state.route = location.pathname; render(); });

async function restore() {
  try { const data = await api('/auth/me'); state.user = data.user; }
  catch { state.user = null; }
  if (location.pathname === '/') go(state.user ? '/home' : '/welcome');
  else render();
}

function needsAuth(route) {
  if (publicRoutes.has(route) || route.startsWith('/help') || route.startsWith('/legal')) return false;
  if (route === '/home' || route.startsWith('/settings') || route === '/profile' || route === '/create') return true;
  if (['/wallet','/coins','/subscriptions','/messages','/notifications','/saved','/community-control','/seller','/creator','/business','/developer'].includes(route)) return true;
  return false;
}

function nav(id, label) {
  return `<button class="${state.route === id || (id === '/home' && state.route === '/') ? 'active' : ''}" data-go="${id}">${label}</button>`;
}

function layout(content) {
  return `
    <div class="wrap">
      ${state.banner ? `<div class="banner">${esc(state.banner)}</div>` : ''}
      <header class="top">
        <button class="brand" data-go="${state.user ? '/home' : '/welcome'}"><i class="mark">EIOP</i><span><b>Everything IOP</b><span>one identity</span></span></button>
        <div class="row">
          <button class="btn ghost" data-theme-cycle>${state.theme}</button>
          ${state.user ? `<button class="btn ghost" data-go="/settings">Settings</button>` : `<button class="btn primary" data-go="/login">Log in</button>`}
        </div>
      </header>
      <div class="shell">
        <aside class="side">
          ${nav('/home','Home')}
          ${nav('/communities','Communities')}
          ${nav('/messages','Messages')}
          ${nav('/notifications','Notifications')}
          ${nav('/profile','Profile')}
          ${nav('/reels','Reels')}
          ${nav('/settings','Settings')}
          ${nav('/settings/security','Security')}
          ${nav('/store','Store')}
          ${nav('/events','Events')}
          ${nav('/wallet','Wallet')}
          ${nav('/community-control','Community control')}
          ${nav('/seller','Seller')}
          ${nav('/creator','Creator')}
          ${nav('/download','App download')}
          ${nav('/help','Help')}
          ${nav('/legal','Privacy & Terms')}
        </aside>
        <main class="main">${content}</main>
      </div>
      <nav class="tabs">
        ${nav('/home','Home')}${nav('/communities','Communities')}${nav('/messages','Messages')}${nav('/profile','Profile')}
      </nav>
    </div>`;
}

function welcome() {
  return layout(`
    <p class="note">EIOP</p>
    <h1 class="hero">One account for feed, communities, messages and tools.</h1>
    <p class="lede">Create an account with email. We send a one-time code. After the account exists, log in once to confirm it. No second app skin. No fake data if a service is down.</p>
    <div class="row" style="margin-top:22px">
      <button class="btn primary" data-go="/register">Create account</button>
      <button class="btn ghost" data-go="/login">Log in</button>
    </div>`);
}

function authView() {
  const a = state.auth;
  const register = state.route === '/register' || a.mode === 'register';
  const recovery = location.search.includes('recovery') || a.mode === 'recovery';
  const title = recovery ? 'Reset password' : register ? 'Create account' : 'Log in';
  let body = '';
  if (register && a.step === 'email') body = `
    <label>Email<input id="f-email" type="email" value="${esc(a.email)}" autocomplete="email" /></label>
    <button class="btn primary wide" data-otp>Send code</button>
    <p class="note">The code arrives from Everything IOP and expires in 10 minutes.</p>`;
  else if (register && a.step === 'otp') body = `
    <label>Code sent to ${esc(a.email)}<input id="f-otp" inputmode="numeric" maxlength="6" value="${esc(a.otp)}" /></label>
    <button class="btn primary wide" data-otp-verify>Verify code</button>`;
  else if (register && a.step === 'profile') body = `
    <label>Name<input id="f-name" value="${esc(a.fullName)}" /></label>
    <label>Username<input id="f-user" value="${esc(a.username)}" /></label>
    <label>Password<input id="f-pass" type="password" /></label>
    <button class="btn primary wide" data-register>Create account</button>`;
  else if (register && a.step === 'confirm') body = `
    <p class="ok">Account created. Log in once to confirm it.</p>
    <label>Email<input id="f-email" value="${esc(a.email)}" /></label>
    <label>Password<input id="f-pass" type="password" /></label>
    <button class="btn primary wide" data-login>Confirm by logging in</button>`;
  else if (recovery && a.step !== 'reset') body = `
    <label>Email<input id="f-email" type="email" value="${esc(a.email)}" /></label>
    <label>Code (after it arrives)<input id="f-otp" inputmode="numeric" maxlength="6" /></label>
    <label>New password<input id="f-pass" type="password" /></label>
    <div class="row"><button class="btn ghost" data-recovery-otp>Send code</button><button class="btn primary" data-recovery>Reset</button></div>`;
  else body = `
    <label>Email or username<input id="f-email" value="${esc(a.email)}" /></label>
    <label>Password<input id="f-pass" type="password" /></label>
    <button class="btn primary wide" data-login>Log in</button>
    <p class="note"><a data-go="/register">Create account</a> · <a data-go="/login?recovery=1">Forgot password</a></p>`;
  return layout(`
    <div class="card grid" style="max-width:420px">
      <h1 class="hero" style="font-size:34px">${title}</h1>
      ${body}
      ${a.error ? `<p class="err">${esc(a.error)}</p>` : ''}
      ${a.message ? `<p class="ok">${esc(a.message)}</p>` : ''}
    </div>`);
}

function page(title, text) {
  return layout(`<h1 class="hero">${title}</h1><p class="lede">${text}</p><div class="card empty">This surface is wired. Data appears when its service is configured — nothing is faked.</div>`);
}

function mediaKindFromRoute() {
  if (state.route.startsWith('/reel')) return 'reel';
  if (state.route.startsWith('/video')) return 'video';
  return 'live';
}

function mediaView() {
  const kind = mediaKindFromRoute();
  if (state.route.split('/').length > 2) {
    const item = state.mediaItem;
    if (state.loadError) return layout(`<h1 class="hero">Media unavailable</h1><p class="lede">${esc(state.loadError)}</p>`);
    if (!item) return layout('<p class="note">Loading media…</p>');
    return layout(`
      <h1 class="hero">${esc(item.title)}</h1>
      <div class="card">
        <video controls playsinline style="width:100%;max-height:70vh;background:#000" src="${esc(item.sourceUrl)}" onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'err',textContent:'This file could not be played. Other pages stay up.'}))"></video>
        ${item.expiresAt ? `<p class="note">Live copy expires ${esc(item.expiresAt)}</p>` : ''}
      </div>`);
  }
  const cards = state.media.map((m) => `<button class="card" style="width:100%;text-align:left;margin-top:10px" data-go="/${kind}/${m.id}"><b>${esc(m.title)}</b><p class="note">${esc(m.kind)}</p></button>`).join('') || '<div class="card empty">No media yet.</div>';
  return layout(`
    <h1 class="hero">${kind[0].toUpperCase()+kind.slice(1)}s</h1>
    ${state.user ? `<div class="card grid"><label>Title<input id="f-mtitle"/></label><label>HTTPS media URL<input id="f-murl"/></label><button class="btn primary" data-mcreate="${kind}">Publish ${kind}</button></div>` : ''}
    ${cards}`);
}

function apkView() {
  const a = state.apk;
  return layout(`
    <h1 class="hero">Android app</h1>
    <p class="lede">Download only starts if the server has a real APK. A click never pretends the file arrived.</p>
    <div class="card grid">
      <p class="note">Status: ${esc(a.status)}${a.bytes ? ` · ${a.bytes} bytes` : ''}</p>
      ${a.message ? `<p class="${a.available ? 'ok' : 'err'}">${esc(a.message)}</p>` : ''}
      <button class="btn primary" data-apk ${a.available ? '' : 'disabled'}>${a.available ? 'Download APK' : 'Unavailable'}</button>
    </div>`);
}

function settings() {
  const s = state.settingsAccount;
  return layout(`
    <h1 class="hero">Settings</h1>
    <div class="card grid">
      <p class="note">Theme stays on this device. The toggles below save to your account.</p>
      <div class="row">
        <button class="btn ghost" data-theme="light">Light</button>
        <button class="btn ghost" data-theme="dark">Dark</button>
        <button class="btn ghost" data-theme="system">System</button>
      </div>
      <label><input type="checkbox" data-setting="readReceipts" ${s.readReceipts?'checked':''}/> Read receipts</label>
      <label><input type="checkbox" data-setting="onlineVisible" ${s.onlineVisible?'checked':''}/> Show online status</label>
      <label><input type="checkbox" data-setting="notifyMessages" ${s.notifyMessages?'checked':''}/> Message notifications</label>
      <label><input type="checkbox" data-setting="notifyCommunity" ${s.notifyCommunity?'checked':''}/> Community notifications</label>
      ${state.loadError ? `<p class="err">${esc(state.loadError)}</p>` : ''}
      <button class="btn ghost" data-go="/settings/security">Security center</button>
      <button class="btn ghost" data-logout>Log out this device</button>
      <button class="btn ghost" data-logoutall>Log out everywhere</button>
    </div>`);
}

function security() {
  return layout(`<h1 class="hero">Security</h1>
    <div class="card grid">
      <p class="lede">This page stays closed until you are logged in. Sessions come from the server, not a demo list.</p>
      <label>Current password<input id="f-cur" type="password"/></label>
      <label>New password<input id="f-new" type="password"/></label>
      <button class="btn primary" data-pwchange>Change password</button>
      <div id="sessions" class="note">Loading sessions…</div>
    </div>`);
}

function help() {
  return layout(`<h1 class="hero">Help</h1><div class="card lede">
    <p>Home is the feed after login. Communities, messages and profile stay in this same shell.</p>
    <p>404 means the page or item does not exist. Offline keeps you on the same page. A down content service is unavailable, not a 404.</p>
    <p>Payments, when enabled, live on Firebase. Posts, reels and chats stay on private storage.</p>
  </div>`);
}

function legal() {
  return layout(`<h1 class="hero">Privacy & Terms</h1><div class="card lede">
    <p>Payment records can be stored in Firebase so web and app stay in sync.</p>
    <p>Reels, videos, messages and other content stay on EIOP private storage and are not sold as a public dataset.</p>
    <p>Use the product lawfully. Do not share OTP codes. Sessions can be revoked from Security.</p>
  </div>`);
}

function home() {
  const name = state.user?.fullName || 'there';
  const items = state.feed.map((p) => `
    <article class="card" style="margin-top:12px">
      <p class="note">${esc(p.author?.fullName || '')} · @${esc(p.author?.username || '')}</p>
      <p>${esc(p.content)}</p>
      <div class="row">
        <button class="btn ghost" data-like="${p.id}">${p.liked ? 'Liked' : 'Like'} ${p.likeCount || 0}</button>
        <button class="btn ghost" data-save="${p.id}">${p.saved ? 'Saved' : 'Save'}</button>
        ${p.authorId === state.user?.id ? `<button class="btn ghost" data-delpost="${p.id}">Delete</button>` : ''}
      </div>
    </article>`).join('') || '<div class="card empty">No posts yet. Write the first one.</div>';
  return layout(`
    <h1 class="hero">Hello, ${esc(name)}.</h1>
    <div class="card grid">
      <label>New post<textarea id="f-post" rows="3" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--bg);color:var(--ink)"></textarea></label>
      <button class="btn primary" data-post>Publish</button>
      ${state.loadError ? `<p class="err">${esc(state.loadError)}</p>` : ''}
    </div>
    ${items}`);
}

function communitiesView() {
  if (state.route.startsWith('/communities/') && state.route !== '/communities') {
    const c = state.community;
    if (!c) return layout('<p class="note">Loading community…</p>');
    const member = state.user && c.memberIds?.includes(state.user.id);
    return layout(`
      <h1 class="hero">${esc(c.name)}</h1>
      <p class="lede">${esc(c.description || '')}</p>
      <p class="note">${(c.memberIds||[]).length} members</p>
      ${state.user ? `<button class="btn primary" data-joinleave="${c.id}">${member ? 'Leave' : 'Join'}</button>` : ''}
      ${state.user && c.ownerId === state.user.id ? `<button class="btn ghost" data-go="/community-control">Community control</button>` : ''}
    `);
  }
  const list = state.communities.map((c) => `<button class="card" style="width:100%;text-align:left;margin-top:10px" data-go="/communities/${c.id}"><b>${esc(c.name)}</b><p class="note">${esc(c.description||'')}</p></button>`).join('') || '<div class="card empty">No communities yet.</div>';
  return layout(`
    <h1 class="hero">Communities</h1>
    ${state.user ? `<div class="card grid"><label>Name<input id="f-cname"/></label><label>Description<input id="f-cdesc"/></label><button class="btn primary" data-ccreate>Create</button></div>` : ''}
    ${list}`);
}

function messagesView() {
  const convos = state.conversations.map((c) => {
    const other = (c.members||[]).find((m) => m.id !== state.user?.id) || {};
    return `<button class="card" style="width:100%;text-align:left;margin-top:10px" data-openchat="${c.id}">${esc(other.fullName || other.username || 'Chat')}</button>`;
  }).join('') || '<div class="card empty">No conversations. Open a profile and message them.</div>';
  const thread = state.messages.map((m) => `<p><b>${esc(m.author?.username || '')}:</b> ${esc(m.text)}</p>`).join('');
  return layout(`
    <h1 class="hero">Messages</h1>
    <div class="grid">
      ${convos}
      ${state.conversation ? `<div class="card">${thread || '<p class="note">No messages yet.</p>'}<label>Reply<input id="f-msg"/></label><button class="btn primary" data-sendmsg>Send</button></div>` : ''}
    </div>`);
}

function notificationsView() {
  const list = state.notifications.map((n) => `<p>${esc(n.text)} · ${n.read ? 'read' : 'new'}</p>`).join('') || '<p class="note">No notifications.</p>';
  return layout(`<h1 class="hero">Notifications</h1><div class="card">${list}<button class="btn ghost" data-readall>Mark all read</button></div>`);
}

function profileView() {
  const p = state.profile;
  if (!p) return layout('<p class="note">Loading profile…</p>');
  const u = p.user;
  const mine = state.user && u.id === state.user.id;
  const posts = (p.posts||[]).map((item) => `<article class="card" style="margin-top:10px"><p>${esc(item.content)}</p></article>`).join('') || '<p class="note">No posts.</p>';
  return layout(`
    <h1 class="hero">${esc(u.fullName)}</h1>
    <p class="lede">@${esc(u.username)} · ${p.followers} followers · ${p.following} following</p>
    ${!mine && state.user ? `<div class="row"><button class="btn primary" data-follow="${u.username}">Follow</button><button class="btn ghost" data-messageuser="${u.id}">Message</button></div>` : ''}
    ${posts}`);
}

function searchView() {
  const s = state.search;
  return layout(`
    <h1 class="hero">Search</h1>
    <div class="card grid">
      <label>Query<input id="f-q" value="${esc(s.q)}"/></label>
      <button class="btn primary" data-search>Search</button>
    </div>
    ${(s.users||[]).map((u)=>`<button class="card" style="width:100%;margin-top:8px;text-align:left" data-go="/users/${u.username}">${esc(u.fullName)} @${esc(u.username)}</button>`).join('')}
    ${(s.communities||[]).map((c)=>`<button class="card" style="width:100%;margin-top:8px;text-align:left" data-go="/communities/${c.id}">${esc(c.name)}</button>`).join('')}
    ${(s.posts||[]).map((p)=>`<div class="card" style="margin-top:8px">${esc(p.content)}</div>`).join('')}
  `);
}

function storeView() {
  const cards = (state.products||[]).map((p) => `<div class="card" style="margin-top:10px"><b>${esc(p.title)}</b><p class="note">${esc(p.description||'')} · ${p.price}</p>${state.user && p.sellerId!==state.user.id ? `<button class="btn primary" data-buy="${p.id}">Buy</button>`:''}</div>`).join('') || '<div class="card empty">No listings yet.</div>';
  return layout(`<h1 class="hero">Store</h1>
    ${state.user?`<div class="card grid"><label>Title<input id="f-ptitle"/></label><label>Description<input id="f-pdesc"/></label><label>Price<input id="f-pprice" type="number"/></label><button class="btn primary" data-plist>List item</button></div>`:''}
    ${cards}`);
}
function eventsView() {
  const cards = (state.events||[]).map((e) => `<div class="card" style="margin-top:10px"><b>${esc(e.title)}</b><p class="note">${esc(e.details||'')} · ${esc(e.startsAt||'')}</p></div>`).join('') || '<div class="card empty">No events yet.</div>';
  return layout(`<h1 class="hero">Events</h1>
    ${state.user?`<div class="card grid"><label>Title<input id="f-etitle"/></label><label>Details<input id="f-edetail"/></label><button class="btn primary" data-ecreate>Create event</button></div>`:''}
    ${cards}`);
}
function walletView() {
  const w = state.wallet || {};
  const orders = (state.orders||[]).map((o) => `<p>${esc(o.status)} · ${esc(o.productId)}</p>`).join('') || '<p class="note">No orders.</p>';
  return layout(`<h1 class="hero">Wallet & coins</h1>
    <div class="card"><p>Coins: ${w.coins ?? 0}</p><p class="note">Payments ledger: ${esc(w.payments || 'unknown')}. Money records go to Firebase when the console database exists. Coins are not cash.</p>${orders}</div>`);
}
function controlView() {
  const list = (state.controlList||[]).map((c) => `<button class="card" style="width:100%;margin-top:8px;text-align:left" data-opencontrol="${c.id}">${esc(c.name)}</button>`).join('') || '<div class="card empty">You do not own a community yet.</div>';
  const panel = state.control ? `<div class="card grid"><p>${(state.control.members||[]).length} members</p><label>Rules<textarea id="f-rules" rows="4">${esc(state.control.rules||'')}</textarea></label><button class="btn primary" data-saverules="${state.control.community.id}">Save rules</button></div>` : '';
  return layout(`<h1 class="hero">Community control</h1><p class="lede">Owner-scoped only. There is no platform admin.</p>${list}${panel}`);
}
function dashView(title, extra) {
  const d = state.dash || {};
  return layout(`<h1 class="hero">${title}</h1><div class="card">${Object.entries(d).map(([k,v])=>`<p>${esc(k)}: ${esc(v)}</p>`).join('') || extra}</div>`);
}
function notFound() {
  return layout(`<h1 class="hero">Page not found</h1><p class="lede">This route does not exist. The app is still online.</p><button class="btn primary" data-go="/home">Back to Home</button>`);
}

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function screen() {
  const r = state.route;
  if (needsAuth(r) && !state.user) {
    state.auth.mode = 'login';
    return authView();
  }
  if (r === '/welcome') return welcome();
  if (r === '/login' || r === '/register') return authView();
  if (r === '/home') return home();
  if (r === '/communities' || r.startsWith('/communities/')) return communitiesView();
  if (r === '/messages') return messagesView();
  if (r === '/notifications') return notificationsView();
  if (r === '/search' || r === '/explore') return searchView();
  if (r === '/saved') return home();
  if (r === '/profile' || r.startsWith('/users/')) return profileView();
  if (r === '/settings') return settings();
  if (r === '/settings/security') return security();
  if (r === '/help') return help();
  if (r === '/legal') return legal();
  if (r === '/download') return apkView();
  if (r.startsWith('/reel') || r.startsWith('/video') || r === '/live' || r.startsWith('/live/')) return mediaView();
  if (r === '/store') return storeView();
  if (r === '/events') return eventsView();
  if (r === '/wallet' || r === '/coins' || r === '/subscriptions') return walletView();
  if (r === '/community-control') return controlView();
  if (r === '/creator' || r === '/business' || r === '/developer') return dashView('Creator / business', 'Counts come from your posts.');
  if (r === '/seller') return dashView('Seller center', 'Listings and orders.');
  if (workspace.has(r)) return page(r.slice(1).replace(/-/g,' '), 'Workspace inside the same shell.');
  return notFound();
}

async function loadRoute() {
  state.loadError = '';
  try {
    if (state.route === '/home') state.feed = await api('/feed') || [];
    if (state.route === '/saved' && state.user) state.feed = await api('/saved') || [];
    if (state.route === '/communities') state.communities = await api('/communities') || [];
    if (state.route.startsWith('/communities/') && state.route !== '/communities') {
      state.community = await api('/communities/' + state.route.split('/')[2]);
    }
    if (state.route === '/messages' && state.user) state.conversations = await api('/conversations') || [];
    if (state.route === '/notifications' && state.user) state.notifications = await api('/notifications') || [];
    if (state.route === '/profile' && state.user) state.profile = await api('/users/' + state.user.username);
    if (state.route.startsWith('/users/')) state.profile = await api('/users/' + state.route.split('/')[2]);
    if (state.route === '/reels') state.media = await api('/reels') || [];
    if (state.route === '/videos') state.media = await api('/videos') || [];
    if (state.route === '/live') state.media = await api('/live') || [];
    if (state.route.startsWith('/reel/')) state.mediaItem = await api('/reels/' + state.route.split('/')[2]);
    if (state.route.startsWith('/video/')) state.mediaItem = await api('/videos/' + state.route.split('/')[2]);
    if (state.route.startsWith('/live/')) state.mediaItem = await api('/live/' + state.route.split('/')[2]);
    if (state.route === '/store') state.products = await api('/products') || [];
    if (state.route === '/events') state.events = await api('/events') || [];
    if ((state.route === '/wallet' || state.route === '/coins' || state.route === '/subscriptions') && state.user) {
      state.wallet = await api('/wallet');
      state.orders = await api('/orders') || [];
    }
    if (state.route === '/community-control' && state.user) state.controlList = await api('/community-control') || [];
    if (state.route === '/creator' && state.user) state.dash = await api('/creator/dashboard');
    if (state.route === '/seller' && state.user) state.dash = await api('/seller/dashboard');
    if (state.route === '/business' && state.user) state.dash = await api('/creator/dashboard');
    if (state.route === '/developer' && state.user) state.dash = await api('/creator/dashboard');
    if (state.route === '/settings' && state.user) state.settingsAccount = await api('/settings');
    if (state.route === '/download') {
      state.apk = { status: 'checking', message: '', available: false, bytes: 0 };
      const info = await api('/download/apk/status');
      state.apk = {
        status: info.available ? 'available' : 'unavailable',
        available: Boolean(info.available),
        bytes: info.bytes || 0,
        message: info.available ? 'The APK is on the server.' : 'No APK file is installed on the server.',
      };
    }
  } catch (e) {
    state.loadError = e.message;
    if (e.status === 404) state.community = null;
  }
}

function render() {
  document.getElementById('app').innerHTML = screen();
  loadRoute().then(() => { document.getElementById('app').innerHTML = screen(); hookSecurity(); });
  hookSecurity();
}

function hookSecurity() {
  if (state.route === '/settings/security' && state.user) {
    api('/auth/sessions').then((rows) => {
      const el = document.getElementById('sessions');
      if (!el) return;
      const list = Array.isArray(rows) ? rows : [];
      el.innerHTML = list.length ? list.map((s) => `${esc(s.device)} · ${s.isCurrent ? 'this device' : 'other'} ${s.revoked ? '(revoked)' : ''}`).join('<br>') : 'No other sessions.';
    }).catch((e) => {
      const el = document.getElementById('sessions');
      if (el) el.textContent = e.message;
    });
  }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-go],[data-otp],[data-otp-verify],[data-register],[data-login],[data-logout],[data-logoutall],[data-theme],[data-theme-cycle],[data-recovery],[data-recovery-otp],[data-post],[data-like],[data-save],[data-delpost],[data-ccreate],[data-joinleave],[data-openchat],[data-sendmsg],[data-readall],[data-follow],[data-messageuser],[data-search],[data-mcreate],[data-apk],[data-pwchange],[data-plist],[data-buy],[data-ecreate],[data-opencontrol],[data-saverules]');
  if (!t) return;
  if (t.dataset.go) {
    if (t.dataset.go === '/register') { state.auth = { ...state.auth, mode: 'register', step: 'email', error: '' }; }
    if (t.dataset.go.startsWith('/login')) { state.auth = { ...state.auth, mode: t.dataset.go.includes('recovery') ? 'recovery' : 'login', step: 'email', error: '' }; }
    go(t.dataset.go.split('?')[0]);
    if (t.dataset.go.includes('recovery')) history.replaceState({}, '', '/login?recovery=1');
    return;
  }
  if (t.dataset.theme) { state.theme = t.dataset.theme; localStorage.setItem('eiop_theme', state.theme); applyTheme(); render(); return; }
  if (t.dataset.themeCycle !== undefined) {
    state.theme = state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'system' : 'light';
    localStorage.setItem('eiop_theme', state.theme); applyTheme(); render(); return;
  }
  const val = (id) => document.getElementById(id)?.value || '';
  if (state.busy) return;
  try {
    state.busy = true;
    state.auth.error = '';
    if (t.dataset.otp !== undefined) {
      state.auth.email = val('f-email');
      const res = await api('/auth/signup/otp/request', { method: 'POST', body: { email: state.auth.email } });
      state.auth.step = 'otp';
      state.auth.message = res.devCode ? `Dev code: ${res.devCode}` : 'Check your email for the EIOP code.';
    } else if (t.dataset.otpVerify !== undefined) {
      state.auth.otp = val('f-otp');
      await api('/auth/signup/otp/verify', { method: 'POST', body: { email: state.auth.email, code: state.auth.otp } });
      state.auth.step = 'profile';
      state.auth.message = 'Email verified. Set your profile, then log in.';
    } else if (t.dataset.register !== undefined) {
      state.auth.fullName = val('f-name');
      state.auth.username = val('f-user');
      await api('/auth/register', { method: 'POST', body: { email: state.auth.email, otp: state.auth.otp, fullName: state.auth.fullName, username: state.auth.username, password: val('f-pass') } });
      state.auth.step = 'confirm';
      state.auth.mode = 'login';
      state.auth.message = 'Account created. Log in to confirm.';
      history.replaceState({}, '', '/login');
      state.route = '/login';
    } else if (t.dataset.login !== undefined) {
      const data = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: val('f-email') || state.auth.email, password: val('f-pass') } });
      state.user = data.user;
      go('/home');
      return;
    } else if (t.dataset.recoveryOtp !== undefined) {
      state.auth.email = val('f-email');
      const res = await api('/auth/recovery/request', { method: 'POST', body: { email: state.auth.email } });
      state.auth.message = res.devCode ? `Dev code: ${res.devCode}` : 'If that inbox can be used, a code is on the way.';
    } else if (t.dataset.recovery !== undefined) {
      await api('/auth/recovery/confirm', { method: 'POST', body: { email: val('f-email'), otp: val('f-otp'), password: val('f-pass') } });
      state.auth.mode = 'login';
      state.auth.step = 'email';
      state.auth.message = 'Password updated. Log in.';
      go('/login');
      return;
    } else if (t.dataset.post !== undefined) {
      await api('/posts', { method: 'POST', body: { content: val('f-post') } });
    } else if (t.dataset.like) {
      await api('/posts/' + t.dataset.like + '/reactions', { method: 'POST', body: { type: 'like' } });
    } else if (t.dataset.save) {
      await api('/posts/' + t.dataset.save + '/save', { method: 'POST' });
    } else if (t.dataset.delpost) {
      await api('/posts/' + t.dataset.delpost, { method: 'DELETE' });
    } else if (t.dataset.ccreate !== undefined) {
      const created = await api('/communities', { method: 'POST', body: { name: val('f-cname'), description: val('f-cdesc') } });
      go('/communities/' + created.id); return;
    } else if (t.dataset.joinleave) {
      const id = t.dataset.joinleave;
      const member = state.community?.memberIds?.includes(state.user.id);
      await api('/communities/' + id + (member ? '/leave' : '/join'), { method: 'POST' });
    } else if (t.dataset.openchat) {
      state.conversation = t.dataset.openchat;
      state.messages = await api('/conversations/' + state.conversation + '/messages') || [];
    } else if (t.dataset.sendmsg !== undefined) {
      await api('/conversations/' + state.conversation + '/messages', { method: 'POST', body: { text: val('f-msg') } });
      state.messages = await api('/conversations/' + state.conversation + '/messages') || [];
    } else if (t.dataset.readall !== undefined) {
      await api('/notifications/read-all', { method: 'POST' });
    } else if (t.dataset.follow) {
      await api('/users/' + t.dataset.follow + '/follow', { method: 'POST' });
    } else if (t.dataset.messageuser) {
      const conv = await api('/conversations', { method: 'POST', body: { userId: t.dataset.messageuser } });
      state.conversation = conv.id;
      go('/messages'); return;
    } else if (t.dataset.search !== undefined) {
      state.search.q = val('f-q');
      state.search = { q: state.search.q, ...(await api('/search?q=' + encodeURIComponent(state.search.q))) };
    } else if (t.dataset.mcreate) {
      const created = await api('/media', { method: 'POST', body: { kind: t.dataset.mcreate, title: val('f-mtitle'), sourceUrl: val('f-murl') } });
      go('/' + created.kind + '/' + created.id); return;
    } else if (t.dataset.apk !== undefined) {
      state.apk.status = 'downloading';
      state.apk.message = 'Downloading…';
      render();
      const res = await fetch('/api/v1/download/apk', { credentials: 'include' });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('application/json')) {
        const body = await res.json().catch(() => ({}));
        state.apk.status = 'failed';
        state.apk.available = false;
        state.apk.message = body?.error?.message || 'Download failed.';
      } else {
        const blob = await res.blob();
        if (blob.type.includes('html') || blob.size < 100) {
          state.apk.status = 'failed';
          state.apk.message = 'Server did not return an APK file.';
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'eiop.apk'; a.click();
          state.apk.status = 'downloaded';
          state.apk.message = 'Saved eiop.apk (' + blob.size + ' bytes).';
        }
      }
    } else if (t.dataset.plist !== undefined) {
      await api('/products', { method: 'POST', body: { title: val('f-ptitle'), description: val('f-pdesc'), price: Number(val('f-pprice')||0) } });
    } else if (t.dataset.buy) {
      await api('/products/' + t.dataset.buy + '/buy', { method: 'POST' });
      state.auth.message = 'Order created. Payment waits for the gateway.';
    } else if (t.dataset.ecreate !== undefined) {
      await api('/events', { method: 'POST', body: { title: val('f-etitle'), details: val('f-edetail') } });
    } else if (t.dataset.opencontrol) {
      state.control = await api('/communities/' + t.dataset.opencontrol + '/control');
    } else if (t.dataset.saverules) {
      await api('/communities/' + t.dataset.saverules + '/rules', { method: 'PATCH', body: { rules: document.getElementById('f-rules')?.value || '' } });
      state.control = await api('/communities/' + t.dataset.saverules + '/control');
    } else if (t.dataset.pwchange !== undefined) {
      await api('/auth/password', { method: 'POST', body: { current: val('f-cur'), next: val('f-new') } });
      state.loadError = '';
      state.auth.message = 'Password changed.';
    } else if (t.dataset.logoutall !== undefined) {
      await api('/auth/logout-all', { method: 'POST' });
      state.user = null;
      state.settingsAccount = { readReceipts: true, onlineVisible: true, notifyMessages: true, notifyCommunity: true };
      go('/welcome'); return;
    } else if (t.dataset.logout !== undefined) {
      await api('/auth/logout', { method: 'POST' });
      state.user = null;
      state.settingsAccount = { readReceipts: true, onlineVisible: true, notifyMessages: true, notifyCommunity: true };
      go('/welcome');
      return;
    }
  } catch (err) {
    if (err.status === 503) state.banner = err.message;
    state.auth.error = err.message;
    state.loadError = err.message;
  } finally {
    state.busy = false;
  }
  render();
});

restore();
