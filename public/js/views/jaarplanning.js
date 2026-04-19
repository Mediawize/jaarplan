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
  const schooljaar = klas?.schooljaar;
  const weken = DB.getWeken(schooljaar);
  const opdrachten = DB.getOpdrachten(window._selectedKlas);
  const cw = getCurrentWeek();

  // Kijk of er gegenereerde weken zijn voor dit schooljaar
  const heeftWeken = weken && weken.length > 0;

  const periodes = { 1: [], 2: [], 3: [], 4: [] };
  if (heeftWeken) {
    weken.forEach(w => {
      const wn = w.weeknummer;
      let p = 1;
      if ((wn >= 44) || (wn <= 8)) p = 2;
      else if (wn >= 9 && wn <= 18) p = 3;
      else if (wn >= 19 && wn <= 26) p = 4;
      periodes[p].push(w);
    });
  }

  const periodeNamen = {
    1: 'Periode 1 — september t/m november',
    2: 'Periode 2 — december t/m februari',
    3: 'Periode 3 — maart t/m mei',
    4: 'Periode 4 — juni t/m juli',
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
        <select id="klas-select" onchange="window._selectedKlas=this.value; renderJaarplanning()"
          style="padding:9px 14px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13.5px;background:#fff;color:var(--ink);font-weight:500">
          ${klassen.map(k => `<option value="${k.id}" ${k.id === window._selectedKlas ? 'selected' : ''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
      </div>
    </div>

    ${readonly ? `<div class="readonly-notice">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Leesmodus — alle planning is zichtbaar maar niet aanpasbaar.
    </div>` : ''}

    <!-- Klas info balk -->
    <div class="card" style="margin-bottom:16px;padding:0">
      <div style="display:flex;align-items:center;gap:24px;padding:16px 24px;flex-wrap:wrap">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Vak</div>
          <span class="badge badge-green">${escHtml(vak?.naam || '—')} — ${escHtml(vak?.volledig || '')}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Niveau</div>
          <span style="font-weight:500">Leerjaar ${klas?.leerjaar} · ${escHtml(klas?.niveau)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Docent</div>
          <span>${docent ? escHtml(docent.naam + ' ' + docent.achternaam) : '—'}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Schooljaar</div>
          <span>${escHtml(schooljaar)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Opdrachten</div>
          <span>${opdrachten.length} gepland</span></div>
      </div>
    </div>

    ${!heeftWeken ? `
      <div class="card">
        <div class="empty-state">
          <h3>Geen weekstructuur</h3>
          <p>Voor schooljaar <strong>${escHtml(schooljaar)}</strong> zijn nog geen weken gegenereerd.</p>
          ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="showView('schooljaren')">Schooljaar aanmaken</button>` : '<p style="color:var(--ink-muted)">Vraag de beheerder om het schooljaar aan te maken.</p>'}
        </div>
      </div>
    ` : `
      ${[1,2,3,4].map(p => {
        const pw = periodes[p];
        if (!pw.length) return '';
        return `
          <div class="card">
            <div class="card-header">
              <div>
                <h2>${periodeNamen[p]}</h2>
                <div class="card-meta">${pw.filter(w => !w.isVakantie).length} schoolweken · ${pw.filter(w => w.isVakantie).length} vakantieweken</div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:70px">Week</th>
                  <th style="width:130px">Datum</th>
                  <th style="width:200px">Thema</th>
                  <th>Opdrachten / activiteiten</th>
                  ${!readonly ? '<th style="width:100px"></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${pw.map(w => {
                  const wOpdrachten = opdrachten.filter(o => {
                    if (o.weeknummer === w.weeknummer && o.schooljaar === schooljaar) return true;
                    if (o.weken) return weekInRange(o.weken, w.weeknummer);
                    return false;
                  });
                  const isNu = w.weeknummer === cw;

                  if (w.isVakantie) {
                    return `<tr style="background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(196,130,26,0.03) 4px,rgba(196,130,26,0.03) 8px)">
                      <td><span class="week-pill">${w.weeknummer}</span></td>
                      <td style="font-size:12px;color:var(--ink-muted)">${w.van} – ${w.tot}</td>
                      <td colspan="${!readonly ? 3 : 2}">
                        <span class="badge badge-amber">${w.vakantieNaam}</span>
                      </td>
                    </tr>`;
                  }

                  return `<tr class="${isNu ? 'planning-row-active' : ''}">
                    <td>
                      <span class="week-pill ${isNu ? 'current' : ''}">${w.weeknummer}</span>
                      ${isNu ? '<div style="font-size:10px;color:var(--accent);font-weight:700;margin-top:2px">NU</div>' : ''}
                    </td>
                    <td style="font-size:12px;color:var(--ink-muted)">${w.van}<br>${w.tot}</td>
                    <td>
                      ${!readonly
                        ? `<span class="week-thema-inline"
                            data-weekid="${w.id}"
                            data-schooljaar="${schooljaar}"
                            onclick="editWeekThemaInline(this)"
                            style="display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${w.thema ? 'transparent' : 'var(--border-med)'};cursor:pointer;font-size:12px;color:${w.thema ? 'var(--ink)' : 'var(--ink-muted)'};min-height:28px"
                          >${escHtml(w.thema) || '<span style="opacity:.5">+ Thema</span>'}</span>`
                        : `<span style="font-size:12px;color:var(--ink-muted)">${escHtml(w.thema) || '—'}</span>`
                      }
                    </td>
                    <td>
                      ${wOpdrachten.length === 0
                        ? `<span style="font-size:12px;color:var(--border-med)">—</span>`
                        : wOpdrachten.map(o => `
                          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                            <span class="badge ${typeKleur(o.type)}" style="font-size:10px;padding:2px 6px">${escHtml(o.type)}</span>
                            <span style="font-size:12px;font-weight:500">${escHtml(o.naam)}</span>
                            ${o.syllabuscodes ? `<span style="font-size:11px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)}</span>` : ''}
                            ${o.theorieLink ? `<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank" style="font-size:11px">theorie ↗</a>` : ''}
                            ${o.toetsBestand ? `<span class="badge badge-amber" style="font-size:10px;padding:2px 6px">📄</span>` : ''}
                          </div>
                        `).join('')
                      }
                    </td>
                    ${!readonly ? `<td>
                      <button class="btn btn-sm" onclick="openOpdrachtModal(null,'${window._selectedKlas}',${p},${w.weeknummer})">
                        + Opdracht
                      </button>
                    </td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}
    `}
  `;
}

// Inline thema bewerken in jaarplanning
function editWeekThemaInline(el) {
  const weekId = el.dataset.weekid;
  const schooljaar = el.dataset.schooljaar;
  const huidig = el.querySelector('span[style*="opacity"]') ? '' : el.textContent.trim();

  const input = document.createElement('input');
  input.type = 'text';
  input.value = huidig;
  input.style.cssText = 'padding:4px 6px;border:1.5px solid var(--accent);border-radius:6px;font-size:12px;font-family:DM Sans,sans-serif;width:100%;outline:none';

  el.replaceWith(input);
  input.focus();
  input.select();

  function opslaan() {
    const nieuw = input.value.trim();
    DB.updateWeekThema(schooljaar, weekId, nieuw);
    const span = document.createElement('span');
    span.className = 'week-thema-inline';
    span.dataset.weekid = weekId;
    span.dataset.schooljaar = schooljaar;
    span.onclick = function() { editWeekThemaInline(this); };
    span.style.cssText = `display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${nieuw ? 'transparent' : 'var(--border-med)'};cursor:pointer;font-size:12px;color:${nieuw ? 'var(--ink)' : 'var(--ink-muted)'};min-height:28px`;
    span.innerHTML = nieuw ? escHtml(nieuw) : '<span style="opacity:.5">+ Thema</span>';
    input.replaceWith(span);
  }

  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); opslaan(); }
    if (e.key === 'Escape') opslaan();
  });
}

function openOpdrachtModal(opdrachtId = null, klasId = null, defaultPeriode = 1, defaultWeek = null) {
  const o = opdrachtId ? DB.getOpdracht(opdrachtId) : null;
  const klassen = Auth.getZichtbareKlassen();
  const selectedKlas = klasId || o?.klasId || (klassen[0]?.id);
  const schooljaar = DB.getKlas(selectedKlas)?.schooljaar;
  const weken = schooljaar ? DB.getWeken(schooljaar).filter(w => !w.isVakantie) : [];

  openModal(`
    <h2>${o ? 'Opdracht bewerken' : 'Opdracht toevoegen'}</h2>
    <p class="modal-sub">Vul de gegevens in. De opdracht wordt gekoppeld aan een week in de jaarplanning.</p>

    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam opdracht / activiteit *</label>
        <input type="text" id="o-naam" placeholder="bijv. Businessmodel Canvas" value="${escHtml(o?.naam || '')}">
      </div>
      <div class="form-field">
        <label>Klas *</label>
        <select id="o-klas" onchange="refreshWekenSelect()">
          ${klassen.map(k => `<option value="${k.id}" ${(klasId && k.id === klasId) || o?.klasId === k.id ? 'selected' : ''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Periode</label>
        <select id="o-periode">
          ${[1,2,3,4].map(p => `<option value="${p}" ${(o?.periode || defaultPeriode) == p ? 'selected' : ''}>Periode ${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Week *</label>
        <select id="o-weeknummer">
          <option value="">— Selecteer week —</option>
          ${weken.map(w => `<option value="${w.weeknummer}"
            ${(o?.weeknummer === w.weeknummer) || defaultWeek === w.weeknummer ? 'selected' : ''}>
            Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema ? ' · ' + w.thema : ''}
          </option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Type *</label>
        <select id="o-type">
          ${['Theorie','Opdracht','Toets','Praktijk','Project','Groepsopdracht','Presentatie'].map(t =>
            `<option value="${t}" ${o?.type === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Syllabuscodes (bijv. PIE-1.1, PIE-1.2)</label>
        <input type="text" id="o-syllabus" placeholder="PIE-1.1, PIE-1.2" value="${escHtml(o?.syllabuscodes || '')}">
      </div>
      <div class="form-field form-full">
        <label>Werkboek / hoofdstuk / pagina</label>
        <input type="text" id="o-werkboek" placeholder="bijv. H3 p.20-28" value="${escHtml(o?.werkboekLink || '')}">
      </div>
      <div class="form-field form-full">
        <label>Beschrijving</label>
        <textarea id="o-beschrijving" placeholder="Korte beschrijving van de opdracht">${escHtml(o?.beschrijving || '')}</textarea>
      </div>
      <div class="form-field form-full">
        <label>Link theoriemateriaal</label>
        <input type="text" id="o-theorie" placeholder="https://..." value="${escHtml(o?.theorieLink || '')}">
      </div>
      <div class="form-field form-full">
        <label>Toetsbestand (bestandsnaam na uploaden)</label>
        <input type="text" id="o-toets" placeholder="bijv. toets_periode1.pdf" value="${escHtml(o?.toetsBestand || '')}">
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

function refreshWekenSelect() {
  const klasId = document.getElementById('o-klas')?.value;
  const schooljaar = DB.getKlas(klasId)?.schooljaar;
  const weken = schooljaar ? DB.getWeken(schooljaar).filter(w => !w.isVakantie) : [];
  const sel = document.getElementById('o-weeknummer');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecteer week —</option>` +
    weken.map(w => `<option value="${w.weeknummer}">Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema ? ' · ' + w.thema : ''}</option>`).join('');
}

function saveOpdracht(opdrachtId) {
  const naam = document.getElementById('o-naam').value.trim();
  const klasId = document.getElementById('o-klas').value;
  const periode = parseInt(document.getElementById('o-periode').value);
  const weeknummer = parseInt(document.getElementById('o-weeknummer').value);
  const type = document.getElementById('o-type').value;
  const syllabuscodes = document.getElementById('o-syllabus').value.trim();
  const werkboekLink = document.getElementById('o-werkboek').value.trim();
  const beschrijving = document.getElementById('o-beschrijving').value.trim();
  const theorieLink = document.getElementById('o-theorie').value.trim();
  const toetsBestand = document.getElementById('o-toets').value.trim() || null;
  const schooljaar = DB.getKlas(klasId)?.schooljaar;

  if (!naam || !klasId || !weeknummer || !type) {
    alert('Vul alle verplichte velden in (naam, klas, week, type).');
    return;
  }

  const data = {
    naam, klasId, periode, weeknummer, weken: String(weeknummer),
    schooljaar, type, syllabuscodes, werkboekLink,
    beschrijving, theorieLink, toetsBestand
  };

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
