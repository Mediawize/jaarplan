// ============================================================
// app.js — Hoofdmodule, routing, shell
// MOBIEL: showView blokkeert niet-dashboard views op mobiel
// ============================================================

const Auth = {
  currentUser: null,
  isAdmin() { return this.currentUser?.rol === 'admin'; },
  isDocent() { return this.currentUser?.rol === 'docent'; },
  isManagement() { return this.currentUser?.rol === 'management'; },
  canEdit() { return this.isAdmin() || this.isDocent(); },
};

function escHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function typeKleur(t) {
  const m = {
    'Theorie':'badge-blue','Opdracht':'badge-green','Groepsopdracht':'badge-green',
    'Toets':'badge-amber','Eindtoets':'badge-amber',
    'Praktijk':'badge-red','Project':'badge-blue',
    'Presentatie':'badge-gray','Overig':'badge-gray'
  };
  return m[t] || 'badge-gray';
}

function getRolLabel(r) { return {'admin':'Beheerder','docent':'Docent','management':'Management'}[r] || r; }

function getCurrentWeek() {
  const n = new Date(), d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  const dn = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dn);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - y) / 86400000) + 1) / 7);
}

function weekInRange(w, wk) {
  if (!w) return false;
  if (String(w).includes('-')) {
    const [s, e] = String(w).split('-').map(n => parseInt(n.trim(), 10));
    return wk >= s && wk <= e;
  }
  return parseInt(w, 10) === wk;
}

function getInitialen(user) {
  if (!user) return '???';
  if (user.initialen) return user.initialen.toUpperCase().slice(0, 3);
  const delen = [(user.naam || ''), (user.achternaam || '')].join(' ').trim().split(/\s+/);
  if (delen.length >= 3) return (delen[0][0] + delen[1][0] + delen[2][0]).toUpperCase();
  if (delen.length === 2) return (delen[0][0] + delen[0][1] + delen[1][0]).toUpperCase();
  if (delen.length === 1 && delen[0].length >= 3) return delen[0].slice(0, 3).toUpperCase();
  return (delen.join('').slice(0, 3)).toUpperCase().padEnd(3, 'X');
}

function getSchooljaarLabel() {
  const nu = new Date();
  const maand = nu.getMonth() + 1;
  const jaar = nu.getFullYear();
  const startJaar = maand >= 8 ? jaar : jaar - 1;
  return `Schooljaar ${startJaar}–${startJaar + 1}`;
}

function isMobiel() {
  return window.innerWidth <= 768;
}

function showError(msg) {
  const el = document.getElementById('global-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function openModal(content) {
  const o = document.getElementById('modal-overlay');
  o.innerHTML = `<div class="modal-overlay-inner" onclick="closeModal(event)"><div class="modal-box">${content}</div></div>`;
  o.style.cssText = 'display:flex;position:fixed;inset:0;z-index:1000;align-items:center;justify-content:center;background:rgba(26,23,20,0.55)';
}
function closeModal(e) { if (e.target.classList.contains('modal-overlay-inner')) closeModalDirect(); }
function closeModalDirect() { const o = document.getElementById('modal-overlay'); o.style.display = 'none'; o.innerHTML = ''; }

function showLoading(viewId) {
  const el = document.getElementById('view-' + viewId);
  if (el) el.innerHTML = '<div style="padding:60px;text-align:center;color:var(--ink-3)">Laden...</div>';
}


function renderLoginShell() {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-logo"><span class="logo-mark">JP</span><div><div class="logo-title">JaarPlan</div><div class="logo-sub">Docentenplatform</div></div></div>
      <h1 class="login-heading">Welkom terug</h1>
      <p class="login-desc">Log in om je jaarplanning te bekijken en te beheren.</p>
      <div id="login-error" class="login-error" style="display:none"></div>
      <div class="form-field"><label>E-mailadres</label><input type="email" id="login-email" placeholder="naam@school.nl" autocomplete="email"></div>
      <div class="form-field"><label>Wachtwoord</label><input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password"></div>
      <button class="btn-login" onclick="doLogin()">Inloggen</button>
      <div style="text-align:right;margin-top:8px">
        <button onclick="toonWachtwoordVergetenScherm()" style="background:none;border:none;color:var(--ink-3);font-size:13px;cursor:pointer;text-decoration:underline">Wachtwoord vergeten?</button>
      </div>

    </div>
  `;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !pw) { errEl.textContent = 'Vul e-mailadres en wachtwoord in.'; errEl.style.display = 'block'; return; }
  try {
    const result = await API.login(email, pw);
    if (result?.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
    Auth.currentUser = result.user;
    if (!checkMustChangePassword()) {
      startApp();
    }
  } catch (e) {
    errEl.textContent = e.message || 'Inloggen mislukt';
    errEl.style.display = 'block';
  }
}

async function doLogout() {
  await API.logout();
  Auth.currentUser = null;
  Cache.invalidateAll();
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen')?.style.display !== 'none') doLogin();
});

function renderAppShell() {
  document.getElementById('app-shell').innerHTML = `
    <div id="global-error" style="display:none;position:fixed;top:70px;right:16px;z-index:9999;background:var(--red-dim);color:var(--red-text);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;max-width:320px;box-shadow:var(--shadow)"></div>
    <div class="mobile-header">
      <div class="mobile-logo"><div class="logo-mark-sm">JP</div>JaarPlan</div>
      <button class="hamburger" onclick="toggleSidebar()" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-logo"><span class="logo-mark-sm">JP</span><span class="logo-text">JaarPlan</span></div>
      <div class="nav-group">
        <div class="nav-label">Overzicht</div>
        <a class="nav-item" data-view="dashboard" onclick="showView('dashboard');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</a>
        <a class="nav-item" data-view="klassen" onclick="showView('klassen');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Klassen</a>
        <a class="nav-item" data-view="rooster" onclick="showView('rooster');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16M6 12h2M10 12h2M14 12h2M6 15h2M10 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Mijn rooster</a>
      </div>
      <div class="nav-group">
        <div class="nav-label">Planning</div>
        <a class="nav-item" data-view="jaarplanning" onclick="showView('jaarplanning');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Jaarplanning</a>
        <a class="nav-item" data-view="lesprofielen" onclick="showView('lesprofielen');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h8M6 11h8M6 15h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Lesprofielen</a>
        <a class="nav-item" data-view="taken" onclick="showView('taken');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Taken</a>
        <a class="nav-item" data-view="opdrachten" onclick="showView('opdrachten');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5h10M5 9h10M5 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Opdrachten</a>
        <a class="nav-item" data-view="toetsen" onclick="showView('toetsen');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Toetsen & Materialen</a>
      </div>
      <div class="nav-group" id="nav-admin" style="display:none">
        <div class="nav-label">Beheer</div>
        <a class="nav-item" data-view="schooljaren" onclick="showView('schooljaren');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Schooljaren</a>
        <a class="nav-item" data-view="gebruikers" onclick="showView('gebruikers');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 18c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Gebruikers</a>
        <a class="nav-item" data-view="vakken" onclick="showView('vakken');closeSidebar()"><svg viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5H18l-4.5 3.5 1.5 5.5L10 13l-5 3 1.5-5.5L2 7h5.5L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Vakken</a>
        <a class="nav-item" onclick="closeSidebar();openInstellingenModal()"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Instellingen</a>
      </div>
      <div class="sidebar-footer">
        <div class="user-info" id="user-info-sidebar"></div>
        <button class="btn-logout" onclick="doLogout()"><svg viewBox="0 0 20 20" fill="none"><path d="M13 3h4v14h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Uitloggen</button>
      </div>
    </nav>
    <main class="main-content">
      <div id="view-dashboard" class="view"></div>
      <div id="view-klassen" class="view" style="display:none"></div>
      <div id="view-rooster" class="view" style="display:none"></div>
      <div id="view-jaarplanning" class="view" style="display:none"></div>
      <div id="view-lesprofielen" class="view" style="display:none"></div>
      <div id="view-taken" class="view" style="display:none"></div>
      <div id="view-opdrachten" class="view" style="display:none"></div>
      <div id="view-toetsen" class="view" style="display:none"></div>
      <div id="view-schooljaren" class="view" style="display:none"></div>
      <div id="view-gebruikers" class="view" style="display:none"></div>
      <div id="view-vakken" class="view" style="display:none"></div>
    </main>
    <!-- Bottom nav: op mobiel alleen dashboard knop -->
    <nav class="bottom-nav" id="bottom-nav">
      <button class="bottom-nav-item active" data-view="dashboard" onclick="showView('dashboard')">
        <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
        <span>Dashboard</span>
      </button>
      <button class="bottom-nav-item" onclick="doLogout()">
        <svg viewBox="0 0 20 20" fill="none"><path d="M13 3h4v14h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Uitloggen</span>
      </button>
    </nav>
    <div id="modal-overlay" style="display:none"></div>
  `;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function updateSidebar() {
  const u = Auth.currentUser;
  const info = document.getElementById('user-info-sidebar');
  if (info && u) info.innerHTML = `<strong>${escHtml(u.naam)}</strong>${escHtml(u.email)}<br><span style="opacity:.6">${getRolLabel(u.rol)}</span>`;
  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) navAdmin.style.display = Auth.isAdmin() ? 'block' : 'none';
}

// MOBIEL: alleen dashboard beschikbaar
// Op desktop: alle views beschikbaar
function showView(view) {
  const mobiel = isMobiel();

  // Op mobiel altijd naar dashboard sturen
  if (mobiel && view !== 'dashboard') {
    view = 'dashboard';
  }

  const views = ['dashboard','klassen','rooster','jaarplanning','lesprofielen','taken','opdrachten','toetsen','schooljaren','gebruikers','vakken'];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });

  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));

  const renderers = {
    dashboard: renderDashboard,
    klassen: renderKlassen,
    rooster: renderRooster,
    jaarplanning: renderJaarplanning,
    lesprofielen: renderLesprofielen,
    taken: renderTaken,
    opdrachten: renderOpdrachten,
    toetsen: renderToetsen,
    schooljaren: renderSchooljaren,
    gebruikers: renderGebruikers,
    vakken: renderVakken
  };
  if (renderers[view]) renderers[view]();
}

function startApp() {
  renderAppShell();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  updateSidebar();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', async () => {
  renderLoginShell();
  try {
    const { user } = await API.getSession();
    if (user) {
      Auth.currentUser = user;
      if (!checkMustChangePassword()) {
        startApp();
      }
    } else {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app-shell').style.display = 'none';
    }
  } catch {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  }
});
