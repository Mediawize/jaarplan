function renderOpdrachten() {
  const readonly = !Auth.canEdit();
  const klassen = Auth.getZichtbareKlassen();
  const klasIds = klassen.map(k => k.id);

  // Filters
  if (!window._filterOpdKlas) window._filterOpdKlas = '';
  if (!window._filterOpdType) window._filterOpdType = '';

  let opdrachten = DB.getOpdrachten().filter(o => klasIds.includes(o.klasId));
  if (window._filterOpdKlas) opdrachten = opdrachten.filter(o => o.klasId === window._filterOpdKlas);
  if (window._filterOpdType) opdrachten = opdrachten.filter(o => o.type === window._filterOpdType);
  opdrachten.sort((a, b) => parseInt(a.weken || 0) - parseInt(b.weken || 0));

  document.getElementById('view-opdrachten').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Alle opdrachten</h1>
      </div>
      ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal()">
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Opdracht toevoegen
      </button>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;padding:14px 20px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.04em">Filter:</span>
        <select onchange="window._filterOpdKlas=this.value; renderOpdrachten()"
          style="padding:8px 12px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13px;background:#fff;color:var(--ink)">
          <option value="">Alle klassen</option>
          ${klassen.map(k => `<option value="${k.id}" ${window._filterOpdKlas===k.id?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
        <select onchange="window._filterOpdType=this.value; renderOpdrachten()"
          style="padding:8px 12px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13px;background:#fff;color:var(--ink)">
          <option value="">Alle typen</option>
          ${['Theorie','Opdracht','Groepsopdracht','Toets','Praktijk','Project','Presentatie'].map(t =>
            `<option value="${t}" ${window._filterOpdType===t?'selected':''}>${t}</option>`
          ).join('')}
        </select>
        <span style="font-size:13px;color:var(--ink-muted);margin-left:auto">${opdrachten.length} resultaten</span>
      </div>
    </div>

    <div class="card">
      ${opdrachten.length === 0 ? `
        <div class="empty-state">
          <h3>Geen opdrachten gevonden</h3>
          <p>Pas de filter aan of voeg een opdracht toe via de jaarplanning.</p>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Klas</th>
              <th>Naam</th>
              <th>Type</th>
              <th>P.</th>
              <th>Syllabus</th>
              <th>Werkboek</th>
              <th>Theorie</th>
              <th>Toets</th>
              ${!readonly ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${opdrachten.map(o => {
              const klas = DB.getKlas(o.klasId);
              const cw = getCurrentWeek();
              const isNu = weekInRange(o.weken, cw);
              return `<tr class="${isNu ? 'planning-row-active' : ''}">
                <td><span class="week-pill ${isNu ? 'current' : ''}">Wk ${o.weken}</span></td>
                <td style="font-weight:500">${escHtml(klas?.naam || '—')}</td>
                <td>
                  <div style="font-weight:500">${escHtml(o.naam)}</div>
                  ${o.beschrijving ? `<div style="font-size:12px;color:var(--ink-muted)">${escHtml(o.beschrijving.slice(0,60))}${o.beschrijving.length>60?'…':''}</div>` : ''}
                </td>
                <td><span class="badge ${typeKleur(o.type)}">${escHtml(o.type)}</span></td>
                <td style="color:var(--ink-muted)">P${o.periode||1}</td>
                <td style="font-size:12px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)||'—'}</td>
                <td style="font-size:12px;color:var(--blue)">${escHtml(o.werkboekLink)||'—'}</td>
                <td>${o.theorieLink ? `<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank">↗</a>` : '—'}</td>
                <td>${o.toetsBestand ? `<span class="badge badge-amber" title="${escHtml(o.toetsBestand)}">📄</span>` : '—'}</td>
                ${!readonly ? `<td>
                  <div style="display:flex;gap:4px">
                    <button class="icon-btn" onclick="window._selectedKlas='${o.klasId}'; openOpdrachtModal('${o.id}','${o.klasId}')">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn" onclick="deleteOpdracht('${o.id}'); renderOpdrachten()" style="color:var(--red)">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}
