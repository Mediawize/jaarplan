// ============================================================
// lesprofielen.js — Lesprofielen beheer + koppelen aan planning
// NIEUW: Lesbrief knop toegevoegd per activiteit
// ============================================================

const syllabusWizardState = {
  uploadToken: '',
  modules: []
};

function openSyllabusWizard() {
  syllabusWizardState.uploadToken = '';
  syllabusWizardState.modules = [];
  openModal(`
    <h2>Lesprofiel uit syllabus</h2>
    <p class="modal-sub">Upload een syllabus PDF, kies daarna de profielmodule, het niveau en de verdeling over weken.</p>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Syllabus PDF *</label>
        <input type="file" id="syllabus-pdf-input" accept="application/pdf">
      </div>
      <div class="form-field form-full">
        <button class="btn" onclick="analyseerSyllabusUpload()">PDF analyseren</button>
      </div>
      <div id="syllabus-analyse-result" class="form-field form-full" style="display:none"></div>
      <div class="form-field">
        <label>Module *</label>
        <select id="syllabus-module-select" disabled><option value="">Analyseer eerst de syllabus</option></select>
      </div>
      <div class="form-field">
        <label>Niveau *</label>
        <select id="syllabus-niveau-select">
          <option value="BB">vmbo-b / BB</option>
          <option value="KB">vmbo-k / KB</option>
          <option value="GL">vmbo-gl / GL</option>
        </select>
      </div>
      <div class="form-field">
        <label>Aantal weken *</label>
        <input id="syllabus-aantal-weken" type="number" min="1" value="7">
      </div>
      <div class="form-field">
        <label>Uur theorie per week *</label>
        <input id="syllabus-uren-theorie" type="number" min="1" value="2">
      </div>
      <div class="form-field">
        <label>Uur praktijk per week *</label>
        <input id="syllabus-uren-praktijk" type="number" min="1" value="4">
      </div>
      <div class="form-field">
        <label>Naam lesprofiel</label>
        <input id="syllabus-profiel-naam" placeholder="bijv. Installeren en monteren BB periode 1">
      </div>
      <div class="form-field form-full">
        <label>Vak *</label>
        <select id="syllabus-vak-select"></select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
      <button class="btn btn-primary" onclick="genereerLesprofielUitSyllabusWizard()">Genereer lesprofiel</button>
    </div>
  `);
  vulSyllabusVakSelect();
}

async function vulSyllabusVakSelect() {
  const vakken = await API.getVakken();
  const sel = document.getElementById('syllabus-vak-select');
  if (!sel) return;
  sel.innerHTML = vakken.map(v => `<option value="${v.id}">${escHtml(v.naam)}</option>`).join('');
}

async function analyseerSyllabusUpload() {
  const input = document.getElementById('syllabus-pdf-input');
  const result = document.getElementById('syllabus-analyse-result');
  const moduleSel = document.getElementById('syllabus-module-select');
  if (!input?.files?.[0]) { alert('Kies eerst een syllabus PDF.'); return; }
  result.style.display = 'block';
  result.innerHTML = `<div class="alert alert-info">Syllabus wordt geanalyseerd...</div>`;
  try {
    const data = await API.analyseSyllabus(input.files[0]);
    syllabusWizardState.uploadToken = data.uploadToken;
    syllabusWizardState.modules = data.modules || [];
    moduleSel.disabled = false;
    moduleSel.innerHTML = `<option value="">Kies een module</option>` + syllabusWizardState.modules.map(m => `<option value="${m.code}">Module ${m.code} ${escHtml(m.naam)} (${m.taskCount} onderdelen)</option>`).join('');
    result.innerHTML = `<div class="alert alert-success">${syllabusWizardState.modules.length} profielmodules gevonden. Kies nu de module, het niveau en de wekenverdeling.</div>`;
  } catch (e) {
    result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red);border:1px solid rgba(176,58,46,0.2)">${escHtml(e.message)}</div>`;
  }
}

async function genereerLesprofielUitSyllabusWizard() {
  const moduleCode = document.getElementById('syllabus-module-select')?.value;
  const niveau = document.getElementById('syllabus-niveau-select')?.value;
  const aantalWeken = Number(document.getElementById('syllabus-aantal-weken')?.value || 0);
  const urenTheorie = Number(document.getElementById('syllabus-uren-theorie')?.value || 0);
  const urenPraktijk = Number(document.getElementById('syllabus-uren-praktijk')?.value || 0);
  const naam = document.getElementById('syllabus-profiel-naam')?.value?.trim();
  const vakId = document.getElementById('syllabus-vak-select')?.value;

  if (!syllabusWizardState.uploadToken) { alert('Analyseer eerst de syllabus.'); return; }
  if (!moduleCode || !niveau || !aantalWeken || !urenTheorie || !urenPraktijk || !vakId) {
    alert('Vul alle velden in.');
    return;
  }

  try {
    const res = await API.genereerLesprofielUitSyllabus({
      uploadToken: syllabusWizardState.uploadToken,
      moduleCode, niveau, aantalWeken, urenTheorie, urenPraktijk, naam, vakId
    });
    Cache.invalidateAll();
    await renderLesprofielen();
    const verder = confirm(`Lesprofiel "${res.profiel.naam}" is aangemaakt. Nog een module maken?`);
    if (verder) { openSyllabusWizard(); } else { closeModalDirect(); }
  } catch (e) { alert(e.message); }
}

function openImportModal() {
  openModal(`
    <h2>Lesprofiel importeren</h2>
    <p class="modal-sub">Upload een ingevuld Word bestand (.docx) om automatisch een lesprofiel aan te maken.</p>
    <div class="alert alert-info" style="margin-bottom:16px">
      <strong>Stap 1:</strong> Download de template via "⬇ Template downloaden"<br>
      <strong>Stap 2:</strong> Laat ChatGPT of Claude hem invullen, of doe het zelf<br>
      <strong>Stap 3:</strong> Upload het ingevulde bestand hier
    </div>
    <div class="upload-zone" onclick="document.getElementById('import-input').click()" id="import-zone">
      <div class="upload-icon">↑</div>
      <div style="font-weight:500;margin-bottom:4px">Klik om een ingevuld .docx bestand te kiezen</div>
      <div style="font-size:12px">Alleen .docx bestanden</div>
    </div>
    <input type="file" id="import-input" accept=".docx" style="display:none" onchange="doImportLesprofiel(this)">
    <div id="import-result" style="margin-top:12px;font-size:13px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
    </div>
  `);
}

async function doImportLesprofiel(input) {
  const file = input.files[0];
  if (!file) return;
  const result = document.getElementById('import-result');
  const zone = document.getElementById('import-zone');
  zone.style.borderColor = 'var(--accent)';
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bestand wordt verwerkt...</span>`;
  const formData = new FormData();
  formData.append('bestand', file);
  try {
    const res = await fetch('/api/import-lesprofiel', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      result.innerHTML = `<div class="alert alert-success">✓ ${escHtml(data.info)}</div>`;
      setTimeout(() => { closeModalDirect(); renderLesprofielen(); }, 1500);
    } else {
      result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red)">✗ ${escHtml(data.error)}</div>`;
    }
  } catch(e) {
    result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red)">✗ Upload mislukt: ${escHtml(e.message)}</div>`;
  }
}

async function renderLesprofielen() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesprofielen').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`;
    return;
  }
  showLoading('lesprofielen');
  try {
    const [profielen, vakken] = await Promise.all([API.getLesprofielen(), API.getVakken()]);
    const perVak = {};
    profielen.forEach(p => { if (!perVak[p.vakId]) perVak[p.vakId] = []; perVak[p.vakId].push(p); });

    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesprofielen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <a href="/api/lesprofiel-template" class="btn btn-sm" download>⬇ Template</a>
          <button class="btn btn-sm" onclick="openImportModal()">↑ Importeren</button>
          <button class="btn btn-sm" onclick="openSyllabusWizard()">⚡ Uit syllabus</button>
          <button class="btn btn-sm btn-primary" onclick="openProfielModal()">+ Nieuw lesprofiel</button>
        </div>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Een lesprofiel is een blok van meerdere weken met activiteiten per week. Koppel het aan een startweek in de jaarplanning om het automatisch in te vullen.
      </div>
      ${profielen.length === 0
        ? `<div class="card"><div class="empty-state"><h3>Nog geen lesprofielen</h3><button class="btn btn-primary" onclick="openProfielModal()">Eerste lesprofiel aanmaken</button></div></div>`
        : vakken.map(vak => {
            const vp = perVak[vak.id] || [];
            if (!vp.length) return '';
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <div><h2>${escHtml(vak.naam)} — ${escHtml(vak.volledig)}</h2><div class="card-meta">${vp.length} profiel${vp.length !== 1 ? 'en' : ''}</div></div>
                <button class="btn btn-sm btn-primary" onclick="openProfielModal('${vak.id}')">+ Profiel voor ${escHtml(vak.naam)}</button>
              </div>
              <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
                ${vp.map(p => {
                  const aantalActs = (p.weken || []).reduce((t, w) => t + (w.activiteiten?.length || 0), 0);
                  return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;cursor:pointer;transition:box-shadow .15s" onclick="openProfielDetail('${p.id}')" onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='none'">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                      <div style="font-weight:600;font-size:14px">${escHtml(p.naam)}</div>
                      <div style="display:flex;gap:4px">
                        <button class="icon-btn" onclick="event.stopPropagation();openProfielModal('${p.vakId}','${p.id}')" title="Bewerken"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                        <button class="icon-btn" onclick="event.stopPropagation();verwijderProfiel('${p.id}')" style="color:var(--red)" title="Verwijderen"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                      </div>
                    </div>
                    <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">${p.niveau ? `<span class="badge badge-blue" style="margin-right:4px">${p.niveau}</span>` : ''}${p.aantalWeken} weken · ${aantalActs} activiteiten · ${p.urenPerWeek} uur/week</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${(p.weken || []).slice(0, 4).map((w, i) => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--cream);border:1px solid var(--border);color:var(--ink-muted)">W${i+1}: ${(w.activiteiten || []).map(a => a.type[0]).join('+') || '—'}</span>`).join('')}
                      ${p.aantalWeken > 4 ? `<span style="font-size:10px;color:var(--ink-muted)">+${p.aantalWeken - 4}</span>` : ''}
                    </div>
                    <button class="btn btn-sm btn-primary" style="width:100%;margin-top:12px" onclick="event.stopPropagation();openKoppelModal('${p.id}')">Koppelen aan planning →</button>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')
      }
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openProfielModal(vakId = null, profielId = null) {
  const [vakken, profielen] = await Promise.all([API.getVakken(), API.getLesprofielen()]);
  const p = profielId ? profielen.find(x => x.id === profielId) : null;
  openModal(`
    <h2>${profielId ? 'Lesprofiel bewerken' : 'Nieuw lesprofiel'}</h2>
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam *</label><input id="profiel-naam" value="${escHtml(p?.naam || '')}" placeholder="bijv. Constructief Bouwkunde GL periode 1"></div>
      <div class="form-field"><label>Vak *</label><select id="profiel-vak">
        ${vakken.map(v => `<option value="${v.id}" ${(vakId === v.id || p?.vakId === v.id) ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Niveau</label><select id="profiel-niveau">
        ${['', 'BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => `<option value="${n}" ${(p?.niveau || '') === n ? 'selected' : ''}>${n || 'Alle niveaus'}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Aantal weken *</label><input id="profiel-weken" type="number" min="1" max="40" value="${p?.aantalWeken || 8}"></div>
      <div class="form-field"><label>Uren per week *</label><input id="profiel-uren" type="number" min="1" value="${p?.urenPerWeek || 3}"></div>
      <div class="form-field form-full"><label>Beschrijving</label><input id="profiel-beschrijving" value="${escHtml(p?.beschrijving || '')}" placeholder="Korte omschrijving"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaProfielOp('${profielId || ''}')">Opslaan</button>
    </div>
  `);
}

async function slaProfielOp(profielId) {
  const naam = document.getElementById('profiel-naam').value.trim();
  const vakId = document.getElementById('profiel-vak').value;
  const niveau = document.getElementById('profiel-niveau').value;
  const aantalWeken = parseInt(document.getElementById('profiel-weken').value);
  const urenPerWeek = parseInt(document.getElementById('profiel-uren').value);
  const beschrijving = document.getElementById('profiel-beschrijving').value.trim();
  if (!naam) { alert('Naam is verplicht.'); return; }
  if (!aantalWeken || aantalWeken < 1 || aantalWeken > 40) { alert('Aantal weken moet tussen 1 en 40 zijn.'); return; }

  let weken;
  if (profielId) {
    const bestaand = (await API.getLesprofielen()).find(x => x.id === profielId);
    weken = Array.from({ length: aantalWeken }, (_, i) => bestaand?.weken?.[i] || { weekIndex: i + 1, thema: '', activiteiten: [] });
  } else {
    weken = Array.from({ length: aantalWeken }, (_, i) => ({ weekIndex: i + 1, thema: '', activiteiten: [] }));
  }

  try {
    let id = profielId;
    if (profielId) { await API.updateLesprofiel(profielId, { naam, vakId, niveau, aantalWeken, urenPerWeek, beschrijving, weken }); }
    else { const r = await API.addLesprofiel({ naam, vakId, niveau, aantalWeken, urenPerWeek, beschrijving, weken }); id = r.id; }
    closeModalDirect();
    openProfielDetail(id);
  } catch(e) { showError(e.message); }
}

async function openProfielDetail(profielId) {
  const [profielen, vakken, klassen, alleOpd] = await Promise.all([
    API.getLesprofielen(), API.getVakken(), API.getKlassen(), API.getOpdrachten()
  ]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  const vak = vakken.find(v => v.id === p.vakId);

  const gekoppeldeKlasIds = [...new Set(alleOpd.filter(o => o.profielId === profielId).map(o => o.klasId))];
  const gekoppeldeKlassen = gekoppeldeKlasIds.map(id => klassen.find(k => k.id === id)).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.id = 'profiel-detail-overlay';
  const isMobiel = window.innerWidth <= 768;
  overlay.style.cssText = `position:fixed;top:${isMobiel ? '56px' : '0'};left:${isMobiel ? '0' : 'var(--sidebar-w,256px)'};right:0;bottom:0;background:#F8F7F4;z-index:400;overflow-y:auto;padding:${isMobiel ? '16px' : '32px'}`;

  const gekoppeldHTML = gekoppeldeKlassen.length === 0
    ? `<div style="padding:16px 20px;font-size:13px;color:var(--ink-muted)">
         Dit profiel is nog niet aan een klas gekoppeld.
         <button class="btn btn-sm btn-primary" style="margin-left:12px" onclick="openKoppelModal('${p.id}')">Nu koppelen →</button>
       </div>`
    : `<div style="padding:8px 20px 16px">
         ${gekoppeldeKlassen.map(k => {
           const aantalOpd = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id).length;
           const afgevinkt = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id && o.afgevinkt).length;
           const pct = aantalOpd ? Math.round(afgevinkt / aantalOpd * 100) : 0;
           return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
             <div style="flex:1"><strong>${escHtml(k.naam)}</strong> <span style="font-size:12px;color:var(--ink-muted)">${k.schooljaar}</span></div>
             <div style="font-size:12px;color:var(--ink-muted)">${afgevinkt}/${aantalOpd} afgevinkt (${pct}%)</div>
             <button class="btn btn-sm" style="color:var(--red)" onclick="ontkoppelKlasVanProfiel('${profielId}','${k.id}','${escHtml(k.naam)}')">Ontkoppelen</button>
           </div>`;
         }).join('')}
         <button class="btn btn-sm btn-primary" style="margin-top:12px" onclick="openKoppelModal('${p.id}')">+ Koppelen aan andere klas</button>
       </div>`;

  overlay.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="document.getElementById('profiel-detail-overlay').remove();renderLesprofielen()">← Terug</button>
        <h1 style="margin:0;flex:1">${escHtml(p.naam)}</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="openProfielModal('${p.vakId}','${p.id}')">Bewerken</button>
          <button class="btn btn-sm" onclick="openKoppelModal('${p.id}')">Koppelen aan planning</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>Gekoppelde klassen</h2>
            <div class="card-meta">${escHtml(vak?.naam || '')} · ${p.aantalWeken} weken · ${p.urenPerWeek} uur/week${p.niveau ? ' · ' + p.niveau : ''}</div>
          </div>
          <div style="font-size:12px;color:var(--ink-muted)">${gekoppeldeKlassen.length ? gekoppeldeKlassen.length + ' gekoppeld' : 'Nog niet gekoppeld'}</div>
        </div>
        ${gekoppeldHTML}
      </div>

      ${(p.weken || []).map((w, wi) => `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <h3 style="margin:0;font-size:15px">Week ${wi + 1}</h3>
              <div id="thema-display-${p.id}-${wi}" style="font-size:13px;color:var(--ink-muted);margin-top:2px;cursor:pointer" onclick="editProfielWeekThema('${p.id}',${wi},this)">${w.thema ? escHtml(w.thema) : '<span style="opacity:.5">+ Thema toevoegen</span>'}</div>
            </div>
            <button class="btn btn-sm" onclick="openActiviteitModal('${p.id}',${wi})">+ Activiteit</button>
          </div>
          <div id="activiteiten-week-${p.id}-${wi}">
            ${renderActiviteitenHTML(p, wi)}
          </div>
          ${(!w.activiteiten || !w.activiteiten.length) ? `<div style="padding:12px 20px;font-size:13px;color:var(--ink-muted)">Nog geen activiteiten. Klik op "+ Activiteit".</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(overlay);
}

async function ontkoppelKlasVanProfiel(profielId, klasId, klasNaam) {
  if (!confirm(`Lesprofiel ontkoppelen van "${klasNaam}"?\n\nAlle opdrachten die vanuit dit profiel zijn aangemaakt worden verwijderd.`)) return;
  try {
    const opdrachten = await API.getOpdrachten(klasId);
    const teVerwijderen = opdrachten.filter(o => o.profielId === profielId);
    for (const o of teVerwijderen) { await API.deleteOpdracht(o.id); }
    Cache.invalidateAll();
    document.getElementById('profiel-detail-overlay')?.remove();
    openProfielDetail(profielId);
  } catch(e) { showError(e.message); }
}

function editProfielWeekThema(profielId, weekIdx, el) {
  const huidig = el.textContent.trim().startsWith('+') ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type = 'text'; input.value = huidig;
  input.style.cssText = 'padding:4px 8px;border:1.5px solid var(--accent);border-radius:6px;font-size:13px;font-family:inherit;min-width:200px;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  async function opslaan() {
    const nieuw = input.value.trim();
    await updateProfielWeekThemaAsync(profielId, weekIdx, nieuw);
    const span = document.createElement('div');
    span.id = `thema-display-${profielId}-${weekIdx}`;
    span.style.cssText = 'font-size:13px;color:var(--ink-muted);margin-top:2px;cursor:pointer';
    span.onclick = function() { editProfielWeekThema(profielId, weekIdx, this); };
    span.innerHTML = nieuw ? escHtml(nieuw) : '<span style="opacity:.5">+ Thema toevoegen</span>';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); opslaan(); } if (e.key === 'Escape') opslaan(); });
}

// ── Renderactiviteiten met Lesbrief knop ──────────────────────
function renderActiviteitenHTML(p, weekIdx) {
  const w = p.weken[weekIdx];
  if (!w?.activiteiten?.length) return '';
  const kleuren = { 'Theorie': 'badge-blue', 'Praktijk': 'badge-green', 'Toets': 'badge-amber', 'Presentatie': 'badge-gray', 'Overig': 'badge-gray' };
  return `<table class="data-table">
    <thead><tr><th>Type</th><th>Uren</th><th>Omschrijving</th><th>Syllabus</th><th>Link / bestand</th><th style="width:140px"></th></tr></thead>
    <tbody>
      ${w.activiteiten.map((a, ai) => `<tr>
        <td><span class="badge ${kleuren[a.type] || 'badge-gray'}">${escHtml(a.type)}</span></td>
        <td style="font-size:13px;font-weight:500">${a.uren} uur</td>
        <td style="font-size:13px">${escHtml(a.omschrijving || '—')}</td>
        <td style="font-size:12px;color:#78716C">${escHtml(a.syllabus || '—')}</td>
        <td>
          ${a.link ? `<a href="${escHtml(a.link)}" class="text-link" target="_blank">${escHtml(a.link.length > 35 ? a.link.slice(0, 35) + '…' : a.link)}</a>` : ''}
          ${a.bestand ? `<span class="badge badge-amber" style="font-size:11px">📄 ${escHtml(a.bestand)}</span>` : ''}
          ${!a.link && !a.bestand ? '<span style="color:#A8A29E">—</span>' : ''}
        </td>
        <td>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" style="font-size:11px;padding:3px 7px;white-space:nowrap"
              onclick="openLesbrief('${p.id}',${weekIdx},${ai},{type:'${escHtml(a.type)}',omschrijving:${JSON.stringify(a.omschrijving||'')},uren:${a.uren||1},syllabus:${JSON.stringify(a.syllabus||'')},profielNaam:${JSON.stringify(p.naam||'')},weekThema:${JSON.stringify((w.thema||''))}})">
              📋 Lesbrief
            </button>
            <button class="icon-btn" onclick="bewerkActiviteit('${p.id}',${weekIdx},${ai})" title="Bewerken">
              <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn" onclick="verwijderActiviteit('${p.id}',${weekIdx},${ai})" style="color:#DC2626" title="Verwijderen">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function bewerkActiviteit(profielId, weekIdx, actIdx) {
  API.getLesprofielen().then(profielen => {
    const p = profielen.find(x => x.id === profielId);
    if (!p) return;
    const a = p.weken[weekIdx].activiteiten[actIdx];
    openModal(`
      <h2>Activiteit bewerken</h2>
      <div class="form-grid">
        <div class="form-field"><label>Type *</label><select id="act-type">
          ${['Theorie', 'Praktijk', 'Toets', 'Presentatie', 'Overig'].map(t => `<option value="${t}" ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select></div>
        <div class="form-field"><label>Uren *</label><select id="act-uren">
          ${[1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8].map(u => `<option value="${u}" ${a.uren == u ? 'selected' : ''}>${u} uur</option>`).join('')}
        </select></div>
        <div class="form-field form-full"><label>Omschrijving</label><input id="act-omschrijving" value="${escHtml(a.omschrijving || '')}"></div>
        <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..." value="${escHtml(a.link || '')}"></div>
        <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1" value="${escHtml(a.syllabus || '')}"></div>
        <div class="form-field form-full"><label>Bestandsnaam</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf" value="${escHtml(a.bestand || '')}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModalDirect()">Annuleren</button>
        <button class="btn btn-primary" onclick="slaActiviteitBewerkingOp('${profielId}',${weekIdx},${actIdx})">Opslaan</button>
      </div>
    `);
  });
}

async function slaActiviteitBewerkingOp(profielId, weekIdx, actIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].activiteiten[actIdx] = { type, uren, omschrijving, link, syllabus, bestand: bestand || null };
  await API.updateLesprofiel(profielId, { weken: p.weken });
  closeModalDirect();
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container && bijgewerkt) container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
}

async function updateProfielWeekThemaAsync(profielId, weekIdx, thema) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].thema = thema;
  await API.updateLesprofiel(profielId, { weken: p.weken });
}

function openActiviteitModal(profielId, weekIdx) {
  openModal(`
    <h2>Activiteit toevoegen</h2>
    <div class="form-grid">
      <div class="form-field"><label>Type *</label><select id="act-type">
        <option>Theorie</option><option>Praktijk</option><option>Toets</option><option>Presentatie</option><option>Overig</option>
      </select></div>
      <div class="form-field"><label>Uren *</label><select id="act-uren">
        ${[0.5, 1, 1.5, 2, 2.5, 3, 4].map(u => `<option value="${u}" ${u === 1 ? 'selected' : ''}>${u} uur</option>`).join('')}
      </select></div>
      <div class="form-field form-full"><label>Omschrijving</label><input id="act-omschrijving" placeholder="bijv. Uitleg businessmodel canvas"></div>
      <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..."></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1"></div>
      <div class="form-field form-full"><label>Bestandsnaam (na uploaden)</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaActiviteitOp('${profielId}',${weekIdx})">Toevoegen</button>
    </div>
  `);
}

async function slaActiviteitOp(profielId, weekIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].activiteiten = p.weken[weekIdx].activiteiten || [];
  p.weken[weekIdx].activiteiten.push({ type, uren, omschrijving, link, syllabus, bestand: bestand || null });
  await API.updateLesprofiel(profielId, { weken: p.weken });
  closeModalDirect();
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  if (container && bijgewerkt) {
    container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
    const empty = container.nextElementSibling;
    if (empty && empty.textContent.includes('Nog geen')) empty.style.display = 'none';
  }
}

async function verwijderActiviteit(profielId, weekIdx, actIdx) {
  if (!confirm('Activiteit verwijderen?')) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  p.weken[weekIdx].activiteiten.splice(actIdx, 1);
  await API.updateLesprofiel(profielId, { weken: p.weken });
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container && bijgewerkt) container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
}

async function verwijderProfiel(id) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === id);
  if (!confirm(`Lesprofiel "${p?.naam}" verwijderen?`)) return;
  try { await API.deleteLesprofiel(id); renderLesprofielen(); }
  catch(e) { showError(e.message); }
}

async function openKoppelModal(profielId) {
  const [profielen, klassen, vakken] = await Promise.all([API.getLesprofielen(), API.getKlassen(), API.getVakken()]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  const vak = vakken.find(v => v.id === p.vakId);
  const relevante = klassen.filter(k => k.vakId === p.vakId && (!p.niveau || (k.niveau || '') === p.niveau));
  const alleOpd = await API.getOpdrachten();
  const alGekoppeld = alleOpd.filter(o => o.profielId === profielId);
  const gekoppeldeKlassen = [...new Set(alGekoppeld.map(o => o.klasId))];
  const gekoppeldeKlasNamen = gekoppeldeKlassen.map(id => klassen.find(k => k.id === id)?.naam).filter(Boolean);

  openModal(`
    <h2>Profiel koppelen aan planning</h2>
    <p class="modal-sub">Koppel "<strong>${escHtml(p.naam)}</strong>" (${p.aantalWeken} weken) aan een startweek.</p>
    ${gekoppeldeKlasNamen.length > 0
      ? `<div class="alert alert-info" style="margin-bottom:16px">
           ⚠️ Dit profiel is al gekoppeld aan: <strong>${escHtml(gekoppeldeKlasNamen.join(', '))}</strong><br>
           <span style="font-size:12px">Bij opnieuw koppelen worden de oude opdrachten eerst verwijderd en opnieuw aangemaakt.</span>
         </div>` : ''}
    <div class="form-grid">
      <div class="form-field"><label>Klas *</label><select id="koppel-klas" onchange="laadKoppelWeken('${p.id}')">
        ${relevante.length === 0
          ? `<option value="">Geen klassen met vak ${escHtml(vak?.naam)}</option>`
          : relevante.map(k => `<option value="${k.id}">${escHtml(k.naam)} — ${escHtml(k.schooljaar)}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Startweek *</label><select id="koppel-startweek"><option value="">— Selecteer klas eerst —</option></select></div>
    </div>
    <div id="koppel-preview" style="margin-top:12px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaKoppelingOp('${profielId}')">Koppelen → planning invullen</button>
    </div>
  `);
  setTimeout(() => laadKoppelWeken(profielId), 100);
}

async function laadKoppelWeken(profielId) {
  const klasId = document.getElementById('koppel-klas')?.value;
  if (!klasId) return;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k => k.id === klasId);
  if (!klas) return;
  const weken = (await API.getWeken(klas.schooljaar)).filter(w => !w.isVakantie);
  const sel = document.getElementById('koppel-startweek');
  if (!sel) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  sel.innerHTML = `<option value="">— Selecteer startweek —</option>` + weken.map(w => `<option value="${w.weeknummer}">Wk ${w.weeknummer} · ${w.van} – ${w.tot}${w.thema ? ' · ' + w.thema : ''}</option>`).join('');
  sel.onchange = () => {
    const sw = parseInt(sel.value);
    if (!sw || !p) return;
    const schoolWeken = weken.filter(w => Number(w.weeknummer) >= sw).slice(0, p.aantalWeken);
    document.getElementById('koppel-preview').innerHTML = `<div class="alert alert-success">Profiel wordt gekoppeld aan week ${schoolWeken[0]?.weeknummer || sw} t/m ${schoolWeken[schoolWeken.length - 1]?.weeknummer || sw + p.aantalWeken - 1}<br><small style="opacity:.7">${schoolWeken.length} schoolweken</small></div>`;
  };
}

async function slaKoppelingOp(profielId) {
  const klasId = document.getElementById('koppel-klas').value;
  const startweek = parseInt(document.getElementById('koppel-startweek').value);
  if (!klasId || !startweek) { alert('Selecteer een klas en startweek.'); return; }
  const [profielen, klassen] = await Promise.all([API.getLesprofielen(), API.getKlassen()]);
  const p = profielen.find(x => x.id === profielId);
  const klas = klassen.find(k => k.id === klasId);

  const bestaandeOpd = await API.getOpdrachten(klasId);
  const teVerwijderen = bestaandeOpd.filter(o => o.profielId === profielId);
  for (const o of teVerwijderen) { await API.deleteOpdracht(o.id); }

  const alleWeken = (await API.getWeken(klas.schooljaar)).filter(w => !w.isVakantie);
  const startIdx = alleWeken.findIndex(w => Number(w.weeknummer) === startweek);
  const schoolWeken = alleWeken.slice(startIdx, startIdx + p.aantalWeken);

  for (let i = 0; i < schoolWeken.length; i++) {
    const sw = schoolWeken[i];
    const pw = p.weken[i];
    if (!pw) continue;
    for (const act of (pw.activiteiten || [])) {
      await API.addOpdracht({
        naam: act.omschrijving || `${act.type} — ${p.naam}`,
        klasId,
        periode: getPeriodeVoorWeekLP(Number(sw.weeknummer)),
        weeknummer: Number(sw.weeknummer),
        weken: String(sw.weeknummer),
        schooljaar: klas.schooljaar,
        type: act.type,
        uren: act.uren,
        syllabuscodes: act.syllabus || '',
        werkboekLink: '',
        beschrijving: pw.thema
          ? `${pw.thema} — Uit lesprofiel: ${p.naam} (week ${i + 1} van ${p.aantalWeken})`
          : `Uit lesprofiel: ${p.naam} (week ${i + 1} van ${p.aantalWeken})`,
        theorieLink: act.link || '',
        toetsBestand: act.bestand || null,
        profielId: p.id,
      });
    }
  }

  Cache.invalidateAll();
  closeModalDirect();
  document.getElementById('profiel-detail-overlay')?.remove();
  window._selectedKlas = klasId;
  showView('jaarplanning');
}

function getPeriodeVoorWeekLP(wn) {
  if (wn >= 35 && wn <= 43) return 1;
  if ((wn >= 44 && wn <= 52) || (wn >= 1 && wn <= 8)) return 2;
  if (wn >= 9 && wn <= 18) return 3;
  return 4;
}
