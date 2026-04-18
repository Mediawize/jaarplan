function escHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function typeKleur(type) {
  switch (type) {
    case 'Theorie': return 'badge-blue';
    case 'Opdracht': return 'badge-green';
    case 'Toets': return 'badge-amber';
    case 'Praktijk': return 'badge-red';
    case 'Project': return 'badge-blue';
    case 'Groepsopdracht': return 'badge-green';
    default: return 'badge-gray';
  }
}

function getCurrentWeek() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function weekInRange(weken, week) {
  if (!weken) return false;
  if (String(weken).includes('-')) {
    const [start, end] = String(weken).split('-').map(n => parseInt(n.trim(), 10));
    return week >= start && week <= end;
  }
  return parseInt(weken, 10) === week;
}

function openModal(content) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal-box" id="modal-box">${content}</div>`;
  overlay.style.display = 'flex';
}

function closeModal(event) {
  if (event.target.id === 'modal-overlay') {
    closeModalDirect();
  }
}

function closeModalDirect() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}

function renderShell() {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-bg">
      <div class="login-grid"></div>
    </div>
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-mark">JP</span>
        <div>
          <div class="logo-title">JaarPlan</div>
          <div class="logo-sub">Docentenplatform</div>
        </div>
      </div>
      <h1 class="login-heading">Welkom terug</h1>
      <p class="login-desc">Log in om je jaarplanning te bekijken en te beheren.</p>
      <div id="login-error" class="login-error" style="display:none"></div>
      <div class="form-field">
        <label>E-mailadres</label>
        <input type="email" id="login-email" placeholder="naam@school.nl" autocomplete="email">
      </div>
      <div class="form-field">
        <label>Wachtwoord</label>
        <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn-login" onclick="doLogin()">Inloggen</button>
      <div class="login-demo">
        <p>Demo accounts:</p>
        <div class="demo-accounts">
          <button onclick="fillDemo('admin@school.nl','admin123')">🔑 Beheerder</button>
          <button onclick="fillDemo('docent@school.nl','docent123')">👨‍🏫 Docent</button>
          <button onclick="fillDemo('management@school.nl','mgmt123')">👔 Management</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('app-shell').innerHTML = `
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <span class="logo-mark-sm">JP</span>
        <span class="logo-text">JaarPlan</span>
      </div>

      <div class="nav-group" id="nav-main">
        <div class="nav-label">Overzicht</div>
        <a class="nav-item" data-view="dashboard" onclick="showView('dashboard')">
          <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
          Dashboard
        </a>
        <a class="nav-item" data-view="klassen" onclick="showView('klassen')">
          <svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Klassen
        </a>
      </div>

      <div class="nav-group" id="nav-planning">
        <div class="nav-label">Planning</div>
        <a class="nav-item" data-view="jaarplanning" onclick="showView('jaarplanning')">
          <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Jaarplanning
        </a>
      </div>

      <div class="nav-group" id="nav-admin" style="display:none">
        <div class="nav-label">Beheer</div>
        <a class="nav-item" data-view="gebruikers" onclick="showView('gebruikers')">
          <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 18c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Gebruikers
        </a>
      </div>

      <div class="sidebar-footer">
        <div class="user-info" id="user-info-sidebar"></div>
        <button class="btn-logout" onclick="doLogout()">
          <svg viewBox="0 0 20 20" fill="none"><path d="M13 3h4v14h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Uitloggen
        </button>
      </div>
    </nav>

    <main class="main-content">
      <div id="view-dashboard" class="view"></div>
      <div id="view-klassen" class="view" style="display:none"></div>
      <div id="view-jaarplanning" class="view" style="display:none"></div>
      <div id="view-opdrachten" class="view" style="display:none"></div>
      <div id="view-toetsen" class="view" style="display:none"></div>
      <div id="view-gebruikers" class="view" style="display:none"></div>
      <div id="view-vakken" class="view" style="display:none"></div>
    </main>
  `;
}

function updateSidebar() {
  const user = Auth.currentUser;
  const info = document.getElementById('user-info-sidebar');
  if (info && user) {
    info.innerHTML = `<strong>${escHtml(user.naam)}</strong>${escHtml(user.email)}<br>${escHtml(user.rol)}`;
  }

  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) {
    navAdmin.style.display = Auth.isAdmin() ? 'block' : 'none';
  }
}

function showView(view) {
  const views = [
    'dashboard',
    'klassen',
    'jaarplanning',
    'opdrachten',
    'toetsen',
    'gebruikers',
    'vakken'
  ];

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  if (view === 'dashboard') renderDashboard();
  if (view === 'klassen') renderKlassen();
  if (view === 'jaarplanning') renderJaarplanning();

  if (view === 'gebruikers') {
    const el = document.getElementById('view-gebruikers');
    el.innerHTML = `<div class="empty-state"><h3>Nog niet gekoppeld</h3><p>Dit onderdeel voeg je later toe.</p></div>`;
  }

  if (view === 'opdrachten') {
    const el = document.getElementById('view-opdrachten');
    el.innerHTML = `<div class="empty-state"><h3>Nog niet gekoppeld</h3><p>Gebruik voorlopig Jaarplanning voor opdrachten.</p></div>`;
  }

  if (view === 'toetsen') {
    const el = document.getElementById('view-toetsen');
    el.innerHTML = `<div class="empty-state"><h3>Nog niet gekoppeld</h3><p>Dit onderdeel voeg je later toe.</p></div>`;
  }

  if (view === 'vakken') {
    const el = document.getElementById('view-vakken');
    el.innerHTML = `<div class="empty-state"><h3>Nog niet gekoppeld</h3><p>Dit onderdeel voeg je later toe.</p></div>`;
  }
}

function startApp() {
  renderShell();

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';

  updateSidebar();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  renderShell();

  if (Auth.init()) {
    startApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  }
});
