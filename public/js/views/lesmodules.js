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
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <h2>${label}</h2>
                <span style="font-size:12px;color:var(--ink-muted)">${lijst.length} module${lijst.length !== 1 ? 's' : ''}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;padding:16px">
                ${lijst.map(m => {
                  const vak = vakken.find(v => v.id === m.vakId);
                  return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;background:var(--surface)">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
                      <div>
                        <div style="font-weight:600;font-size:14px">${escHtml(m.naam)}</div>
                        <div style="font-size:12px;color:var(--ink-muted);margin-top:2px">
                          ${vak ? escHtml(vak.naam) + ' · ' : ''}${m.niveau || 'Alle niveaus'} · ${(m.stappen || []).length} stappen
                        </div>
                      </div>
                      <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="icon-btn" onclick="openLesModuleModal('${m.id}')" title="Bewerken">✏️</button>
                        <button class="icon-btn" style="color:var(--red)" onclick="verwijderLesModule('${m.id}','${escHtml(m.naam)}')" title="Verwijderen">🗑</button>
                      </div>
                    </div>
                    ${m.beschrijving ? `<p style="font-size:12px;color:var(--ink-muted);margin:0 0 10px">${escHtml(m.beschrijving)}</p>` : ''}
                    <div style="max-height:160px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:#fafafa">
                      ${(m.stappen || []).length
                        ? (m.stappen).map((s, i) => `
                          <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px">
                            <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;font-size:10px;flex-shrink:0">${i + 1}</span>
                            <span>${escHtml(s)}</span>
                          </div>`).join('')
                        : '<div style="padding:12px;font-size:13px;color:var(--ink-muted)">Nog geen stappen</div>'}
                    </div>
                    ${m.bronBestand ? `<div style="font-size:11px;color:var(--ink-muted);margin-top:8px">📄 ${escHtml(m.bronBestand)}</div>` : ''}
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')
      }`;
  } catch (e) { showError('Fout: ' + e.message); }
}

async function openLesModuleModal(moduleId = null) {
  const [vakken, modules] = await Promise.all([API.getVakken(), API.getLesModules()]);
  const m = moduleId ? modules.find(x => x.id === moduleId) : null;

  openModal(`
    <h2>${m ? 'Les module bewerken' : 'Nieuwe les module'}</h2>
    <p class="modal-sub">Kies eerst het type en niveau. Upload dan een PDF of Word-bestand — AI haalt de theoriestappen eruit (toetsen worden overgeslagen).</p>

    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-field"><label>Type *</label>
        <select id="lm-type">
          <option value="profieldeel" ${(!m || m.type === 'profieldeel') ? 'selected' : ''}>Profieldeel (max 12 stappen)</option>
          <option value="keuzedeel" ${m?.type === 'keuzedeel' ? 'selected' : ''}>Keuzedeel (max 8 stappen)</option>
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
        <label style="font-weight:600;font-size:14px">Theoriestappen <span id="lm-stapcount" style="font-size:12px;color:var(--ink-muted);font-weight:400"></span></label>
        <button class="btn btn-sm" onclick="lmVoegStapToe()">+ Stap toevoegen</button>
      </div>
      <div id="lm-stappen-lijst" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);max-height:300px;overflow-y:auto">
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

function lmStappenHtml(stappen) {
  if (!stappen.length) return '<div style="padding:16px;text-align:center;color:var(--ink-muted);font-size:13px">Nog geen stappen. Upload een bestand of voeg stappen handmatig toe.</div>';
  return stappen.map((s, i) => `
    <div class="lm-stap-rij" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;flex-shrink:0">${i + 1}</span>
      <input class="lm-stap-input" value="${escHtml(s)}" style="flex:1;border:1px solid transparent;border-radius:6px;padding:4px 8px;font-size:13px;background:transparent" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent'" oninput="lmUpdateStapCount()">
      <button onclick="this.closest('.lm-stap-rij').remove();lmUpdateStapCount()" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:16px;line-height:1;padding:2px 4px" title="Verwijderen">×</button>
    </div>`).join('');
}

function lmVoegStapToe() {
  const lijst = document.getElementById('lm-stappen-lijst');
  if (!lijst) return;
  const leeg = lijst.querySelector('[style*="Nog geen stappen"]');
  if (leeg) leeg.remove();
  const i = lijst.querySelectorAll('.lm-stap-rij').length;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="lm-stap-rij" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;flex-shrink:0">${i + 1}</span>
      <input class="lm-stap-input" value="" style="flex:1;border:1px solid var(--accent);border-radius:6px;padding:4px 8px;font-size:13px;background:transparent" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent'" oninput="lmUpdateStapCount()" placeholder="Naam van de theoriestap">
      <button onclick="this.closest('.lm-stap-rij').remove();lmUpdateStapCount()" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:16px;line-height:1;padding:2px 4px">×</button>
    </div>`;
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('input')?.focus();
  lmUpdateStapCount();
}

function lmUpdateStapCount() {
  const count = document.querySelectorAll('.lm-stap-input').length;
  const el = document.getElementById('lm-stapcount');
  if (el) el.textContent = count ? `(${count} stappen)` : '';
}

function lmLeesStappen() {
  return Array.from(document.querySelectorAll('.lm-stap-input'))
    .map(i => i.value.trim()).filter(Boolean);
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

    // Vul naam automatisch in als nog leeg
    const naamEl = document.getElementById('lm-naam');
    if (naamEl && !naamEl.value.trim()) naamEl.value = data.naam || '';
    document.getElementById('lm-bron-bestand').value = data.bronBestand || '';

    // Toon stappen
    const lijst = document.getElementById('lm-stappen-lijst');
    if (lijst) lijst.innerHTML = lmStappenHtml(data.stappen || []);
    lmUpdateStapCount();

    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success" style="margin-top:8px">${data.stappen.length} theoriestappen gevonden uit "${escHtml(data.bronBestand || '')}".</div>`;
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
