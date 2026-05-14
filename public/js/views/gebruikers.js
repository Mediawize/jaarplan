// ============================================================
// gebruikers.js — Gebruikersbeheer
// ============================================================

let _guRolFilter = '';

async function renderGebruikers() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-gebruikers').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`;
    return;
  }
  showLoading('gebruikers');
  try {
    const [gebruikers, vakken] = await Promise.all([API.getGebruikers(), API.getVakken()]);
    window._guGebruikers = gebruikers;
    window._guVakken    = vakken;

    const docenten    = gebruikers.filter(g => g.rol === 'docent').length;
    const admins      = gebruikers.filter(g => g.rol === 'admin').length;
    const management  = gebruikers.filter(g => g.rol === 'management').length;
    const tijdelijk   = gebruikers.filter(g => g.mustChangePassword).length;

    document.getElementById('view-gebruikers').innerHTML = `
      <div class="gu-wrapper">
        <div class="page-header">
          <div class="page-header-left">
            <h1>Gebruikers</h1>
            <p class="page-sub">${gebruikers.length} gebruikers in het systeem</p>
          </div>
          <button class="btn btn-primary" onclick="openGebruikerModal()">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="margin-right:6px"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Gebruiker toevoegen
          </button>
        </div>

        <div class="gu-stats">
          <div class="gu-stat">
            <div class="gu-stat-num">${gebruikers.length}</div>
            <div class="gu-stat-label">Totaal</div>
          </div>
          <div class="gu-stat gu-stat--groen">
            <div class="gu-stat-num">${docenten}</div>
            <div class="gu-stat-label">Docenten</div>
          </div>
          <div class="gu-stat gu-stat--paars">
            <div class="gu-stat-num">${admins}</div>
            <div class="gu-stat-label">Beheerders</div>
          </div>
          <div class="gu-stat gu-stat--blauw">
            <div class="gu-stat-num">${management}</div>
            <div class="gu-stat-label">Management</div>
          </div>
          ${tijdelijk > 0 ? `<div class="gu-stat gu-stat--amber">
            <div class="gu-stat-num">${tijdelijk}</div>
            <div class="gu-stat-label">Tijdelijk ww</div>
          </div>` : ''}
        </div>

        <div class="gu-info-banner">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;margin-top:1px"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>Nieuwe gebruikers krijgen een <strong>eenmalig wachtwoord</strong>. Bij de eerste login moeten zij zelf een nieuw wachtwoord instellen.</span>
        </div>

        <div class="gu-filter">
          <div class="gu-zoek-wrap">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M15 15l-3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <input type="text" id="gu-zoek" placeholder="Zoek op naam of e-mail…" oninput="guFilter()">
          </div>
          <div class="gu-tabs">
            <button class="gu-tab ${_guRolFilter===''?'active':''}" onclick="guSetRol(this,'')">Alle</button>
            <button class="gu-tab ${_guRolFilter==='docent'?'active':''}" onclick="guSetRol(this,'docent')">Docenten</button>
            <button class="gu-tab ${_guRolFilter==='admin'?'active':''}" onclick="guSetRol(this,'admin')">Beheerders</button>
            <button class="gu-tab ${_guRolFilter==='management'?'active':''}" onclick="guSetRol(this,'management')">Management</button>
          </div>
        </div>

        <div class="gu-list" id="gu-list">
          ${gebruikers.map(g => guKaartHtml(g, vakken)).join('')}
        </div>
      </div>
    `;
    guFilter();
  } catch(e) {
    document.getElementById('view-gebruikers').innerHTML = `<div class="empty-state"><h3>Fout bij laden</h3><p>${escHtml(e.message)}</p></div>`;
  }
}

function guKaartHtml(g, vakken) {
  const naam     = escHtml(((g.naam || '') + ' ' + (g.achternaam || '')).trim());
  const initialen = escHtml(getInitialen(g));
  const email    = escHtml(g.email || '');
  const rol      = g.rol || 'docent';
  const rolLabel = { docent: 'Docent', admin: 'Beheerder', management: 'Management' }[rol] || rol;
  const isSelf   = g.id === Auth.currentUser?.id;
  const vakNamen = (g.vakken || []).map(id => { const v = (vakken||[]).find(v => v.id === id); return v ? escHtml(v.naam) : null; }).filter(Boolean);

  return `<div class="gu-kaart" data-naam="${naam.toLowerCase()} ${email.toLowerCase()}" data-rol="${escHtml(rol)}">
    <div class="gu-avatar gu-avatar--${escHtml(rol)}">${initialen}</div>
    <div class="gu-body">
      <div class="gu-naam-rij">
        <span class="gu-naam">${naam}</span>
        <span class="gu-badge gu-badge--${escHtml(rol)}">${escHtml(rolLabel)}</span>
        ${g.isTeamleider ? `<span class="gu-badge gu-badge--tl">🏅 Teamleider</span>` : ''}
        ${isSelf ? `<span class="gu-badge gu-badge--self">Ingelogd</span>` : ''}
        <span class="gu-badge ${g.mustChangePassword ? 'gu-badge--tijdelijk' : 'gu-badge--actief'}">
          ${g.mustChangePassword ? '⏳ Tijdelijk ww' : '✓ Actief'}
        </span>
      </div>
      <div class="gu-email">${email}</div>
      ${vakNamen.length ? `<div class="gu-vakken">${vakNamen.map(n => `<span class="gu-vak">${n}</span>`).join('')}</div>` : ''}
    </div>
    <div class="gu-acties">
      <button class="gu-btn" onclick="openGebruikerModal('${escHtml(g.id)}')" title="Bewerken">
        <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="gu-btn" onclick="resetWachtwoordVoorGebruiker('${escHtml(g.id)}','${naam}')" title="Wachtwoord resetten">
        <svg viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 1 1 12 0M4 10v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${!isSelf ? `<button class="gu-btn gu-btn--danger" onclick="deleteGebruiker('${escHtml(g.id)}')" title="Verwijderen">
        <svg viewBox="0 0 20 20" fill="none"><path d="M7 4h6M5 7h10l-1 9H6L5 7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>` : ''}
    </div>
  </div>`;
}

function guSetRol(btn, rol) {
  _guRolFilter = rol;
  document.querySelectorAll('.gu-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  guFilter();
}

function guFilter() {
  const q   = (document.getElementById('gu-zoek')?.value || '').trim().toLowerCase();
  const rol = _guRolFilter;
  document.querySelectorAll('#gu-list .gu-kaart').forEach(el => {
    const naamMatch = !q || (el.dataset.naam || '').includes(q);
    const rolMatch  = !rol || el.dataset.rol === rol;
    el.style.display = naamMatch && rolMatch ? '' : 'none';
  });
}

async function openGebruikerModal(userId = null) {
  const [vakken, gebruikers] = await Promise.all([API.getVakken(), API.getGebruikers()]);
  const u = userId ? gebruikers.find(x => x.id === userId) : null;
  openModal(`
    <h2>${u ? 'Gebruiker bewerken' : 'Gebruiker toevoegen'}</h2>
    <p class="modal-sub">Velden gemarkeerd met * zijn verplicht.</p>
    <div class="form-grid">
      <div class="form-field"><label>Voornaam *</label><input id="g-naam" type="text" value="${escHtml(u?.naam||'')}"></div>
      <div class="form-field"><label>Achternaam *</label><input id="g-achternaam" type="text" value="${escHtml(u?.achternaam||'')}"></div>
      <div class="form-field form-full"><label>E-mailadres *</label><input id="g-email" type="email" value="${escHtml(u?.email||'')}"></div>
      <div class="form-field">
        <label>${u ? 'Nieuw wachtwoord (leeg = ongewijzigd)' : 'Tijdelijk wachtwoord *'}</label>
        <input id="g-wachtwoord" type="text" placeholder="${u ? 'Leeg laten om ongewijzigd te laten' : 'bijv. Welkom2024!'}" autocomplete="new-password">
        ${!u ? `<div class="form-hint">Dit wachtwoord deel je zelf met de gebruiker. Bij eerste inlog moeten zij het wijzigen.</div>` : ''}
      </div>
      <div class="form-field">
        <label>Rol *</label>
        <select id="g-rol" onchange="toggleVakSelect()">
          <option value="docent"     ${u?.rol==='docent'    ?'selected':''}>Docent</option>
          <option value="admin"      ${u?.rol==='admin'     ?'selected':''}>Beheerder</option>
          <option value="management" ${u?.rol==='management'?'selected':''}>Management</option>
        </select>
      </div>
      <div class="form-field">
        <label>Initialen (optioneel, 3 letters)</label>
        <input id="g-initialen" type="text" maxlength="3" placeholder="Automatisch" value="${escHtml(u?.initialen||'')}" style="text-transform:uppercase">
        <div class="form-hint">Leeg = automatisch op basis van naam</div>
      </div>

      <div class="form-field form-full" id="g-vakken-wrap" style="${u?.rol !== 'docent' && u ? 'display:none' : ''}">
        <div class="vak-select-header">
          <label>Vakken koppelen</label>
          <div class="vak-select-count"><span id="g-vakken-count">0</span> geselecteerd</div>
        </div>
        <div class="vak-select-search">
          <input id="g-vak-search" type="text" placeholder="Zoek een vak…" oninput="filterGebruikerVakken()">
        </div>
        <div class="vak-select-grid" id="g-vakken-grid">
          ${vakken.map(v => `<label class="vak-option ${(u?.vakken||[]).includes(v.id) ? 'is-selected' : ''}" data-label="${escHtml(`${v.naam} ${v.volledig||''}`).toLowerCase()}">
            <input type="checkbox" class="g-vak" value="${v.id}" ${(u?.vakken||[]).includes(v.id) ? 'checked' : ''} onchange="updateVakSelectionUI()">
            <div class="vak-option-text">
              <strong>${escHtml(v.naam)}</strong>
              <span>${escHtml(v.volledig||'')}</span>
            </div>
          </label>`).join('')}
        </div>
      </div>

      <div class="form-field form-full">
        <div class="tl-toggle-rij">
          <label class="tl-toggle-label">
            <input type="checkbox" id="g-is-teamleider" ${u?.isTeamleider ? 'checked' : ''} onchange="toggleTeamleiderVakken()">
            <span>Teamleider</span>
          </label>
          <span class="form-hint">Een teamleider ziet een overzicht van alle lessen en taken voor zijn/haar vakken</span>
        </div>
      </div>
      <div class="form-field form-full" id="g-teamleider-vakken-wrap" style="${u?.isTeamleider ? '' : 'display:none'}">
        <label>Vakken als teamleider</label>
        <div class="vak-select-grid" id="g-tl-vakken-grid">
          ${vakken.map(v => `<label class="vak-option ${(u?.teamleiderVakken||[]).includes(v.id) ? 'is-selected' : ''}">
            <input type="checkbox" class="g-tl-vak" value="${v.id}" ${(u?.teamleiderVakken||[]).includes(v.id) ? 'checked' : ''} onchange="this.closest('label').classList.toggle('is-selected',this.checked)">
            <div class="vak-option-text">
              <strong>${escHtml(v.naam)}</strong>
              <span>${escHtml(v.volledig||'')}</span>
            </div>
          </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveGebruiker('${userId||''}')">
        ${u ? 'Wijzigingen opslaan' : 'Gebruiker aanmaken'}
      </button>
    </div>
  `);
  updateVakSelectionUI();
}

function toggleVakSelect() {
  const rol  = document.getElementById('g-rol')?.value;
  const wrap = document.getElementById('g-vakken-wrap');
  if (wrap) wrap.style.display = rol === 'docent' ? 'block' : 'none';
  if (rol === 'docent') updateVakSelectionUI();
}

function toggleTeamleiderVakken() {
  const isTeamleider = document.getElementById('g-is-teamleider')?.checked;
  const wrap = document.getElementById('g-teamleider-vakken-wrap');
  if (wrap) wrap.style.display = isTeamleider ? '' : 'none';
}

function updateVakSelectionUI() {
  const countEl = document.getElementById('g-vakken-count');
  let count = 0;
  document.querySelectorAll('#g-vakken-grid .vak-option').forEach(option => {
    const cb = option.querySelector('.g-vak');
    const checked = !!cb?.checked;
    option.classList.toggle('is-selected', checked);
    if (checked) count++;
  });
  if (countEl) countEl.textContent = String(count);
}

function filterGebruikerVakken() {
  const q = (document.getElementById('g-vak-search')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#g-vakken-grid .vak-option').forEach(option => {
    option.style.display = !q || (option.dataset.label || '').includes(q) ? '' : 'none';
  });
}

async function saveGebruiker(userId) {
  const naam      = document.getElementById('g-naam').value.trim();
  const achternaam = document.getElementById('g-achternaam').value.trim();
  const email     = document.getElementById('g-email').value.trim();
  const ww        = document.getElementById('g-wachtwoord').value.trim();
  const rol       = document.getElementById('g-rol').value;
  const initialen = document.getElementById('g-initialen').value.trim().toUpperCase().slice(0, 3) || null;
  const vakken    = Array.from(document.querySelectorAll('.g-vak:checked')).map(cb => cb.value);
  const isTeamleider    = !!document.getElementById('g-is-teamleider')?.checked;
  const teamleiderVakken = Array.from(document.querySelectorAll('.g-tl-vak:checked')).map(cb => cb.value);

  if (!naam || !achternaam || !email || (!userId && !ww)) {
    alert('Vul alle verplichte velden in.');
    return;
  }

  const data = { naam, achternaam, email, rol, initialen, vakken: rol === 'docent' ? vakken : [], isTeamleider, teamleiderVakken };
  if (ww) data.wachtwoord = ww;

  try {
    if (userId) {
      await API.updateGebruiker(userId, data);
      closeModalDirect();
      renderGebruikers();
    } else {
      await API.addGebruiker(data);
      closeModalDirect();
      toonTijdelijkWachtwoordModal(naam, email, ww);
    }
  } catch(e) { showError(e.message); }
}

function toonTijdelijkWachtwoordModal(naam, email, wachtwoord) {
  openModal(`
    <div style="text-align:center;padding:8px 0 16px">
      <div style="width:48px;height:48px;background:var(--accent-dim);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:22px">✓</div>
      <h2 style="margin-bottom:4px">Gebruiker aangemaakt</h2>
      <p class="modal-sub">Deel de volgende inloggegevens met <strong>${escHtml(naam)}</strong>.</p>
    </div>
    <div class="geb-ww-blok">
      <div class="geb-ww-label">E-mailadres</div>
      <div class="geb-ww-waarde">${escHtml(email)}</div>
      <div class="geb-ww-label">Tijdelijk wachtwoord</div>
      <div class="geb-ww-rij">
        <code id="tijdelijk-ww" class="geb-ww-code">${escHtml(wachtwoord)}</code>
        <button class="btn btn-sm" onclick="kopieerWachtwoord()">Kopiëren</button>
      </div>
    </div>
    <div class="gu-info-banner" style="margin-top:12px">
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>Bij de eerste inlog wordt deze gebruiker gevraagd een eigen wachtwoord in te stellen.</span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModalDirect();renderGebruikers()">Sluiten</button>
    </div>
  `);
}

function kopieerWachtwoord() {
  const el = document.getElementById('tijdelijk-ww');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    el.style.background = 'var(--accent-dim)';
    el.style.color = 'var(--accent-text)';
    setTimeout(() => { el.style.background = 'var(--amber-dim)'; el.style.color = 'var(--amber-text)'; }, 1500);
  });
}

function resetWachtwoordVoorGebruiker(userId, naam) {
  openModal(`
    <h2>Wachtwoord resetten</h2>
    <p class="modal-sub">Stel een nieuw tijdelijk wachtwoord in voor <strong>${escHtml(naam)}</strong>.</p>
    <div id="reset-admin-error" class="login-error" style="display:none"></div>
    <div class="form-field">
      <label>Nieuw tijdelijk wachtwoord *</label>
      <input id="reset-admin-ww" type="text" placeholder="bijv. Welkom2024!" autocomplete="new-password">
      <div class="form-hint">Minimaal 8 tekens. Deel dit daarna zelf met de gebruiker.</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaResetAdminOp('${escHtml(userId)}','${escHtml(naam)}')">Wachtwoord instellen</button>
    </div>
  `);
}

async function slaResetAdminOp(userId, naam) {
  const ww    = document.getElementById('reset-admin-ww').value.trim();
  const errEl = document.getElementById('reset-admin-error');
  if (ww.length < 8) { errEl.textContent = 'Wachtwoord moet minimaal 8 tekens zijn.'; errEl.style.display = 'block'; return; }
  try {
    const gebruiker = (await API.getGebruikers()).find(g => g.id === userId);
    if (!gebruiker) { errEl.textContent = 'Gebruiker niet gevonden.'; errEl.style.display = 'block'; return; }
    await API.updateGebruiker(userId, { ...gebruiker, wachtwoord: ww, mustChangePassword: true });
    closeModalDirect();
    toonTijdelijkWachtwoordModal(naam, gebruiker.email, ww);
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function deleteGebruiker(id) {
  if (!confirm('Gebruiker verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
  try { await API.deleteGebruiker(id); renderGebruikers(); }
  catch(e) { showError(e.message); }
}
