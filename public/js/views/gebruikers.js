function renderGebruikers() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-gebruikers').innerHTML = `
      <div class="empty-state">
        <h3>Geen toegang</h3>
        <p>Alleen beheerders kunnen gebruikers beheren.</p>
      </div>
    `;
    return;
  }

  const gebruikers = DB.getGebruikers();
  const vakken = DB.getVakken();

  document.getElementById('view-gebruikers').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Gebruikers</h1>
      </div>
      <button class="btn btn-primary" onclick="openGebruikerModal()">
        + Gebruiker toevoegen
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Alle gebruikers</h2>
      </div>

      ${gebruikers.length === 0 ? `
        <div class="empty-state">
          <h3>Geen gebruikers</h3>
          <p>Voeg een gebruiker toe om te beginnen.</p>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Rol</th>
              <th>Vakken</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${gebruikers.map(g => `
              <tr>
                <td style="font-weight:600">${escHtml(g.naam)} ${escHtml(g.achternaam || '')}</td>
                <td>${escHtml(g.email)}</td>
                <td>
                  <span class="role-badge ${
                    g.rol === 'admin' ? 'role-admin' :
                    g.rol === 'management' ? 'role-management' :
                    'role-docent'
                  }">
                    ${escHtml(g.rol)}
                  </span>
                </td>
                <td>
                  ${(g.vakken || []).map(id => {
                    const vak = vakken.find(v => v.id === id);
                    return vak ? `<span class="badge badge-green">${escHtml(vak.naam)}</span>` : '';
                  }).join(' ')}
                </td>
                <td style="text-align:right">
                  ${g.id !== Auth.currentUser.id ? `
                    <button class="icon-btn" onclick="deleteGebruiker('${g.id}')" style="color:var(--red)">✕</button>
                  ` : `
                    <span style="font-size:12px;color:var(--ink-muted)">ingelogd</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function openGebruikerModal() {
  const vakken = DB.getVakken();

  openModal(`
    <h2>Gebruiker toevoegen</h2>
    <p class="modal-sub">Maak een nieuwe docent, beheerder of managementgebruiker aan.</p>

    <div class="form-grid">
      <div class="form-field">
        <label>Voornaam *</label>
        <input id="g-naam" type="text" placeholder="Bijv. Jan">
      </div>

      <div class="form-field">
        <label>Achternaam *</label>
        <input id="g-achternaam" type="text" placeholder="Bijv. Jansen">
      </div>

      <div class="form-field form-full">
        <label>E-mailadres *</label>
        <input id="g-email" type="email" placeholder="naam@school.nl">
      </div>

      <div class="form-field">
        <label>Wachtwoord *</label>
        <input id="g-wachtwoord" type="text" placeholder="Kies een wachtwoord">
      </div>

      <div class="form-field">
        <label>Rol *</label>
        <select id="g-rol" onchange="toggleVakSelect()">
          <option value="docent">docent</option>
          <option value="admin">admin</option>
          <option value="management">management</option>
        </select>
      </div>

      <div class="form-field form-full" id="g-vakken-wrap">
        <label>Vakken docent</label>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          ${vakken.map(v => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px">
              <input type="checkbox" class="g-vak" value="${v.id}">
              <span>${escHtml(v.naam)} — ${escHtml(v.volledig || '')}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveGebruiker()">Opslaan</button>
    </div>
  `);
}

function toggleVakSelect() {
  const rol = document.getElementById('g-rol')?.value;
  const wrap = document.getElementById('g-vakken-wrap');
  if (wrap) {
    wrap.style.display = rol === 'docent' ? 'block' : 'none';
  }
}

function saveGebruiker() {
  const naam = document.getElementById('g-naam').value.trim();
  const achternaam = document.getElementById('g-achternaam').value.trim();
  const email = document.getElementById('g-email').value.trim();
  const wachtwoord = document.getElementById('g-wachtwoord').value.trim();
  const rol = document.getElementById('g-rol').value;

  const vakken = Array.from(document.querySelectorAll('.g-vak:checked')).map(cb => cb.value);

  if (!naam || !achternaam || !email || !wachtwoord || !rol) {
    alert('Vul alle verplichte velden in.');
    return;
  }

  const result = DB.addGebruiker({
    naam,
    achternaam,
    email,
    wachtwoord,
    rol,
    vakken: rol === 'docent' ? vakken : []
  });

  if (result?.error) {
    alert(result.error);
    return;
  }

  closeModalDirect();
  renderGebruikers();
}

function deleteGebruiker(id) {
  if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) return;
  DB.deleteGebruiker(id);
  renderGebruikers();
}
