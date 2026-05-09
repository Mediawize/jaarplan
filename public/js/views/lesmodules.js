// ============================================================
// public/js/views/lesmodules.js
// Les Modules — admin sectie voor profiel- en keuzedelen
// ============================================================

async function renderLesModules() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-lesmodules').innerHTML =
      '<div class="empty-state"><h3>Geen toegang</h3><p>Alleen admins kunnen les modules beheren.</p></div>';
    return;
  }
  showLoading('lesmodules');
  try {
    const [modules, vakken] = await Promise.all([API.getLesModules(), API.getVakken()]);
    const perGroep = { theorie_profieldeel: [], theorie_keuzedeel: [], theorie_overig: [], praktijk: [] };
    modules.forEach(m => {
      const cat = m.categorie || 'theorie';
      if (cat === 'praktijk') { perGroep.praktijk.push(m); return; }
      const t = m.type === 'profieldeel' ? 'theorie_profieldeel' : m.type === 'keuzedeel' ? 'theorie_keuzedeel' : 'theorie_overig';
      perGroep[t].push(m);
    });

    const groepen = [
      { key: 'theorie_profieldeel', label: 'Theorie — Profieldelen',  badgeKleur: '#3b82f6', typeLabel: 'Profieldeel' },
      { key: 'theorie_keuzedeel',   label: 'Theorie — Keuzedelen',    badgeKleur: '#10b981', typeLabel: 'Keuzedeel' },
      { key: 'theorie_overig',      label: 'Theorie — Overig',        badgeKleur: '#6b7280', typeLabel: 'Overig' },
      { key: 'praktijk',            label: 'Praktijk modules',        badgeKleur: '#f59e0b', typeLabel: 'Praktijk' },
    ];

    document.getElementById('view-lesmodules').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Les Modules</h1>
          <p class="page-sub">Theorie- en praktijk modules voor EloDigitaal. Gebruik ze als basis bij het aanmaken van lesprofielen.</p>
        </div>
        <button class="btn btn-primary" onclick="openLesModuleModal()">+ Nieuwe les module</button>
      </div>

      ${modules.length === 0
        ? `<div class="card"><div class="empty-state">
            <h3>Nog geen les modules</h3>
            <p>Maak een theorie module aan via PDF/Word, of voeg handmatig een praktijk module toe.</p>
            <button class="btn btn-primary" onclick="openLesModuleModal()">Eerste module aanmaken</button>
           </div></div>`
        : groepen.map(({ key, label, badgeKleur, typeLabel }) => {
            const lijst = perGroep[key];
            if (!lijst.length) return '';
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <h2>${label}</h2>
                <span style="font-size:12px;color:var(--ink-muted)">${lijst.length} module${lijst.length !== 1 ? 's' : ''}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:16px">
                ${lijst.map(m => {
                  const cat = m.categorie || 'theorie';
                  const aantalStappen = (m.stappen || []).length;
                  const meta = cat === 'praktijk'
                    ? `${aantalStappen} opdracht${aantalStappen !== 1 ? 'en' : ''}`
                    : (m.type === 'profieldeel' ? 'Profieldeel' : m.type === 'keuzedeel' ? 'Keuzedeel' : 'Overig') + ` · ${aantalStappen} stapp${aantalStappen !== 1 ? 'en' : ''}`;
                  return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;background:var(--surface);display:flex;flex-direction:column;gap:8px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:${badgeKleur};color:#fff;letter-spacing:.3px">${typeLabel}</span>
                      <span style="font-size:11px;color:var(--ink-muted)">${m.niveau ? escHtml(m.niveau) : 'Alle niveaus'}</span>
                    </div>
                    <div style="font-weight:600;font-size:14px;line-height:1.3">${escHtml(m.naam)}</div>
                    <div style="font-size:11px;color:var(--ink-muted)">${meta}</div>
                    <div style="display:flex;gap:6px;margin-top:auto;padding-top:4px">
                      <button class="btn btn-sm" style="flex:1" onclick="bekijkLesModule('${m.id}')">Bekijk</button>
                      <button class="icon-btn" onclick="openLesModuleModal('${m.id}')" title="Bewerken">✏️</button>
                      <button class="icon-btn" style="color:var(--red)" onclick="verwijderLesModule('${m.id}','${escHtml(m.naam)}')" title="Verwijderen">🗑</button>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')
      }`;
  } catch (e) { showError('Fout: ' + e.message); }
}

async function bekijkLesModule(moduleId) {
  const [modules, vakken] = await Promise.all([API.getLesModules(), API.getVakken()]);
  const m = modules.find(x => x.id === moduleId);
  if (!m) return;
  const vak = vakken.find(v => v.id === m.vakId);
  const stappen = m.stappen || [];
  const cat = m.categorie || 'theorie';

  let badgeKleur, typeLabel;
  if (cat === 'praktijk') {
    badgeKleur = '#f59e0b'; typeLabel = 'Praktijk';
  } else {
    badgeKleur = m.type === 'profieldeel' ? '#3b82f6' : m.type === 'keuzedeel' ? '#10b981' : '#6b7280';
    typeLabel = m.type === 'profieldeel' ? 'Profieldeel' : m.type === 'keuzedeel' ? 'Keuzedeel' : 'Overig';
  }

  let stappenHtml;
  if (!stappen.length) {
    stappenHtml = '<div style="padding:16px;color:var(--ink-muted);font-size:13px">Nog geen stappen gedefinieerd.</div>';
  } else if (cat === 'praktijk') {
    stappenHtml = stappen.map((opdracht, i) => {
      const codes = Array.isArray(opdracht.syllabusCodes) ? opdracht.syllabusCodes : [];
      return `<div style="padding:10px 14px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
          <span style="font-weight:600;font-size:13px;min-width:20px;color:var(--accent)">${i + 1}.</span>
          <span style="font-weight:600;font-size:13px">${escHtml(opdracht.naam || '')}</span>
        </div>
        ${opdracht.omschrijving ? `<div style="font-size:12px;color:var(--ink-muted);margin-left:28px;margin-bottom:4px">${escHtml(opdracht.omschrijving)}</div>` : ''}
        <div style="margin-left:28px;display:flex;flex-wrap:wrap;gap:6px;font-size:11px">
          ${opdracht.theorieSectie ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px">📚 ${escHtml(opdracht.theorieSectie)}</span>` : ''}
          ${codes.map(c => `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:99px">${escHtml(c)}</span>`).join('')}
          ${opdracht.werkboekjeLink ? `<a href="${escHtml(opdracht.werkboekjeLink)}" target="_blank" style="color:var(--accent)">🔗 Werkboekje</a>` : ''}
          ${opdracht.werkboekjeBestand ? `<span style="color:var(--ink-muted)">📄 ${escHtml(opdracht.werkboekjeBestand)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  } else {
    const isLegacy = stappen.length > 0 && typeof stappen[0] === 'string';
    if (isLegacy) {
      stappenHtml = stappen.map((s, i) => `
        <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:baseline;font-size:13px">
          <span style="min-width:20px;font-weight:600;color:var(--ink-muted)">${i + 1}.</span>
          <span>${escHtml(s)}</span>
        </div>`).join('');
    } else {
      stappenHtml = stappen.map((stap, i) => {
        const lessen = Array.isArray(stap.lessen) ? stap.lessen : [];
        return `<div style="margin-bottom:2px">
          <div style="padding:8px 12px;background:#f8f9fa;font-weight:600;font-size:13px;display:flex;gap:8px;align-items:center">
            <span style="min-width:20px;color:var(--accent)">${i + 1}.</span>
            <span>${escHtml(stap.naam)}</span>
          </div>
          ${lessen.map((les, j) => `
            <div style="padding:6px 12px 6px 40px;border-bottom:1px solid var(--border);font-size:13px;color:var(--ink-muted);display:flex;gap:8px">
              <span style="min-width:28px;flex-shrink:0">${i + 1}.${j + 1}</span>
              <span>${escHtml(les)}</span>
            </div>`).join('')}
        </div>`;
      }).join('');
    }
  }

  const aantalLabel = cat === 'praktijk'
    ? `${stappen.length} opdracht${stappen.length !== 1 ? 'en' : ''}`
    : (typeof stappen[0] === 'string' ? stappen.length + ' stappen' : stappen.length + ' hoofdstappen');

  openModal(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;background:${badgeKleur};color:#fff">${typeLabel}</span>
      <span style="font-size:12px;color:var(--ink-muted)">${m.niveau ? escHtml(m.niveau) : 'Alle niveaus'}</span>
    </div>
    <h2 style="margin:6px 0 4px">${escHtml(m.naam)}</h2>
    ${vak ? `<div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px">Vak: ${escHtml(vak.naam)}</div>` : ''}
    ${m.beschrijving ? `<p style="font-size:13px;color:var(--ink-sub,var(--ink-muted));margin:0 0 12px">${escHtml(m.beschrijving)}</p>` : ''}
    ${m.bronBestand ? `<div style="font-size:11px;color:var(--ink-muted);margin-bottom:12px">📄 ${escHtml(m.bronBestand)}</div>` : ''}

    <div style="font-weight:600;font-size:14px;margin-bottom:8px">
      ${cat === 'praktijk' ? 'Opdrachten' : 'Stappen'} ${stappen.length ? `<span style="font-weight:400;font-size:12px;color:var(--ink-muted)">(${aantalLabel})</span>` : ''}
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:420px;overflow-y:auto">
      ${stappenHtml}
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
      <button class="btn btn-primary" onclick="closeModalDirect();openLesModuleModal('${moduleId}')">Bewerken</button>
    </div>
  `);
}

async function openLesModuleModal(moduleId = null) {
  const [vakken, modules] = await Promise.all([API.getVakken(), API.getLesModules()]);
  const m = moduleId ? modules.find(x => x.id === moduleId) : null;
  const cat = m?.categorie || 'theorie';

  openModal(`
    <h2>${m ? 'Les module bewerken' : 'Nieuwe les module'}</h2>

    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-field">
        <label>Categorie *</label>
        <select id="lm-categorie" onchange="lmOnCategorieChange()">
          <option value="theorie" ${cat !== 'praktijk' ? 'selected' : ''}>Theorie module</option>
          <option value="praktijk" ${cat === 'praktijk' ? 'selected' : ''}>Praktijk module</option>
        </select>
      </div>
      <div class="form-field" id="lm-type-veld" style="${cat === 'praktijk' ? 'display:none' : ''}">
        <label>Type *</label>
        <select id="lm-type" onchange="lmOnTypeChange()">
          <option value="profieldeel" ${(!m || m.type === 'profieldeel') ? 'selected' : ''}>Profieldeel (max 8 hoofdstappen)</option>
          <option value="keuzedeel" ${m?.type === 'keuzedeel' ? 'selected' : ''}>Keuzedeel (max 5 hoofdstappen)</option>
        </select>
      </div>
      <div class="form-field"><label>Niveau</label>
        <select id="lm-niveau">
          ${['BB', 'KB', 'GL', 'TL', 'Havo', 'VWO', ''].map(n => `<option value="${n}" ${(m?.niveau || '') === n ? 'selected' : ''}>${n || 'Alle niveaus'}</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label>Vak</label>
        <select id="lm-vak">
          <option value="">Geen specifiek vak</option>
          ${vakken.map(v => `<option value="${v.id}" ${m?.vakId === v.id ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full"><label>Naam *</label><input id="lm-naam" value="${escHtml(m?.naam || '')}" placeholder="bijv. Profieldeel Wonen - GL"></div>
      <div class="form-field form-full"><label>Beschrijving</label>
        <textarea id="lm-beschrijving" rows="2" style="resize:vertical" placeholder="Korte omschrijving">${escHtml(m?.beschrijving || '')}</textarea>
      </div>
    </div>

    <!-- Theorie: upload + hoofdstappen -->
    <div id="lm-theorie-sectie" style="${cat === 'praktijk' ? 'display:none' : ''}">
      <div id="lm-upload-sectie" style="${m ? 'display:none' : ''}">
        <hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px">
        <div class="form-field form-full">
          <label>PDF of Word uploaden</label>
          <input id="lm-bestand" type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
          <small style="color:var(--ink-muted)">Syllabus of profieldeel-document. Toetsmomenten worden automatisch overgeslagen.</small>
        </div>
        <button class="btn btn-primary" style="margin-bottom:16px" onclick="analyseerLesModuleBestand()">AI analyseer bestand</button>
        <div id="lm-analyse-status"></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
      </div>
      ${m ? `<button class="btn btn-sm" style="margin-bottom:16px" onclick="document.getElementById('lm-upload-sectie').style.display='block';this.remove()">↻ Nieuw bestand analyseren</button>` : ''}

      <div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-weight:600;font-size:14px">Hoofdstappen <span id="lm-stapcount" style="font-size:12px;color:var(--ink-muted);font-weight:400"></span></label>
          <button class="btn btn-sm" id="lm-voeg-stap-btn" onclick="lmVoegHoofdstapToe()">+ Hoofdstap toevoegen</button>
        </div>
        <div id="lm-stappen-lijst" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);max-height:420px;overflow-y:auto">
          ${lmStappenHtml(cat !== 'praktijk' ? (m?.stappen || []) : [])}
        </div>
      </div>
    </div>

    <!-- Praktijk: opdrachten lijst -->
    <div id="lm-praktijk-sectie" style="${cat !== 'praktijk' ? 'display:none' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label style="font-weight:600;font-size:14px">Opdrachten <span id="lm-opdracht-count" style="font-size:12px;color:var(--ink-muted);font-weight:400"></span></label>
        <button class="btn btn-sm" onclick="lmVoegOpdrachtToe()">+ Opdracht toevoegen</button>
      </div>
      <div id="lm-opdrachten-lijst" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);max-height:500px;overflow-y:auto">
        ${lmOpdrachtenHtml(cat === 'praktijk' ? (m?.stappen || []) : [])}
      </div>
    </div>

    <input id="lm-bron-bestand" type="hidden" value="${escHtml(m?.bronBestand || '')}">

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaLesModuleOp('${moduleId || ''}')">Opslaan</button>
    </div>
  `);
  lmUpdateStapCount();
  lmUpdateOpdrachtCount();
}

// ============================================================
// THEORIE MODULE helpers
// ============================================================

function lmGetMax() {
  const type = document.getElementById('lm-type')?.value || 'profieldeel';
  return type === 'keuzedeel' ? 5 : 8;
}

function lmOnCategorieChange() {
  const cat = document.getElementById('lm-categorie')?.value || 'theorie';
  document.getElementById('lm-type-veld').style.display = cat === 'praktijk' ? 'none' : '';
  document.getElementById('lm-theorie-sectie').style.display = cat === 'praktijk' ? 'none' : '';
  document.getElementById('lm-praktijk-sectie').style.display = cat !== 'praktijk' ? 'none' : '';
}

function lmOnTypeChange() {
  lmUpdateStapCount();
}

function lmStappenHtml(stappen) {
  if (!stappen || !stappen.length) {
    return '<div style="padding:16px;text-align:center;color:var(--ink-muted);font-size:13px">Nog geen stappen. Upload een bestand of voeg stappen handmatig toe.</div>';
  }
  const isLegacy = typeof stappen[0] === 'string';
  if (isLegacy) {
    return stappen.map((s, i) => lmHoofdstapHtml(i, { naam: s, lessen: [] })).join('');
  }
  return stappen.map((stap, i) => lmHoofdstapHtml(i, stap)).join('');
}

function lmHoofdstapHtml(i, stap) {
  const naam = stap.naam || '';
  const lessen = Array.isArray(stap.lessen) ? stap.lessen : [];
  const lessenHtml = lessen.map((les, j) => lmLesHtml(i, j, les)).join('');
  return `<div class="lm-hoofdstap" data-idx="${i}" style="border-bottom:1px solid var(--border);padding:10px 12px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;flex-shrink:0">${i + 1}</span>
      <input class="lm-hoofdstap-input" value="${escHtml(naam)}" placeholder="Naam van de hoofdstap (bijv. Elektrische installaties)"
        style="flex:1;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:500"
        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      <button onclick="this.closest('.lm-hoofdstap').remove();lmUpdateStapCount()"
        style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:18px;line-height:1;padding:2px 4px" title="Verwijder hoofdstap">×</button>
    </div>
    <div class="lm-lessen" style="padding-left:30px">
      ${lessenHtml}
      <button class="btn btn-sm lm-voeg-les-btn" onclick="lmVoegLesToe(this)"
        style="margin-top:4px;font-size:11px;padding:3px 8px${lessen.length >= 3 ? ';opacity:.4' : ''}"
        ${lessen.length >= 3 ? 'disabled' : ''}>+ Les toevoegen</button>
    </div>
  </div>`;
}

function lmLesHtml(stapIdx, lesIdx, les) {
  return `<div class="lm-les-rij" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
    <span style="font-size:11px;color:var(--ink-muted);min-width:28px;flex-shrink:0">${stapIdx + 1}.${lesIdx + 1}</span>
    <input class="lm-les-input" value="${escHtml(les)}" placeholder="Naam van de les"
      style="flex:1;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px"
      onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
    <button onclick="lmVerwijderLes(this)" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:14px;line-height:1;padding:2px 4px">×</button>
  </div>`;
}

function lmVerwijderLes(btn) {
  const stap = btn.closest('.lm-hoofdstap');
  btn.closest('.lm-les-rij').remove();
  lmUpdateLesNummers(stap);
  lmUpdateVoegLesKnop(stap);
}

function lmVoegLesToe(btn) {
  const stap = btn.closest('.lm-hoofdstap');
  const lessenDiv = stap.querySelector('.lm-lessen');
  const bestaandeLessen = stap.querySelectorAll('.lm-les-rij').length;
  if (bestaandeLessen >= 3) return;
  const hoofdstappen = Array.from(document.querySelectorAll('.lm-hoofdstap'));
  const stapIdx = hoofdstappen.indexOf(stap);
  const div = document.createElement('div');
  div.innerHTML = lmLesHtml(stapIdx, bestaandeLessen, '');
  lessenDiv.insertBefore(div.firstElementChild, btn);
  lessenDiv.querySelectorAll('.lm-les-input')[bestaandeLessen]?.focus();
  lmUpdateLesNummers(stap);
  lmUpdateVoegLesKnop(stap);
}

function lmUpdateLesNummers(stap) {
  if (!stap) return;
  const hoofdstappen = Array.from(document.querySelectorAll('.lm-hoofdstap'));
  const stapIdx = hoofdstappen.indexOf(stap);
  stap.querySelectorAll('.lm-les-rij').forEach((rij, j) => {
    const numEl = rij.querySelector('span');
    if (numEl) numEl.textContent = `${stapIdx + 1}.${j + 1}`;
  });
}

function lmUpdateVoegLesKnop(stap) {
  if (!stap) return;
  const btn = stap.querySelector('.lm-voeg-les-btn');
  if (!btn) return;
  const count = stap.querySelectorAll('.lm-les-rij').length;
  btn.disabled = count >= 3;
  btn.style.opacity = count >= 3 ? '.4' : '1';
}

function lmVoegHoofdstapToe() {
  const lijst = document.getElementById('lm-stappen-lijst');
  if (!lijst) return;
  const max = lmGetMax();
  const bestaand = lijst.querySelectorAll('.lm-hoofdstap').length;
  if (bestaand >= max) return;
  const leeg = lijst.querySelector('[style*="Nog geen stappen"]');
  if (leeg) leeg.remove();
  const div = document.createElement('div');
  div.innerHTML = lmHoofdstapHtml(bestaand, { naam: '', lessen: [] });
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('.lm-hoofdstap-input')?.focus();
  lmUpdateStapCount();
}

function lmUpdateStapCount() {
  const count = document.querySelectorAll('.lm-hoofdstap').length;
  const max = lmGetMax();
  const el = document.getElementById('lm-stapcount');
  if (el) el.textContent = count ? `(${count}/${max} hoofdstappen)` : `(max ${max})`;
  const voegBtn = document.getElementById('lm-voeg-stap-btn');
  if (voegBtn) {
    voegBtn.disabled = count >= max;
    voegBtn.style.opacity = count >= max ? '.4' : '1';
  }
}

function lmLeesStappen() {
  return Array.from(document.querySelectorAll('.lm-hoofdstap')).map(stap => {
    const naam = stap.querySelector('.lm-hoofdstap-input')?.value.trim() || '';
    const lessen = Array.from(stap.querySelectorAll('.lm-les-input'))
      .map(i => i.value.trim()).filter(Boolean);
    return { naam, lessen };
  }).filter(s => s.naam);
}

async function analyseerLesModuleBestand() {
  const input = document.getElementById('lm-bestand');
  const statusEl = document.getElementById('lm-analyse-status');
  if (!input?.files?.[0]) { if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);font-size:13px">Kies eerst een bestand.</span>'; return; }

  if (statusEl) statusEl.innerHTML = '<span style="color:var(--ink-muted);font-size:13px">⏳ AI analyseert het bestand...</span>';

  const niveau = document.getElementById('lm-niveau')?.value || '';
  const type = document.getElementById('lm-type')?.value || 'profieldeel';

  const fd = new FormData();
  fd.append('bestand', input.files[0]);
  fd.append('niveau', niveau);
  fd.append('type', type);
  try {
    const res = await fetch('/api/les-modules/analyseer', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');

    const naamEl = document.getElementById('lm-naam');
    if (naamEl && !naamEl.value.trim()) naamEl.value = data.naam || '';
    document.getElementById('lm-bron-bestand').value = data.bronBestand || '';

    const lijst = document.getElementById('lm-stappen-lijst');
    if (lijst) lijst.innerHTML = lmStappenHtml(data.stappen || []);
    lmUpdateStapCount();

    const aantalHoofdstappen = (data.stappen || []).length;
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success" style="margin-top:8px">${aantalHoofdstappen} hoofdstappen gevonden uit "${escHtml(data.bronBestand || '')}".</div>`;
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:8px;font-size:13px">Fout: ${escHtml(e.message)}</div>`;
  }
}

// ============================================================
// PRAKTIJK MODULE helpers
// ============================================================

function lmOpdrachtenHtml(opdrachten) {
  if (!opdrachten || !opdrachten.length) {
    return '<div id="lm-opdrachten-leeg" style="padding:16px;text-align:center;color:var(--ink-muted);font-size:13px">Nog geen opdrachten. Voeg opdrachten handmatig toe.</div>';
  }
  return opdrachten.map((o, i) => lmOpdrachtHtml(i, o)).join('');
}

function lmOpdrachtHtml(i, o) {
  const codes = Array.isArray(o.syllabusCodes) ? o.syllabusCodes.join(', ') : '';
  return `<div class="lm-opdracht" data-idx="${i}" style="border-bottom:1px solid var(--border);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#f59e0b;color:#fff;font-size:11px;flex-shrink:0">${i + 1}</span>
      <input class="lm-opdracht-naam" value="${escHtml(o.naam || '')}" placeholder="Naam van de opdracht"
        style="flex:1;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:500"
        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      <button onclick="this.closest('.lm-opdracht').remove();lmUpdateOpdrachtCount()"
        style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:18px;line-height:1;padding:2px 4px" title="Verwijder opdracht">×</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-left:30px">
      <div class="form-field" style="margin:0">
        <label style="font-size:11px">Omschrijving</label>
        <input class="lm-opdracht-omschrijving" value="${escHtml(o.omschrijving || '')}" placeholder="Korte omschrijving"
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:11px">Werkboekje link (optioneel)</label>
        <input class="lm-opdracht-link" value="${escHtml(o.werkboekjeLink || '')}" placeholder="https://..."
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:11px">Theorie-onderdeel (AI)</label>
        <input class="lm-opdracht-theorie" value="${escHtml(o.theorieSectie || '')}" placeholder="Bijv. Materiaalkennis"
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:11px">Syllabus codes (komma-gescheiden)</label>
        <input class="lm-opdracht-codes" value="${escHtml(codes)}" placeholder="K/PIE/2.1, K/DT/3.2"
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%">
      </div>
    </div>
    <div style="margin-left:30px;margin-top:8px;display:flex;align-items:center;gap:8px">
      <label style="font-size:11px;color:var(--ink-muted);white-space:nowrap">Werkboekje uploaden:</label>
      <input class="lm-opdracht-bestand" type="file" accept=".pdf,.docx" style="font-size:11px;flex:1">
      <button class="btn btn-sm" onclick="lmAnalyseerPraktijkBestand(this)" style="font-size:11px;white-space:nowrap">AI analyseer</button>
      <span class="lm-opdracht-bestandsnaam" style="font-size:11px;color:var(--ink-muted)">${o.werkboekjeBestand ? escHtml(o.werkboekjeBestand) : ''}</span>
    </div>
  </div>`;
}

function lmVoegOpdrachtToe() {
  const lijst = document.getElementById('lm-opdrachten-lijst');
  if (!lijst) return;
  const leeg = lijst.querySelector('#lm-opdrachten-leeg');
  if (leeg) leeg.remove();
  const bestaand = lijst.querySelectorAll('.lm-opdracht').length;
  const div = document.createElement('div');
  div.innerHTML = lmOpdrachtHtml(bestaand, {});
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('.lm-opdracht-naam')?.focus();
  lmUpdateOpdrachtCount();
}

function lmUpdateOpdrachtCount() {
  const count = document.querySelectorAll('.lm-opdracht').length;
  const el = document.getElementById('lm-opdracht-count');
  if (el) el.textContent = count ? `(${count})` : '';
}

async function lmAnalyseerPraktijkBestand(btn) {
  const rij = btn.closest('.lm-opdracht');
  if (!rij) return;
  const fileInput = rij.querySelector('.lm-opdracht-bestand');
  const naamInput = rij.querySelector('.lm-opdracht-naam');
  const theorieInput = rij.querySelector('.lm-opdracht-theorie');
  const codesInput = rij.querySelector('.lm-opdracht-codes');
  const bestandsnaamEl = rij.querySelector('.lm-opdracht-bestandsnaam');

  if (!fileInput?.files?.[0]) { alert('Kies eerst een bestand voor deze opdracht.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳';

  const fd = new FormData();
  fd.append('bestand', fileInput.files[0]);
  fd.append('opdrachtnaam', naamInput?.value || '');
  fd.append('niveau', document.getElementById('lm-niveau')?.value || '');

  try {
    const res = await fetch('/api/les-modules/analyseer-praktijk', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');

    if (theorieInput && data.theorieSectie) theorieInput.value = data.theorieSectie;
    if (codesInput && data.syllabusCodes?.length) codesInput.value = data.syllabusCodes.join(', ');
    if (bestandsnaamEl && data.bestandsnaam) bestandsnaamEl.textContent = data.bestandsnaam;
    rij.dataset.werkboekjeBestand = data.bestandsnaam || '';
  } catch (e) {
    alert('Fout bij analyseren: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI analyseer';
  }
}

function lmLeesOpdrachten() {
  return Array.from(document.querySelectorAll('.lm-opdracht')).map(rij => {
    const naam = rij.querySelector('.lm-opdracht-naam')?.value.trim() || '';
    const omschrijving = rij.querySelector('.lm-opdracht-omschrijving')?.value.trim() || '';
    const werkboekjeLink = rij.querySelector('.lm-opdracht-link')?.value.trim() || '';
    const theorieSectie = rij.querySelector('.lm-opdracht-theorie')?.value.trim() || '';
    const codesRaw = rij.querySelector('.lm-opdracht-codes')?.value.trim() || '';
    const syllabusCodes = codesRaw ? codesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const werkboekjeBestand = rij.dataset.werkboekjeBestand || rij.querySelector('.lm-opdracht-bestandsnaam')?.textContent.trim() || '';
    return { naam, omschrijving, werkboekjeLink, theorieSectie, syllabusCodes, werkboekjeBestand };
  }).filter(o => o.naam);
}

// ============================================================
// OPSLAAN
// ============================================================

async function slaLesModuleOp(moduleId) {
  const naam = document.getElementById('lm-naam')?.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }

  const categorie = document.getElementById('lm-categorie')?.value || 'theorie';
  const stappen = categorie === 'praktijk' ? lmLeesOpdrachten() : lmLeesStappen();

  const payload = {
    naam,
    categorie,
    type: categorie === 'praktijk' ? 'praktijk' : (document.getElementById('lm-type')?.value || 'profieldeel'),
    vakId: document.getElementById('lm-vak')?.value || null,
    niveau: document.getElementById('lm-niveau')?.value || '',
    beschrijving: document.getElementById('lm-beschrijving')?.value.trim() || '',
    stappen,
    bronBestand: document.getElementById('lm-bron-bestand')?.value || ''
  };

  try {
    if (moduleId) {
      await fetch(`/api/les-modules/${moduleId}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/les-modules', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    closeModalDirect();
    await renderLesModules();
  } catch (e) { alert('Fout bij opslaan: ' + e.message); }
}

async function verwijderLesModule(id, naam) {
  if (!confirm(`Les module "${naam}" verwijderen?`)) return;
  try {
    await fetch(`/api/les-modules/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    await renderLesModules();
  } catch (e) { alert('Fout: ' + e.message); }
}
