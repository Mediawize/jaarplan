// ============================================================
// wachtwoord.js — Wachtwoord schermen
// - Verplicht wijzigen bij eerste login (mustChangePassword)
// - Wachtwoord vergeten / reset via e-mail
// - Eigen wachtwoord wijzigen vanuit profiel
// Voeg dit toe als apart <script> in index.html
// ============================================================

// ============================================================
// CHECK NA LOGIN: moet wachtwoord gewijzigd worden?
// Aanroepen vanuit startApp() of na doLogin() succes
// ============================================================
function checkMustChangePassword() {
  if (Auth.currentUser?.mustChangePassword) {
    toonWachtwoordWijzigenScherm(true);
    return true;
  }
  return false;
}

// ============================================================
// SCHERM: Verplicht wachtwoord wijzigen (eerste login)
// ============================================================
function toonWachtwoordWijzigenScherm(verplicht = false) {
  const naam = Auth.currentUser?.naam?.split(' ')[0] || 'Welkom';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-mark">JP</span>
        <div><div class="logo-title">JaarPlan</div><div class="logo-sub">Docentenplatform</div></div>
      </div>
      ${verplicht
        ? `<h1 class="login-heading">Welkom, ${escHtml(naam)}!</h1>
           <p class="login-desc">Je logt voor het eerst in. Kies een persoonlijk wachtwoord om verder te gaan.</p>`
        : `<h1 class="login-heading">Wachtwoord wijzigen</h1>
           <p class="login-desc">Kies een nieuw wachtwoord van minimaal 8 tekens.</p>`
      }
      <div id="ww-error" class="login-error" style="display:none"></div>
      <div id="ww-success" style="display:none;background:#f0fdf4;border:1px solid rgba(22,163,74,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#15803D;margin-bottom:16px"></div>
      ${!verplicht ? `
      <div class="form-field">
        <label>Huidig wachtwoord</label>
        <input type="password" id="ww-huidig" placeholder="••••••••" autocomplete="current-password">
      </div>` : ''}
      <div class="form-field">
        <label>Nieuw wachtwoord *</label>
        <input type="password" id="ww-nieuw" placeholder="Minimaal 8 tekens" autocomplete="new-password">
      </div>
      <div class="form-field">
        <label>Herhaal nieuw wachtwoord *</label>
        <input type="password" id="ww-herhaal" placeholder="••••••••" autocomplete="new-password">
      </div>
      <button class="btn-login" onclick="slaWachtwoordOp(${verplicht})">
        ${verplicht ? 'Wachtwoord instellen en inloggen' : 'Wachtwoord wijzigen'}
      </button>
      ${!verplicht ? `
      <div style="text-align:center;margin-top:16px">
        <button onclick="annuleerWachtwoordWijzigen()" style="background:none;border:none;color:var(--ink-3);font-size:13px;cursor:pointer;text-decoration:underline">Annuleren</button>
      </div>` : ''}
    </div>
  `;
}

async function slaWachtwoordOp(verplicht) {
  const nieuw = document.getElementById('ww-nieuw').value;
  const herhaal = document.getElementById('ww-herhaal').value;
  const huidig = document.getElementById('ww-huidig')?.value || '';
  const errEl = document.getElementById('ww-error');
  const sucEl = document.getElementById('ww-success');
  errEl.style.display = 'none';

  if (nieuw.length < 8) { errEl.textContent = 'Wachtwoord moet minimaal 8 tekens zijn.'; errEl.style.display = 'block'; return; }
  if (nieuw !== herhaal) { errEl.textContent = 'Wachtwoorden komen niet overeen.'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch('/api/auth/wijzig-wachtwoord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ huidigWachtwoord: huidig, nieuwWachtwoord: nieuw }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Er ging iets mis.'; errEl.style.display = 'block'; return; }

    Auth.currentUser.mustChangePassword = false;
    sucEl.textContent = '✓ Wachtwoord succesvol gewijzigd!';
    sucEl.style.display = 'block';

    setTimeout(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-shell').style.display = 'flex';
      if (verplicht) showView('dashboard');
    }, 1000);
  } catch(e) {
    errEl.textContent = 'Verbindingsfout. Probeer opnieuw.';
    errEl.style.display = 'block';
  }
}

function annuleerWachtwoordWijzigen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
}

// ============================================================
// SCHERM: Wachtwoord vergeten
// ============================================================
function toonWachtwoordVergetenScherm() {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-mark">JP</span>
        <div><div class="logo-title">JaarPlan</div><div class="logo-sub">Docentenplatform</div></div>
      </div>
      <h1 class="login-heading">Wachtwoord vergeten</h1>
      <p class="login-desc">Vul je e-mailadres in. Als het bekend is krijg je een e-mail met een resetlink.</p>
      <div id="verg-error" class="login-error" style="display:none"></div>
      <div id="verg-success" style="display:none;background:#f0fdf4;border:1px solid rgba(22,163,74,0.2);border-radius:8px;padding:12px 14px;font-size:13px;color:#15803D;margin-bottom:16px;line-height:1.5"></div>
      <div class="form-field">
        <label>E-mailadres</label>
        <input type="email" id="verg-email" placeholder="naam@school.nl" autocomplete="email">
      </div>
      <button class="btn-login" onclick="vraagResetAan()">Resetlink versturen</button>
      <div style="text-align:center;margin-top:16px">
        <button onclick="renderLoginShell()" style="background:none;border:none;color:var(--ink-3);font-size:13px;cursor:pointer;text-decoration:underline">← Terug naar inloggen</button>
      </div>
    </div>
  `;
}

async function vraagResetAan() {
  const email = document.getElementById('verg-email').value.trim();
  const errEl = document.getElementById('verg-error');
  const sucEl = document.getElementById('verg-success');
  errEl.style.display = 'none';

  if (!email) { errEl.textContent = 'Vul je e-mailadres in.'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch('/api/auth/wachtwoord-vergeten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    // Altijd succes tonen (server geeft altijd 200 terug)
    sucEl.innerHTML = `✓ Als <strong>${escHtml(email)}</strong> bekend is in ons systeem, ontvang je zo een e-mail.<br><span style="font-size:12px;opacity:.8">Controleer ook je spam-map.</span>`;
    sucEl.style.display = 'block';
    document.getElementById('verg-email').disabled = true;
    document.querySelector('.btn-login').disabled = true;
  } catch(e) {
    errEl.textContent = 'Verbindingsfout. Probeer opnieuw.';
    errEl.style.display = 'block';
  }
}

// ============================================================
// SCHERM: Reset wachtwoord via token (vanuit e-mail link)
// Wordt getoond als URL /reset-wachtwoord?token=... bevat
// ============================================================
async function checkResetTokenInUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return false;

  // Toon laadscherm
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-logo"><span class="logo-mark">JP</span><div><div class="logo-title">JaarPlan</div></div></div>
      <p style="text-align:center;color:var(--ink-3)">Link controleren...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/auth/check-reset-token/${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!data.geldig) {
      document.getElementById('login-screen').innerHTML = `
        <div class="login-card">
          <div class="login-logo"><span class="logo-mark">JP</span><div><div class="logo-title">JaarPlan</div></div></div>
          <div class="login-error" style="display:block">Deze resetlink is verlopen of al gebruikt. Vraag een nieuwe aan.</div>
          <button class="btn-login" onclick="renderLoginShell();toonWachtwoordVergetenScherm()" style="margin-top:12px">Nieuwe link aanvragen</button>
        </div>
      `;
      return true;
    }

    // Geldige token — toon reset scherm
    document.getElementById('login-screen').innerHTML = `
      <div class="login-card">
        <div class="login-logo"><span class="logo-mark">JP</span><div><div class="logo-title">JaarPlan</div><div class="logo-sub">Docentenplatform</div></div></div>
        <h1 class="login-heading">Nieuw wachtwoord</h1>
        <p class="login-desc">Hallo ${escHtml(data.naam)}, kies een nieuw wachtwoord.</p>
        <div id="reset-error" class="login-error" style="display:none"></div>
        <div id="reset-success" style="display:none;background:#f0fdf4;border:1px solid rgba(22,163,74,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#15803D;margin-bottom:16px"></div>
        <div class="form-field">
          <label>Nieuw wachtwoord *</label>
          <input type="password" id="reset-nieuw" placeholder="Minimaal 8 tekens" autocomplete="new-password">
        </div>
        <div class="form-field">
          <label>Herhaal wachtwoord *</label>
          <input type="password" id="reset-herhaal" placeholder="••••••••" autocomplete="new-password">
        </div>
        <button class="btn-login" onclick="voerResetUit('${escHtml(token)}')">Wachtwoord instellen</button>
      </div>
    `;
  } catch(e) {
    document.getElementById('login-screen').innerHTML = `
      <div class="login-card">
        <div class="login-error" style="display:block">Er is een fout opgetreden. Probeer opnieuw.</div>
        <button class="btn-login" onclick="renderLoginShell()" style="margin-top:12px">Terug naar inloggen</button>
      </div>
    `;
  }
  return true;
}

async function voerResetUit(token) {
  const nieuw = document.getElementById('reset-nieuw').value;
  const herhaal = document.getElementById('reset-herhaal').value;
  const errEl = document.getElementById('reset-error');
  const sucEl = document.getElementById('reset-success');
  errEl.style.display = 'none';

  if (nieuw.length < 8) { errEl.textContent = 'Wachtwoord moet minimaal 8 tekens zijn.'; errEl.style.display = 'block'; return; }
  if (nieuw !== herhaal) { errEl.textContent = 'Wachtwoorden komen niet overeen.'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch('/api/auth/reset-wachtwoord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, nieuwWachtwoord: nieuw }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Er ging iets mis.'; errEl.style.display = 'block'; return; }

    sucEl.textContent = '✓ Wachtwoord ingesteld! Je wordt doorgestuurd naar inloggen...';
    sucEl.style.display = 'block';
    // Verwijder token uit URL
    window.history.replaceState({}, '', '/app');
    setTimeout(() => renderLoginShell(), 2000);
  } catch(e) {
    errEl.textContent = 'Verbindingsfout. Probeer opnieuw.';
    errEl.style.display = 'block';
  }
}
