async function renderVakken() {
  if (!Auth.isAdmin()) { document.getElementById('view-vakken').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`; return; }
  showLoading('vakken');
  try {
    const vakken = await API.getVakken();
    document.getElementById('view-vakken').innerHTML = `
      <div class="page-header"><div class="page-header-left"><h1>Vakken</h1></div><button class="btn btn-primary" onclick="openVakModal()">+ Vak toevoegen</button></div>
      <div class="card">
        <div class="card-header"><h2>Alle vakken (${vakken.length})</h2></div>
        ${vakken.length===0?`<div class="empty-state"><h3>Geen vakken</h3></div>`:`
        <table class="data-table">
          <thead><tr><th>Naam</th><th>Volledige naam</th><th></th></tr></thead>
          <tbody>${vakken.map(v=>`<tr>
            <td><span class="badge badge-green">${escHtml(v.naam)}</span></td>
            <td>${escHtml(v.volledig||'')}</td>
            <td style="text-align:right">
              <button class="icon-btn" onclick="deleteVak('${v.id}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
            </td>
          </tr>`).join('')}</tbody>
        </table>`}
      </div>
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

function openVakModal() {
  openModal(`
    <h2>Vak toevoegen</h2>
    <div class="form-field"><label>Afkorting *</label><input id="vak-naam" placeholder="bijv. PIE" style="text-transform:uppercase"></div>
    <div class="form-field"><label>Volledige naam *</label><input id="vak-volledig" placeholder="bijv. Produceren, Installeren & Energie"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveVak()">Opslaan</button>
    </div>
  `);
}

async function saveVak() {
  const naam = document.getElementById('vak-naam').value.trim().toUpperCase();
  const volledig = document.getElementById('vak-volledig').value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  try { await API.addVak({ naam, volledig, kleur: '#2D5A3D' }); closeModalDirect(); renderVakken(); }
  catch(e) { showError(e.message); }
}

async function deleteVak(id) {
  if (!confirm('Vak verwijderen?')) return;
  try { await API.deleteVak(id); renderVakken(); }
  catch(e) { showError(e.message); }
}
