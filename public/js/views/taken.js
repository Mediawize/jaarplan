async function renderTaken() {
  showLoading('taken');
  try {
    const [taken, gebruikers] = await Promise.all([API.getTaken(), API.getGebruikers()]);
    const readonly = !Auth.canEdit();

    const gesorteerd = [...(taken||[])].sort((a, b) => {
      if (a.afgerond !== b.afgerond) return a.afgerond ? 1 : -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    const open = gesorteerd.filter(t => !t.afgerond);
    const afgerond = gesorteerd.filter(t => t.afgerond);

    document.getElementById('view-taken').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Taken</h1>
          <div class="breadcrumb">Sectietaken voor docenten</div>
        </div>
        ${!readonly ? `<button class="btn btn-primary" onclick="openTaakModal()">+ Taak toevoegen</button>` : ''}
      </div>

      <div class="alert alert-info" style="margin-bottom:20px">
        Taken zijn sectie-brede acties, zoals materialen klaarzetten of spullen regelen. Docenten kunnen een taak oppakken en afvinken als klaar. Taken met een deadline verschijnen ook op het dashboard.
      </div>

      <!-- Open taken -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>Open taken</h2><div class="card-meta">${open.length} openstaand</div></div>
        </div>
        ${open.length === 0
          ? `<div class="empty-state" style="padding:36px 20px"><p>Geen open taken. ${!readonly?'Voeg een taak toe via de knop rechtsboven.':''}</p></div>`
          : `<div class="taak-lijst">${open.map(t => renderTaakKaart(t, gebruikers, readonly)).join('')}</div>`
        }
      </div>

      <!-- Afgeronde taken -->
      ${afgerond.length > 0 ? `
      <div class="card">
        <div class="card-header"><div><h2>Afgerond</h2><div class="card-meta">${afgerond.length} taken</div></div></div>
        <div class="taak-lijst afgerond">
          ${afgerond.map(t => renderTaakKaart(t, gebruikers, readonly)).join('')}
        </div>
      </div>` : ''}
    `;
  } catch(e) { showError('Fout bij laden taken: ' + e.message); }
}

function renderTaakKaart(t, gebruikers, readonly) {
  const nu = new Date();
  const deadline = t.deadline ? new Date(t.deadline) : null;
  const telaat = deadline && !t.afgerond && deadline < nu;
  const binnenkort = deadline && !t.afgerond && !telaat && (deadline - nu) < 3*24*60*60*1000;

  const deadlineHtml = deadline
    ? telaat
      ? `<span class="taak-badge telaat">⚠ Te laat</span>`
      : binnenkort
      ? `<span class="taak-badge binnenkort">📅 ${deadline.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}</span>`
      : `<span class="taak-badge normaal">📅 ${deadline.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}</span>`
    : '';

  const opgepaktDoor = Array.isArray(t.opgepakt) ? t.opgepakt : [];
  const opgepaktGebruikers = opgepaktDoor.map(id => gebruikers.find(u => u.id === id)).filter(Boolean);
  const heeftOpgepakt = opgepaktDoor.includes(Auth.currentUser?.id);

  return `<div class="taak-rij">

    <${!readonly ? `button onclick="taakAfvinken('${t.id}')" title="${t.afgerond?'Heropenen':'Markeer als klaar'}"` : 'div'}
      class="taak-cirkel${t.afgerond?' afgerond':''}${!readonly?' is-button':''}">
      ${t.afgerond?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
    </${!readonly ? 'button' : 'div'}>

    <div class="taak-inhoud">
      <div class="taak-naam-rij">
        <span class="taak-naam${t.afgerond?' afgerond':''}">${escHtml(t.naam)}</span>
        ${deadlineHtml}
      </div>
      ${t.beschrijving ? `<div class="taak-beschrijving">${escHtml(t.beschrijving)}</div>` : ''}
      <div class="taak-acties">
        ${opgepaktGebruikers.map(u => `<span class="taak-initiaal" title="${escHtml(u.naam)}">${escHtml(getInitialen(u))}</span>`).join('')}
        ${!readonly && !t.afgerond ? `<button onclick="taakOppakken('${t.id}')" class="taak-oppak-btn${heeftOpgepakt?' opgepakt':''}">${heeftOpgepakt ? '✓ Opgepakt' : '+ Oppakken'}</button>` : ''}
        ${opgepaktGebruikers.length === 0 && !t.afgerond ? `<span class="taak-niemand">Nog niemand opgepakt</span>` : ''}
      </div>
    </div>

    ${!readonly ? `<div class="taak-knoppen">
      <button class="icon-btn" onclick="openTaakModal('${t.id}')" title="Bewerken">
        <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="icon-btn" onclick="taakVerwijderen('${t.id}')" style="color:var(--red)" title="Verwijderen">
        <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>` : ''}
  </div>`;
}

async function openTaakModal(taakId = null) {
  let t = null;
  if (taakId) {
    const taken = await API.getTaken();
    t = taken.find(x => x.id === taakId);
  }
  openModal(`
    <h2>${t ? 'Taak bewerken' : 'Nieuwe taak aanmaken'}</h2>
    <p class="modal-sub">Sectietaken zijn zichtbaar voor alle docenten en verschijnen op het dashboard als er een deadline is.</p>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam *</label>
        <input id="taak-naam" placeholder="bijv. Materialen klaarzetten voor practicum" value="${escHtml(t?.naam||'')}">
      </div>
      <div class="form-field form-full">
        <label>Beschrijving <span style="font-weight:400;color:var(--ink-3)">(optioneel)</span></label>
        <textarea id="taak-beschrijving" placeholder="Wat moet er precies gedaan worden?">${escHtml(t?.beschrijving||'')}</textarea>
      </div>
      <div class="form-field">
        <label>Deadline <span style="font-weight:400;color:var(--ink-3)">(optioneel)</span></label>
        <input type="date" id="taak-deadline" value="${t?.deadline||''}">
        <div style="font-size:11px;color:var(--ink-4);margin-top:4px">Bij een deadline verschijnt de taak in Komende activiteiten op het dashboard.</div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="taakOpslaan('${taakId||''}')">Opslaan</button>
    </div>
  `);
}

async function taakOpslaan(taakId) {
  const naam = document.getElementById('taak-naam').value.trim();
  const beschrijving = document.getElementById('taak-beschrijving').value.trim();
  const deadline = document.getElementById('taak-deadline').value || null;
  if (!naam) { alert('Vul een naam in.'); return; }
  try {
    if (taakId) {
      await API.updateTaak(taakId, { naam, beschrijving, deadline });
    } else {
      await API.addTaak({ naam, beschrijving, deadline });
    }
    closeModalDirect();
    renderTaken();
  } catch(e) { showError(e.message); }
}

async function taakAfvinken(taakId) {
  try { await API.taakAfvinken(taakId); renderTaken(); }
  catch(e) { showError(e.message); }
}

async function taakOppakken(taakId) {
  try { await API.taakOppakken(taakId); renderTaken(); }
  catch(e) { showError(e.message); }
}

async function taakVerwijderen(taakId) {
  if (!confirm('Taak verwijderen?')) return;
  try { await API.deleteTaak(taakId); renderTaken(); }
  catch(e) { showError(e.message); }
}
