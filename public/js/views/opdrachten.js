async function renderOpdrachten() {
  showLoading('opdrachten');
  try {
    const [klassen, alleOpd] = await Promise.all([API.getKlassen(), API.getOpdrachten()]);
    const readonly = !Auth.canEdit();
    if (!window._filterOpdKlas) window._filterOpdKlas = '';
    if (!window._filterOpdType) window._filterOpdType = '';
    let opdrachten = alleOpd;
    if (window._filterOpdKlas) opdrachten = opdrachten.filter(o=>o.klasId===window._filterOpdKlas);
    if (window._filterOpdType) opdrachten = opdrachten.filter(o=>o.type===window._filterOpdType);
    opdrachten.sort((a,b)=>parseInt(a.weken||0)-parseInt(b.weken||0));
    const cw = getCurrentWeek();

    document.getElementById('view-opdrachten').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Alle opdrachten</h1></div>
        ${!readonly?`<button class="btn btn-primary" onclick="openOpdrachtModal()">+ Activiteit toevoegen</button>`:''}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="opd-filter-balk">
          <span class="opd-filter-label">Filter:</span>
          <select onchange="window._filterOpdKlas=this.value;renderOpdrachten()" class="opd-filter-select">
            <option value="">Alle klassen</option>
            ${klassen.map(k=>`<option value="${k.id}" ${window._filterOpdKlas===k.id?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
          </select>
          <select onchange="window._filterOpdType=this.value;renderOpdrachten()" class="opd-filter-select">
            <option value="">Alle typen</option>
            ${['Theorie','Praktijk','Toets','Opdracht','Groepsopdracht','Presentatie','Project','Overig'].map(t=>`<option value="${t}" ${window._filterOpdType===t?'selected':''}>${t}</option>`).join('')}
          </select>
          <span style="font-size:13px;color:var(--ink-muted);margin-left:auto">${opdrachten.length} resultaten</span>
        </div>
      </div>
      <div class="card">
        ${opdrachten.length===0?`<div class="empty-state"><h3>Geen opdrachten gevonden</h3><p>Pas de filter aan of voeg een activiteit toe via de jaarplanning.</p></div>`:`
        <table class="data-table">
          <thead><tr>
            <th>Week</th><th>Klas</th><th>Naam</th><th>Type</th><th>P.</th>
            <th>Syllabus</th><th>Link</th><th>Toets</th><th>Status</th>
            ${!readonly?'<th></th>':''}
          </tr></thead>
          <tbody>
            ${opdrachten.map(o=>{
              const klas=klassen.find(k=>k.id===o.klasId);
              const isNu=weekInRange(o.weken,cw);
              const afgevinkt=o.afgevinkt||o.afgevinkt===1;
              return `<tr class="${isNu?'planning-row-active':''}">
                <td><span class="week-pill ${isNu?'current':''}">Wk ${o.weken||o.weeknummer}</span></td>
                <td style="font-weight:500">${escHtml(klas?.naam||'—')}</td>
                <td>
                  <div style="font-weight:500">${escHtml(o.naam)}</div>
                  ${o.beschrijving?`<div style="font-size:12px;color:var(--ink-muted)">${escHtml(o.beschrijving.slice(0,60))}${o.beschrijving.length>60?'…':''}</div>`:''}
                </td>
                <td><span class="badge ${typeKleur(o.type)}">${escHtml(o.type)}</span></td>
                <td style="color:var(--ink-muted)">P${o.periode||1}</td>
                <td style="font-size:12px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)||'—'}</td>
                <td>${o.theorieLink?`<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank">↗</a>`:'—'}</td>
                <td>${o.toetsBestand?`<span class="badge badge-amber" title="${escHtml(o.toetsBestand)}">📄</span>`:'—'}</td>
                <td>${afgevinkt
                  ?`<span style="font-size:11px;font-weight:700;font-family:monospace;background:var(--accent);color:#fff;padding:1px 6px;border-radius:4px">${escHtml(o.afgevinktDoor||'✓')}</span>`
                  :`<span style="font-size:12px;color:var(--ink-muted)">Open</span>`
                }</td>
                ${!readonly?`<td>
                  <div style="display:flex;gap:4px">
                    <button class="icon-btn" onclick="window._selectedKlas='${o.klasId}';openOpdrachtModal('${o.id}','${o.klasId}')">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn" onclick="verwijderOpdracht('${o.id}')" style="color:var(--red)">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </td>`:''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function verwijderOpdracht(id) {
  if (!confirm('Activiteit verwijderen?')) return;
  try { await API.deleteOpdracht(id); renderOpdrachten(); }
  catch(e) { showError(e.message); }
}
