// ============================================================
// gebruikers.js — Gebruikersbeheer
// NIEUW:
//  - Tijdelijk wachtwoord tonen na aanmaken (admin kopieert zelf)
//  - mustChangePassword badge in de tabel
//  - Knop om wachtwoord opnieuw in te stellen voor een gebruiker
// ============================================================

async function renderGebruikers() {
  if (!Auth.isAdmin()) { document.getElementById('view-gebruikers').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`; return; }
  showLoading('gebruikers');
  try {
    const [gebruikers, vakken] = await Promise.all([API.getGebruikers(), API.getVakken()]);
    document.getElementById('view-gebruikers').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Gebruikers</h1></div>
        <button class="btn btn-primary" onclick="openGebruikerModal()">+ Gebruiker toevoegen</button>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Nieuwe gebruikers krijgen automatisch een <strong>eenmalig wachtwoord</strong>. Bij de eerste login moeten zij zelf een nieuw wachtwoord instellen.
      </div>
      <div class="card">
        <div class="card-header"><h2>Alle gebruikers (${gebruikers.length})</h2></div>
        <table class="data-table">
          <thead><tr><th>Naam</th><th>Initialen</th><th>E-mail</th><th>Rol</th><th>Vakken</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${gebruikers.map(g=>`<tr>
              <td style="font-weight:600">${escHtml(g.naam)} ${escHtml(g.achternaam||'')}</td>
              <td><span class="geb-initialen">${escHtml(getInitialen(g))}</span></td>
              <td>${escHtml(g.email)}</td>
              <td><span class="role-badge ${g.rol==='admin'?'role-admin':g.rol==='management'?'role-management':'role-docent'}">${escHtml(g.rol)}</span></td>
              <td>${(g.vakken||[]).map(id=>{const v=vakken.find(v=>v.id===id);return v?`<span class="badge badge-green">${escHtml(v.naam)}</span>`:''}).join(' ')}</td>
              <td>
                ${g.mustChangePassword
                  ? `<span class="geb-status tijdelijk">⏳ Tijdelijk ww</span>`
                  : `<span class="geb-status actief">✓ Actief</span>`
                }
              </td>
              <td style="text-align:right">
                <div style="display:flex;gap:6px;justify-content:flex-end">
                  <button class="icon-btn" onclick="openGebruikerModal('${g.id}')" title="Bewerken">
                    <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  <button class="icon-btn" onclick="resetWachtwoordVoorGebruiker('${g.id}','${escHtml(g.naam+' '+(g.achternaam||'')).trim()}')" title="Nieuw wachtwoord instellen">
                    <svg viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 1 1 12 0M4 10v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  ${g.id!==Auth.currentUser.id
                    ? `<button class="icon-btn" onclick="deleteGebruiker('${g.id}')" style="color:var(--red)" title="Verwijderen">
                        <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                       </button>`
                    : `<span style="font-size:12px;color:var(--ink-muted)">ingelogd</span>`
                  }
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openGebruikerModal(userId = null) {
  const [vakken, gebruikers] = await Promise.all([API.getVakken(), API.getGebruikers()]);
  const u = userId ? gebruikers.find(x=>x.id===userId) : null;
  openModal(`
    <h2>${u?'Gebruiker bewerken':'Gebruiker toevoegen'}</h2>
    <p class="modal-sub">Initialen worden automatisch berekend, maar je kunt ze ook handmatig instellen (3 letters).</p>
    <div class="form-grid">
      <div class="form-field"><label>Voornaam *</label><input id="g-naam" type="text" value="${escHtml(u?.naam||'')}"></div>
      <div class="form-field"><label>Achternaam *</label><input id="g-achternaam" type="text" value="${escHtml(u?.achternaam||'')}"></div>
      <div class="form-field form-full"><label>E-mailadres *</label><input id="g-email" type="email" value="${escHtml(u?.email||'')}"></div>
      <div class="form-field">
        <label>${u?'Nieuw wachtwoord (leeg = ongewijzigd)':'Tijdelijk wachtwoord *'}</label>
        <input id="g-wachtwoord" type="text" placeholder="${u?'Leeg laten om ongewijzigd te laten':'bijv. Welkom2024!'}" autocomplete="new-password">
        ${!u ? `<div style="font-size:11px;color:var(--ink-muted);margin-top:4px">Dit wachtwoord deel je zelf met de gebruiker. Bij eerste inlog moeten zij het wijzigen.</div>` : ''}
      </div>
      <div class="form-field"><label>Rol *</label><select id="g-rol" onchange="toggleVakSelect()">
        <option value="docent" ${u?.rol==='docent'?'selected':''}>Docent</option>
        <option value="admin" ${u?.rol==='admin'?'selected':''}>Beheerder</option>
        <option value="management" ${u?.rol==='management'?'selected':''}>Management</option>
      </select></div>
      <div class="form-field"><label>Initialen (3 letters, optioneel)</label>
        <input id="g-initialen" type="text" maxlength="3" placeholder="Automatisch" value="${escHtml(u?.initialen||'')}" style="text-transform:uppercase">
        <div style="font-size:11px;color:var(--ink-muted);margin-top:4px">Leeg = automatisch op basis van naam</div>
      </div>
      <div class="form-field form-full" id="g-vakken-wrap" style="${u?.rol!=='docent'&&u?'display:none':''}">
        <div class="vak-select-header">
          <label for="g-vak-search">Vakken koppelen</label>
          <div class="vak-select-count"><span id="g-vakken-count">0</span> geselecteerd</div>
        </div>
        <div class="vak-select-search">
          <input id="g-vak-search" type="text" placeholder="Zoek een vak..." oninput="filterGebruikerVakken()">
        </div>
        <div class="vak-select-grid" id="g-vakken-grid">
          ${vakken.map(v=>`<label class="vak-option ${(u?.vakken||[]).includes(v.id)?'is-selected':''}" data-label="${escHtml(`${v.naam} ${v.volledig||''}`).toLowerCase()}">
            <input type="checkbox" class="g-vak" value="${v.id}" ${(u?.vakken||[]).includes(v.id)?'checked':''} onchange="updateVakSelectionUI()">
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
      <button class="btn btn-primary" onclick="saveGebruiker('${userId||''}')">Opslaan</button>
    </div>
  `);
  updateVakSelectionUI();
}

function toggleVakSelect() {
  const rol = document.getElementById('g-rol')?.value;
  const wrap = document.getElementById('g-vakken-wrap');
  if (wrap) wrap.style.display = rol==='docent'?'block':'none';
  if (rol==='docent') updateVakSelectionUI();
}

function updateVakSelectionUI() {
  const countEl = document.getElementById('g-vakken-count');
  const options = Array.from(document.querySelectorAll('#g-vakken-grid .vak-option'));
  let count = 0;
  options.forEach(option => {
    const cb = option.querySelector('.g-vak');
    const checked = !!cb?.checked;
    option.classList.toggle('is-selected', checked);
    if (checked) count += 1;
  });
  if (countEl) countEl.textContent = String(count);
}

function filterGebruikerVakken() {
  const q = (document.getElementById('g-vak-search')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#g-vakken-grid .vak-option').forEach(option => {
    const text = option.dataset.label || '';
    option.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

async function saveGebruiker(userId) {
  const naam = document.getElementById('g-naam').value.trim();
  const achternaam = document.getElementById('g-achternaam').value.trim();
  const email = document.getElementById('g-email').value.trim();
  const ww = document.getElementById('g-wachtwoord').value.trim();
  const rol = document.getElementById('g-rol').value;
  const initialen = document.getElementById('g-initialen').value.trim().toUpperCase().slice(0,3) || null;
  const vakken = Array.from(document.querySelectorAll('.g-vak:checked')).map(cb=>cb.value);
  if (!naam||!achternaam||!email||(!userId&&!ww)) { alert('Vul alle verplichte velden in.'); return; }

  const data = { naam, achternaam, email, rol, initialen, vakken: rol==='docent'?vakken:[] };
  if (ww) data.wachtwoord = ww;

  try {
    if (userId) {
      await API.updateGebruiker(userId, data);
      closeModalDirect();
      renderGebruikers();
    } else {
      // Nieuw account — toon tijdelijk wachtwoord aan admin
      const r = await API.addGebruiker(data);
      closeModalDirect();
      toonTijdelijkWachtwoordModal(naam, email, ww);
    }
  } catch(e) { showError(e.message); }
}

function toonTijdelijkWachtwoordModal(naam, email, wachtwoord) {
  openModal(`
    <h2>✓ Gebruiker aangemaakt</h2>
    <p class="modal-sub">Deel de volgende inloggegevens met <strong>${escHtml(naam)}</strong>.</p>
    <div class="geb-ww-blok">
      <div class="geb-ww-label">E-mailadres</div>
      <div class="geb-ww-waarde">${escHtml(email)}</div>
      <div class="geb-ww-label">Tijdelijk wachtwoord</div>
      <div class="geb-ww-rij">
        <code id="tijdelijk-ww" class="geb-ww-code">${escHtml(wachtwoord)}</code>
        <button class="btn btn-sm" onclick="kopieerWachtwoord()">Kopiëren</button>
      </div>
    </div>
    <div class="alert alert-info" style="font-size:12px">
      Bij de eerste inlog wordt deze gebruiker gevraagd een eigen wachtwoord in te stellen.
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModalDirect();renderGebruikers()">Sluiten</button>
    </div>
  `);
}

function kopieerWachtwoord() {
  const el = document.getElementById('tijdelijk-ww');
  if (el) {
    navigator.clipboard.writeText(el.textContent).then(() => {
      el.style.background = 'var(--accent-dim)';
      el.style.color = 'var(--accent-text)';
      setTimeout(() => { el.style.background = 'var(--amber-dim)'; el.style.color = 'var(--amber-text)'; }, 1500);
    });
  }
}

// ---- Admin: wachtwoord opnieuw instellen voor een gebruiker ----
function resetWachtwoordVoorGebruiker(userId, naam) {
  openModal(`
    <h2>Wachtwoord opnieuw instellen</h2>
    <p class="modal-sub">Stel een nieuw tijdelijk wachtwoord in voor <strong>${escHtml(naam)}</strong>.</p>
    <div id="reset-admin-error" class="login-error" style="display:none"></div>
    <div class="form-field">
      <label>Nieuw tijdelijk wachtwoord *</label>
      <input id="reset-admin-ww" type="text" placeholder="bijv. Welkom2024!" autocomplete="new-password">
      <div style="font-size:11px;color:var(--ink-muted);margin-top:4px">Minimaal 8 tekens. Deel dit daarna zelf met de gebruiker.</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaResetAdminOp('${userId}','${escHtml(naam)}')">Wachtwoord instellen</button>
    </div>
  `);
}

async function slaResetAdminOp(userId, naam) {
  const ww = document.getElementById('reset-admin-ww').value.trim();
  const errEl = document.getElementById('reset-admin-error');
  if (ww.length < 8) { errEl.textContent = 'Wachtwoord moet minimaal 8 tekens zijn.'; errEl.style.display = 'block'; return; }
  try {
    // Gebruik updateGebruiker met mustChangePassword expliciet true
    const gebruiker = (await API.getGebruikers()).find(g => g.id === userId);
    if (!gebruiker) { errEl.textContent = 'Gebruiker niet gevonden.'; errEl.style.display = 'block'; return; }
    await API.updateGebruiker(userId, { ...gebruiker, wachtwoord: ww, mustChangePassword: true });
    closeModalDirect();
    const email = gebruiker.email;
    toonTijdelijkWachtwoordModal(naam, email, ww);
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function deleteGebruiker(id) {
  if (!confirm('Gebruiker verwijderen?')) return;
  try { await API.deleteGebruiker(id); renderGebruikers(); }
  catch(e) { showError(e.message); }
}
