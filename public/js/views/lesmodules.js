// ============================================================
// public/js/views/lesmodules.js
// Les Modules — profiel- en keuzedelen met geïntegreerde praktijk
// ============================================================

async function renderLesModules() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesmodules').innerHTML =
      '<div class="empty-state"><h3>Geen toegang</h3></div>';
    return;
  }

  const isAdmin = Auth.isAdmin();
  showLoading('lesmodules');

  try {
    const [modules, vakken] = await Promise.all([
      API.getLesModules(),
      API.getVakken()
    ]);

    // Docenten zien alleen modules van hun eigen vakken; admins zien alles
    const docentVakken = Auth.currentUser?.vakken || [];
    const zichtbaar = isAdmin
      ? modules
      : modules.filter(m => !m.vakId || docentVakken.includes(m.vakId));

    const typeInfo = {
      profieldeel: { label: 'Profieldelen', typeLabel: 'Profieldeel', kleur: 'var(--blue-text)' },
      keuzedeel: { label: 'Keuzedelen', typeLabel: 'Keuzedeel', kleur: '#059669' },
      theorie_module: { label: 'Theorie modules', typeLabel: 'Theorie module', kleur: '#7c3aed' },
      overig: { label: 'Overig', typeLabel: 'Overig', kleur: '#78716C' }
    };

    const moduleType = (m) => {
      if (m.isTheorieModule || m.type === 'theorie_module') return 'theorie_module';
      if (m.type === 'profieldeel') return 'profieldeel';
      if (m.type === 'keuzedeel') return 'keuzedeel';
      return 'overig';
    };
    const normaliseerNaam = (naam) => String(naam || 'Naamloze module').trim().toLowerCase();
    const niveauLabel = (m) => {
      const n = String(m.niveau || '').trim();
      return n ? n.split(',').map(x => x.trim()).filter(Boolean).join(', ') : 'Alle niveaus';
    };
    const vakNaam = (m) => vakken.find(v => v.id === m.vakId)?.naam || '';
    const telPraktijk = (m) => {
      const stappen = Array.isArray(m.stappen) ? m.stappen : [];
      return stappen.reduce((sum, s) => sum + (Array.isArray(s.praktijkOpdrachten) ? s.praktijkOpdrachten.length : 0), 0)
        + (Array.isArray(m.gedeeldeOpdrachten) ? m.gedeeldeOpdrachten.length : 0);
    };
    const telToetsen = (m) => {
      const stappen = Array.isArray(m.stappen) ? m.stappen : [];
      return stappen.filter(s => s && (s.toetsId || s.toetsUrl)).length;
    };

    const perType = { profieldeel: new Map(), keuzedeel: new Map(), theorie_module: new Map(), overig: new Map() };

    zichtbaar.forEach(m => {
      const type = moduleType(m);
      const key = normaliseerNaam(m.naam);
      if (!perType[type].has(key)) {
        perType[type].set(key, {
          naam: String(m.naam || 'Naamloze module').trim() || 'Naamloze module',
          modules: []
        });
      }
      perType[type].get(key).modules.push(m);
    });

    const renderModuleGroep = (groep, info) => {
      const lijst = groep.modules.slice().sort((a, b) => niveauLabel(a).localeCompare(niveauLabel(b), 'nl'));
      const stappenTotaal = lijst.reduce((sum, m) => sum + (Array.isArray(m.stappen) ? m.stappen.length : 0), 0);
      const praktijkTotaal = lijst.reduce((sum, m) => sum + telPraktijk(m), 0);
      const toetsTotaal = lijst.reduce((sum, m) => sum + telToetsen(m), 0);
      const vakkenUniek = [...new Set(lijst.map(vakNaam).filter(Boolean))];
      const niveaus = [...new Set(lijst.map(niveauLabel))];
      const meta = [
        `${niveaus.length} niveau${niveaus.length !== 1 ? 's' : ''}`,
        stappenTotaal ? `${stappenTotaal} stap${stappenTotaal !== 1 ? 'pen' : ''}` : null,
        praktijkTotaal ? `${praktijkTotaal} praktijk` : null,
        toetsTotaal ? `${toetsTotaal} toets${toetsTotaal !== 1 ? 'en' : ''}` : null,
        vakkenUniek.length ? vakkenUniek.join(', ') : null
      ].filter(Boolean).join(' · ');

      return `<div class="lm-kaart" style="position:relative">
        ${isAdmin ? `<button type="button" class="lm-blok-delete" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border:0;background:transparent;color:var(--ink);font-size:28px;line-height:24px;font-weight:500;cursor:pointer;border-radius:999px" title="Verwijder blok" aria-label="Verwijder blok" onmouseover="this.style.background='var(--red-dim)';this.style.color='var(--red-text)'" onmouseout="this.style.background='transparent';this.style.color='var(--ink)'" onclick="verwijderLesModuleGroep('${lijst[0].id}')">×</button>` : ''}
        <div class="lm-kaart-type">
          <span class="lm-type-pill" style="background:${info.kleur}">${info.typeLabel}</span>
          <span style="font-size:11.5px;color:var(--ink-3)">${niveaus.length} niveau${niveaus.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="lm-kaart-naam">${escHtml(groep.naam)}</div>
        <div class="lm-kaart-meta">${escHtml(meta)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
          ${lijst.map(m => `<button class="btn btn-sm" onclick="bekijkLesModule('${m.id}')">${escHtml(niveauLabel(m))}</button>`).join('')}
        </div>
        ${isAdmin ? `<div class="lm-kaart-acties" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" style="flex:1" onclick="openLesModuleNiveauToevoegen('${lijst[0].id}')">+ Niveau toevoegen</button>
          <button class="btn btn-sm" onclick="openLesModuleGroepBewerken('${lijst[0].id}')">Bewerk blok</button>
        </div>` : ''}
      </div>`;
    };

    const totaalModules = zichtbaar.length;

    document.getElementById('view-lesmodules').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Les Modules</h1>
          <p class="page-sub">Profiel- en keuzedelen gegroepeerd per module. Klik op een niveau om te bekijken of te bewerken.</p>
        </div>
        ${isAdmin ? `<button class="btn btn-primary" onclick="openLesModuleModal()">+ Nieuwe les module</button>` : ''}
      </div>

      ${totaalModules === 0
        ? `<div class="card"><div class="empty-state">
            <h3>Geen les modules</h3>
            ${isAdmin ? `<p>Upload een syllabus PDF of Word-bestand. AI haalt de theoriestappen automatisch eruit.</p><button class="btn btn-primary" onclick="openLesModuleModal()">Eerste module aanmaken</button>` : '<p>Er zijn nog geen les modules beschikbaar voor jouw vakken.</p>'}
           </div></div>`
        : ['profieldeel', 'keuzedeel', 'theorie_module', 'overig'].map(type => {
            const groepen = [...perType[type].values()]
              .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
            if (!groepen.length) return '';
            const info = typeInfo[type];
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <div>
                  <h2>${info.label}</h2>
                  <div class="card-meta">${groepen.length} modulegroep${groepen.length !== 1 ? 'en' : ''} · ${groepen.reduce((sum, g) => sum + g.modules.length, 0)} niveau${groepen.reduce((sum, g) => sum + g.modules.length, 0) !== 1 ? 's' : ''}</div>
                </div>
                ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="openLesModuleModal()">+ Module</button>` : ''}
              </div>
              <div class="lm-grid">
                ${groepen.map(groep => renderModuleGroep(groep, info)).join('')}
              </div>
            </div>`;
          }).join('')
      }
    `;
  } catch (e) {
    showError('Fout: ' + e.message);
  }
}

// ============================================================
// BEKIJK MODAL
// ============================================================

async function bekijkLesModule(moduleId) {
  const [modules, vakken, toetsen, werkboekjes] = await Promise.all([API.getLesModules(), API.getVakken(), API.getMaterialen('toets').catch(() => []), API.getMaterialen('werkboekje').catch(() => [])]);
  const m = modules.find(x => x.id === moduleId);
  if (!m) return;
  const vak = vakken.find(v => v.id === m.vakId);
  const stappen = m.stappen || [];
  const gedeeld = m.gedeeldeOpdrachten || [];
  const badgeKleur = m.type === 'profieldeel' ? 'var(--blue-text)' : m.type === 'keuzedeel' ? '#10b981' : '#6b7280';
  const typeLabel = m.type === 'profieldeel' ? 'Profieldeel' : m.type === 'keuzedeel' ? 'Keuzedeel' : 'Overig';

  let stappenHtml;
  if (!stappen.length) {
    stappenHtml = '<div style="padding:16px;color:var(--ink-muted);font-size:13px">Nog geen stappen gedefinieerd.</div>';
  } else {
    const isLegacy = typeof stappen[0] === 'string';
    if (isLegacy) {
      stappenHtml = stappen.map((s, i) => `
        <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:baseline;font-size:13px">
          <span style="min-width:20px;font-weight:600;color:var(--ink-muted)">${i + 1}.</span>
          <span>${escHtml(s)}</span>
        </div>`).join('');
    } else {
      stappenHtml = stappen.map((stap, i) => {
        const lessen = Array.isArray(stap.lessen) ? stap.lessen : [];
        const opdrachten = Array.isArray(stap.praktijkOpdrachten) ? stap.praktijkOpdrachten : [];
        const totaalUren = [
          ...lessen.map(l => (typeof l === 'object' ? l?.lesuren : 0) || 0),
          ...opdrachten.map(o => o?.lesuren || 0)
        ].reduce((s, n) => s + n, 0);
        const toetsMat = stap.toetsId ? toetsen.find(t => t.id === stap.toetsId) : null;
        const heeftToets = toetsMat || stap.toetsUrl;
        return `<div class="lm-bekijk-stap">
          <div class="lm-bekijk-stap-header">
            <span class="lm-bekijk-stap-nr">${i + 1}</span>
            <span style="font-weight:600;font-size:14px;flex:1;color:var(--ink)">${escHtml(stap.naam)}</span>
            ${stap.url ? `<a href="${escHtml(stap.url)}" target="_blank" style="font-size:12px;color:var(--blue-text);font-weight:500" onclick="event.stopPropagation()">🔗 Leslink</a>` : ''}
            ${totaalUren ? `<span style="font-size:11px;font-weight:700;color:var(--ink-3);background:var(--surface-2);padding:2px 8px;border-radius:20px;border:1px solid var(--border)">⏱ ${totaalUren} lesuur${totaalUren !== 1 ? 'uren' : ''}</span>` : ''}
            ${heeftToets ? `<span style="font-size:11px;color:var(--red-text);background:var(--red-dim);padding:2px 8px;border-radius:20px;border:1px solid var(--red-dim);font-weight:600">📝 Toets</span>` : ''}
          </div>
          ${heeftToets ? `<div class="lp-toets-balk">
            📝 Toets:
            ${toetsMat ? `<strong>${escHtml(toetsMat.naam)}</strong> <a href="/uploads/${encodeURIComponent(toetsMat.bestandsnaam)}" target="_blank" style="font-size:11px;color:var(--red-text)">⬇ Download</a>` : ''}
            ${stap.toetsUrl ? `<a href="${escHtml(stap.toetsUrl)}" target="_blank" style="color:var(--red-text);font-size:11px">${escHtml(stap.toetsUrl.length > 50 ? stap.toetsUrl.slice(0,50)+'…' : stap.toetsUrl)}</a>` : ''}
          </div>` : ''}
          ${stap.leerlingTaak ? `<div style="padding:7px 14px;font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border-bottom:1px solid var(--border)">📝 ${escHtml(stap.leerlingTaak)}</div>` : ''}
          <div class="lm-bekijk-stap-body">
            ${lessen.map((les, j) => {
              const lNaam   = typeof les === 'string' ? les : (les?.naam || '');
              const lUrl    = typeof les === 'object' ? les?.url : null;
              const lUren   = typeof les === 'object' ? les?.lesuren : null;
              return `<div class="lm-bekijk-les">
                <span style="min-width:32px;font-size:11px;color:var(--ink-4);font-family:var(--font-mono);flex-shrink:0">${i+1}.${j+1}</span>
                <span style="flex:1">${lUrl ? `<a href="${escHtml(lUrl)}" target="_blank" style="color:var(--blue-text);font-weight:600;text-decoration:none">${escHtml(lNaam)}</a>` : escHtml(lNaam)}</span>
                ${lUren ? `<span style="font-size:10px;font-weight:700;color:var(--ink-3);background:var(--surface-2);padding:1px 6px;border-radius:20px;border:1px solid var(--border);flex-shrink:0">⏱ ${lUren}u</span>` : ''}
              </div>`;
            }).join('')}
            ${opdrachten.length ? `<div class="lm-bekijk-praktijk-blok">
              <div style="font-size:11px;font-weight:700;color:var(--amber-text);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">🔧 Praktijk (${opdrachten.length})</div>
              ${opdrachten.map((o, k) => {
                const codes = Array.isArray(o.syllabusCodes) ? o.syllabusCodes : [];
                return `<div style="margin-bottom:6px;font-size:12.5px">
                  <div style="display:flex;align-items:center;gap:6px">
                    <strong>${k + 1}. ${escHtml(o.naam || '')}</strong>
                    ${o.lesuren ? `<span style="font-size:10px;font-weight:700;color:var(--ink-3);background:var(--surface-2);padding:1px 6px;border-radius:20px;border:1px solid var(--border)">⏱ ${o.lesuren}u</span>` : ''}
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">
                    ${o.theorieSectie ? `<span style="background:var(--amber-dim);color:var(--amber-text);padding:2px 8px;border-radius:20px;font-size:11px;border:1px solid var(--amber-dim)">📚 ${escHtml(o.theorieSectie)}</span>` : ''}
                    ${codes.map(c => `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;border:1px solid #bbf7d0">${escHtml(c)}</span>`).join('')}
                    ${(() => { const wb = o.werkboekjeId ? werkboekjes.find(w => w.id === o.werkboekjeId) : null; return wb ? `<a href="/uploads/${encodeURIComponent(wb.bestandsnaam)}" target="_blank" style="font-size:11px;color:var(--accent-text);padding:2px 8px;background:var(--accent-dim);border-radius:20px;border:1px solid rgba(22,163,74,.15)">📗 ${escHtml(wb.naam || 'Werkboekje')}</a>` : ''; })()}
                    ${o.werkboekjeLink ? `<a href="${escHtml(o.werkboekjeLink)}" target="_blank" style="font-size:11px;color:var(--accent-text);padding:2px 8px;background:var(--accent-dim);border-radius:20px;border:1px solid rgba(22,163,74,.15)">🔗 Werkboekje</a>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  }

  const gedeeldHtml = gedeeld.length ? `
    <div style="font-weight:600;font-size:14px;margin:16px 0 8px">
      Gedeelde praktijk opdrachten <span style="font-weight:400;font-size:12px;color:var(--ink-muted)">(${gedeeld.length})</span>
    </div>
    <div style="border:1px solid var(--amber-dim);border-radius:8px;overflow:hidden">
      ${gedeeld.map((o, i) => {
        const codes = Array.isArray(o.syllabusCodes) ? o.syllabusCodes : [];
        const stapNamen = Array.isArray(o.stappen) && stappen.length
          ? o.stappen.map(idx => stappen[idx]?.naam ? `Stap ${idx + 1}` : null).filter(Boolean).join(', ')
          : 'Alle stappen';
        return `<div style="padding:10px 14px;border-bottom:1px solid var(--amber-dim);background:var(--amber-dim)">
          <div style="font-size:12px;font-weight:600">${i + 1}. ${escHtml(o.naam || '')}</div>
          <div style="font-size:11px;color:var(--amber-text);margin:2px 0">📌 ${stapNamen}</div>
          ${o.omschrijving ? `<div style="font-size:11px;color:var(--ink-muted)">${escHtml(o.omschrijving)}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">
            ${o.theorieSectie ? `<span style="background:var(--amber-dim);color:var(--amber-text);padding:1px 7px;border-radius:99px;font-size:10px">📚 ${escHtml(o.theorieSectie)}</span>` : ''}
            ${codes.map(c => `<span style="background:#f0fdf4;color:#166534;padding:1px 7px;border-radius:99px;font-size:10px">${escHtml(c)}</span>`).join('')}
            ${o.werkboekjeLink ? `<a href="${escHtml(o.werkboekjeLink)}" target="_blank" style="font-size:10px;color:var(--accent)">🔗 Werkboekje</a>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  openModal(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span class="lm-type-pill" style="background:${badgeKleur}">${typeLabel}</span>
      <span style="font-size:12px;color:var(--ink-3)">${m.niveau ? escHtml(m.niveau) : 'Alle niveaus'}</span>
      ${vak ? `<span style="font-size:12px;color:var(--ink-3)">· ${escHtml(vak.naam)}</span>` : ''}
    </div>
    <h2>${escHtml(m.naam)}</h2>
    ${m.beschrijving ? `<p class="modal-sub">${escHtml(m.beschrijving)}</p>` : '<div style="margin-bottom:16px"></div>'}

    <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--ink-2)">
      Stappen <span style="font-weight:400;color:var(--ink-3)">(${stappen.length})</span>
    </div>
    <div style="max-height:420px;overflow-y:auto">
      ${stappenHtml}
    </div>
    ${gedeeldHtml}

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
      ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="closeModalDirect();openLesModuleModal('${moduleId}')">✏️ Bewerken</button>` : ''}
    </div>
  `);
}


// ============================================================
// GROEP ACTIES
// ============================================================

async function openLesModuleNiveauToevoegen(basisModuleId) {
  const modules = await API.getLesModules();
  const basis = modules.find(m => m.id === basisModuleId);
  if (!basis) return alert('Basismodule niet gevonden.');
  const basisKey = String(basis.naam || '').trim().toLowerCase();
  const bestaandeNiveaus = modules
    .filter(m => String(m.naam || '').trim().toLowerCase() === basisKey)
    .map(m => String(m.niveau || '').trim());
  openLesModuleModal(null, {
    basisModuleId,
    naam: basis.naam || '',
    vakId: basis.vakId || '',
    type: basis.type || 'profieldeel',
    beschrijving: basis.beschrijving || '',
    bestaandeNiveaus
  });
}

async function openLesModuleGroepBewerken(basisModuleId) {
  const [modules, vakken] = await Promise.all([API.getLesModules(), API.getVakken()]);
  const basis = modules.find(m => m.id === basisModuleId);
  if (!basis) return alert('Blok niet gevonden.');
  const basisKey = String(basis.naam || '').trim().toLowerCase();
  const groep = modules.filter(m => String(m.naam || '').trim().toLowerCase() === basisKey);

  openModal(`
    <h2>Moduleblok bewerken</h2>
    <p class="modal-sub">Dit past naam, vak en type aan voor alle niveaus binnen dit blok.</p>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam *</label>
        <input id="lm-groep-naam" value="${escHtml(basis.naam || '')}">
      </div>
      <div class="form-field">
        <label>Type</label>
        <select id="lm-groep-type">
          <option value="profieldeel" ${basis.type === 'profieldeel' ? 'selected' : ''}>Profieldeel</option>
          <option value="keuzedeel" ${basis.type === 'keuzedeel' ? 'selected' : ''}>Keuzedeel</option>
        </select>
      </div>
      <div class="form-field">
        <label>Vak</label>
        <select id="lm-groep-vak">
          <option value="">Geen specifiek vak</option>
          ${vakken.map(v => `<option value="${v.id}" ${basis.vakId === v.id ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Beschrijving</label>
        <textarea id="lm-groep-beschrijving" rows="2">${escHtml(basis.beschrijving || '')}</textarea>
      </div>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--ink-muted)">
      Niveaus in dit blok: ${groep.map(m => escHtml(String(m.niveau || '').trim() || 'Alle niveaus')).join(', ')}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaLesModuleGroepOp('${basisModuleId}')">Opslaan</button>
    </div>
  `);
}

async function slaLesModuleGroepOp(basisModuleId) {
  const modules = await API.getLesModules();
  const basis = modules.find(m => m.id === basisModuleId);
  if (!basis) return alert('Blok niet gevonden.');
  const basisKey = String(basis.naam || '').trim().toLowerCase();
  const groep = modules.filter(m => String(m.naam || '').trim().toLowerCase() === basisKey);
  const naam = document.getElementById('lm-groep-naam')?.value.trim();
  if (!naam) return alert('Vul een naam in.');
  const type = document.getElementById('lm-groep-type')?.value || 'profieldeel';
  const vakId = document.getElementById('lm-groep-vak')?.value || null;
  const beschrijving = document.getElementById('lm-groep-beschrijving')?.value.trim() || '';

  try {
    for (const m of groep) {
      await fetch(`/api/les-modules/${m.id}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...m, naam, type, vakId, beschrijving })
      });
    }
    closeModalDirect();
    await renderLesModules();
  } catch (e) { alert('Fout bij opslaan: ' + e.message); }
}

async function verwijderLesModuleGroep(basisModuleId) {
  const modules = await API.getLesModules();
  const basis = modules.find(m => m.id === basisModuleId);
  if (!basis) return alert('Blok niet gevonden.');
  const basisKey = String(basis.naam || '').trim().toLowerCase();
  const groep = modules.filter(m => String(m.naam || '').trim().toLowerCase() === basisKey);
  const niveaus = groep.map(m => String(m.niveau || '').trim() || 'Alle niveaus').join(', ');
  if (!confirm(`Moduleblok "${basis.naam}" verwijderen?\n\nDit verwijdert ${groep.length} niveau(s): ${niveaus}`)) return;
  try {
    for (const m of groep) {
      await fetch(`/api/les-modules/${m.id}`, { method: 'DELETE', credentials: 'same-origin' });
    }
    await renderLesModules();
  } catch (e) { alert('Fout bij verwijderen: ' + e.message); }
}

// ============================================================
// BEWERK/NIEUW MODAL
// ============================================================

async function openLesModuleModal(moduleId = null, preset = {}) {
  const [vakken, modules, werkboekjes, toetsen] = await Promise.all([
    API.getVakken(),
    API.getLesModules(),
    API.getMaterialen('werkboekje').catch(() => []),
    API.getMaterialen('toets').catch(() => [])
  ]);
  const m = moduleId ? modules.find(x => x.id === moduleId) : null;
  const basisModule = preset?.basisModuleId ? modules.find(x => x.id === preset.basisModuleId) : null;
  const basisNaam = preset?.naam ?? basisModule?.naam ?? '';
  const basisVakId = preset?.vakId ?? basisModule?.vakId ?? '';
  const basisType = preset?.type ?? basisModule?.type ?? 'profieldeel';
  const basisBeschrijving = preset?.beschrijving ?? basisModule?.beschrijving ?? '';
  const bestaandeNiveaus = Array.isArray(preset?.bestaandeNiveaus)
    ? preset.bestaandeNiveaus
    : basisModule ? modules
        .filter(x => String(x.naam || '').trim().toLowerCase() === String(basisModule.naam || '').trim().toLowerCase())
        .map(x => String(x.niveau || '').trim())
      : [];
  window._lmBibliotheek = werkboekjes;
  window._lmToetsen = toetsen;
  window._lmBestaandeNiveaus = bestaandeNiveaus;

  openModal(`
    <h2>${m ? 'Les module bewerken' : 'Nieuwe les module'}</h2>

    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-field">
        <label>Type *</label>
        <select id="lm-type" onchange="lmOnTypeChange()">
          <option value="profieldeel" ${((m?.type || basisType) === 'profieldeel') ? 'selected' : ''}>Profieldeel (max 8 stappen)</option>
          <option value="keuzedeel" ${((m?.type || basisType) === 'keuzedeel') ? 'selected' : ''}>Keuzedeel (max 5 stappen)</option>
          <option value="theorie_module" ${((m?.type || basisType) === 'theorie_module') ? 'selected' : ''}>Theorie module (herbruikbaar)</option>
        </select>
      </div>
      <div class="form-field">
        <label>Niveau(s)</label>
        <div class="lm-niveau-checkboxes">
          ${['BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => {
            const geselect = (m?.niveau || '').split(',').map(x => x.trim()).includes(n);
            const bestaatAl = !m && bestaandeNiveaus.includes(n);
            return `<label class="lm-niveau-checkbox${bestaatAl ? ' lm-niveau--al' : ''}">
              <input type="checkbox" name="lm-niveau" value="${n}" ${geselect ? 'checked' : ''}>
              ${n}${bestaatAl ? ' ✓' : ''}
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="form-field">
        <label>Vak</label>
        <select id="lm-vak">
          <option value="">Geen specifiek vak</option>
          ${vakken.map(v => `<option value="${v.id}" ${((m?.vakId || basisVakId) === v.id) ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full"><label>Naam *</label><input id="lm-naam" value="${escHtml(m?.naam || basisNaam || '')}" placeholder="bijv. Booglasprocessen"></div>
      <div class="form-field form-full"><label>Beschrijving</label>
        <textarea id="lm-beschrijving" rows="2" style="resize:vertical" placeholder="Korte omschrijving">${escHtml(m?.beschrijving || basisBeschrijving || '')}</textarea>
      </div>
    </div>

    <div id="lm-upload-sectie" style="${m ? 'display:none' : ''}">
      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-field form-full" style="margin:0">
          <label>PDF of Word uploaden</label>
          <input id="lm-bestand" type="file" accept=".pdf,.docx,.doc">
          <small style="color:var(--ink-muted)">Syllabus- of profieldeel-document. Toetsmomenten worden automatisch overgeslagen.</small>
          <button class="btn btn-primary" style="margin-top:8px" onclick="analyseerLesModuleBestand()">AI analyseer bestand</button>
        </div>
        <div class="form-field form-full" style="margin:0">
          <label>Afbeelding uploaden</label>
          <input id="lm-afbeelding" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
          <small style="color:var(--ink-muted)">Screenshot van leerplatform of inhoudsopgave. AI leest de stappen eruit.</small>
          <button class="btn btn-primary" style="margin-top:8px" onclick="analyseerLesModuleAfbeelding()">AI analyseer afbeelding</button>
        </div>
      </div>
      <div id="lm-analyse-status"></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    </div>
    ${m ? `<button class="btn btn-sm" style="margin-bottom:16px" onclick="document.getElementById('lm-upload-sectie').style.display='block';this.remove()">↻ Nieuw bestand analyseren</button>` : ''}

    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <label style="font-weight:600;font-size:14px">Stappen <span id="lm-stapcount" style="font-size:12px;color:var(--ink-muted);font-weight:400"></span></label>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm lm-voeg-tm-btn" onclick="lmVoegTheorieModuleIn()" style="background:#ede9fe;border-color:#c4b5fd;color:#6d28d9${(m?.isTheorieModule || m?.type === 'theorie_module') ? ';display:none' : ''}">📚 Theorie module invoegen</button>
          <button class="btn btn-sm" id="lm-voeg-stap-btn" onclick="lmVoegHoofdstapToe()">+ Stap toevoegen</button>
        </div>
      </div>
      <div id="lm-stappen-lijst" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);max-height:560px;overflow-y:auto">
        ${lmStappenHtml(m?.stappen || [], werkboekjes)}
      </div>
    </div>

    <hr style="border:none;border-top:1px solid var(--border);margin:20px 0 16px" class="lm-gedeelde-wrap"${(m?.isTheorieModule || (m?.type === 'theorie_module')) ? ' style="display:none"' : ''}>
    <div class="lm-gedeelde-wrap"${(m?.isTheorieModule || (m?.type === 'theorie_module')) ? ' style="display:none"' : ''}>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label style="font-weight:600;font-size:14px">Gedeelde praktijk opdrachten
          <span style="font-size:11px;font-weight:400;color:var(--ink-muted);margin-left:6px">— voor meerdere stappen tegelijk</span>
        </label>
        <button class="btn btn-sm" onclick="lmVoegGedeeldeOpdrachtToe()" style="background:var(--amber-dim);border-color:var(--amber);color:var(--amber-text)">+ Gedeelde opdracht</button>
      </div>
      <div id="lm-gedeelde-lijst">
        ${lmGedeeldeOpdrachtenHtml(m?.gedeeldeOpdrachten || [], m?.stappen || [])}
      </div>
    </div>

    <input id="lm-bron-bestand" type="hidden" value="${escHtml(m?.bronBestand || '')}">
    <input id="lm-is-theorie-module" type="hidden" value="${m?.isTheorieModule ? '1' : '0'}">

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaLesModuleOp('${moduleId || ''}')">Opslaan</button>
    </div>
  `);
  lmUpdateStapCount();
}

// ============================================================
// STAPPEN RENDERING
// ============================================================

function lmGetMax() {
  return (document.getElementById('lm-type')?.value || 'profieldeel') === 'keuzedeel' ? 5 : 8;
}

function lmOnTypeChange() {
  const type = document.getElementById('lm-type')?.value;
  const isTM = type === 'theorie_module';
  document.getElementById('lm-is-theorie-module').value = isTM ? '1' : '0';
  // Hide/show gedeelde opdrachten and praktijk sections
  const gedeeldeWraps = document.querySelectorAll('.lm-gedeelde-wrap');
  gedeeldeWraps.forEach(el => { el.style.display = isTM ? 'none' : ''; });
  const tmBtn = document.querySelector('.lm-voeg-tm-btn');
  if (tmBtn) tmBtn.style.display = isTM ? 'none' : '';
  // Hide praktijk in all stappen
  document.querySelectorAll('.lm-praktijk-sectie').forEach(el => { el.style.display = isTM ? 'none' : ''; });
  lmUpdateStapCount();
}

function lmStappenHtml(stappen, bibliotheek) {
  const bib = bibliotheek || window._lmBibliotheek || [];
  if (!stappen || !stappen.length) {
    return '<div style="padding:16px;text-align:center;color:var(--ink-muted);font-size:13px">Nog geen stappen. Upload een bestand of voeg stappen handmatig toe.</div>';
  }
  const isLegacy = typeof stappen[0] === 'string';
  if (isLegacy) {
    return stappen.map((s, i) => lmHoofdstapHtml(i, { naam: s, lessen: [], url: '', leerlingTaak: '', praktijkOpdrachten: [] }, bib)).join('');
  }
  return stappen.map((stap, i) => {
    if (stap?.type === 'theorie_module') return lmTheorieModuleStapHtml(i, stap);
    return lmHoofdstapHtml(i, stap, bib);
  }).join('');
}

function lmTheorieModuleStapHtml(i, stap) {
  const urenType = stap.urenType || 'theorie';
  return `<div class="lm-tm-stap" data-module-id="${escHtml(stap.theorieModuleId||'')}" data-module-naam="${escHtml(stap.theorieModuleNaam||'')}" style="border-bottom:1px solid var(--border);padding:10px 14px;display:flex;align-items:center;gap:10px;background:#faf5ff">
    <span style="font-size:18px;flex-shrink:0">📚</span>
    <span style="flex:1;font-weight:700;font-size:13px;color:#6d28d9">${escHtml(stap.theorieModuleNaam||'Theorie module')}</span>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <label style="font-size:11px;color:var(--ink-muted)">Uren:</label>
      <input class="lm-tm-uren" type="number" min="0.5" max="20" step="0.5" value="${stap.uren||1}" style="width:60px;border:1px solid #c4b5fd;border-radius:6px;padding:3px 6px;font-size:12px;text-align:center">
      <label style="font-size:11px;color:var(--ink-muted)">Ten koste van:</label>
      <select class="lm-tm-uren-type" onchange="lmTmUrenTypeWijzig(this)" style="border:1px solid #c4b5fd;border-radius:6px;padding:3px 6px;font-size:12px;font-family:inherit">
        <option value="theorie" ${urenType==='theorie'?'selected':''}>Theorie</option>
        <option value="praktijk" ${urenType==='praktijk'?'selected':''}>Praktijk</option>
        <option value="split" ${urenType==='split'?'selected':''}>Gesplitst</option>
      </select>
      <input class="lm-tm-uren-theorie" type="number" min="0" max="20" step="0.5" value="${stap.urenTheorie||0}" placeholder="T" title="Theorie uren" style="width:50px;border:1px solid #c4b5fd;border-radius:6px;padding:3px 6px;font-size:12px;text-align:center;${urenType==='split'?'':'display:none'}">
      <input class="lm-tm-uren-praktijk" type="number" min="0" max="20" step="0.5" value="${stap.urenPraktijk||0}" placeholder="P" title="Praktijk uren" style="width:50px;border:1px solid #c4b5fd;border-radius:6px;padding:3px 6px;font-size:12px;text-align:center;${urenType==='split'?'':'display:none'}">
    </div>
    <button onclick="lmVerwijderTheorieModuleStap(this)" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:18px;line-height:1;padding:2px 4px;flex-shrink:0">×</button>
  </div>`;
}

function lmHoofdstapHtml(i, stap, bib) {
  const bibliotheek = bib || window._lmBibliotheek || [];
  const naam = stap.naam || '';
  const url = stap.url || '';
  const leerlingTaak = stap.leerlingTaak || '';
  const toetsUrl = stap.toetsUrl || '';
  const toetsId = stap.toetsId || '';
  const lessen = Array.isArray(stap.lessen) ? stap.lessen : [];
  const opdrachten = Array.isArray(stap.praktijkOpdrachten) ? stap.praktijkOpdrachten : [];
  const lessenHtml = lessen.map((les, j) => lmLesHtml(i, j, les)).join('');
  const opdrachtenHtml = opdrachten.map((o, k) => lmPraktijkOpdrachtHtml(i, k, o, bibliotheek)).join('');
  const toetsen = window._lmToetsen || [];
  const toetsOpties = toetsen.map(t => `<option value="${t.id}" ${toetsId === t.id ? 'selected' : ''}>${escHtml(t.naam)}</option>`).join('');

  return `<div class="lm-hoofdstap" data-idx="${i}" style="border-bottom:1px solid var(--border);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;flex-shrink:0">${i + 1}</span>
      <input class="lm-hoofdstap-input" value="${escHtml(naam)}" placeholder="Naam van de stap"
        style="flex:1;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:500"
        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      <button onclick="this.closest('.lm-hoofdstap').remove();lmUpdateStapCount()"
        style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:18px;line-height:1;padding:2px 4px">×</button>
    </div>

    <div style="padding-left:30px;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div class="form-field" style="margin:0">
        <label style="font-size:11px;color:var(--ink-muted)">URL les (docent)</label>
        <input class="lm-url-input" value="${escHtml(url)}" placeholder="https://elo.school.nl/les/..."
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:11px;color:var(--ink-muted)">Leerling taak</label>
        <input class="lm-taak-input" value="${escHtml(leerlingTaak)}" placeholder="Wat moeten leerlingen maken?"
          style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;width:100%"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      </div>
    </div>

    <div style="padding-left:30px;margin-bottom:8px;background:var(--red-dim);border-radius:6px;padding:8px 10px 8px 30px;border-left:2px solid var(--red-dim)">
      <div style="font-size:11px;color:var(--red-text);font-weight:600;margin-bottom:6px">📝 Toets (optioneel)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div class="form-field" style="margin:0">
          <label style="font-size:11px;color:var(--ink-muted)">Gegenereerde toets</label>
          <select class="lm-toets-id"
            style="border:1px solid var(--red-dim);border-radius:6px;padding:4px 8px;font-size:12px;width:100%;background:var(--surface)">
            <option value="">— Geen toets gekoppeld —</option>
            ${toetsOpties}
          </select>
        </div>
        <div class="form-field" style="margin:0">
          <label style="font-size:11px;color:var(--ink-muted)">Of toets URL</label>
          <input class="lm-toets-url" value="${escHtml(toetsUrl)}" placeholder="https://..."
            style="border:1px solid var(--red-dim);border-radius:6px;padding:4px 8px;font-size:12px;width:100%;background:var(--surface)"
            onfocus="this.style.borderColor='var(--red-text)'" onblur="this.style.borderColor='var(--red-dim)'">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
        <label style="font-size:10px;color:var(--red-text);white-space:nowrap;flex-shrink:0">Toets uploaden:</label>
        <input class="lm-toets-bestand" type="file" accept=".pdf,.doc,.docx" style="font-size:10px;flex:1;min-width:0">
        <button class="btn btn-sm" onclick="lmUploadToetsMateriaal(this)" style="font-size:10px;padding:3px 8px;white-space:nowrap">Upload</button>
        <span class="lm-toets-bestandsnaam" style="font-size:10px;color:var(--ink-muted)"></span>
      </div>
    </div>

    <div class="lm-lessen" style="padding-left:30px;margin-bottom:8px">
      <div style="font-size:11px;color:var(--ink-muted);margin-bottom:4px">Sub-lessen (theorie)</div>
      ${lessenHtml}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        <button class="btn btn-sm lm-voeg-les-btn" onclick="lmVoegLesToe(this)"
          style="font-size:11px;padding:3px 8px${lessen.length >= 15 ? ';opacity:.4' : ''}"
          ${lessen.length >= 15 ? 'disabled' : ''}>+ Sub-les</button>
        <button class="btn btn-sm" onclick="lmAnalyseerSubLesAfbeelding(this)"
          style="font-size:11px;padding:3px 8px;background:#ede9fe;border-color:#c4b5fd;color:#6d28d9">🖼 Afbeelding analyseren</button>
      </div>
    </div>

    <div class="lm-praktijk-sectie" style="padding-left:30px">
      <div style="font-size:11px;color:var(--ink-muted);margin-bottom:6px;display:flex;align-items:center;gap:8px">
        <span>Praktijk opdrachten</span>
        <span class="lm-praktijk-count" style="font-size:10px;background:var(--amber-dim);color:var(--amber-text);padding:1px 7px;border-radius:99px">${opdrachten.length}</span>
      </div>
      <div class="lm-praktijk-lijst">${opdrachtenHtml}</div>
      <button class="btn btn-sm" onclick="lmVoegPraktijkOpdrachtToe(this.closest('.lm-hoofdstap'))"
        style="font-size:11px;padding:3px 10px;background:var(--amber-dim);border-color:var(--amber);color:var(--amber-text);margin-top:4px">+ Praktijk opdracht</button>
    </div>
  </div>`;
}

// ============================================================
// SUB-LESSEN
// ============================================================

function lmLesHtml(stapIdx, lesIdx, les) {
  const naam    = typeof les === 'string' ? les : (les?.naam || '');
  const url     = typeof les === 'object' ? (les?.url || '') : '';
  const lesuren = typeof les === 'object' ? (les?.lesuren || '') : '';
  return `<div class="lm-les-rij" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
    <span style="font-size:11px;color:var(--ink-muted);min-width:28px;flex-shrink:0">${stapIdx + 1}.${lesIdx + 1}</span>
    <input class="lm-les-input" value="${escHtml(naam)}" placeholder="Naam van de sub-les (ELO-stap)"
      style="flex:2;min-width:120px;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px"
      onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
    <input class="lm-les-url" value="${escHtml(url)}" placeholder="URL (ELO / LessonUp)"
      style="flex:2;min-width:120px;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px"
      onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
    <input class="lm-les-uren" type="number" min="0.5" max="20" step="0.5" value="${escHtml(String(lesuren))}" placeholder="uren"
      title="Aantal lesuren"
      style="width:64px;flex-shrink:0;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:12px;text-align:center"
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
  if (bestaandeLessen >= 15) return;
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
  const stapIdx = Array.from(document.querySelectorAll('.lm-hoofdstap')).indexOf(stap);
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
  btn.disabled = count >= 15;
  btn.style.opacity = count >= 15 ? '.4' : '1';
}

async function lmAnalyseerSubLesAfbeelding(btn) {
  const stap = btn.closest('.lm-hoofdstap');
  const lessenDiv = stap.querySelector('.lm-lessen');

  // Verberg knop tijdelijk, toon status
  const origTekst = btn.textContent;
  const statusSpan = document.createElement('span');
  statusSpan.style.cssText = 'font-size:11px;color:var(--ink-muted);margin-left:6px';
  btn.after(statusSpan);

  // Open file picker
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif';
  input.onchange = async () => {
    if (!input.files?.[0]) { statusSpan.remove(); return; }
    btn.disabled = true;
    btn.textContent = '⏳';
    statusSpan.textContent = 'AI analyseert...';
    try {
      const fd = new FormData();
      fd.append('bestand', input.files[0]);
      const res = await fetch('/api/les-modules/analyseer-afbeelding', { method: 'POST', credentials: 'same-origin', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Fout');

      const namen = (data.stappen || []).filter(Boolean);
      if (!namen.length) { statusSpan.textContent = 'Geen stappen gevonden.'; btn.textContent = origTekst; btn.disabled = false; return; }

      const hoofdstappen = Array.from(document.querySelectorAll('.lm-hoofdstap'));
      const stapIdx = hoofdstappen.indexOf(stap);
      namen.forEach((naam, i) => {
        const bestaand = stap.querySelectorAll('.lm-les-rij').length;
        if (bestaand >= 15) return;
        const div = document.createElement('div');
        div.innerHTML = lmLesHtml(stapIdx, bestaand, naam);
        lessenDiv.insertBefore(div.firstElementChild, btn.parentElement);
      });
      lmUpdateLesNummers(stap);
      lmUpdateVoegLesKnop(stap);
      statusSpan.textContent = `${namen.length} sub-lessen toegevoegd ✓`;
      setTimeout(() => statusSpan.remove(), 3000);
    } catch (e) {
      statusSpan.textContent = 'Fout: ' + e.message;
    }
    btn.textContent = origTekst;
    btn.disabled = false;
  };
  input.click();
}

// ============================================================
// PRAKTIJK OPDRACHTEN (embedded per stap)
// ============================================================

function lmPraktijkOpdrachtHtml(stapIdx, opIdx, o, bibliotheek) {
  const bib = bibliotheek || window._lmBibliotheek || [];
  const codes = Array.isArray(o.syllabusCodes) ? o.syllabusCodes.join(', ') : '';
  const bibOpties = bib.map(w =>
    `<option value="${w.id}" ${o.werkboekjeId === w.id ? 'selected' : ''}>${escHtml(w.naam || w.bestandsnaam || 'Werkboekje')}</option>`
  ).join('');

  return `<div class="lm-praktijk-rij" style="border:1px solid var(--amber-dim);border-radius:8px;padding:10px;margin-bottom:8px;background:var(--amber-dim)">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-size:10px;font-weight:700;background:var(--amber);color:#fff;padding:1px 6px;border-radius:99px;flex-shrink:0">P${opIdx + 1}</span>
      <input class="lm-po-naam" value="${escHtml(o.naam || '')}" placeholder="Naam van de opdracht"
        style="flex:1;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;font-weight:500"
        onfocus="this.style.borderColor='var(--amber)'" onblur="this.style.borderColor='var(--border)'">
      <button onclick="lmVerwijderPraktijkOpdracht(this)"
        style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:14px;line-height:1;padding:2px 4px">×</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:6px;margin-bottom:6px">
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Omschrijving</label>
        <input class="lm-po-omschrijving" value="${escHtml(o.omschrijving || '')}" placeholder="Korte omschrijving"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Werkboekje uit lesmaterialen</label>
        <select class="lm-po-wbid" style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
          <option value="">— Geen werkboekje gekoppeld —</option>
          ${bibOpties}
        </select>
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Of werkboekje link (URL)</label>
        <input class="lm-po-link" value="${escHtml(o.werkboekjeLink || '')}" placeholder="https://..."
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Theorie-onderdeel</label>
        <input class="lm-po-theorie" value="${escHtml(o.theorieSectie || '')}" placeholder="AI of handmatig"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Lesuren</label>
        <input class="lm-po-uren" type="number" min="0.5" max="20" step="0.5" value="${escHtml(String(o.lesuren || ''))}" placeholder="bv. 2"
          title="Aantal lesuren dat leerlingen hieraan werken"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%;text-align:center"
          onfocus="this.style.borderColor='var(--amber)'" onblur="this.style.borderColor='var(--border)'">
      </div>
      <div class="form-field" style="margin:0;grid-column:1/-1">
        <label style="font-size:10px;color:var(--ink-muted)">Syllabus codes (komma-gescheiden)</label>
        <input class="lm-po-codes" value="${escHtml(codes)}" placeholder="K/PIE/2.1, K/DT/3.2"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <label style="font-size:10px;color:var(--ink-muted);white-space:nowrap;flex-shrink:0">Werkboekje uploaden:</label>
      <input class="lm-po-bestand" type="file" accept=".pdf,.doc,.docx" style="font-size:10px;flex:1;min-width:0">
      <button class="btn btn-sm" onclick="lmUploadPraktijkMateriaal(this, 'werkboekje')" style="font-size:10px;padding:3px 8px;white-space:nowrap">Upload</button>
      <span class="lm-po-bestandsnaam" style="font-size:10px;color:var(--ink-muted)">${o.werkboekjeBestand ? escHtml(o.werkboekjeBestand) : ''}</span>
    </div>
  </div>`;
}

function lmVoegPraktijkOpdrachtToe(stapEl) {
  if (!stapEl) return;
  const lijst = stapEl.querySelector('.lm-praktijk-lijst');
  if (!lijst) return;
  const hauptstappen = Array.from(document.querySelectorAll('.lm-hoofdstap'));
  const stapIdx = hauptstappen.indexOf(stapEl);
  const opIdx = lijst.querySelectorAll('.lm-praktijk-rij').length;
  const div = document.createElement('div');
  div.innerHTML = lmPraktijkOpdrachtHtml(stapIdx, opIdx, {}, window._lmBibliotheek || []);
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('.lm-po-naam')?.focus();
  lmUpdatePraktijkCount(stapEl);
}

function lmVerwijderPraktijkOpdracht(btn) {
  const stap = btn.closest('.lm-hoofdstap');
  btn.closest('.lm-praktijk-rij').remove();
  lmUpdatePraktijkCount(stap);
  lmHernummerPraktijk(stap);
}

function lmVerwijderTheorieModuleStap(btn) {
  btn.closest('.lm-tm-stap').remove();
  lmUpdateStapCount();
}

function lmTmUrenTypeWijzig(select) {
  const rij = select.closest('.lm-tm-stap');
  const isSplit = select.value === 'split';
  rij.querySelector('.lm-tm-uren-theorie').style.display = isSplit ? '' : 'none';
  rij.querySelector('.lm-tm-uren-praktijk').style.display = isSplit ? '' : 'none';
}

async function lmVoegTheorieModuleIn() {
  const modules = await API.getLesModules();
  const theorieModules = modules.filter(m => m.isTheorieModule || m.type === 'theorie_module');
  if (!theorieModules.length) {
    alert('Er zijn nog geen theorie modules aangemaakt. Maak eerst een theorie module aan.');
    return;
  }
  openModal(`
    <h2>📚 Theorie module invoegen</h2>
    <p class="modal-sub">Selecteer een theorie module om als stap in te voegen in de huidige module.</p>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Theorie module *</label>
        <select id="lm-tm-keuze">
          <option value="">— Kies een theorie module —</option>
          ${theorieModules.map(m => `<option value="${escHtml(m.id)}" data-naam="${escHtml(m.naam)}">${escHtml(m.naam)}${m.niveau ? ` (${escHtml(m.niveau)})` : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Aantal uren</label>
        <input id="lm-tm-uren" type="number" min="0.5" max="20" step="0.5" value="1" style="text-align:center">
      </div>
      <div class="form-field">
        <label>Ten koste van</label>
        <select id="lm-tm-uren-type" onchange="lmTmPickerWijzig()">
          <option value="theorie">Theorie uren</option>
          <option value="praktijk">Praktijk uren</option>
          <option value="split">Gesplitst (kies per type)</option>
        </select>
      </div>
      <div class="form-field" id="lm-tm-split-wrap" style="display:none;grid-column:1/-1">
        <label>Verdeling</label>
        <div style="display:flex;gap:10px;align-items:center">
          <input id="lm-tm-uren-t" type="number" min="0" max="20" step="0.5" value="0.5" placeholder="Theorie" style="width:80px;text-align:center"> u theorie
          <input id="lm-tm-uren-p" type="number" min="0" max="20" step="0.5" value="0.5" placeholder="Praktijk" style="width:80px;text-align:center"> u praktijk
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="lmBevestigTheorieModuleIn()">Invoegen</button>
    </div>
  `);
}

function lmTmPickerWijzig() {
  const isSplit = document.getElementById('lm-tm-uren-type')?.value === 'split';
  const wrap = document.getElementById('lm-tm-split-wrap');
  if (wrap) wrap.style.display = isSplit ? '' : 'none';
}

function lmBevestigTheorieModuleIn() {
  const select = document.getElementById('lm-tm-keuze');
  const id = select?.value;
  const naam = select?.selectedOptions?.[0]?.dataset.naam || select?.selectedOptions?.[0]?.text || '';
  if (!id) { alert('Kies een theorie module.'); return; }
  const uren = parseFloat(document.getElementById('lm-tm-uren')?.value) || 1;
  const urenType = document.getElementById('lm-tm-uren-type')?.value || 'theorie';
  const urenTheorie = urenType === 'split' ? (parseFloat(document.getElementById('lm-tm-uren-t')?.value) || 0) : 0;
  const urenPraktijk = urenType === 'split' ? (parseFloat(document.getElementById('lm-tm-uren-p')?.value) || 0) : 0;

  const stap = { type: 'theorie_module', theorieModuleId: id, theorieModuleNaam: naam, uren, urenType, urenTheorie, urenPraktijk };
  const lijst = document.getElementById('lm-stappen-lijst');
  if (!lijst) { closeModalDirect(); return; }
  const div = document.createElement('div');
  div.innerHTML = lmTheorieModuleStapHtml(0, stap);
  lijst.appendChild(div.firstElementChild);
  lmUpdateStapCount();
  closeModalDirect();
}

function lmUpdatePraktijkCount(stapEl) {
  if (!stapEl) return;
  const count = stapEl.querySelectorAll('.lm-praktijk-rij').length;
  const badge = stapEl.querySelector('.lm-praktijk-count');
  if (badge) badge.textContent = count;
}

function lmHernummerPraktijk(stapEl) {
  if (!stapEl) return;
  stapEl.querySelectorAll('.lm-praktijk-rij').forEach((rij, k) => {
    const badge = rij.querySelector('span[style*="var(--amber)"]');
    if (badge) badge.textContent = `P${k + 1}`;
  });
}


async function lmUploadBestandAlsMateriaal(file, type, naam, vak) {
  const fd = new FormData();
  fd.append('bestand', file);
  fd.append('type', type);
  fd.append('naam', naam || file.name || (type === 'toets' ? 'Toets' : 'Werkboekje'));
  fd.append('vak', vak || '');
  const res = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: fd });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Upload mislukt');
  return data;
}

async function lmUploadToetsMateriaal(btn) {
  const stap = btn.closest('.lm-hoofdstap');
  if (!stap) return;
  const input = stap.querySelector('.lm-toets-bestand');
  const bestandEl = stap.querySelector('.lm-toets-bestandsnaam');
  const select = stap.querySelector('.lm-toets-id');
  const file = input?.files?.[0];
  if (!file) { alert('Kies eerst een toetsbestand.'); return; }
  const stapNaam = stap.querySelector('.lm-hoofdstap-input')?.value.trim() || 'Toets';
  const vakNaam = document.getElementById('lm-vak')?.selectedOptions?.[0]?.textContent || '';
  const oudeTekst = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await lmUploadBestandAlsMateriaal(file, 'toets', stapNaam, vakNaam);
    if (bestandEl) bestandEl.textContent = data.bestandsnaam || file.name;
    if (select && data.materiaalId) {
      if (![...select.options].some(o => o.value === data.materiaalId)) {
        select.insertAdjacentHTML('beforeend', `<option value="${data.materiaalId}">${escHtml(stapNaam)}</option>`);
      }
      select.value = data.materiaalId;
    }
    window._lmToetsen = window._lmToetsen || [];
    if (data.materiaalId && !window._lmToetsen.some(t => t.id === data.materiaalId)) {
      window._lmToetsen.push({ id: data.materiaalId, type: 'toets', naam: stapNaam, bestandsnaam: data.bestandsnaam, vak: vakNaam });
    }
  } catch (e) {
    alert('Fout: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = oudeTekst;
  }
}

async function lmUploadPraktijkMateriaal(btn, type) {
  const rij = btn.closest('.lm-praktijk-rij');
  if (!rij) return;
  const input = rij.querySelector('.lm-po-bestand');
  const naamInput = rij.querySelector('.lm-po-naam');
  const bestandsnaamEl = rij.querySelector('.lm-po-bestandsnaam');
  const select = rij.querySelector('.lm-po-wbid');
  const file = input?.files?.[0];
  if (!file) { alert('Kies eerst een werkboekje.'); return; }
  const naam = naamInput?.value.trim() || file.name || 'Werkboekje';
  const vakNaam = document.getElementById('lm-vak')?.selectedOptions?.[0]?.textContent || '';
  const oudeTekst = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await lmUploadBestandAlsMateriaal(file, type, naam, vakNaam);
    if (bestandsnaamEl) bestandsnaamEl.textContent = data.bestandsnaam || file.name;
    if (data.materiaalId) {
      rij.dataset.werkboekjeId = data.materiaalId;
      rij.dataset.werkboekjeBestand = data.bestandsnaam || '';
      if (select) {
        if (![...select.options].some(o => o.value === data.materiaalId)) {
          select.insertAdjacentHTML('beforeend', `<option value="${data.materiaalId}">${escHtml(naam)}</option>`);
        }
        select.value = data.materiaalId;
      }
      window._lmBibliotheek = window._lmBibliotheek || [];
      if (!window._lmBibliotheek.some(w => w.id === data.materiaalId)) {
        window._lmBibliotheek.push({ id: data.materiaalId, type, naam, bestandsnaam: data.bestandsnaam, vak: vakNaam });
      }
    }
  } catch (e) {
    alert('Fout: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = oudeTekst;
  }
}

async function lmUploadGedeeldMateriaal(btn, type) {
  const rij = btn.closest('.lm-gedeelde-rij');
  if (!rij) return;
  const input = rij.querySelector('.lm-gd-bestand');
  const naamInput = rij.querySelector('.lm-gd-naam');
  const bestandsnaamEl = rij.querySelector('.lm-gd-bestandsnaam');
  const select = rij.querySelector('.lm-gd-wbid');
  const file = input?.files?.[0];
  if (!file) { alert('Kies eerst een werkboekje.'); return; }
  const naam = naamInput?.value.trim() || file.name || 'Werkboekje';
  const vakNaam = document.getElementById('lm-vak')?.selectedOptions?.[0]?.textContent || '';
  const oudeTekst = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await lmUploadBestandAlsMateriaal(file, type, naam, vakNaam);
    if (bestandsnaamEl) bestandsnaamEl.textContent = data.bestandsnaam || file.name;
    if (data.materiaalId) {
      rij.dataset.werkboekjeId = data.materiaalId;
      rij.dataset.werkboekjeBestand = data.bestandsnaam || '';
      if (select) {
        if (![...select.options].some(o => o.value === data.materiaalId)) {
          select.insertAdjacentHTML('beforeend', `<option value="${data.materiaalId}">${escHtml(naam)}</option>`);
        }
        select.value = data.materiaalId;
      }
      window._lmBibliotheek = window._lmBibliotheek || [];
      if (!window._lmBibliotheek.some(w => w.id === data.materiaalId)) {
        window._lmBibliotheek.push({ id: data.materiaalId, type, naam, bestandsnaam: data.bestandsnaam, vak: vakNaam });
      }
    }
  } catch (e) {
    alert('Fout: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = oudeTekst;
  }
}

async function lmAnalyseerPraktijkBestand(btn) {
  const rij = btn.closest('.lm-praktijk-rij');
  if (!rij) return;
  const fileInput = rij.querySelector('.lm-po-bestand');
  const naamInput = rij.querySelector('.lm-po-naam');
  const theorieInput = rij.querySelector('.lm-po-theorie');
  const codesInput = rij.querySelector('.lm-po-codes');
  const bestandsnaamEl = rij.querySelector('.lm-po-bestandsnaam');
  if (!fileInput?.files?.[0]) { alert('Kies eerst een bestand.'); return; }
  const origTekst = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  const fd = new FormData();
  fd.append('bestand', fileInput.files[0]);
  fd.append('opdrachtnaam', naamInput?.value || '');
  fd.append('niveau', _lmGetNiveau());
  try {
    const res = await fetch('/api/les-modules/analyseer-praktijk', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');
    if (theorieInput && data.theorieSectie) theorieInput.value = data.theorieSectie;
    if (codesInput && data.syllabusCodes?.length) codesInput.value = data.syllabusCodes.join(', ');
    if (bestandsnaamEl && data.bestandsnaam) { bestandsnaamEl.textContent = data.bestandsnaam; rij.dataset.werkboekjeBestand = data.bestandsnaam; }
    if (data.bibliotheekId) {
      rij.dataset.werkboekjeId = data.bibliotheekId;
      const select = rij.querySelector('.lm-po-wbid');
      if (select) {
        if (![...select.options].some(o => o.value === data.bibliotheekId)) {
          select.insertAdjacentHTML('beforeend', `<option value="${data.bibliotheekId}">${escHtml(data.bibliotheekNaam || data.origineelBestand || data.bestandsnaam || 'Werkboekje')}</option>`);
        }
        select.value = data.bibliotheekId;
      }
      window._lmBibliotheek = window._lmBibliotheek || [];
      if (!window._lmBibliotheek.some(w => w.id === data.bibliotheekId)) {
        window._lmBibliotheek.push({ id: data.bibliotheekId, naam: data.bibliotheekNaam || data.origineelBestand || data.bestandsnaam || 'Werkboekje', data: { bestandsnaam: data.bestandsnaam } });
      }
    }
  } catch (e) { alert('Fout: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = origTekst; }
}


async function lmAnalyseerGedeeldBestand(btn) {
  const rij = btn.closest('.lm-gedeelde-rij');
  if (!rij) return;
  const fileInput = rij.querySelector('.lm-gd-bestand');
  const naamInput = rij.querySelector('.lm-gd-naam');
  const theorieInput = rij.querySelector('.lm-gd-theorie');
  const codesInput = rij.querySelector('.lm-gd-codes');
  const bestandsnaamEl = rij.querySelector('.lm-gd-bestandsnaam');
  if (!fileInput?.files?.[0]) { alert('Kies eerst een bestand.'); return; }
  const origTekst = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  const fd = new FormData();
  fd.append('bestand', fileInput.files[0]);
  fd.append('opdrachtnaam', naamInput?.value || 'Gedeelde praktijkopdracht');
  fd.append('niveau', _lmGetNiveau());
  try {
    const res = await fetch('/api/les-modules/analyseer-praktijk', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');
    if (theorieInput && data.theorieSectie) theorieInput.value = data.theorieSectie;
    if (codesInput && data.syllabusCodes?.length) codesInput.value = data.syllabusCodes.join(', ');
    if (bestandsnaamEl && data.bestandsnaam) { bestandsnaamEl.textContent = data.bestandsnaam; rij.dataset.werkboekjeBestand = data.bestandsnaam; }
    if (data.bibliotheekId) {
      rij.dataset.werkboekjeId = data.bibliotheekId;
      const select = rij.querySelector('.lm-gd-wbid');
      if (select) {
        if (![...select.options].some(o => o.value === data.bibliotheekId)) {
          select.insertAdjacentHTML('beforeend', `<option value="${data.bibliotheekId}">${escHtml(data.bibliotheekNaam || data.origineelBestand || data.bestandsnaam || 'Werkboekje')}</option>`);
        }
        select.value = data.bibliotheekId;
      }
      window._lmBibliotheek = window._lmBibliotheek || [];
      if (!window._lmBibliotheek.some(w => w.id === data.bibliotheekId)) {
        window._lmBibliotheek.push({ id: data.bibliotheekId, naam: data.bibliotheekNaam || data.origineelBestand || data.bestandsnaam || 'Werkboekje', data: { bestandsnaam: data.bestandsnaam } });
      }
    }
  } catch (e) { alert('Fout: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = origTekst; }
}

// ============================================================
// GEDEELDE OPDRACHTEN (module-niveau, meerdere stappen)
// ============================================================

function lmGedeeldeOpdrachtenHtml(opdrachten, stappen) {
  if (!opdrachten || !opdrachten.length) {
    return '<div style="padding:12px;text-align:center;color:var(--ink-muted);font-size:13px">Nog geen gedeelde opdrachten.</div>';
  }
  return opdrachten.map((o, i) => lmGedeeldeOpdrachtHtml(i, o, stappen)).join('');
}

function lmGedeeldeOpdrachtHtml(idx, o, stappen) {
  const huidigeStappen = stappen || Array.from(document.querySelectorAll('.lm-hoofdstap')).map((s, i) => ({
    naam: s.querySelector('.lm-hoofdstap-input')?.value.trim() || `Stap ${i + 1}`
  }));
  const codes = Array.isArray(o.syllabusCodes) ? o.syllabusCodes.join(', ') : '';
  const geselecteerd = Array.isArray(o.stappen) ? o.stappen : [];
  const bib = window._lmBibliotheek || [];
  const bibOpties = bib.map(w =>
    `<option value="${w.id}" ${o.werkboekjeId === w.id ? 'selected' : ''}>${escHtml(w.naam || w.bestandsnaam || 'Werkboekje')}</option>`
  ).join('');

  const stapCheckboxes = huidigeStappen.map((stap, i) =>
    `<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-right:8px;cursor:pointer">
      <input type="checkbox" class="lm-gd-stap-cb" value="${i}" ${geselecteerd.includes(i) ? 'checked' : ''}> Stap ${i + 1}${stap.naam ? ` — ${escHtml(stap.naam.slice(0, 20))}` : ''}
    </label>`
  ).join('');

  return `<div class="lm-gedeelde-rij" style="border:1px solid var(--amber-dim);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--amber-dim)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:10px;font-weight:700;background:var(--amber);color:#fff;padding:2px 8px;border-radius:99px">Gedeeld ${idx + 1}</span>
      <input class="lm-gd-naam" value="${escHtml(o.naam || '')}" placeholder="Naam van de gedeelde opdracht"
        style="flex:1;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:13px;font-weight:500"
        onfocus="this.style.borderColor='var(--amber)'" onblur="this.style.borderColor='var(--border)'">
      <button onclick="this.closest('.lm-gedeelde-rij').remove()"
        style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:18px;line-height:1;padding:2px 4px">×</button>
    </div>

    <div style="margin-bottom:8px">
      <div style="font-size:11px;color:var(--ink-muted);margin-bottom:4px">Hoort bij stappen:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${stapCheckboxes || '<span style="font-size:11px;color:var(--ink-muted)">Voeg eerst stappen toe.</span>'}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Omschrijving</label>
        <input class="lm-gd-omschrijving" value="${escHtml(o.omschrijving || '')}" placeholder="Korte omschrijving"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Werkboekje uit lesmaterialen</label>
        <select class="lm-gd-wbid" style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
          <option value="">— Geen werkboekje gekoppeld —</option>
          ${bibOpties}
        </select>
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Of werkboekje link (URL)</label>
        <input class="lm-gd-link" value="${escHtml(o.werkboekjeLink || '')}" placeholder="https://..."
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0">
        <label style="font-size:10px;color:var(--ink-muted)">Theorie-onderdeel</label>
        <input class="lm-gd-theorie" value="${escHtml(o.theorieSectie || '')}" placeholder="AI of handmatig"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0;grid-column:1/-1">
        <label style="font-size:10px;color:var(--ink-muted)">Syllabus codes (komma-gescheiden)</label>
        <input class="lm-gd-codes" value="${escHtml(codes)}" placeholder="K/PIE/2.1, K/DT/3.2"
          style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;width:100%">
      </div>
      <div class="form-field" style="margin:0;grid-column:1/-1">
        <label style="font-size:10px;color:var(--ink-muted)">Werkboekje / werkinstructie uploaden</label>
        <div style="display:flex;align-items:center;gap:6px">
          <input class="lm-gd-bestand" type="file" accept=".pdf,.docx,.doc" style="font-size:10px;flex:1;min-width:0">
          <button class="btn btn-sm" onclick="lmUploadGedeeldMateriaal(this, 'werkboekje')" style="font-size:10px;padding:3px 8px;white-space:nowrap">Upload</button>
          <span class="lm-gd-bestandsnaam" style="font-size:10px;color:var(--ink-muted)">${o.werkboekjeBestand ? escHtml(o.werkboekjeBestand) : ''}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function lmVoegGedeeldeOpdrachtToe() {
  const lijst = document.getElementById('lm-gedeelde-lijst');
  if (!lijst) return;
  const leeg = lijst.querySelector('[style*="Nog geen gedeelde"]');
  if (leeg) leeg.remove();
  const huidigeStappen = Array.from(document.querySelectorAll('.lm-hoofdstap')).map((s, i) => ({
    naam: s.querySelector('.lm-hoofdstap-input')?.value.trim() || `Stap ${i + 1}`
  }));
  const idx = lijst.querySelectorAll('.lm-gedeelde-rij').length;
  const div = document.createElement('div');
  div.innerHTML = lmGedeeldeOpdrachtHtml(idx, {}, huidigeStappen);
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('.lm-gd-naam')?.focus();
}

// ============================================================
// STAP COUNT + TOEVOEGEN
// ============================================================

function lmVoegHoofdstapToe() {
  const lijst = document.getElementById('lm-stappen-lijst');
  if (!lijst) return;
  const max = lmGetMax();
  const bestaand = lijst.querySelectorAll('.lm-hoofdstap').length;
  if (bestaand >= max) return;
  const leeg = lijst.querySelector('[style*="Nog geen stappen"]');
  if (leeg) leeg.remove();
  const div = document.createElement('div');
  div.innerHTML = lmHoofdstapHtml(bestaand, { naam: '', lessen: [], url: '', leerlingTaak: '', praktijkOpdrachten: [] }, window._lmBibliotheek || []);
  lijst.appendChild(div.firstElementChild);
  lijst.lastElementChild?.querySelector('.lm-hoofdstap-input')?.focus();
  lmUpdateStapCount();
}

function lmUpdateStapCount() {
  const count = document.querySelectorAll('.lm-hoofdstap').length;
  const max = lmGetMax();
  const el = document.getElementById('lm-stapcount');
  if (el) el.textContent = count ? `(${count}/${max})` : `(max ${max})`;
  const voegBtn = document.getElementById('lm-voeg-stap-btn');
  if (voegBtn) { voegBtn.disabled = count >= max; voegBtn.style.opacity = count >= max ? '.4' : '1'; }
}

// ============================================================
// LEZEN UIT DOM
// ============================================================

function lmLeesStappen() {
  const lijst = document.getElementById('lm-stappen-lijst');
  if (!lijst) return [];
  const result = [];
  lijst.querySelectorAll('.lm-hoofdstap, .lm-tm-stap').forEach(el => {
    if (el.classList.contains('lm-tm-stap')) {
      const urenType = el.querySelector('.lm-tm-uren-type')?.value || 'theorie';
      result.push({
        type: 'theorie_module',
        theorieModuleId: el.dataset.moduleId || '',
        theorieModuleNaam: el.dataset.moduleNaam || '',
        uren: parseFloat(el.querySelector('.lm-tm-uren')?.value) || 1,
        urenType,
        urenTheorie: urenType === 'split' ? (parseFloat(el.querySelector('.lm-tm-uren-theorie')?.value) || 0) : 0,
        urenPraktijk: urenType === 'split' ? (parseFloat(el.querySelector('.lm-tm-uren-praktijk')?.value) || 0) : 0,
      });
    } else {
      const naam = el.querySelector('.lm-hoofdstap-input')?.value.trim() || '';
      if (!naam) return;
      const url = el.querySelector('.lm-url-input')?.value.trim() || '';
      const leerlingTaak = el.querySelector('.lm-taak-input')?.value.trim() || '';
      const lessen = Array.from(el.querySelectorAll('.lm-les-rij')).map(rij => {
        const naam   = rij.querySelector('.lm-les-input')?.value.trim() || '';
        const url    = rij.querySelector('.lm-les-url')?.value.trim() || '';
        const uren   = parseFloat(rij.querySelector('.lm-les-uren')?.value) || 0;
        if (!naam) return null;
        return { naam, url, lesuren: uren || undefined };
      }).filter(Boolean);
      const praktijkOpdrachten = Array.from(el.querySelectorAll('.lm-praktijk-rij')).map(rij => {
        const codesRaw = rij.querySelector('.lm-po-codes')?.value.trim() || '';
        return {
          naam: rij.querySelector('.lm-po-naam')?.value.trim() || '',
          omschrijving: rij.querySelector('.lm-po-omschrijving')?.value.trim() || '',
          werkboekjeId: rij.querySelector('.lm-po-wbid')?.value || rij.dataset.werkboekjeId || '',
          werkboekjeLink: rij.querySelector('.lm-po-link')?.value.trim() || '',
          theorieSectie: rij.querySelector('.lm-po-theorie')?.value.trim() || '',
          syllabusCodes: codesRaw ? codesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
          werkboekjeBestand: rij.dataset.werkboekjeBestand || rij.querySelector('.lm-po-bestandsnaam')?.textContent.trim() || '',
          lesuren: parseFloat(rij.querySelector('.lm-po-uren')?.value) || undefined,
        };
      }).filter(o => o.naam);
      const toetsId = el.querySelector('.lm-toets-id')?.value || '';
      const toetsUrl = el.querySelector('.lm-toets-url')?.value.trim() || '';
      result.push({ naam, url, leerlingTaak, lessen, praktijkOpdrachten, toetsId, toetsUrl });
    }
  });
  return result;
}

function lmLeesGedeeldeOpdrachten() {
  return Array.from(document.querySelectorAll('.lm-gedeelde-rij')).map(rij => {
    const codesRaw = rij.querySelector('.lm-gd-codes')?.value.trim() || '';
    const geselecteerdeStappen = Array.from(rij.querySelectorAll('.lm-gd-stap-cb:checked')).map(cb => parseInt(cb.value));
    return {
      naam: rij.querySelector('.lm-gd-naam')?.value.trim() || '',
      omschrijving: rij.querySelector('.lm-gd-omschrijving')?.value.trim() || '',
      werkboekjeId: rij.querySelector('.lm-gd-wbid')?.value || rij.dataset.werkboekjeId || '',
      werkboekjeLink: rij.querySelector('.lm-gd-link')?.value.trim() || '',
      theorieSectie: rij.querySelector('.lm-gd-theorie')?.value.trim() || '',
      syllabusCodes: codesRaw ? codesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      stappen: geselecteerdeStappen,
      werkboekjeBestand: rij.dataset.werkboekjeBestand || rij.querySelector('.lm-gd-bestandsnaam')?.textContent.trim() || '',
    };
  }).filter(o => o.naam);
}

// ============================================================
// AI UPLOAD (theorie syllabus)
// ============================================================

async function analyseerLesModuleAfbeelding() {
  const input = document.getElementById('lm-afbeelding');
  const statusEl = document.getElementById('lm-analyse-status');
  if (!input?.files?.[0]) { if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);font-size:13px">Kies eerst een afbeelding.</span>'; return; }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--ink-muted);font-size:13px">⏳ AI analyseert de afbeelding...</span>';
  const fd = new FormData();
  fd.append('bestand', input.files[0]);
  try {
    const res = await fetch('/api/les-modules/analyseer-afbeelding', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');
    const stappen = (data.stappen || []).map(naam => ({ naam, lessen: [], praktijkOpdrachten: [] }));
    const lijst = document.getElementById('lm-stappen-lijst');
    if (lijst) lijst.innerHTML = lmStappenHtml(stappen, window._lmBibliotheek || []);
    lmUpdateStapCount();
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success" style="margin-top:8px">${stappen.length} stappen gevonden uit afbeelding.</div>`;
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert" style="background:var(--red-dim);color:var(--red-text);border:1px solid var(--red-dim);border-radius:8px;padding:10px;margin-top:8px;font-size:13px">Fout: ${escHtml(e.message)}</div>`;
  }
}

async function analyseerLesModuleBestand() {
  const input = document.getElementById('lm-bestand');
  const statusEl = document.getElementById('lm-analyse-status');
  if (!input?.files?.[0]) { if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);font-size:13px">Kies eerst een bestand.</span>'; return; }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--ink-muted);font-size:13px">⏳ AI analyseert het bestand...</span>';
  const fd = new FormData();
  fd.append('bestand', input.files[0]);
  fd.append('niveau', _lmGetNiveau());
  fd.append('type', document.getElementById('lm-type')?.value || 'profieldeel');
  try {
    const res = await fetch('/api/les-modules/analyseer', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout');
    const naamEl = document.getElementById('lm-naam');
    if (naamEl && !naamEl.value.trim()) naamEl.value = data.naam || '';
    document.getElementById('lm-bron-bestand').value = data.bronBestand || '';
    const lijst = document.getElementById('lm-stappen-lijst');
    if (lijst) lijst.innerHTML = lmStappenHtml(data.stappen || [], window._lmBibliotheek || []);
    lmUpdateStapCount();
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success" style="margin-top:8px">${(data.stappen || []).length} stappen gevonden uit "${escHtml(data.bronBestand || '')}".</div>`;
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert" style="background:var(--red-dim);color:var(--red-text);border:1px solid var(--red-dim);border-radius:8px;padding:10px;margin-top:8px;font-size:13px">Fout: ${escHtml(e.message)}</div>`;
  }
}

// ============================================================
// OPSLAAN / VERWIJDEREN
// ============================================================

function _lmGetNiveau() {
  return [...document.querySelectorAll('input[name="lm-niveau"]:checked')]
    .map(cb => cb.value).filter(Boolean).join(',');
}

async function slaLesModuleOp(moduleId) {
  const naam = document.getElementById('lm-naam')?.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  const niveau = _lmGetNiveau();

  const isTheorieModule = document.getElementById('lm-type')?.value === 'theorie_module';
  const payload = {
    naam,
    type: document.getElementById('lm-type')?.value || 'profieldeel',
    categorie: 'theorie',
    vakId: document.getElementById('lm-vak')?.value || null,
    niveau,
    beschrijving: document.getElementById('lm-beschrijving')?.value.trim() || '',
    stappen: lmLeesStappen(),
    gedeeldeOpdrachten: lmLeesGedeeldeOpdrachten(),
    bronBestand: document.getElementById('lm-bron-bestand')?.value || '',
    isTheorieModule
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
