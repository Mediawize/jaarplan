function renderKlassen() {
  const klassen = Auth.getZichtbareKlassen();
  const readonly = !Auth.canEdit();

  document.getElementById('view-klassen').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Klassen</h1>
      </div>
      ${!readonly ? `<button class="btn btn-primary" onclick="openKlasModal()">+ Klas toevoegen</button>` : ''}
    </div>

    ${readonly ? `<div class="readonly-notice">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Leesmodus — u kunt klassen bekijken maar niet wijzigen.
    </div>` : ''}

    ${klassen.length === 0 ? `
      <div class="empty-state">
        <h3>Geen klassen</h3>
        <p>Voeg een klas toe om te beginnen.</p>
        ${!readonly ? `<button class="btn btn-primary" onclick="openKlasModal()">Eerste klas aanmaken</button>` : ''}
      </div>
    ` : `
      <div class="klas-grid">
        ${klassen.map(k => {
          const vak = DB.getVak(k.vakId);
          const docent = DB.getGebruiker(k.docentId);
          const opdrachten = DB.getOpdrachten(k.id);
          const cw = getCurrentWeek();
          const afgerond = opdrachten.filter(o => {
            const end = parseInt((o.weken || '99').split('-').pop().trim());
            return end < cw;
          }).length;
          const progress = opdrachten.length ? Math.round((afgerond / opdrachten.length) * 100) : 0;

          return `
            <div class="klas-card">
              <div class="klas-card-top">
                <div>
                  <div class="klas-naam">${escHtml(k.naam)}</div>
                  <div class="klas-meta-row">
                    Leerjaar ${k.leerjaar || '?'} · ${escHtml(k.niveau)} · ${escHtml(vak?.naam || '—')}
                    ${docent ? `<br>${escHtml(docent.naam)} ${escHtml(docent.achternaam)}` : ''}
                  </div>
                </div>
                ${!readonly ? `
                <div style="display:flex;gap:6px">
                  <button class="icon-btn" onclick="openKlasModal('${k.id}')">
                    <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  <button class="icon-btn" onclick="deleteKlas('${k.id}')" style="color:var(--red)">
                    <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>` : ''}
              </div>

              <div style="margin-bottom:10px">
                <span class="badge badge-green">${escHtml(vak?.naam || '—')}</span>
                <span style="font-size:11px;color:var(--ink-muted);margin-left:6px">${escHtml(k.schooljaar || '')}</span>
              </div>

              <div class="klas-progress">
                <div class="klas-progress-fill" style="width:${progress}%"></div>
              </div>
              <div class="klas-progress-label">
                <span>${opdrachten.length} opdrachten gepland</span>
                <span>${progress}% afgerond</span>
              </div>

              <button class="btn btn-sm" style="margin-top:12px;width:100%" onclick="window._selectedKlas='${k.id}'; showView('jaarplanning')">
                Planning openen →
              </button>
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
  const docenten = DB.getGebruikers().filter(u => u.rol === 'docent' || u.rol === 'admin');

  openModal(`
    <h2>${k ? 'Klas bewerken' : 'Nieuwe klas aanmaken'}</h2>
    <p class="modal-sub">Vul de gegevens van de klas in.</p>

    <div class="form-grid">
      <div class="form-field">
        <label>Klasnaam *</label>
        <input id="klas-naam" placeholder="bijv. 3 HAVO A" value="${escHtml(k?.naam || '')}">
      </div>
      <div class="form-field">
        <label>Schooljaar *</label>
        <input id="klas-schooljaar" placeholder="2025-2026" value="${escHtml(k?.schooljaar || '2025-2026')}">
      </div>
      <div class="form-field">
        <label>Leerjaar *</label>
        <select id="klas-leerjaar">
          ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(k?.leerjaar||3)==n?'selected':''}>Leerjaar ${n}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Niveau *</label>
        <select id="klas-niveau">
          ${['VMBO-B','VMBO-K','VMBO-GT','HAVO','VWO'].map(n => `<option value="${n}" ${k?.niveau===n?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Vak *</label>
        <select id="klas-vak">
          ${vakken.map(v => `<option value="${v.id}" ${k?.vakId===v.id?'selected':''}>${escHtml(v.naam)} — ${escHtml(v.volledig||'')}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Docent koppelen</label>
        <select id="klas-docent">
          <option value="">— Geen docent —</option>
          ${docenten.map(d => `<option value="${d.id}" ${k?.docentId===d.id?'selected':''}>${escHtml(d.naam)} ${escHtml(d.achternaam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Uren per week (voor dit vak)</label>
        <select id="klas-uren">
          ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(k?.urenPerWeek||3)===n?'selected':''}>${n} uur per week</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveKlas('${k?.id || ''}')">
        ${k ? 'Wijzigingen opslaan' : 'Klas aanmaken'}
      </button>
    </div>
  `);
}

function saveKlas(id) {
  const naam = document.getElementById('klas-naam').value.trim();
  const schooljaar = document.getElementById('klas-schooljaar').value.trim();
  const leerjaar = parseInt(document.getElementById('klas-leerjaar').value);
  const niveau = document.getElementById('klas-niveau').value;
  const vakId = document.getElementById('klas-vak').value;
  const docentId = document.getElementById('klas-docent').value || null;

  if (!naam || !schooljaar || !vakId) {
    alert('Vul alle verplichte velden in.');
    return;
  }

  const urenPerWeek = parseInt(document.getElementById('klas-uren').value);
  const data = { naam, schooljaar, leerjaar, niveau, vakId, docentId, urenPerWeek };

  if (id) {
    DB.updateKlas(id, data);
  } else {
    DB.addKlas(data);
  }

  closeModalDirect();
  renderKlassen();
}

function deleteKlas(id) {
  const k = DB.getKlas(id);
  const opd = DB.getOpdrachten(id);
  if (!confirm(`Klas "${k?.naam}" verwijderen?\n\nDit verwijdert ook ${opd.length} gekoppelde opdrachten.`)) return;
  DB.deleteKlas(id);
  renderKlassen();
}
