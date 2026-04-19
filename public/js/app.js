function escHtml(v){if(v==null)return '';return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function typeKleur(t){const m={'Theorie':'badge-blue','Opdracht':'badge-green','Groepsopdracht':'badge-green','Toets':'badge-amber','Praktijk':'badge-red','Project':'badge-blue','Presentatie':'badge-gray'};return m[t]||'badge-gray';}
function getRolLabel(r){return {'admin':'Beheerder','docent':'Docent','management':'Management'}[r]||r;}
function getCurrentWeek(){const n=new Date(),d=new Date(Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())),dn=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-dn);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y)/86400000)+1)/7);}
function weekInRange(w,wk){if(!w)return false;if(String(w).includes('-')){const[s,e]=String(w).split('-').map(n=>parseInt(n.trim(),10));return wk>=s&&wk<=e;}return parseInt(w,10)===wk;}
function openModal(c){const o=document.getElementById('modal-overlay');o.innerHTML=`<div class="modal-overlay-inner" onclick="closeModal(event)"><div class="modal-box">${c}</div></div>`;o.style.cssText='display:flex;position:fixed;inset:0;z-index:1000;align-items:center;justify-content:center;background:rgba(26,23,20,0.55)';}
function closeModal(e){if(e.target.classList.contains('modal-overlay-inner'))closeModalDirect();}
function closeModalDirect(){const o=document.getElementById('modal-overlay');o.style.display='none';o.innerHTML='';}
function renderShell(){
  document.getElementById('login-screen').innerHTML=`
    <div class="login-bg"><div class="login-grid"></div></div>
    <div class="login-card">
      <div class="login-logo"><span class="logo-mark">JP</span><div><div class="logo-title">JaarPlan</div><div class="logo-sub">Docentenplatform</div></div></div>
      <h1 class="login-heading">Welkom terug</h1>
      <p class="login-desc">Log in om je jaarplanning te bekijken en te beheren.</p>
      <div id="login-error" class="login-error" style="display:none"></div>
      <div class="form-field"><label>E-mailadres</label><input type="email" id="login-email" placeholder="naam@school.nl" autocomplete="email"></div>
      <div class="form-field"><label>Wachtwoord</label><input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password"></div>
      <button class="btn-login" onclick="doLogin()">Inloggen</button>
      <div class="login-demo"><p>Demo accounts:</p><div class="demo-accounts">
        <button onclick="fillDemo('t.nieuweboer@atlascollege.nl','admin123')">🔑 Beheerder</button>
        <button onclick="fillDemo('docent@school.nl','docent123')">👨‍🏫 Docent</button>
        <button onclick="fillDemo('management@school.nl','mgmt123')">👔 Management</button>
      </div></div>
    </div>`;
  document.getElementById('app-shell').innerHTML=`
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-logo"><span class="logo-mark-sm">JP</span><span class="logo-text">JaarPlan</span></div>
      <div class="nav-group">
        <div class="nav-label">Overzicht</div>
        <a class="nav-item" data-view="dashboard" onclick="showView('dashboard')"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</a>
        <a class="nav-item" data-view="klassen" onclick="showView('klassen')"><svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Klassen</a>
      </div>
      <div class="nav-group">
        <div class="nav-label">Planning</div>
        <a class="nav-item" data-view="jaarplanning" onclick="showView('jaarplanning')"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Jaarplanning</a>
        <a class="nav-item" data-view="lesprofielen" onclick="showView('lesprofielen')"><svg viewBox="0 0 20 20" fill="none"><path d="M4 4h12v2H4zM4 9h12v2H4zM4 14h8v2H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Lesprofielen</a>
        <a class="nav-item" data-view="opdrachten" onclick="showView('opdrachten')"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5h10M5 9h10M5 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Opdrachten</a>
        <a class="nav-item" data-view="toetsen" onclick="showView('toetsen')"><svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>Toetsen & Materialen</a>
      </div>
      <div class="nav-group" id="nav-admin" style="display:none">
        <div class="nav-label">Beheer</div>
        <a class="nav-item" data-view="schooljaren" onclick="showView('schooljaren')"><svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16M6 12h2M10 12h2M6 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Schooljaren</a>
        <a class="nav-item" data-view="gebruikers" onclick="showView('gebruikers')"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 18c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Gebruikers</a>
        <a class="nav-item" data-view="vakken" onclick="showView('vakken')"><svg viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5H18l-4.5 3.5 1.5 5.5L10 13l-5 3 1.5-5.5L2 7h5.5L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Vakken</a>
      </div>
      <div class="sidebar-footer">
        <div class="user-info" id="user-info-sidebar"></div>
        <button class="btn-logout" onclick="doLogout()"><svg viewBox="0 0 20 20" fill="none"><path d="M13 3h4v14h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Uitloggen</button>
      </div>
    </nav>
    <main class="main-content">
      <div id="view-dashboard" class="view"></div>
      <div id="view-klassen" class="view" style="display:none"></div>
      <div id="view-jaarplanning" class="view" style="display:none"></div>
      <div id="view-lesprofielen" class="view" style="display:none"></div>
      <div id="view-opdrachten" class="view" style="display:none"></div>
      <div id="view-toetsen" class="view" style="display:none"></div>
      <div id="view-schooljaren" class="view" style="display:none"></div>
      <div id="view-gebruikers" class="view" style="display:none"></div>
      <div id="view-vakken" class="view" style="display:none"></div>
    </main>`;}
function updateSidebar(){const u=Auth.currentUser,i=document.getElementById('user-info-sidebar');if(i&&u)i.innerHTML=`<strong>${escHtml(u.naam)}</strong>${escHtml(u.email)}<br><span style="opacity:.6">${getRolLabel(u.rol)}</span>`;const n=document.getElementById('nav-admin');if(n)n.style.display=Auth.isAdmin()?'block':'none';}
function showView(view){
  ['dashboard','klassen','jaarplanning','lesprofielen','opdrachten','toetsen','schooljaren','gebruikers','vakken'].forEach(v=>{const el=document.getElementById('view-'+v);if(el)el.style.display=v===view?'block':'none';});
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.dataset.view===view));
  const r={dashboard:renderDashboard,klassen:renderKlassen,jaarplanning:renderJaarplanning,lesprofielen:renderLesprofielen,opdrachten:renderOpdrachten,toetsen:renderToetsen,schooljaren:renderSchooljaren,gebruikers:renderGebruikers,vakken:renderVakken};
  if(r[view])r[view]();
}
function startApp(){renderShell();document.getElementById('login-screen').style.display='none';document.getElementById('app-shell').style.display='flex';updateSidebar();showView('dashboard');}
document.addEventListener('DOMContentLoaded',()=>{renderShell();if(Auth.init()){startApp();}else{document.getElementById('login-screen').style.display='flex';document.getElementById('app-shell').style.display='none';}});
