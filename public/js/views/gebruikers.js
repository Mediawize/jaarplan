function renderGebruikers() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-gebruikers').innerHTML = `
      <div class="empty-state"><h3>Geen toegang</h3><p>Alleen beheerders kunnen gebruikers beheren.</p></div>
    `;
    return;
  }

  const gebruikers = DB.getGebruikers();
  const vakken = DB.getVakken();

  document.getElementById('view-gebruikers').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>Gebruikers</h1></div>
      <button class="btn btn-primary" onclick="openGebruikerModal()">+ Gebruiker toevoegen</button>
    </div>
    <div class="alert alert-info" style="margin-bottom:20px">
      De initialen (3 hoofdletters) worden automatisch berekend uit de naam en worden getoond bij afgevinkte activiteiten in de jaarplanning.
    </div>
    <div class="card">
      <div class="card-header"><h2>Alle gebruikers</h2></div>
      ${gebruikers.length === 0 ? `<div class="empty-state"><h3>Geen gebruikers</h3></div>` : `
      <table class="data-table">
        <thead><tr><th>Naam</th><th>Initialen</th><th>E-mail</th><th>Rol</th><th>Vakken</th><th></th></tr></thead>
        <tbody>
          ${gebruikers.map(g => `
            <tr>
              <td style="font-weight:600">${escHtml(g.naam)} ${escHtml(g.achternaam || '')}</td>
              <td><span style="font-family:monospace;font-size:13px;font-weight:700;background:var(--accent-light);color:var(--accent);padding:3px 8px;border-radius:6px">${getInitialen(g)}</span></td>
              <td>${escHtml(g.email)}</td>
              <td><span class="role-badge ${g.rol==='admin'?'role-admin':g.rol==='management'?'role-management':'role-docent'}">${escHtml(g.rol)}</span></td>
              <td>${(g.vakken||[]).map(id=>{const v=vakken.find(v=>v.id===id);return v?`<span class="badge badge-green">${escHtml(v.naam)}</span>`:''}).join(' ')}</td>
              <td style="text-align:right">
                ${g.id!==Auth.currentUser.id
                  ? `<button class="icon-btn" onclick="deleteGebruiker('${g.id}')" style="color:var(--red)">✕</button>`
                  : `<span style="font-size:12px;color:var(--ink-muted)">ingelogd</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>
  `;
}

function getInitialen(user) {
  if (!user) return '???';
  if (user.initialen) return user.initialen.toUpperCase().slice(0,3);
  const delen = [(user.naam||''), (user.achternaam||'')].join(' ').trim().split(/\s+/);
  if (delen.length >= 3) return (delen[0][0]+delen[1][0]+delen[2][0]).toUpperCase();
  if (delen.length === 2) return (delen[0][0]+delen[0][1]+delen[1][0]).toUpperCase();
  if (delen.length === 1 && delen[0].length >= 3) return delen[0].slice(0,3).toUpperCase();
  return (delen.join('').slice(0,3)).toUpperCase().padEnd(3,'X');
}

function openGebruikerModal(userId) {
  const u = userId ? DB.getGebruiker(userId) : null;
  const vakken = DB.getVakken();
  openModal(`
    <h2>${u ? 'Gebruiker bewerken' : 'Gebruiker toevoegen'}</h2>
    <p class="modal-sub">Initialen worden automatisch berekend, maar je kunt ze ook handmatig instellen.</p>
    <div class="form-grid">
      <div class="form-field"><label>Voornaam *</label><input id="g-naam" type="text" placeholder="Bijv. Jan" value="${escHtml(u?.naam||'')}"></div>
      <div class="form-field"><label>Achternaam *</label><input id="g-achternaam" type="text" placeholder="Bijv. Jansen" value="${escHtml(u?.achternaam||'')}"></div>
      <div class="form-field form-full"><label>E-mailadres *</label><input id="g-email" type="email" placeholder="naam@school.nl" value="${escHtml(u?.email||'')}"></div>
      <div class="form-field"><label>${u?'Nieuw wachtwoord (leeg = ongewijzigd)':'Wachtwoord *'}</label><input id="g-wachtwoord" type="text" placeholder="${u?'Leeg laten om niet te wijzigen':'Kies een wachtwoord'}"></div>
      <div class="form-field"><label>Rol *</label>
        <select id="g-rol" onchange="toggleVakSelect()">
          <option value="docent" ${u?.rol==='docent'?'selected':''}>docent</option>
          <option value="admin" ${u?.rol==='admin'?'selected':''}>admin</option>
          <option value="management" ${u?.rol==='management'?'selected':''}>management</option>
        </select>
      </div>
      <div class="form-field">
        <label>Initialen (3 letters, optioneel)</label>
        <input id="g-initialen" type="text" maxlength="3" placeholder="Automatisch" value="${escHtml(u?.initialen||'')}" style="text-transform:uppercase">
        <div style="font-size:11px;color:var(--ink-muted);margin-top:4px">Leeg laten voor automatisch op basis van naam</div>
      </div>
      <div class="form-field form-full" id="g-vakken-wrap" style="${u?.rol==='docent'||!u?'':'display:none'}">
        <label>Vakken docent</label>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          ${vakken.map(v=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px">
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

function saveGebruiker(userId) {
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
  if (userId) { DB.updateGebruiker(userId, data); }
  else { const r=DB.addGebruiker(data); if (r?.error){alert(r.error);return;} }
  closeModalDirect();
  renderGebruikers();
}

function deleteGebruiker(id) {
  if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) return;
  DB.deleteGebruiker(id);
  renderGebruikers();
}
