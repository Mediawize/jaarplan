function renderKlassen() {
  const klassen = Auth.getZichtbareKlassen();

  document.getElementById('view-klassen').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Klassen</h1>
      </div>
      ${Auth.canEdit() ? `
      <button class="btn btn-primary" onclick="openKlasModal()">
        + Klas toevoegen
      </button>` : ''}
    </div>

    ${klassen.length === 0 ? `
      <div class="empty-state">
        <h3>Geen klassen</h3>
        <p>Voeg een klas toe om te beginnen</p>
      </div>
    ` : `
      <div class="klas-grid">
        ${klassen.map(k => {
          const vak = DB.getVak(k.vakId);
          const opdrachten = DB.getOpdrachten(k.id);
          const progress = opdrachten.length
            ? Math.round((opdrachten.filter(o => o.actief).length / opdrachten.length) * 100)
            : 0;

          return `
            <div class="klas-card">
              <div class="klas-card-top">
                <div>
                  <div class="klas-naam">${k.naam}</div>
                  <div class="klas-meta-row">
                    ${k.niveau} • ${vak?.naam || ''}
                  </div>
                </div>
                ${Auth.canEdit() ? `
                <div style="display:flex;gap:6px">
                  <button class="icon-btn" onclick="openKlasModal('${k.id}')">✏️</button>
                  <button class="icon-btn" onclick="deleteKlas('${k.id}')" style="color:red">✕</button>
                </div>` : ''}
              </div>

              <div class="klas-progress">
                <div class="klas-progress-fill" style="width:${progress}%"></div>
              </div>

              <div class="klas-progress-label">
                <span>Voortgang</span>
                <span>${progress}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function openKlasModal(id = null) {
  const k = id ? DB.getKlas(id) : null;
  const vakken = DB.getVakken();

  document.getElementById('modal-overlay').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box">
        <h2>${k ? 'Klas bewerken' : 'Nieuwe klas'}</h2>

        <div class="form-field">
          <label>Naam</label>
          <input id="klas-naam" value="${k?.naam || ''}">
        </div>

        <div class="form-field">
          <label>Niveau</label>
          <input id="klas-niveau" value="${k?.niveau || ''}">
        </div>

        <div class="form-field">
          <label>Vak</label>
          <select id="klas-vak">
            ${vakken.map(v =>
              `<option value="${v.id}" ${k?.vakId === v.id ? 'selected' : ''}>${v.naam}</option>`
            ).join('')}
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn" onclick="closeModalDirect()">Annuleren</button>
          <button class="btn btn-primary" onclick="saveKlas('${k?.id || ''}')">Opslaan</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').style.display = 'flex';
}

function saveKlas(id) {
  const naam = document.getElementById('klas-naam').value.trim();
  const niveau = document.getElementById('klas-niveau').value.trim();
  const vakId = document.getElementById('klas-vak').value;

  if (!naam || !niveau || !vakId) {
    alert('Vul alle velden in.');
    return;
  }

  const data = {
    naam,
    niveau,
    vakId,
    docentId: Auth.currentUser.id,
    schooljaar: '2025-2026',
    aantalWeken: 38
  };

  if (id) {
    DB.updateKlas(id, data);
  } else {
    DB.addKlas(data);
  }

  closeModalDirect();
  renderKlassen();
}

function deleteKlas(id) {
  if (!confirm('Weet je zeker dat je deze klas wilt verwijderen?')) return;
  DB.deleteKlas(id);
  renderKlassen();
}
