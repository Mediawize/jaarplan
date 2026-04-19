async function renderGebruikers() {
  if (!Auth.isAdmin()) { document.getElementById('view-gebruikers').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`; return; }
  showLoading('gebruikers');
  try {
    const [gebruikers, vakken] = await Promise.all([API.getGebruikers(), API.getVakken()]);
    document.getElementById('view-gebruikers').innerHTML = `
      <div class="page-header"><div class="page-header-left"><h1>Gebruikers</h1></div><button class="btn btn-primary" onclick="openGebruikerModal()">+ Gebruiker toevoegen</button></div>
      <div class="alert alert-info" style="margin-bottom:20px">Initialen (3 letters) worden automatisch berekend of handmatig ingesteld. Ze verschijnen bij afgevinkte activiteiten.</div>
      <div class="card">
        <div class="card-header"><h2>Alle gebruikers (${gebruikers.length})</h2></div>
        <table class="data-table">
          <thead><tr><th>Naam</th><th>Initialen</th><th>E-mail</th><th>Rol</th><th>Vakken</th><th></th></tr></thead>
          <tbody>
            ${gebruikers.map(g=>`<tr>
              <td style="font-weight:600">${escHtml(g.naam)} ${escHtml(g.achternaam||'')}</td>
              <td><span style="font-family:monospace;font-size:13px;font-weight:700;background:var(--accent-light);color:var(--accent);padding:3px 8px;border-radius:6px">${escHtml(getInitialen(g))}</span></td>
              <td>${escHtml(g.email)}</td>
              <td><span class="role-badge ${g.rol==='admin'?'role-admin':g.rol==='management'?'role-management':'role-docent'}">${escHtml(g.rol)}</span></td>
              <td>${(g.vakken||[]).map(id=>{const v=vakken.find(v=>v.id===id);return v?`<span class="badge badge-green">${escHtml(v.naam)}</span>`:''}).join(' ')}</td>
              <td style="text-align:right">
                <div style="display:flex;gap:6px;justify-content:flex-end">
                  <button class="icon-btn" onclick="openGebruikerModal('${g.id}')"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                  ${g.id!==Auth.currentUser.id?`<button class="icon-btn" onclick="deleteGebruiker('${g.id}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`:`<span style="font-size:12px;color:var(--ink-muted)">ingelogd</span>`}
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
      <div class="form-field"><label>${u?'Nieuw wachtwoord (leeg = ongewijzigd)':'Wachtwoord *'}</label><input id="g-wachtwoord" type="password" placeholder="${u?'Leeg laten':''}" autocomplete="new-password"></div>
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
        <label>Vakken koppelen</label>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
          ${vakken.map(v=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 10px;border:1.5px solid var(--border-med);border-radius:var(--radius)">
            <input type="checkbox" class="g-vak" value="${v.id}" ${(u?.vakken||[]).includes(v.id)?'checked':''}>${escHtml(v.naam)} — ${escHtml(v.volledig||'')}
          </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveGebruiker('${userId||''}')">Opslaan</button>
    </div>
  `);
}

function toggleVakSelect() {
  const rol = document.getElementById('g-rol')?.value;
  const wrap = document.getElementById('g-vakken-wrap');
  if (wrap) wrap.style.display = rol==='docent'?'block':'none';
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
    if (userId) { await API.updateGebruiker(userId, data); } else { await API.addGebruiker(data); }
    closeModalDirect();
    renderGebruikers();
  } catch(e) { showError(e.message); }
}

async function deleteGebruiker(id) {
  if (!confirm('Gebruiker verwijderen?')) return;
  try { await API.deleteGebruiker(id); renderGebruikers(); }
  catch(e) { showError(e.message); }
}
