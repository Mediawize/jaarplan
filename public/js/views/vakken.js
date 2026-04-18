function renderVakken() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-vakken').innerHTML = `
      <div class="empty-state">
        <h3>Geen toegang</h3>
        <p>Alleen beheerders kunnen vakken beheren.</p>
      </div>
    `;
    return;
  }

  const vakken = DB.getVakken();

  document.getElementById('view-vakken').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Vakken</h1>
      </div>
      <button class="btn btn-primary" onclick="openVakModal()">
        + Vak toevoegen
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Alle vakken</h2>
      </div>
      ${vakken.length === 0 ? `
        <div class="empty-state">
          <h3>Geen vakken</h3>
          <p>Voeg een vak toe om te beginnen.</p>
        </div>
      ` : `
      <table class="data-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Volledige naam</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${vakken.map(v => `
            <tr>
              <td><strong>${escHtml(v.naam)}</strong></td>
              <td>${escHtml(v.volledig || '')}</td>
              <td style="text-align:right">
                <button class="icon-btn" onclick="deleteVak('${v.id}')" style="color:red">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>
  `;
}

function openVakModal() {
  openModal(`
    <h2>Vak toevoegen</h2>

    <div class="form-field">
      <label>Korte naam</label>
      <input id="vak-naam" placeholder="bijv. PIE">
    </div>

    <div class="form-field">
      <label>Volledige naam</label>
      <input id="vak-volledig" placeholder="bijv. Produceren, Installeren & Energie">
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveVak()">Opslaan</button>
    </div>
  `);
}

function saveVak() {
  const naam = document.getElementById('vak-naam').value.trim();
  const volledig = document.getElementById('vak-volledig').value.trim();

  if (!naam) {
    alert('Vul minimaal een naam in.');
    return;
  }

  DB.addVak({
    naam,
    volledig,
    kleur: '#2D5A3D'
  });

  closeModalDirect();
  renderVakken();
}

function deleteVak(id) {
  if (!confirm('Weet je zeker dat je dit vak wilt verwijderen?')) return;
  DB.deleteVak(id);
  renderVakken();
}
