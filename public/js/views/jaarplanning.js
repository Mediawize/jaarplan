function renderJaarplanning() {
  const readonly = !Auth.canEdit();
  const klassen = Auth.getZichtbareKlassen();

  if (klassen.length === 0) {
    document.getElementById('view-jaarplanning').innerHTML = `
      <div class="page-header"><div class="page-header-left"><h1>Jaarplanning</h1></div></div>
      <div class="empty-state"><h3>Geen klassen beschikbaar</h3><p>Maak eerst een klas aan.</p>
      ${!readonly ? `<button class="btn btn-primary" onclick="showView('klassen')">Klas aanmaken</button>` : ''}</div>
    `;
    return;
  }

  if (!window._selectedKlas || !klassen.find(k => k.id === window._selectedKlas)) {
    window._selectedKlas = klassen[0].id;
  }

  const klas = DB.getKlas(window._selectedKlas);
  const vak = DB.getVak(klas?.vakId);
  const docent = DB.getGebruiker(klas?.docentId);
  const opdrachten = DB.getOpdrachten(window._selectedKlas);
  const cw = getCurrentWeek();

  const periodes = {};
  opdrachten.forEach(o => {
    const p = o.periode || 1;
    if (!periodes[p]) periodes[p] = [];
    periodes[p].push(o);
  });

  const periodeNamen = {
    1: 'Periode 1 — september t/m november',
    2: 'Periode 2 — december t/m februari',
    3: 'Periode 3 — maart t/m mei',
    4: 'Periode 4 — juni t/m juli'
  };

  document.getElementById('view-jaarplanning').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="breadcrumb">
          <span onclick="showView('klassen')" style="cursor:pointer;color:var(--accent)">Klassen</span>
          <span>›</span>
          <span>Jaarplanning</span>
        </div>
        <h1>${escHtml(klas?.naam || '—')}</h1>
      </div>
      <div class="page-header-actions">
        <select id="klas-select" onchange="window._selectedKlas=this.value; renderJaarplanning()" style="padding:9px 14px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13.5px;background:#fff;color:var(--ink);font-weight:500">
          ${klassen.map(k => `<option value="${k.id}" ${k.id === window._selectedKlas ? 'selected' : ''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
        ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal(null,'${window._selectedKlas}')">
          <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Opdracht toevoegen
        </button>` : ''}
      </div>
    </div>

    ${readonly ? `<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus — alle planning is zichtbaar maar niet aanpasbaar.</div>` : ''}

    <div class="card" style="margin-bottom:16px;padding:0">
      <div style="display:flex;align-items:center;gap:24px;padding:16px 24px;flex-wrap:wrap">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Vak</div><span class="badge badge-green">${escHtml(vak?.naam || '—')} — ${escHtml(vak?.volledig || '')}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Niveau</div><span style="font-weight:500">Leerjaar ${klas?.leerjaar} · ${escHtml(klas?.niveau)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Docent</div><span>${docent ? escHtml(docent.naam + ' ' + docent.achternaam) : '—'}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Schooljaar</div><span>${escHtml(klas?.schooljaar)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Opdrachten</div><span>${opdrachten.length} gepland</span></div>
      </div>
    </div>

    ${opdrachten.length === 0 ? `<div class="card"><div class="empty-state">
      <h3>Nog geen opdrachten</h3>
      <p>Voeg opdrachten toe om de jaarplanning op te bouwen.</p>
      ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal(null,'${window._selectedKlas}')">Eerste opdracht toevoegen</button>` : ''}
    </div></div>` :

    [1,2,3,4].map(p => {
      const po = periodes[p] || [];
      if (po.length === 0 && !(!readonly)) return '';
      return `
      <div class="card">
        <div class="card-header">
          <div>
            <h2>${periodeNamen[p]}</h2>
            <div class="card-meta">${po.length} opdrachten / activiteiten</div>
          </div>
          ${!readonly ? `<button class="btn btn-sm" onclick="openOpdrachtModal(null,'${window._selectedKlas}',${p})">
            + Opdracht aan periode ${p}
          </button>` : ''}
        </div>
        ${po.length === 0 ? `<div style="padding:20px 24px;color:var(--ink-muted);font-size:13px">Nog geen opdrachten in deze periode. <span style="cursor:pointer;color:var(--accent)" onclick="openOpdrachtModal(null,'${window._selectedKlas}',${p})">Voeg er een toe</span></div>` : `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:90px">Week(en)</th>
              <th>Opdracht / activiteit</th>
              <th>Type</th>
              <th>Syllabuscodes</th>
              <th>Werkboek</th>
              <th>Theorie</th>
              <th>Toets</th>
              ${!readonly ? '<th style="width:80px"></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${po.sort((a,b) => parseInt(a.weken||0) - parseInt(b.weken||0)).map(o => {
              const isNu = weekInRange(o.weken, cw);
              return `<tr class="${isNu ? 'planning-row-active' : ''}">
                <td><span class="week-pill ${isNu ? 'current' : ''}">Wk ${o.weken}</span>${isNu ? ' <span style="font-size:10px;color:var(--accent);font-weight:700">NU</span>' : ''}</td>
                <td>
                  <div style="font-weight:500">${escHtml(o.naam)}</div>
                  ${o.beschrijving ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px">${escHtml(o.beschrijving.slice(0,80))}${o.beschrijving.length > 80 ? '…' : ''}</div>` : ''}
                </td>
                <td><span class="badge ${typeKleur(o.type)}">${escHtml(o.type)}</span></td>
                <td style="font-size:12px;color:var(--ink-muted);max-width:120px">${escHtml(o.syllabuscodes) || '—'}</td>
                <td>${o.werkboekLink ? `<span style="font-size:12px;color:var(--blue)">${escHtml(o.werkboekLink)}</span>` : '<span style="color:var(--ink-muted)">—</span>'}</td>
                <td>${o.theorieLink ? `<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank">Bekijken ↗</a>` : '<span style="color:var(--ink-muted)">—</span>'}</td>
                <td>${o.toetsBestand ? `<span class="badge badge-amber">📄 ${escHtml(o.toetsBestand)}</span>` : '<span style="color:var(--ink-muted)">—</span>'}</td>
                ${!readonly ? `<td>
                  <div style="display:flex;gap:4px">
                    <button class="icon-btn" title="Bewerken" onclick="openOpdrachtModal('${o.id}','${window._selectedKlas}')">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn" title="Verwijderen" onclick="deleteOpdracht('${o.id}')" style="color:var(--red)">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>`;
    }).join('')}
  `;
}

function openOpdrachtModal(opdrachtId = null, klasId = null, defaultPeriode = 1) {
  const o = opdrachtId ? DB.getOpdracht(opdrachtId) : null;
  const klassen = Auth.getZichtbareKlassen();

  openModal(`
    <h2>${o ? 'Opdracht bewerken' : 'Opdracht toevoegen'}</h2>
    <p class="modal-sub">Vul alle velden in voor de jaarplanning.</p>

    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam opdracht / activiteit *</label>
        <input type="text" id="o-naam" placeholder="bijv. Businessmodel Canvas" value="${escHtml(o?.naam || '')}">
      </div>
      <div class="form-field">
        <label>Klas *</label>
        <select id="o-klas">
          ${klassen.map(k => `<option value="${k.id}" ${(klasId && k.id === klasId) || o?.klasId === k.id ? 'selected' : ''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Periode *</label>
        <select id="o-periode">
          ${[1,2,3,4].map(p => `<option value="${p}" ${(o?.periode || defaultPeriode) == p ? 'selected' : ''}>Periode ${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Week(en) * (bijv. 36-37 of 40)</label>
        <input type="text" id="o-weken" placeholder="bijv. 36-37" value="${escHtml(o?.weken || '')}">
      </div>
      <div class="form-field">
        <label>Type *</label>
        <select id="o-type">
          ${['Theorie','Opdracht','Toets','Praktijk','Project','Groepsopdracht'].map(t => `<option value="${t}" ${o?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Syllabuscodes</label>
        <input type="text" id="o-syllabus" placeholder="bijv. PIE-1.1, PIE-1.2" value="${escHtml(o?.syllabuscodes || '')}">
      </div>
      <div class="form-field form-full">
        <label>Werkboek / hoofdstuk / verwijzing</label>
        <input type="text" id="o-werkboek" placeholder="bijv. H3 p.20-28" value="${escHtml(o?.werkboekLink || '')}">
      </div>
      <div class="form-field form-full">
        <label>Beschrijving</label>
        <textarea id="o-beschrijving" placeholder="Korte beschrijving van de opdracht">${escHtml(o?.beschrijving || '')}</textarea>
      </div>
      <div class="form-field form-full">
        <label>Theorie-link</label>
        <input type="text" id="o-theorie" placeholder="https://..." value="${escHtml(o?.theorieLink || '')}">
      </div>
      <div class="form-field form-full">
        <label>Toetsbestand / naam (upload simulatie)</label>
        <input type="text" id="o-toets" placeholder="bijv. toets_periode1.pdf" value="${escHtml(o?.toetsBestand || '')}">
        <div style="font-size:11px;color:var(--ink-muted);margin-top:4px">In de productieverisie kunt u hier een PDF uploaden.</div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveOpdracht('${opdrachtId || ''}')">
        ${o ? 'Wijzigingen opslaan' : 'Toevoegen aan planning'}
      </button>
    </div>
  `);
}

function saveOpdracht(opdrachtId) {
  const naam = document.getElementById('o-naam').value.trim();
  const klasId = document.getElementById('o-klas').value;
  const periode = parseInt(document.getElementById('o-periode').value);
  const weken = document.getElementById('o-weken').value.trim();
  const type = document.getElementById('o-type').value;
  const syllabuscodes = document.getElementById('o-syllabus').value.trim();
  const werkboekLink = document.getElementById('o-werkboek').value.trim();
  const beschrijving = document.getElementById('o-beschrijving').value.trim();
  const theorieLink = document.getElementById('o-theorie').value.trim();
  const toetsBestand = document.getElementById('o-toets').value.trim() || null;

  if (!naam || !klasId || !weken || !type) {
    alert('Vul alle verplichte velden in (naam, klas, week(en), type).');
    return;
  }

  const data = { naam, klasId, periode, weken, type, syllabuscodes, werkboekLink, beschrijving, theorieLink, toetsBestand };

  if (opdrachtId) {
    DB.updateOpdracht(opdrachtId, data);
  } else {
    DB.addOpdracht(data);
  }

  window._selectedKlas = klasId;
  closeModalDirect();
  renderJaarplanning();
}

function deleteOpdracht(id) {
  const o = DB.getOpdracht(id);
  if (!confirm(`Opdracht "${o?.naam}" verwijderen?`)) return;
  DB.deleteOpdracht(id);
  renderJaarplanning();
}
