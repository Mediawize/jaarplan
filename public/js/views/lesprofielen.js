// ============================================================
// lesprofielen.js — Lean lesprofielen (naam + module + uren)
// ============================================================

function lpNormalizeNiveau(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  if (['BB', 'B', 'VMBOB', 'BASIS', 'BASISBEROEPS'].includes(raw)) return 'BB';
  if (['KB', 'K', 'VMBOK', 'KADER', 'KADERBEROEPS'].includes(raw)) return 'KB';
  if (['GL', 'GT', 'TL', 'VMBOGT', 'VMBOGL', 'VMBOTL', 'GEMENGD', 'THEORETISCH'].includes(raw)) return 'GL';
  if (raw.includes('HAVO')) return 'HAVO';
  if (raw.includes('VWO')) return 'VWO';
  return raw;
}

function lpKlasPastBijProfiel(klas, profiel) {
  if (!klas || !profiel) return false;
  if (String(klas.vakId || '') !== String(profiel.vakId || '')) return false;
  const profielNiveau = lpNormalizeNiveau(profiel.niveau);
  if (!profielNiveau) return true;
  return lpNormalizeNiveau(klas.niveau) === profielNiveau;
}

// ============================================================
// Overzicht
// ============================================================
async function renderLesprofielen() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesprofielen').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`;
    return;
  }
  showLoading('lesprofielen');
  try {
    const [profielen, vakken, modules] = await Promise.all([API.getLesprofielen(), API.getVakken(), API.getLesModules()]);
    const perVak = {};
    profielen.forEach(p => { if (!perVak[p.vakId]) perVak[p.vakId] = []; perVak[p.vakId].push(p); });
    const moduleMap = Object.fromEntries(modules.map(m => [m.id, m]));

    const niveauVolgorde = ['BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'];
    const niveauKleur = { BB: 'var(--amber)', KB: 'var(--blue)', GL: 'var(--accent)', TL: '#9333EA', Havo: '#0891B2', VWO: 'var(--red-text)' };

    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesprofielen</h1></div>
        <button class="btn btn-sm btn-primary" onclick="openNieuwProfielModal()">+ Profiel</button>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Een lesprofiel koppelt een lesmodule aan een klas. Vul uren in, koppel aan de planning — AI maakt de weekverdeling.
      </div>
      ${profielen.length === 0
        ? `<div class="card"><div class="empty-state"><h3>Nog geen lesprofielen</h3><button class="btn btn-primary" onclick="openNieuwProfielModal()">Eerste profiel aanmaken</button></div></div>`
        : vakken.map(vak => {
            const vp = perVak[vak.id] || [];
            if (!vp.length) return '';
            const perNiveau = {};
            vp.forEach(p => { const n = p.niveau || '__geen__'; if (!perNiveau[n]) perNiveau[n] = []; perNiveau[n].push(p); });
            const overige = Object.keys(perNiveau).filter(n => !niveauVolgorde.includes(n) && n !== '__geen__');
            const niveaus = [...niveauVolgorde.filter(n => perNiveau[n]), ...overige, ...(perNiveau['__geen__'] ? ['__geen__'] : [])];

            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <div><h2>${escHtml(vak.naam)} — ${escHtml(vak.volledig || '')}</h2><div class="card-meta">${vp.length} profiel${vp.length !== 1 ? 'en' : ''}</div></div>
                <button class="btn btn-sm" style="background:#eff6ff;border-color:#93c5fd;color:#2563eb" onclick="openKoppelModuleModal('${vak.id}')">+ Module</button>
              </div>
              ${niveaus.map(niveau => {
                const groep = perNiveau[niveau];
                const niveauLabel = niveau === '__geen__' ? 'Overig' : niveau;
                const kleur = niveauKleur[niveau] || 'var(--ink-3)';
                return `
                  <div class="lp-niveau-header">
                    <span class="lp-niveau-pill" style="color:${kleur};background:${kleur}1a">${niveauLabel}</span>
                    <span class="lp-niveau-count">${groep.length} profiel${groep.length !== 1 ? 'en' : ''}</span>
                  </div>
                  <div class="lp-profielen-grid">
                    ${groep.map(p => {
                      const mod = p.moduleId ? moduleMap[p.moduleId] : null;
                      const aantalStappen = mod ? (mod.stappen || []).length : 0;
                      const urenLabel = p.urenPerWeek ? `${p.urenPerWeek}u/week` : (p.urenTheorie || p.urenPraktijk ? `${p.urenTheorie || 0}u theorie · ${p.urenPraktijk || 0}u praktijk` : '');
                      return `<div class="lp-kaart" onclick="openProfielDetail('${p.id}')">
                        <div class="lp-kaart-naam">${escHtml(p.naam)}</div>
                        <div class="lp-kaart-module">
                          ${mod
                            ? `<svg viewBox="0 0 20 20" fill="none" style="width:13px;height:13px;flex-shrink:0"><path d="M4 3h9l4 4v11H4V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${escHtml(mod.naam)}`
                            : `<span style="color:var(--ink-4)">Geen module gekoppeld</span>`}
                        </div>
                        <div class="lp-kaart-meta">
                          ${aantalStappen ? aantalStappen + ' stappen' : ''}${aantalStappen && urenLabel ? ' · ' : ''}${urenLabel}
                        </div>
                        <div class="lp-kaart-acties">
                          <button class="btn btn-sm btn-primary" style="flex:1" onclick="event.stopPropagation();openKoppelModal('${p.id}')">Koppelen →</button>
                          <button class="btn btn-sm" onclick="event.stopPropagation();openNieuwProfielModal('${p.vakId}','${p.id}')">✏️</button>
                          <button class="btn btn-sm" style="color:var(--red);border-color:rgba(220,38,38,0.3)" onclick="event.stopPropagation();verwijderProfiel('${p.id}')">🗑</button>
                        </div>
                      </div>`;
                    }).join('')}
                  </div>
                  <div style="height:1px;background:var(--border);margin:0 22px"></div>`;
              }).join('')}
            </div>`;
          }).join('')
      }
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

// ============================================================
// Nieuw / bewerk profiel
// ============================================================
async function openNieuwProfielModal(vakId = null, profielId = null) {
  const [vakken, profielen, modules] = await Promise.all([API.getVakken(), API.getLesprofielen(), API.getLesModules()]);
  const p = profielId ? profielen.find(x => x.id === profielId) : null;
  const bewerken = !!profielId;

  // Module-dropdown alleen bij bewerken
  const moduleHtml = bewerken ? `
    <div class="form-field form-full">
      <label>Module koppelen</label>
      <select id="lp-module" onchange="lpModuleGewijzigd()">
        <option value="">— Geen module —</option>
        ${modules.map(m => `<option value="${m.id}" data-vakid="${escHtml(m.vakId || '')}" data-istheorie="${m.isTheorieModule ? '1' : '0'}" data-niveau="${escHtml(m.niveau || '')}" ${p?.moduleId === m.id ? 'selected' : ''}>${escHtml(m.naam)}${m.isTheorieModule ? ' (theorie)' : ''}</option>`).join('')}
      </select>
    </div>` : '';

  openModal(`
    <h2>${bewerken ? 'Lesprofiel bewerken' : 'Nieuw lesprofiel'}</h2>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam *</label>
        <input id="lp-naam" value="${escHtml(p?.naam || '')}" placeholder="bijv. Constructief Bouwkunde BB P1">
      </div>
      <div class="form-field form-full">
        <label>Vak *</label>
        <select id="lp-vak"${bewerken ? ' onchange="lpFilterModules()"' : ''}>
          ${vakken.map(v => `<option value="${v.id}" ${(vakId === v.id || p?.vakId === v.id) ? 'selected' : ''}>${escHtml(v.naam)} — ${escHtml(v.volledig || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Niveau(s) en uren${bewerken ? '' : ' — per niveau een apart profiel'}</label>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px">
          <div class="lm-niveau-checkboxes" style="margin-bottom:2px">
            ${['BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => `<label class="lm-niveau-checkbox">
              <input type="checkbox" name="lp-niveau" value="${n}"
                ${(p?.niveau || '') === n ? 'checked' : ''}
                onchange="lpNiveauCheckChanged()">
              ${n}
            </label>`).join('')}
          </div>
          <div style="display:flex;gap:6px;font-size:10px;color:var(--ink-muted);padding:0 2px">
            <span style="min-width:36px"></span>
            <span style="width:64px;text-align:center">Totaal</span>
            <span style="width:64px;text-align:center">Theorie</span>
            <span style="width:64px;text-align:center">Praktijk</span>
          </div>
          <div id="lp-uren-per-niveau" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>
      </div>
      ${moduleHtml}
      <div class="form-field form-full">
        <label>Beschrijving (optioneel)</label>
        <input id="lp-beschrijving" value="${escHtml(p?.beschrijving || '')}" placeholder="Korte omschrijving">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaProfielOp('${profielId || ''}')">Opslaan</button>
    </div>
  `);
  // Initieel uren-inputs renderen
  if (bewerken) {
    lpNiveauCheckChanged({ totaal: p?.urenPerWeek || '', theorie: p?.urenTheorie || '', praktijk: p?.urenPraktijk || '' });
    setTimeout(lpModuleGewijzigd, 0);
  } else {
    lpNiveauCheckChanged();
  }
}

function lpNiveauCheckChanged(bestaand = {}) {
  const container = document.getElementById('lp-uren-per-niveau');
  if (!container) return;
  const niveauKleur = { BB: '#f59e0b', KB: '#3b82f6', GL: '#8b5cf6', TL: '#8b5cf6', Havo: '#0891b2', VWO: '#ef4444' };
  const checked = [...document.querySelectorAll('input[name="lp-niveau"]:checked')].map(cb => cb.value);
  // Bewaar bestaande ingevoerde waarden
  const huidige = {};
  container.querySelectorAll('[data-niveau]').forEach(el => {
    const inputs = el.querySelectorAll('input');
    huidige[el.dataset.niveau] = { totaal: inputs[0]?.value || '', theorie: inputs[1]?.value || '', praktijk: inputs[2]?.value || '' };
  });
  const inputStijl = 'width:64px;border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:13px;text-align:center';
  container.innerHTML = checked.map(n => {
    const kleur = niveauKleur[n] || 'var(--ink-3)';
    const v = huidige[n] || { totaal: bestaand.totaal || '', theorie: bestaand.theorie || '', praktijk: bestaand.praktijk || '' };
    return `<div data-niveau="${n}" style="display:flex;align-items:center;gap:6px;padding:4px 2px">
      <span style="font-size:12px;font-weight:700;color:${kleur};min-width:36px">${n}</span>
      <input type="number" min="0" max="40" step="0.5" value="${v.totaal}" placeholder="0"
        style="${inputStijl}" title="${n} — totaal uren/week">
      <input type="number" min="0" max="40" step="0.5" value="${v.theorie}" placeholder="0"
        style="${inputStijl};border-color:#93c5fd" title="${n} — theorie uren">
      <input type="number" min="0" max="40" step="0.5" value="${v.praktijk}" placeholder="0"
        style="${inputStijl};border-color:#fcd34d" title="${n} — praktijk uren">
    </div>`;
  }).join('');
}

function lpModuleGewijzigd() {
  lpFilterModules();
  const select = document.getElementById('lp-module');
  const groep = document.getElementById('lp-niveau-groep');
  if (!select || !groep) return;
  const gekozen = select.selectedOptions[0];
  const moduleNiveaus = (gekozen?.dataset.niveau || '').split(',').map(x => x.trim()).filter(Boolean);
  groep.querySelectorAll('input[name="lp-niveau"]').forEach(cb => {
    const inModule = moduleNiveaus.length === 0 || moduleNiveaus.includes(cb.value);
    cb.closest('label').style.display = inModule ? '' : 'none';
    cb.checked = moduleNiveaus.includes(cb.value);
  });
}

function lpFilterModules() {
  const vakId = document.getElementById('lp-vak')?.value || '';
  const isTheorie = document.getElementById('lp-istheorie')?.value === '1';
  const select = document.getElementById('lp-module');
  if (!select) return;
  [...select.options].forEach(opt => {
    if (!opt.value) { opt.hidden = false; return; }
    const moduleVakken = (opt.dataset.vakid || '').split(',').map(x => x.trim()).filter(Boolean);
    const vakMatch = moduleVakken.length === 0 || moduleVakken.includes(vakId);
    const typeMatch = isTheorie ? opt.dataset.istheorie === '1' : opt.dataset.istheorie !== '1';
    opt.hidden = !vakMatch || !typeMatch;
  });
  if (select.selectedOptions[0]?.hidden) select.value = '';
}

async function openKoppelModuleModal(vakId) {
  const [vakken, modules] = await Promise.all([API.getVakken(), API.getLesModules()]);
  const vak = vakken.find(v => v.id === vakId);
  const vakModules = modules.filter(m => !m.vakId || m.vakId.split(',').map(x => x.trim()).includes(vakId));

  openModal(`
    <h2>Module toevoegen aan ${escHtml(vak?.naam || '')}</h2>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Module *</label>
        <select id="km-module" onchange="kmModuleGewijzigd()">
          <option value="">— Kies een module —</option>
          ${vakModules.map(m => `<option value="${m.id}" data-naam="${escHtml(m.naam)}" data-niveau="${escHtml(m.niveau || '')}">${escHtml(m.naam)}${m.isTheorieModule ? ' (theorie)' : ''}${m.niveau ? ' [' + m.niveau + ']' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Niveau(s) en uren — per niveau een apart profiel</label>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px">
          <div class="lm-niveau-checkboxes">
            ${['BB','KB','GL','TL','Havo','VWO'].map(n => `<label class="lm-niveau-checkbox">
              <input type="checkbox" name="km-niveau" value="${n}" onchange="lpNiveauCheckChanged()" data-container="lp-uren-per-niveau">
              ${n}
            </label>`).join('')}
          </div>
          <div style="display:flex;gap:6px;font-size:10px;color:var(--ink-muted);padding:0 2px">
            <span style="min-width:36px"></span>
            <span style="width:64px;text-align:center">Totaal</span>
            <span style="width:64px;text-align:center">Theorie</span>
            <span style="width:64px;text-align:center">Praktijk</span>
          </div>
          <div id="lp-uren-per-niveau" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaKoppelModuleOp('${vakId}')">Toevoegen</button>
    </div>
  `);
}

function kmModuleGewijzigd() {
  const sel = document.getElementById('km-module');
  const opt = sel?.selectedOptions[0];
  const moduleNiveaus = (opt?.dataset.niveau || '').split(',').map(x => x.trim()).filter(Boolean);
  document.querySelectorAll('input[name="km-niveau"]').forEach(cb => {
    const inModule = moduleNiveaus.length === 0 || moduleNiveaus.includes(cb.value);
    cb.closest('label').style.display = inModule ? '' : 'none';
    cb.checked = moduleNiveaus.includes(cb.value);
  });
  lpNiveauCheckChanged();
}

async function slaKoppelModuleOp(vakId) {
  const moduleId = document.getElementById('km-module')?.value || null;
  if (!moduleId) { alert('Kies een module.'); return; }
  const moduleSel = document.getElementById('km-module');
  const moduleNaam = moduleSel?.selectedOptions[0]?.dataset.naam || '';
  const urenContainer = document.getElementById('lp-uren-per-niveau');
  const urenPerNiveau = {};
  urenContainer?.querySelectorAll('[data-niveau]').forEach(el => {
    const inputs = el.querySelectorAll('input');
    urenPerNiveau[el.dataset.niveau] = { totaal: parseFloat(inputs[0]?.value)||0, theorie: parseFloat(inputs[1]?.value)||0, praktijk: parseFloat(inputs[2]?.value)||0 };
  });
  const lijst = Object.keys(urenPerNiveau).length ? Object.entries(urenPerNiveau) : [['', {}]];
  try {
    let eersteId = null;
    for (const [niveau, u] of lijst) {
      const naam = lijst.length > 1 ? `${moduleNaam} ${niveau}`.trim() : moduleNaam;
      const r = await API.addLesprofiel({ naam, vakId, niveau, moduleId, urenPerWeek: u.totaal||0, urenTheorie: u.theorie||0, urenPraktijk: u.praktijk||0 });
      if (!eersteId) eersteId = r.id;
    }
    closeModalDirect();
    Cache.invalidateAll();
    lijst.length > 1 ? renderLesprofielen() : openProfielDetail(eersteId);
  } catch(e) { showError(e.message); }
}

async function slaProfielOp(profielId) {
  const naam = document.getElementById('lp-naam').value.trim();
  const vakId = document.getElementById('lp-vak').value;
  const moduleId = document.getElementById('lp-module')?.value || null;
  const beschrijving = document.getElementById('lp-beschrijving').value.trim();

  // Uren per niveau uitlezen (totaal, theorie, praktijk)
  const urenContainer = document.getElementById('lp-uren-per-niveau');
  const urenPerNiveau = {};
  urenContainer?.querySelectorAll('[data-niveau]').forEach(el => {
    const inputs = el.querySelectorAll('input');
    urenPerNiveau[el.dataset.niveau] = {
      totaal:   parseFloat(inputs[0]?.value) || 0,
      theorie:  parseFloat(inputs[1]?.value) || 0,
      praktijk: parseFloat(inputs[2]?.value) || 0,
    };
  });

  if (!naam) { alert('Naam is verplicht.'); return; }

  try {
    if (profielId) {
      // Bewerken: eerste aangevinkte niveau
      const niveau = [...document.querySelectorAll('input[name="lp-niveau"]:checked')].map(cb => cb.value)[0] || '';
      const u = urenPerNiveau[niveau] || {};
      await API.updateLesprofiel(profielId, { naam, vakId, niveau, moduleId, urenPerWeek: u.totaal || 0, urenTheorie: u.theorie || 0, urenPraktijk: u.praktijk || 0, beschrijving });
      closeModalDirect();
      Cache.invalidateAll();
      openProfielDetail(profielId);
    } else {
      // Nieuw: één profiel per aangevinkt niveau met eigen uren
      const lijst = Object.keys(urenPerNiveau).length ? Object.entries(urenPerNiveau) : [['', {}]];
      let eersteId = null;
      for (const [niveau, u] of lijst) {
        const profielNaam = lijst.length > 1 ? `${naam} ${niveau}`.trim() : naam;
        const r = await API.addLesprofiel({ naam: profielNaam, vakId, niveau, moduleId, urenPerWeek: u.totaal || 0, urenTheorie: u.theorie || 0, urenPraktijk: u.praktijk || 0, beschrijving });
        if (!eersteId) eersteId = r.id;
      }
      closeModalDirect();
      Cache.invalidateAll();
      if (lijst.length > 1) {
        renderLesprofielen();
      } else {
        openProfielDetail(eersteId);
      }
    }
  } catch(e) { showError(e.message); }
}

// ============================================================
// Profiel detailview — toont module-inhoud
// ============================================================
async function openProfielDetail(profielId) {
  if (typeof closeSidebar === 'function') closeSidebar();
  document.getElementById('profiel-detail-overlay')?.remove();

  const [profielen, vakken, klassen, alleOpd, modules, toetsen] = await Promise.all([
    API.getLesprofielen(), API.getVakken(), API.getKlassen(), API.getOpdrachten(), API.getLesModules(),
    API.getMaterialen('toets').catch(() => [])
  ]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  const vak = vakken.find(v => v.id === p.vakId);
  const mod = p.moduleId ? modules.find(m => m.id === p.moduleId) : null;

  const gekoppeldeKlasIds = [...new Set(alleOpd.filter(o => o.profielId === profielId).map(o => o.klasId))];
  const gekoppeldeKlassen = gekoppeldeKlasIds.map(id => klassen.find(k => k.id === id)).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.id = 'profiel-detail-overlay';
  const isMobiel = window.innerWidth <= 768;
  overlay.style.cssText = `position:fixed;top:${isMobiel ? '56px' : '0'};left:${isMobiel ? '0' : 'var(--sidebar-w,256px)'};right:0;bottom:0;background:var(--bg);z-index:400;overflow-y:auto;padding:${isMobiel ? '16px' : '32px'}`;

  const gekoppeldHTML = gekoppeldeKlassen.length === 0
    ? `<div style="padding:20px 22px;display:flex;align-items:center;gap:14px">
         <span style="font-size:13px;color:var(--ink-3)">Dit profiel is nog niet aan een klas gekoppeld.</span>
         <button class="btn btn-sm btn-primary" onclick="openKoppelModal('${p.id}')">Nu koppelen →</button>
       </div>`
    : `<div style="padding:8px 22px 18px">
         ${gekoppeldeKlassen.map(k => {
           const aantalOpd = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id).length;
           const afgevinkt = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id && o.afgevinkt).length;
           const pct = aantalOpd ? Math.round(afgevinkt / aantalOpd * 100) : 0;
           return `<div class="lp-koppeling-rij">
             <div style="flex:1">
               <strong style="font-size:14px">${escHtml(k.naam)}</strong>
               <span style="font-size:12px;color:var(--ink-3);margin-left:8px">${k.schooljaar}</span>
             </div>
             <div style="min-width:160px">
               <div style="height:5px;background:var(--surface-3);border-radius:3px;margin-bottom:3px;overflow:hidden">
                 <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></div>
               </div>
               <div style="font-size:11px;color:var(--ink-3)">${afgevinkt}/${aantalOpd} afgevinkt · ${pct}%</div>
             </div>
             <button class="btn btn-sm" style="color:var(--red);border-color:rgba(220,38,38,0.3);flex-shrink:0" onclick="ontkoppelKlasVanProfiel('${profielId}','${k.id}','${escHtml(k.naam)}')">Ontkoppelen</button>
           </div>`;
         }).join('')}
         <button class="btn btn-sm btn-primary" style="margin-top:14px" onclick="openKoppelModal('${p.id}')">+ Koppelen aan andere klas</button>
       </div>`;

  // Module-inhoud weergeven
  let moduleInhoudHTML = '';
  if (mod) {
    const stappen = mod.stappen || [];
    const gedeeld = mod.gedeeldeOpdrachten || [];
    moduleInhoudHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>Module: ${escHtml(mod.naam)}</h2>
            <div class="card-meta">${stappen.length} stappen${gedeeld.length ? ' · ' + gedeeld.length + ' gedeelde opdrachten' : ''}</div>
          </div>
        </div>
        <div style="padding:16px 22px 20px">
          ${stappen.map((stap, si) => {
            const lessen = stap.lessen || [];
            const praktijk = stap.praktijkOpdrachten || [];
            const toetsMat = stap.toetsId ? toetsen.find(t => t.id === stap.toetsId) : null;
            const heeftToets = toetsMat || stap.toetsUrl;
            return `<div class="lp-stap">
              <div class="lp-stap-header">
                <span class="lp-stap-nr">${si + 1}</span>
                <span class="lp-stap-naam">${escHtml(stap.naam || '')}</span>
                ${heeftToets ? `<span style="font-size:11px;background:var(--red-dim);color:var(--red-text);padding:3px 10px;border-radius:20px;border:1px solid var(--red-dim);font-weight:600">📝 Toets</span>` : ''}
                ${stap.url ? `<a href="${escHtml(stap.url)}" target="_blank" style="font-size:12px;color:var(--blue-text);margin-left:auto;white-space:nowrap" onclick="event.stopPropagation()">🔗 Leslink</a>` : ''}
              </div>
              ${heeftToets ? `<div class="lp-toets-balk">
                📝 Toets:
                ${toetsMat ? `<strong>${escHtml(toetsMat.naam)}</strong> <a href="/uploads/${encodeURIComponent(toetsMat.bestandsnaam)}" target="_blank" style="font-size:11px;color:var(--red-text)">⬇ Download</a>` : ''}
                ${stap.toetsUrl ? `<a href="${escHtml(stap.toetsUrl)}" target="_blank" style="color:var(--red-text);font-size:11px">${escHtml(stap.toetsUrl.length > 50 ? stap.toetsUrl.slice(0,50)+'…' : stap.toetsUrl)}</a>` : ''}
              </div>` : ''}
              <div class="lp-stap-body">
                ${stap.leerlingTaak ? `<div style="font-size:12.5px;color:var(--ink-2);background:var(--surface-2);padding:7px 12px;border-radius:5px;margin-bottom:8px;line-height:1.5">📝 ${escHtml(stap.leerlingTaak)}</div>` : ''}
                ${lessen.length ? `<div style="margin-bottom:8px">${lessen.map(l => `<span class="lp-les-chip">${escHtml(l.naam || l)}</span>`).join('')}</div>` : ''}
                ${praktijk.length ? `<div style="font-size:12px;color:var(--ink-3)">🔧 Praktijk: ${praktijk.map(o => escHtml(o.naam || '')).join(' · ')}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
          ${gedeeld.length ? `
            <div style="border:1px solid rgba(217,119,6,0.25);border-radius:var(--radius-sm);padding:14px 16px;background:var(--amber-dim)">
              <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--amber-text)">🔧 Gedeelde praktijkopdrachten</div>
              ${gedeeld.map(o => `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid rgba(217,119,6,0.15);color:var(--ink-2)">${escHtml(o.naam || '')}</div>`).join('')}
            </div>` : ''}
        </div>
      </div>`;
  } else if (p.weken && p.weken.length > 0) {
    // Oud profiel met weken-JSON — toon in read-only modus
    moduleInhoudHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><h2>Weekindeling (oud formaat)</h2></div>
        <div style="padding:12px 20px;font-size:13px;color:var(--ink-muted)">
          Dit profiel heeft nog geen gekoppelde lesmodule. De weekindeling is in het oude formaat opgeslagen.
          <button class="btn btn-sm" style="margin-left:12px" onclick="openNieuwProfielModal('${p.vakId}','${p.id}')">Module koppelen</button>
        </div>
      </div>`;
  } else {
    moduleInhoudHTML = `
      <div class="card" style="margin-bottom:20px;padding:20px">
        <div style="font-size:13px;color:var(--ink-muted)">
          Geen lesmodule gekoppeld. <button class="btn btn-sm btn-primary" style="margin-left:8px" onclick="openNieuwProfielModal('${p.vakId}','${p.id}')">Module koppelen</button>
        </div>
      </div>`;
  }

  const urenInfo = [
    p.urenPerWeek ? `${p.urenPerWeek}u/week` : null,
    (p.urenTheorie || p.urenPraktijk) ? `${p.urenTheorie || 0}u theorie + ${p.urenPraktijk || 0}u praktijk` : null
  ].filter(Boolean).join(' · ');

  overlay.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div class="lp-detail-header">
        <button class="btn btn-sm" onclick="document.getElementById('profiel-detail-overlay').remove();renderLesprofielen()">← Terug</button>
        <h1 class="lp-detail-title">${escHtml(p.naam)}</h1>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-sm" onclick="openNieuwProfielModal('${p.vakId}','${p.id}')">✏️ Bewerken</button>
          <button class="btn btn-sm btn-primary" onclick="openKoppelModal('${p.id}')">Koppelen →</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>Gekoppelde klassen</h2>
            <div class="card-meta">${escHtml(vak?.naam || '')}${p.niveau ? ' · ' + p.niveau : ''}${urenInfo ? ' · ' + urenInfo : ''}</div>
          </div>
          <span class="badge ${gekoppeldeKlassen.length ? 'badge-green' : 'badge-gray'}">${gekoppeldeKlassen.length ? gekoppeldeKlassen.length + ' gekoppeld' : 'Nog niet gekoppeld'}</span>
        </div>
        ${gekoppeldHTML}
      </div>

      ${moduleInhoudHTML}
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

async function verwijderProfiel(id) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === id);
  if (!confirm(`Lesprofiel "${p?.naam}" verwijderen?`)) return;
  try { await API.deleteLesprofiel(id); Cache.invalidateAll(); renderLesprofielen(); }
  catch(e) { showError(e.message); }
}

// ============================================================
// Koppel-modal — klas + startweek + AI-verdeling
// ============================================================
let _lpVerdelingPreview = null;
let _lpVerdelingStappen = null;

async function openKoppelModal(profielId) {
  const [profielen, klassen, vakken] = await Promise.all([API.getLesprofielen(), API.getKlassen(), API.getVakken()]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  const vak = vakken.find(v => v.id === p.vakId);
  const relevante = klassen.filter(k => lpKlasPastBijProfiel(k, p));
  const alleOpd = await API.getOpdrachten();
  const alGekoppeld = alleOpd.filter(o => o.profielId === profielId);
  const gekoppeldeKlasNamen = [...new Set(alGekoppeld.map(o => o.klasId))].map(id => klassen.find(k => k.id === id)?.naam).filter(Boolean);
  _lpVerdelingPreview = null;
  _lpVerdelingStappen = null;

  openModal(`
    <h2>Profiel koppelen aan planning</h2>
    <p class="modal-sub">Koppel "<strong>${escHtml(p.naam)}</strong>" aan een klas en startweek.</p>
    ${gekoppeldeKlasNamen.length > 0
      ? `<div class="alert alert-info" style="margin-bottom:16px">
           ⚠️ Al gekoppeld aan: <strong>${escHtml(gekoppeldeKlasNamen.join(', '))}</strong><br>
           <span style="font-size:12px">Bij opnieuw koppelen worden de oude opdrachten vervangen.</span>
         </div>` : ''}
    <div class="form-grid">
      <div class="form-field">
        <label>Klas *</label>
        <select id="koppel-klas" onchange="laadKoppelWeken('${p.id}')">
          ${relevante.length === 0
            ? `<option value="">Geen klassen voor ${escHtml(vak?.naam || 'dit vak')}${p.niveau ? ' niveau ' + p.niveau : ''}</option>`
            : relevante.map(k => `<option value="${k.id}">${escHtml(k.naam)} — ${escHtml(k.schooljaar)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Startweek *</label>
        <select id="koppel-startweek"><option value="">— Selecteer klas eerst —</option></select>
      </div>
      <div class="form-field">
        <label>Aantal weken *</label>
        <input id="koppel-weken" type="number" min="1" max="40" value="${p.aantalWeken || 8}" placeholder="bijv. 8">
      </div>
    </div>
    ${p.moduleId
      ? `<div class="lp-koppel-ai-rij">
           <button class="btn btn-primary" id="koppel-ai-btn" onclick="genereerVerdeling('${profielId}')">🤖 AI genereer weekverdeling</button>
           <span class="lp-koppel-ai-sub">AI verdeelt modulestappen logisch over de weken</span>
         </div>
         <div id="koppel-verdeling-preview" style="margin-top:12px"></div>`
      : `<div class="alert alert-info" style="margin-top:12px;font-size:13px">
           Koppel eerst een lesmodule aan dit profiel voor AI-weekverdeling.
         </div>`}
    <div id="koppel-week-preview" style="margin-top:8px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaKoppelingOp('${profielId}')">Koppelen → planning</button>
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
  sel.innerHTML = `<option value="">— Selecteer startweek —</option>` + weken.map(w => `<option value="${w.weeknummer}">Wk ${w.weeknummer} · ${w.van} – ${w.tot}${w.thema ? ' · ' + w.thema : ''}</option>`).join('');
  sel.onchange = () => {
    const sw = parseInt(sel.value);
    const nw = parseInt(document.getElementById('koppel-weken')?.value || 0);
    const preview = document.getElementById('koppel-week-preview');
    if (!sw || !preview) return;
    const schoolWeken = weken.filter(w => Number(w.weeknummer) >= sw).slice(0, nw);
    if (schoolWeken.length) {
      preview.innerHTML = `<div class="alert alert-success" style="font-size:12px">Week ${schoolWeken[0].weeknummer} t/m ${schoolWeken[schoolWeken.length-1].weeknummer} (${schoolWeken.length} weken)</div>`;
    }
  };
}

let _lpDragState = null;

function lpDragStart(e, wi, soort, ii) {
  _lpDragState = { wi, soort, ii };
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.4';
}

function lpDragEnd(e) {
  e.currentTarget.style.opacity = '';
}

function lpDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.borderTop = '2px solid var(--blue)';
}

function lpDragLeave(e) {
  e.currentTarget.style.borderTop = '';
}

function lpDropOpItem(e, targetWi, targetSoort, targetIi) {
  e.preventDefault();
  e.currentTarget.style.borderTop = '';
  if (!_lpDragState) return;
  const { wi: srcWi, soort: srcSoort, ii: srcIi } = _lpDragState;
  _lpDragState = null;
  if (srcWi === targetWi && srcSoort === targetSoort && srcIi === targetIi) return;
  const srcLijst = _lpVerdelingPreview[srcWi][srcSoort];
  const [item] = srcLijst.splice(srcIi, 1);
  const dstLijst = _lpVerdelingPreview[targetWi][targetSoort];
  let dstIi = targetIi;
  if (srcWi === targetWi && srcSoort === targetSoort && srcIi < targetIi) dstIi--;
  dstLijst.splice(dstIi, 0, item);
  lpRenderVerdelingPreview();
}

function lpDropZone(e, targetWi, targetSoort) {
  e.preventDefault();
  e.currentTarget.style.outline = '';
  if (!_lpDragState) return;
  const { wi: srcWi, soort: srcSoort, ii: srcIi } = _lpDragState;
  _lpDragState = null;
  const srcLijst = _lpVerdelingPreview[srcWi][srcSoort];
  const [item] = srcLijst.splice(srcIi, 1);
  _lpVerdelingPreview[targetWi][targetSoort].push(item);
  lpRenderVerdelingPreview();
}

function lpDropZoneOver(e) {
  e.preventDefault();
  e.currentTarget.style.outline = '2px dashed var(--blue)';
}

function lpDropZoneLeave(e) {
  e.currentTarget.style.outline = '';
}

function lpItemRij(label, tekst, uren, kleur, wi, soort, ii) {
  return `<div class="lp-item-rij" draggable="true"
    ondragstart="lpDragStart(event,${wi},'${soort}',${ii})"
    ondragend="lpDragEnd(event)"
    ondragover="lpDragOver(event)"
    ondragleave="lpDragLeave(event)"
    ondrop="lpDropOpItem(event,${wi},'${soort}',${ii})">
    <span class="lp-item-handle">⠿</span>
    <span class="lp-item-tekst" style="color:${kleur}">${label} ${escHtml(tekst)}${uren ? ` <span style="opacity:.6">(${uren}u)</span>` : ''}</span>
  </div>`;
}

function lpRenderVerdelingPreview() {
  const preview = document.getElementById('koppel-verdeling-preview');
  if (!preview || !_lpVerdelingPreview) return;
  const n = _lpVerdelingPreview.length;
  preview.innerHTML = `
    <div class="lp-verdeling-wrap">
      <div class="lp-verdeling-titel">Weekverdeling (${n} weken)</div>
      <div class="lp-verdeling-sub">Sleep theorie- of praktijkonderdelen tussen weken om de volgorde aan te passen.</div>
      <div class="lp-verdeling-scroll" id="lp-verdeling-weken">
        ${_lpVerdelingPreview.map((w, i) => `
          <div class="lp-week-rij">
            <div class="lp-week-pijlen">
              <button onclick="lpVerschuifWeek(${i},-1)" ${i === 0 ? 'disabled' : ''} class="lp-week-pijl" title="Week omhoog">▲</button>
              <button onclick="lpVerschuifWeek(${i},1)" ${i === n - 1 ? 'disabled' : ''} class="lp-week-pijl" title="Week omlaag">▼</button>
            </div>
            <div class="lp-week-body">
              <div class="lp-week-label">
                <span>Week ${i + 1}</span>
                ${w.thema ? ` — <strong>${escHtml(w.thema)}</strong>` : ''}
              </div>
              <div class="lp-drop-zone" ondragover="lpDropZoneOver(event)" ondragleave="lpDropZoneLeave(event)" ondrop="lpDropZone(event,${i},'theorie')">
                ${(w.theorie || []).map((t, ti) => lpItemRij('📖', t.stapNaam || t.omschrijving || '', t.uren, 'var(--blue)', i, 'theorie', ti)).join('')}
              </div>
              <div class="lp-drop-zone praktijk" ondragover="lpDropZoneOver(event)" ondragleave="lpDropZoneLeave(event)" ondrop="lpDropZone(event,${i},'praktijk')">
                ${(w.praktijk || []).map((t, pi) => lpItemRij('🔧', t.naam || t.omschrijving || '', t.uren, 'var(--accent)', i, 'praktijk', pi)).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function lpVerschuifWeek(idx, richting) {
  if (!_lpVerdelingPreview) return;
  const nieuw = idx + richting;
  if (nieuw < 0 || nieuw >= _lpVerdelingPreview.length) return;
  const tmp = _lpVerdelingPreview[idx];
  _lpVerdelingPreview[idx] = _lpVerdelingPreview[nieuw];
  _lpVerdelingPreview[nieuw] = tmp;
  lpRenderVerdelingPreview();
}

async function genereerVerdeling(profielId) {
  const aantalWeken = parseInt(document.getElementById('koppel-weken')?.value || 8);
  const klasId = document.getElementById('koppel-klas')?.value || null;
  const btn = document.getElementById('koppel-ai-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Genereren…'; }
  try {
    const data = await API.genereerLesprofielVerdeling(profielId, { aantalWeken, klasId });
    _lpVerdelingPreview = data.weken || [];
    _lpVerdelingStappen = data.stappen || [];
    lpRenderVerdelingPreview();
  } catch(e) {
    const preview = document.getElementById('koppel-verdeling-preview');
    if (preview) preview.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red)">Fout: ${escHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 AI genereer weekverdeling'; }
  }
}

async function slaKoppelingOp(profielId) {
  const klasId = document.getElementById('koppel-klas').value;
  const startweek = parseInt(document.getElementById('koppel-startweek').value);
  const aantalWeken = parseInt(document.getElementById('koppel-weken')?.value || 8);
  if (!klasId || !startweek) { alert('Selecteer een klas en startweek.'); return; }

  const [profielen, klassen] = await Promise.all([API.getLesprofielen(), API.getKlassen()]);
  const p = profielen.find(x => x.id === profielId);
  const klas = klassen.find(k => k.id === klasId);
  if (!p || !klas) return;

  // Verwijder bestaande gekoppelde opdrachten
  const bestaandeOpd = await API.getOpdrachten(klasId);
  const teVerwijderen = bestaandeOpd.filter(o => o.profielId === profielId);
  for (const o of teVerwijderen) { await API.deleteOpdracht(o.id); }

  const alleWeken = (await API.getWeken(klas.schooljaar)).filter(w => !w.isVakantie);
  const startIdx = alleWeken.findIndex(w => Number(w.weeknummer) === startweek);
  const schoolWeken = alleWeken.slice(startIdx, startIdx + aantalWeken);

  if (_lpVerdelingPreview && _lpVerdelingPreview.length > 0) {
    // Gebruik AI-verdeling
    for (let i = 0; i < schoolWeken.length; i++) {
      const sw = schoolWeken[i];
      const wk = _lpVerdelingPreview[i];
      if (!wk) continue;
      const periode = getPeriodeVoorWeekLP(Number(sw.weeknummer));
      for (const t of (wk.theorie || [])) {
        const stapInfo = (_lpVerdelingStappen || []).find(s => s.naam === t.stapNaam);
        await API.addOpdracht({
          naam: t.omschrijving || t.stapNaam || 'Theorie',
          klasId, periode, weeknummer: Number(sw.weeknummer),
          weken: String(sw.weeknummer), schooljaar: klas.schooljaar,
          type: 'Theorie', uren: t.uren || p.urenTheorie || 1,
          beschrijving: wk.thema ? `${wk.thema} — ${p.naam}` : p.naam,
          profielId: p.id,
          moduleId: p.moduleId || null,
          stapNaam: t.stapNaam || stapInfo?.naam || '',
          stapIndex: stapInfo?.index ?? null,
        });
        // Voeg toets toe als de stap een toets heeft
        if (stapInfo && stapInfo.heeftToets) {
          await API.addOpdracht({
            naam: `Toets — ${t.stapNaam || p.naam}`,
            klasId, periode, weeknummer: Number(sw.weeknummer),
            weken: String(sw.weeknummer), schooljaar: klas.schooljaar,
            type: 'Toets', uren: 1,
            beschrijving: wk.thema ? `${wk.thema} — ${p.naam}` : p.naam,
            theorieLink: stapInfo.toetsUrl || '',
            profielId: p.id,
            moduleId: p.moduleId || null,
            stapNaam: t.stapNaam || stapInfo?.naam || '',
            stapIndex: stapInfo?.index ?? null,
          });
        }
      }
      for (const pr of (wk.praktijk || [])) {
        await API.addOpdracht({
          naam: pr.omschrijving || pr.naam || 'Praktijk',
          klasId, periode, weeknummer: Number(sw.weeknummer),
          weken: String(sw.weeknummer), schooljaar: klas.schooljaar,
          type: 'Praktijk', uren: pr.uren || p.urenPraktijk || 1,
          beschrijving: wk.thema ? `${wk.thema} — ${p.naam}` : p.naam,
          profielId: p.id,
          moduleId: p.moduleId || null,
        });
      }
    }
  } else {
    // Geen AI-verdeling: maak 1 blok-opdracht per week
    for (let i = 0; i < schoolWeken.length; i++) {
      const sw = schoolWeken[i];
      await API.addOpdracht({
        naam: `${p.naam} — week ${i + 1}`,
        klasId, periode: getPeriodeVoorWeekLP(Number(sw.weeknummer)),
        weeknummer: Number(sw.weeknummer), weken: String(sw.weeknummer),
        schooljaar: klas.schooljaar, type: 'Theorie',
        uren: p.urenPerWeek || (p.urenTheorie || 0) + (p.urenPraktijk || 0) || 1,
        beschrijving: `Uit lesprofiel: ${p.naam}`,
        profielId: p.id,
        moduleId: p.moduleId || null,
      });
    }
  }

  _lpVerdelingPreview = null;
  _lpVerdelingStappen = null;
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
