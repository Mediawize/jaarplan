// ============================================================
// teamleider.js — Teamleider overzicht
// ============================================================

async function renderTeamleider() {
  if (!Auth.isTeamleider()) {
    document.getElementById('view-teamleider').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3><p>U bent niet ingesteld als teamleider.</p></div>`;
    return;
  }
  showLoading('teamleider');
  try {
    const { klassen, taken, vakken } = await API.getTeamleiderOverzicht();

    const totaalLessen   = klassen.reduce((s, k) => s + (k.opdrachten?.length || 0), 0);
    const afgerondLessen = klassen.reduce((s, k) => s + (k.opdrachten?.filter(o => o.afgevinkt).length || 0), 0);
    const pct = totaalLessen ? Math.round(afgerondLessen / totaalLessen * 100) : 0;
    const openTaken = taken.filter(t => !t.afgerond).length;
    const vakNamen = vakken.map(v => v.naam).join(', ');

    document.getElementById('view-teamleider').innerHTML = `
      <div class="tl-wrapper">
        <div class="page-header">
          <div class="page-header-left">
            <h1>Teamoverzicht</h1>
            <p class="page-sub">${escHtml(vakNamen || 'Geen vakken gekoppeld')}</p>
          </div>
          <button class="btn" onclick="renderTeamleider()">↻ Vernieuwen</button>
        </div>

        <div class="tl-stats">
          <div class="tl-stat">
            <div class="tl-stat-waarde">${klassen.length}</div>
            <div class="tl-stat-label">Klassen</div>
          </div>
          <div class="tl-stat">
            <div class="tl-stat-waarde">${totaalLessen}</div>
            <div class="tl-stat-label">Lessen totaal</div>
          </div>
          <div class="tl-stat tl-stat--kleur">
            <div class="tl-stat-waarde">${pct}%</div>
            <div class="tl-stat-label">${afgerondLessen} / ${totaalLessen} afgerond</div>
            <div class="tl-voortgang-balk"><div class="tl-voortgang-gevuld" style="width:${pct}%"></div></div>
          </div>
          <div class="tl-stat ${openTaken > 0 ? 'tl-stat--waarschuwing' : ''}">
            <div class="tl-stat-waarde">${openTaken}</div>
            <div class="tl-stat-label">Open taken</div>
          </div>
        </div>

        <div class="tl-tabs">
          <button class="tl-tab active" id="tl-tab-lessen" onclick="tlSwitchTab('lessen')">Klassen &amp; lessen</button>
          <button class="tl-tab" id="tl-tab-taken" onclick="tlSwitchTab('taken')">Taken (${openTaken})</button>
        </div>

        <div id="tl-panel-lessen">
          ${klassen.length === 0 ? `<div class="empty-state"><p>Geen klassen gevonden voor jouw vakken.</p></div>` : klassen.map(k => tlKlasHtml(k)).join('')}
        </div>

        <div id="tl-panel-taken" style="display:none">
          ${tlTakenHtml(taken)}
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById('view-teamleider').innerHTML = `<div class="empty-state"><h3>Fout bij laden</h3><p>${escHtml(e.message)}</p></div>`;
  }
}

function tlSwitchTab(tab) {
  document.getElementById('tl-panel-lessen').style.display = tab === 'lessen' ? '' : 'none';
  document.getElementById('tl-panel-taken').style.display  = tab === 'taken'  ? '' : 'none';
  document.getElementById('tl-tab-lessen').classList.toggle('active', tab === 'lessen');
  document.getElementById('tl-tab-taken').classList.toggle('active',  tab === 'taken');
}

function tlKlasHtml(klas) {
  const opdrachten = klas.opdrachten || [];
  const afgerond   = opdrachten.filter(o => o.afgevinkt).length;
  const pct = opdrachten.length ? Math.round(afgerond / opdrachten.length * 100) : 0;
  const klasId = 'tl-klas-' + klas.id;

  const rijen = opdrachten.length === 0
    ? `<tr><td colspan="6" class="tl-empty-rij">Geen lessen gevonden voor deze klas</td></tr>`
    : opdrachten.map(o => {
        const datum = o.afgevinktOp ? new Date(o.afgevinktOp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
        return `<tr class="${o.afgevinkt ? 'tl-rij--afgerond' : ''}">
          <td class="tl-col-week">${o.weeknummer ? `Wk ${o.weeknummer}` : '—'}</td>
          <td class="tl-col-naam">${escHtml(o.naam)}</td>
          <td class="tl-col-type"><span class="tl-type-badge">${escHtml(o.type || 'Les')}</span></td>
          <td class="tl-col-status">
            ${o.afgevinkt
              ? `<span class="tl-status tl-status--ok">✓ Afgerond</span>`
              : `<span class="tl-status tl-status--open">○ Open</span>`}
          </td>
          <td class="tl-col-door">${o.afgevinkt ? escHtml(o.afgevinktDoor || '—') : ''}</td>
          <td class="tl-col-datum">${escHtml(datum)}</td>
          ${o.opmerking ? `<td class="tl-col-noot" title="${escHtml(o.opmerking)}">💬</td>` : '<td></td>'}
        </tr>`;
      }).join('');

  return `<div class="tl-klas-card" id="${klasId}">
    <button class="tl-klas-header" onclick="tlToggleKlas('${klasId}')">
      <div class="tl-klas-naam">${escHtml(klas.naam)}</div>
      <div class="tl-klas-meta">
        <span>${escHtml(klas.niveau || '')}</span>
        <div class="tl-mini-balk"><div class="tl-mini-gevuld" style="width:${pct}%"></div></div>
        <span class="tl-klas-pct ${pct === 100 ? 'tl-pct--groen' : pct > 0 ? 'tl-pct--oranje' : ''}">${afgerond}/${opdrachten.length} (${pct}%)</span>
      </div>
      <svg class="tl-chevron" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div class="tl-klas-body" style="display:none">
      <table class="tl-les-tabel">
        <thead>
          <tr>
            <th>Week</th>
            <th>Naam</th>
            <th>Type</th>
            <th>Status</th>
            <th>Door</th>
            <th>Datum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rijen}</tbody>
      </table>
    </div>
  </div>`;
}

function tlToggleKlas(id) {
  const card = document.getElementById(id);
  if (!card) return;
  const body = card.querySelector('.tl-klas-body');
  const chevron = card.querySelector('.tl-chevron');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function tlTakenHtml(taken) {
  const open     = taken.filter(t => !t.afgerond).sort((a, b) => _dbDatumWaarde(a.deadline) - _dbDatumWaarde(b.deadline));
  const gesloten = taken.filter(t => t.afgerond).slice(0, 10);

  if (!taken.length) return `<div class="empty-state"><p>Geen taken gevonden.</p></div>`;

  const taakRij = (t, afgerond) => {
    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
    const verstreken = !afgerond && t.deadline && new Date(t.deadline) < new Date();
    return `<tr class="${afgerond ? 'tl-rij--afgerond' : verstreken ? 'tl-rij--verstreken' : ''}">
      <td style="font-weight:600">${escHtml(t.naam)}</td>
      <td>${escHtml(t.beschrijving || '')}</td>
      <td class="${verstreken ? 'tl-deadline--verstreken' : ''}">${escHtml(dl)}</td>
      <td>${afgerond ? `<span class="tl-status tl-status--ok">✓ Afgerond</span>` : `<span class="tl-status tl-status--open">○ Open</span>`}</td>
      <td>${(t.opgepakt || []).map(i => `<span class="tl-init">${escHtml(i)}</span>`).join('')}</td>
    </tr>`;
  };

  return `
    ${open.length ? `
      <h3 class="tl-sectie-titel">Open taken (${open.length})</h3>
      <table class="tl-les-tabel tl-taken-tabel">
        <thead><tr><th>Taak</th><th>Beschrijving</th><th>Deadline</th><th>Status</th><th>Opgepakt door</th></tr></thead>
        <tbody>${open.map(t => taakRij(t, false)).join('')}</tbody>
      </table>` : ''}
    ${gesloten.length ? `
      <h3 class="tl-sectie-titel" style="margin-top:24px">Afgeronde taken (laatste ${gesloten.length})</h3>
      <table class="tl-les-tabel tl-taken-tabel">
        <thead><tr><th>Taak</th><th>Beschrijving</th><th>Deadline</th><th>Status</th><th>Opgepakt door</th></tr></thead>
        <tbody>${gesloten.map(t => taakRij(t, true)).join('')}</tbody>
      </table>` : ''}
  `;
}
