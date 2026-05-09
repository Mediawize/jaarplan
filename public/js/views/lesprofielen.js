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
    const niveauKleur = { BB: 'var(--amber)', KB: 'var(--blue)', GL: 'var(--accent)', TL: '#9333EA', Havo: '#0891B2', VWO: '#DC2626' };

    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesprofielen</h1></div>
        <button class="btn btn-sm btn-primary" onclick="openNieuwProfielModal()">+ Nieuw lesprofiel</button>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Een lesprofiel koppelt een lesmodule aan een klas. Vul uren in, koppel aan de planning — AI maakt de weekverdeling.
      </div>
      ${profielen.length === 0
        ? `<div class="card"><div class="empty-state"><h3>Nog geen lesprofielen</h3><button class="btn btn-primary" onclick="openNieuwProfielModal()">Eerste lesprofiel aanmaken</button></div></div>`
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
                <button class="btn btn-sm btn-primary" onclick="openNieuwProfielModal('${vak.id}')">+ Profiel voor ${escHtml(vak.naam)}</button>
              </div>
              ${niveaus.map(niveau => {
                const groep = perNiveau[niveau];
                const niveauLabel = niveau === '__geen__' ? 'Overig' : niveau;
                const kleur = niveauKleur[niveau] || 'var(--ink-3)';
                return `<div style="padding:12px 20px 0">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${kleur};background:${kleur}18;padding:3px 10px;border-radius:20px">${niveauLabel}</span>
                    <span style="font-size:12px;color:var(--ink-3)">${groep.length} profiel${groep.length !== 1 ? 'en' : ''}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px">
                    ${groep.map(p => {
                      const mod = p.moduleId ? moduleMap[p.moduleId] : null;
                      const aantalStappen = mod ? (mod.stappen || []).length : 0;
                      const urenLabel = p.urenPerWeek ? `${p.urenPerWeek}u/week` : (p.urenTheorie || p.urenPraktijk ? `${p.urenTheorie || 0}u T + ${p.urenPraktijk || 0}u P` : '');
                      return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;cursor:pointer;transition:box-shadow .15s" onclick="openProfielDetail('${p.id}')" onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='none'">
                        <div style="font-weight:600;font-size:14px;margin-bottom:4px">${escHtml(p.naam)}</div>
                        ${mod ? `<div style="font-size:12px;color:var(--accent);margin-bottom:4px">📚 ${escHtml(mod.naam)}</div>` : `<div style="font-size:12px;color:var(--ink-muted);margin-bottom:4px">Geen module gekoppeld</div>`}
                        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">${aantalStappen ? aantalStappen + ' stappen' : ''}${aantalStappen && urenLabel ? ' · ' : ''}${urenLabel}</div>
                        <div style="display:flex;gap:6px;margin-top:8px">
                          <button class="btn btn-sm btn-primary" style="flex:1" onclick="event.stopPropagation();openKoppelModal('${p.id}')">Koppelen →</button>
                          <button class="btn btn-sm" onclick="event.stopPropagation();openNieuwProfielModal('${p.vakId}','${p.id}')" title="Bewerken">✏️</button>
                          <button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="event.stopPropagation();verwijderProfiel('${p.id}')" title="Verwijderen">🗑</button>
                        </div>
                      </div>`;
                    }).join('')}
                  </div>
                </div>`;
              }).join('<div style="border-top:1px solid var(--border);margin:0 20px"></div>')}
            </div>`;
          }).join('')
      }
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

// ============================================================
// Nieuw / bewerk profiel — simpel formulier
// ============================================================
async function openNieuwProfielModal(vakId = null, profielId = null) {
  const [vakken, profielen, modules] = await Promise.all([API.getVakken(), API.getLesprofielen(), API.getLesModules()]);
  const p = profielId ? profielen.find(x => x.id === profielId) : null;

  openModal(`
    <h2>${profielId ? 'Lesprofiel bewerken' : 'Nieuw lesprofiel'}</h2>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Naam *</label>
        <input id="lp-naam" value="${escHtml(p?.naam || '')}" placeholder="bijv. Constructief Bouwkunde GL P1">
      </div>
      <div class="form-field">
        <label>Vak *</label>
        <select id="lp-vak" onchange="lpFilterModules()">
          ${vakken.map(v => `<option value="${v.id}" ${(vakId === v.id || p?.vakId === v.id) ? 'selected' : ''}>${escHtml(v.naam)} — ${escHtml(v.volledig || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Niveau</label>
        <select id="lp-niveau">
          ${['', 'BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => `<option value="${n}" ${(p?.niveau || '') === n ? 'selected' : ''}>${n || 'Alle niveaus'}</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Lesmodule koppelen</label>
        <select id="lp-module">
          <option value="">— Geen module —</option>
          ${modules.map(m => `<option value="${m.id}" ${p?.moduleId === m.id ? 'selected' : ''}>${escHtml(m.naam)}${m.niveau ? ' [' + m.niveau + ']' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Uren per week</label>
        <input id="lp-uren" type="number" min="0" max="40" step="0.5" value="${p?.urenPerWeek || ''}" placeholder="bijv. 4">
      </div>
      <div class="form-field">
        <label>Waarvan theorie (u)</label>
        <input id="lp-theorie" type="number" min="0" max="40" step="0.5" value="${p?.urenTheorie || ''}" placeholder="bijv. 1">
      </div>
      <div class="form-field">
        <label>Waarvan praktijk (u)</label>
        <input id="lp-praktijk" type="number" min="0" max="40" step="0.5" value="${p?.urenPraktijk || ''}" placeholder="bijv. 3">
      </div>
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
}

async function slaProfielOp(profielId) {
  const naam = document.getElementById('lp-naam').value.trim();
  const vakId = document.getElementById('lp-vak').value;
  const niveau = document.getElementById('lp-niveau').value;
  const moduleId = document.getElementById('lp-module').value || null;
  const urenPerWeek = parseFloat(document.getElementById('lp-uren').value) || 0;
  const urenTheorie = parseFloat(document.getElementById('lp-theorie').value) || 0;
  const urenPraktijk = parseFloat(document.getElementById('lp-praktijk').value) || 0;
  const beschrijving = document.getElementById('lp-beschrijving').value.trim();

  if (!naam) { alert('Naam is verplicht.'); return; }

  try {
    let id = profielId;
    const payload = { naam, vakId, niveau, moduleId, urenPerWeek, urenTheorie, urenPraktijk, beschrijving };
    if (profielId) {
      await API.updateLesprofiel(profielId, payload);
    } else {
      const r = await API.addLesprofiel(payload);
      id = r.id;
    }
    closeModalDirect();
    Cache.invalidateAll();
    openProfielDetail(id);
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
        <div style="padding:0 20px 16px">
          ${stappen.map((stap, si) => {
            const lessen = stap.lessen || [];
            const praktijk = stap.praktijkOpdrachten || [];
            const toetsMat = stap.toetsId ? toetsen.find(t => t.id === stap.toetsId) : null;
            const heeftToets = toetsMat || stap.toetsUrl;
            return `
              <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden">
                <div style="background:var(--cream);padding:10px 16px;border-bottom:1px solid var(--border)">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-weight:600;font-size:14px">Stap ${si + 1} — ${escHtml(stap.naam || '')}</span>
                    ${heeftToets ? `<span style="font-size:11px;background:#fef2f2;color:#b91c1c;padding:2px 8px;border-radius:99px;border:1px solid #fca5a5">📝 Toets</span>` : ''}
                  </div>
                  ${stap.url ? `<a href="${escHtml(stap.url)}" target="_blank" class="text-link" style="font-size:12px">🔗 ${escHtml(stap.url.length > 60 ? stap.url.slice(0, 60) + '…' : stap.url)}</a>` : ''}
                  ${stap.leerlingTaak ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px">📝 ${escHtml(stap.leerlingTaak)}</div>` : ''}
                </div>
                ${heeftToets ? `<div style="padding:6px 16px;background:#fef2f2;border-bottom:1px solid #fca5a5;font-size:12px;color:#b91c1c;display:flex;gap:8px;align-items:center">
                  📝 Toets:
                  ${toetsMat ? `<strong>${escHtml(toetsMat.naam)}</strong> <a href="/uploads/${encodeURIComponent(toetsMat.bestandsnaam)}" target="_blank" style="font-size:11px;color:#b91c1c">⬇ Download</a>` : ''}
                  ${stap.toetsUrl ? `<a href="${escHtml(stap.toetsUrl)}" target="_blank" style="color:#b91c1c;font-size:11px">${escHtml(stap.toetsUrl.length > 50 ? stap.toetsUrl.slice(0,50)+'…' : stap.toetsUrl)}</a>` : ''}
                </div>` : ''}
                <div style="padding:10px 16px">
                  ${lessen.length ? `<div style="margin-bottom:8px">${lessen.map(l => `<span style="font-size:12px;background:var(--cream);border:1px solid var(--border);border-radius:4px;padding:2px 8px;margin:2px;display:inline-block">${escHtml(l.naam || l)}</span>`).join('')}</div>` : ''}
                  ${praktijk.length ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:4px">Praktijk: ${praktijk.map(o => escHtml(o.naam || '')).join(', ')}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
          ${gedeeld.length ? `
            <div style="border:1px solid var(--amber)30;border-radius:8px;padding:12px 16px;background:var(--amber)08">
              <div style="font-weight:600;font-size:13px;margin-bottom:6px;color:var(--amber)">Gedeelde praktijkopdrachten</div>
              ${gedeeld.map(o => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">${escHtml(o.naam || '')}</div>`).join('')}
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
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="document.getElementById('profiel-detail-overlay').remove();renderLesprofielen()">← Terug</button>
        <h1 style="margin:0;flex:1">${escHtml(p.naam)}</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="openNieuwProfielModal('${p.vakId}','${p.id}')">Bewerken</button>
          <button class="btn btn-sm btn-primary" onclick="openKoppelModal('${p.id}')">Koppelen aan planning</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>Gekoppelde klassen</h2>
            <div class="card-meta">${escHtml(vak?.naam || '')}${p.niveau ? ' · ' + p.niveau : ''}${urenInfo ? ' · ' + urenInfo : ''}</div>
          </div>
          <div style="font-size:12px;color:var(--ink-muted)">${gekoppeldeKlassen.length ? gekoppeldeKlassen.length + ' gekoppeld' : 'Nog niet gekoppeld'}</div>
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
      ? `<div style="margin-top:12px">
           <button class="btn btn-primary" id="koppel-ai-btn" onclick="genereerVerdeling('${profielId}')">🤖 AI genereer weekverdeling</button>
           <span style="font-size:12px;color:var(--ink-muted);margin-left:8px">AI verdeelt modulestappen logisch over de weken</span>
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
  return `<div draggable="true"
    ondragstart="lpDragStart(event,${wi},'${soort}',${ii})"
    ondragend="lpDragEnd(event)"
    ondragover="lpDragOver(event)"
    ondragleave="lpDragLeave(event)"
    ondrop="lpDropOpItem(event,${wi},'${soort}',${ii})"
    style="display:flex;align-items:center;gap:5px;margin-bottom:2px;padding:2px 4px;border-radius:3px;border-top:2px solid transparent;cursor:grab;transition:opacity .15s">
    <span style="color:var(--border);font-size:11px;line-height:1;user-select:none">⠿</span>
    <span style="font-size:11px;color:${kleur}">${label} ${escHtml(tekst)}${uren ? ` <span style="opacity:.6">(${uren}u)</span>` : ''}</span>
  </div>`;
}

function lpRenderVerdelingPreview() {
  const preview = document.getElementById('koppel-verdeling-preview');
  if (!preview || !_lpVerdelingPreview) return;
  const n = _lpVerdelingPreview.length;
  preview.innerHTML = `
    <div style="background:var(--cream);border:1px solid var(--border);border-radius:8px;padding:12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">Weekverdeling (${n} weken)</div>
      <div style="font-size:11px;color:var(--ink-muted);margin-bottom:10px">Sleep theorie- of praktijkonderdelen tussen weken om de volgorde aan te passen.</div>
      <div style="max-height:420px;overflow-y:auto" id="lp-verdeling-weken">
        ${_lpVerdelingPreview.map((w, i) => `
          <div style="display:flex;align-items:stretch;gap:6px;margin-bottom:6px;background:#fff;border:1px solid var(--border);border-radius:6px;overflow:hidden">
            <div style="display:flex;flex-direction:column;gap:0;border-right:1px solid var(--border);background:var(--cream)">
              <button onclick="lpVerschuifWeek(${i},-1)" ${i === 0 ? 'disabled' : ''}
                style="flex:1;border:none;background:none;cursor:${i === 0 ? 'default' : 'pointer'};padding:2px 7px;font-size:12px;color:${i === 0 ? 'var(--border)' : 'var(--ink-muted)'};line-height:1" title="Week omhoog">▲</button>
              <button onclick="lpVerschuifWeek(${i},1)" ${i === n - 1 ? 'disabled' : ''}
                style="flex:1;border:none;background:none;cursor:${i === n - 1 ? 'default' : 'pointer'};padding:2px 7px;font-size:12px;color:${i === n - 1 ? 'var(--border)' : 'var(--ink-muted)'};line-height:1" title="Week omlaag">▼</button>
            </div>
            <div style="padding:7px 10px;flex:1;min-width:0">
              <div style="font-weight:600;font-size:12px;margin-bottom:5px">
                <span style="color:var(--ink-muted);font-weight:400">Week ${i + 1}</span>
                ${w.thema ? ` — ${escHtml(w.thema)}` : ''}
              </div>
              <div ondragover="lpDropZoneOver(event)" ondragleave="lpDropZoneLeave(event)" ondrop="lpDropZone(event,${i},'theorie')"
                style="min-height:18px;border-radius:4px;transition:outline .1s">
                ${(w.theorie || []).map((t, ti) => lpItemRij('📖', t.stapNaam || t.omschrijving || '', t.uren, 'var(--blue)', i, 'theorie', ti)).join('')}
              </div>
              <div ondragover="lpDropZoneOver(event)" ondragleave="lpDropZoneLeave(event)" ondrop="lpDropZone(event,${i},'praktijk')"
                style="min-height:18px;border-radius:4px;margin-top:2px;transition:outline .1s">
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
        await API.addOpdracht({
          naam: t.omschrijving || t.stapNaam || 'Theorie',
          klasId, periode, weeknummer: Number(sw.weeknummer),
          weken: String(sw.weeknummer), schooljaar: klas.schooljaar,
          type: 'Theorie', uren: t.uren || p.urenTheorie || 1,
          beschrijving: wk.thema ? `${wk.thema} — ${p.naam}` : p.naam,
          profielId: p.id,
        });
        // Voeg toets toe als de stap een toets heeft
        const stapInfo = (_lpVerdelingStappen || []).find(s => s.naam === t.stapNaam);
        if (stapInfo && stapInfo.heeftToets) {
          await API.addOpdracht({
            naam: `Toets — ${t.stapNaam || p.naam}`,
            klasId, periode, weeknummer: Number(sw.weeknummer),
            weken: String(sw.weeknummer), schooljaar: klas.schooljaar,
            type: 'Toets', uren: 1,
            beschrijving: wk.thema ? `${wk.thema} — ${p.naam}` : p.naam,
            theorieLink: stapInfo.toetsUrl || '',
            profielId: p.id,
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
