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
    const perType = { profieldeel: [], keuzedeel: [], overig: [] };
    modules.forEach(m => {
      const t = m.type === 'profieldeel' ? 'profieldeel' : m.type === 'keuzedeel' ? 'keuzedeel' : 'overig';
      perType[t].push(m);
    });

    document.getElementById('view-lesmodules').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Les Modules</h1>
          <p class="page-sub">Profiel- en keuzedelen met theoriestappen voor EloDigitaal. Gebruik ze als basis bij het aanmaken van lesprofielen.</p>
        </div>
        <button class="btn btn-primary" onclick="openLesModuleModal()">+ Nieuwe les module</button>
      </div>

      ${modules.length === 0
        ? `<div class="card"><div class="empty-state">
            <h3>Nog geen les modules</h3>
            <p>Upload een syllabus PDF of Word-bestand. AI haalt de theoriestappen automatisch eruit.</p>
            <button class="btn btn-primary" onclick="openLesModuleModal()">Eerste module aanmaken</button>
           </div></div>`
        : ['profieldeel', 'keuzedeel', 'overig'].map(type => {
            const lijst = perType[type];
            if (!lijst.length) return '';
            const label = type === 'profieldeel' ? 'Profieldelen' : type === 'keuzedeel' ? 'Keuzedelen' : 'Overig';
            const badgeKleur = type === 'profieldeel' ? '#3b82f6' : type === 'keuzedeel' ? '#10b981' : '#6b7280';
            const typeLabel = type === 'profieldeel' ? 'Profieldeel' : type === 'keuzedeel' ? 'Keuzedeel' : 'Overig';
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <h2>${label}</h2>
                <span style="font-size:12px;color:var(--ink-muted)">${lijst.length} module${lijst.length !== 1 ? 's' : ''}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:16px">
                ${lijst.map(m => `
                  <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;background:var(--surface);display:flex;flex-direction:column;gap:8px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:${badgeKleur};color:#fff;letter-spacing:.3px">${typeLabel}</span>
                      <span style="font-size:11px;color:var(--ink-muted)">${m.niveau ? escHtml(m.niveau) : 'Alle niveaus'}</span>
                    </div>
                    <div style="font-weight:600;font-size:14px;line-height:1.3">${escHtml(m.naam)}</div>
                    <div style="display:flex;gap:6px;margin-top:auto;padding-top:4px">
                      <button class="btn btn-sm" style="flex:1" onclick="bekijkLesModule('${m.id}')">Bekijk</button>
                      <button class="icon-btn" onclick="openLesModuleModal('${m.id}')" title="Bewerken">✏️</button>
                      <button class="icon-btn" style="color:var(--red)" onclick="verwijderLesModule('${m.id}','${escHtml(m.naam)}')" title="Verwijderen">🗑</button>
                    </div>
                  </div>`).join('')}
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
  const isLegacy = stappen.length > 0 && typeof stappen[0] === 'string';
  const badgeKleur = m.type === 'profieldeel' ? '#3b82f6' : m.type === 'keuzedeel' ? '#10b981' : '#6b7280';
  const typeLabel = m.type === 'profieldeel' ? 'Profieldeel' : m.type === 'keuzedeel' ? 'Keuzedeel' : 'Overig';

  let stappenHtml;
  if (!stappen.length) {
    stappenHtml = '<div style="padding:16px;color:var(--ink-muted);font-size:13px">Nog geen stappen gedefinieerd.</div>';
  } else if (isLegacy) {
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
      Stappen ${stappen.length ? `<span style="font-weight:400;font-size:12px;color:var(--ink-muted)">(${isLegacy ? stappen.length + ' stappen' : stappen.length + ' hoofdstappen'})</span>` : ''}
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

  openModal(`
    <h2>${m ? 'Les module bewerken' : 'Nieuwe les module'}</h2>
    <p class="modal-sub">Kies eerst het type en niveau. Upload dan een PDF of Word-bestand — AI haalt de theoriestappen eruit (toetsen worden overgeslagen).</p>

    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-field"><label>Type *</label>
        <select id="lm-type" onchange="lmOnTypeChange()">
          <option value="profieldeel" ${(!m || m.type === 'profieldeel') ? 'selected' : ''}>Profieldeel (max 8 hoofdstappen)</option>
          <option value="keuzedeel" ${m?.type === 'keuzedeel' ? 'selected' : ''}>Keuzedeel (max 5 hoofdstappen)</option>
        </select>
      </div>
      <div class="form-field"><label>Niveau *</label>
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
        <textarea id="lm-beschrijving" rows="2" style="resize:vertical" placeholder="Korte omschrijving van het profiel- of keuzedeel">${escHtml(m?.beschrijving || '')}</textarea>
      </div>
    </div>

    <div id="lm-upload-sectie" style="${m ? 'display:none' : ''}">
      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px">
      <div class="form-field form-full">
        <label>PDF of Word uploaden</label>
        <input id="lm-bestand" type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
        <small style="color:var(--ink-muted)">Syllabus, profieldeel- of keuzedeel-document. Toetsmomenten worden automatisch overgeslagen.</small>
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
        ${lmStappenHtml(m?.stappen || [])}
      </div>
    </div>
    <input id="lm-bron-bestand" type="hidden" value="${escHtml(m?.bronBestand || '')}">

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaLesModuleOp('${moduleId || ''}')">Opslaan</button>
    </div>
  `);
  lmUpdateStapCount();
}

function lmGetMax() {
  const type = document.getElementById('lm-type')?.value || 'profieldeel';
  return type === 'keuzedeel' ? 5 : 8;
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

async function slaLesModuleOp(moduleId) {
  const naam = document.getElementById('lm-naam')?.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }

  const payload = {
    naam,
    type: document.getElementById('lm-type')?.value || 'profieldeel',
    vakId: document.getElementById('lm-vak')?.value || null,
    niveau: document.getElementById('lm-niveau')?.value || '',
    beschrijving: document.getElementById('lm-beschrijving')?.value.trim() || '',
    stappen: lmLeesStappen(),
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
