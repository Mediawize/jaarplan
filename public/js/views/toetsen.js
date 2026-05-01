// ============================================================
// public/js/views/toetsen.js
// Werkboekje generator (upload + stappen-wizard), Toets generator,
// School instellingen modal
// ============================================================

// ============================================================
// RENDER TOETSEN PAGINA
// ============================================================
async function renderToetsen() {
  showLoading('toetsen');
  try {
    const [klassen, alleOpd, materialen] = await Promise.all([
      API.getKlassen(), API.getOpdrachten(), API.getMaterialen()
    ]);
    const readonly = !Auth.canEdit();
    const metToets = alleOpd.filter(o => o.toetsBestand);
    const metTheorie = alleOpd.filter(o => o.theorieLink);
    const toetsBib = materialen.filter(m => m.type === 'toets');
    const werkBoekBib = materialen.filter(m => m.type === 'werkboekje');

    const renderMateriaalRijen = (lijst) => lijst.map(m => {
      const datum = m.aangemaakt ? m.aangemaakt.slice(0, 10) : '';
      return `
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px">
            <div style="font-weight:500;font-size:13px">${escHtml(m.naam)}</div>
            ${m.vak ? `<div style="font-size:11px;color:var(--ink-muted)">${escHtml(m.vak)}</div>` : ''}
          </div>
          <div style="font-size:12px;color:var(--ink-muted);white-space:nowrap">${datum}</div>
          <a href="/uploads/${escHtml(m.bestandsnaam)}" download="${escHtml(m.bestandsnaam)}"
             class="btn btn-sm">⬇ Download</a>
          ${!readonly ? `<button class="btn btn-sm" onclick="matKoppelAanActiviteit('${m.id}','${escHtml(m.naam)}','${escHtml(m.bestandsnaam)}')">Koppelen</button>` : ''}
          ${!readonly ? `<button class="btn btn-sm" style="color:var(--red)" onclick="matVerwijder('${m.id}')">Verwijderen</button>` : ''}
        </div>`;
    }).join('');

    document.getElementById('view-toetsen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Toetsen & Materialen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${!readonly ? `
            <button class="btn" onclick="openWerkboekjeWizard()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📓</span> Werkboekje maken
            </button>
            <button class="btn" onclick="openToetsGenerator()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📝</span> Toets genereren
            </button>
          ` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>📝 Toets bibliotheek (${toetsBib.length})</h2>
          <div class="card-meta">Gegenereerde toetsen — koppel ze aan een activiteit in een lesprofiel</div></div>
        </div>
        ${toetsBib.length === 0
          ? `<div class="empty-state"><h3>Nog geen toetsen</h3><p>Genereer een toets via "Toets genereren" hierboven.</p></div>`
          : renderMateriaalRijen(toetsBib)}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>📓 Werkboekje bibliotheek (${werkBoekBib.length})</h2>
          <div class="card-meta">Gegenereerde werkboekjes — koppel ze aan een activiteit in een lesprofiel</div></div>
        </div>
        ${werkBoekBib.length === 0
          ? `<div class="empty-state"><h3>Nog geen werkboekjes</h3><p>Genereer een werkboekje via "Werkboekje maken" hierboven.</p></div>`
          : renderMateriaalRijen(werkBoekBib)}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>Toetsen (gekoppeld aan opdrachten) (${metToets.length})</h2></div></div>
        ${metToets.length === 0
          ? `<div class="empty-state"><p>Geen gekoppelde toetsbestanden in opdrachten.</p></div>`
          : metToets.map(o => {
              const klas = klassen.find(k => k.id === o.klasId);
              return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <div style="flex:2;min-width:120px">
                  <a href="/uploads/${escHtml(o.toetsBestand)}" target="_blank" style="color:var(--accent);font-size:13px">${escHtml(o.toetsBestand)}</a>
                  <div style="font-size:12px;color:var(--ink-muted)">${escHtml(o.naam || '')}</div>
                </div>
                <div style="font-size:13px">${escHtml(klas?.naam || '—')}</div>
                <div style="font-size:12px;color:var(--ink-muted)">Week ${o.weeknummer || '—'}</div>
              </div>`;
            }).join('')}
      </div>
    `;
  } catch (e) { showError('Fout bij laden: ' + e.message); }
}

async function matVerwijder(id) {
  if (!confirm('Materiaal definitief verwijderen?')) return;
  try {
    await API.deleteMateriaal(id);
    renderToetsen();
  } catch (e) { alert('Fout: ' + e.message); }
}

async function matKoppelAanActiviteit(materiaalId, naam, bestandsnaam) {
  const [profielen, vakken] = await Promise.all([API.getLesprofielen(), API.getVakken()]);
  if (!profielen.length) { alert('Geen lesprofielen gevonden.'); return; }

  window._matProfielen = profielen;
  window._matVakken = vakken;

  // Unieke vakken die voorkomen in lesprofielen
  const vakIds = [...new Set(profielen.map(p => p.vakId))];
  const vakOpties = vakIds.map(id => {
    const vak = vakken.find(v => v.id === id);
    return `<option value="${id}">${escHtml(vak?.naam || id)}</option>`;
  }).join('');

  openModal(`
    <h2>Koppel aan activiteit</h2>
    <p class="modal-sub">Kies stap voor stap waaraan je <strong>${escHtml(naam)}</strong> wil koppelen.</p>
    <div class="form-field">
      <label>Vak</label>
      <select id="mat-vak" onchange="matFilterNiveau(this.value)">
        <option value="">— kies vak —</option>
        ${vakOpties}
      </select>
    </div>
    <div id="mat-niveau-container"></div>
    <div id="mat-weken-container"></div>
    <div id="mat-koppel-status" style="font-size:13px;margin-top:8px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="matSlaKoppelingOp('${materiaalId}','${escHtml(bestandsnaam)}')">Koppelen</button>
    </div>
  `);
}

function matFilterNiveau(vakId) {
  const niveauContainer = document.getElementById('mat-niveau-container');
  const wekenContainer = document.getElementById('mat-weken-container');
  wekenContainer.innerHTML = '';
  if (!vakId) { niveauContainer.innerHTML = ''; return; }

  const profielen = (window._matProfielen || []).filter(p => p.vakId === vakId);
  const opties = profielen.map(p => {
    const label = p.naam + (p.niveau ? ` — ${p.niveau}` : '');
    return `<option value="${p.id}">${escHtml(label)}</option>`;
  }).join('');

  niveauContainer.innerHTML = `
    <div class="form-field" style="margin-top:10px">
      <label>Niveau</label>
      <select id="mat-profiel" onchange="matLaadWeken(this.value)">
        <option value="">— kies niveau —</option>
        ${opties}
      </select>
    </div>`;
}

function matLaadWeken(profielId) {
  const container = document.getElementById('mat-weken-container');
  if (!profielId) { container.innerHTML = ''; return; }
  const profiel = (window._matProfielen || []).find(p => p.id === profielId);
  if (!profiel) return;

  const opties = (profiel.weken || []).flatMap((w, wi) =>
    (w.activiteiten || []).map((a, ai) =>
      `<option value="${wi}_${ai}">Week ${w.weekIndex || wi + 1} — ${escHtml(a.omschrijving || a.type || 'Activiteit')}</option>`
    )
  );

  container.innerHTML = `
    <div class="form-field" style="margin-top:10px">
      <label>Les / week</label>
      <select id="mat-activiteit">
        <option value="">— kies les —</option>
        ${opties.join('')}
      </select>
    </div>`;
}

async function matSlaKoppelingOp(materiaalId, bestandsnaam) {
  const profielId = document.getElementById('mat-profiel')?.value;
  const actVal = document.getElementById('mat-activiteit')?.value;
  const statusEl = document.getElementById('mat-koppel-status');
  if (!profielId || !actVal) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Kies een lesprofiel en activiteit.</span>`;
    return;
  }
  const [weekIdx, actIdx] = actVal.split('_').map(Number);
  const profiel = window._matProfielen?.find(p => p.id === profielId);
  if (!profiel) return;

  // Sla bestandsnaam op in activiteit
  const weken = profiel.weken ? JSON.parse(JSON.stringify(profiel.weken)) : [];
  if (weken[weekIdx]?.activiteiten?.[actIdx]) {
    weken[weekIdx].activiteiten[actIdx].bestand = bestandsnaam;
  }
  try {
    await API.updateLesprofiel(profielId, { weken });
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ Gekoppeld!</span>`;
    setTimeout(() => closeModalDirect(), 1200);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

// ============================================================
// HELPERS
// ============================================================
async function getSchoolInstellingen() {
  try {
    const res = await fetch('/api/instellingen', { credentials: 'same-origin' });
    if (!res.ok) return { schoolnaam: '', logoBestand: null };
    return await res.json();
  } catch { return { schoolnaam: '', logoBestand: null }; }
}

function toonBestandsnaamInZone(input, zoneId) {
  const file = input.files[0];
  if (!file) return;
  const zone = document.getElementById(zoneId);
  zone.innerHTML = `<div style="font-size:20px">📄</div>
    <div style="font-weight:500;margin-bottom:4px;color:var(--accent)">${escHtml(file.name)}</div>
    <div style="font-size:12px">${(file.size / 1024 / 1024).toFixed(2)} MB — klik om te wijzigen</div>`;
  zone.style.borderColor = 'var(--accent)';
}

// ============================================================
// INSTELLINGEN MODAL
// ============================================================
async function openInstellingenModal() {
  const inst = await getSchoolInstellingen();
  openModal(`
    <h2>⚙️ School instellingen</h2>
    <p class="modal-sub">Schoolnaam en logo worden bovenaan elk werkboekje en elke toets geplaatst.</p>
    <div id="inst-result" style="margin-bottom:8px;font-size:13px"></div>
    <div class="form-field">
      <label>Schoolnaam *</label>
      <input id="inst-schoolnaam" type="text" placeholder="bijv. Atlascollege" value="${escHtml(inst.schoolnaam || '')}">
    </div>
    <div class="form-field">
      <label>Logo (PNG, JPG of SVG)</label>
      <div class="upload-zone" onclick="document.getElementById('inst-logo-input').click()" id="inst-logo-zone"
           style="padding:12px;text-align:center;border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer">
        ${inst.logoBestand
          ? `<img src="/uploads/${escHtml(inst.logoBestand)}" style="height:40px;object-fit:contain;border-radius:4px;border:1px solid var(--border)">`
          : `<div style="font-size:12px;color:var(--ink-muted)">Klik om logo te uploaden</div>`}
      </div>
      <div id="inst-logo-preview" style="margin-top:6px"></div>
      <input type="file" id="inst-logo-input" accept="image/png,image/jpeg,image/jpg,image/svg+xml" style="display:none" onchange="previewLogo(this)">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaInstellingenOp()">Opslaan</button>
    </div>
    ${Auth.isAdmin() ? `
    <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
    <h3 style="font-size:14px;font-weight:600;margin-bottom:4px">Databeheer</h3>
    <p style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">Verwijder verweesde data van profielen die al zijn verwijderd.</p>
    <div id="cleanup-result" style="font-size:13px;margin-bottom:8px"></div>
    <button class="btn" onclick="cleanupProfielen()">🗑 Opschonen verwijderde profielen</button>
    ` : ''}
  `);
}

function previewLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('inst-logo-preview');
  const zone = document.getElementById('inst-logo-zone');
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" style="height:40px;object-fit:contain;border-radius:4px;border:1px solid var(--border)">
    <span style="font-size:12px;color:var(--accent);margin-left:8px">✓ ${escHtml(file.name)}</span>`;
  zone.style.borderColor = 'var(--accent)';
}

async function slaInstellingenOp() {
  const result = document.getElementById('inst-result');
  const schoolnaam = document.getElementById('inst-schoolnaam').value.trim();
  if (!schoolnaam) { result.innerHTML = `<span style="color:var(--red)">Schoolnaam is verplicht.</span>`; return; }
  result.innerHTML = `<span style="color:var(--amber)">⏳ Opslaan...</span>`;
  try {
    const naamRes = await fetch('/api/instellingen/schoolnaam', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolnaam })
    });
    if (!naamRes.ok) throw new Error('Schoolnaam opslaan mislukt');
    const logoInput = document.getElementById('inst-logo-input');
    if (logoInput.files[0]) {
      const fd = new FormData();
      fd.append('logo', logoInput.files[0]);
      const logoRes = await fetch('/api/instellingen/logo', { method: 'POST', body: fd });
      if (!logoRes.ok) throw new Error('Logo uploaden mislukt');
    }
    result.innerHTML = `<span style="color:var(--accent)">✓ Instellingen opgeslagen</span>`;
    setTimeout(() => closeModalDirect(), 1200);
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

async function cleanupProfielen() {
  const result = document.getElementById('cleanup-result');
  if (!result) return;
  if (!confirm('Verwijder alle data (lesbrieven, koppelingen) van profielen die al zijn verwijderd?')) return;
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bezig...</span>`;
  try {
    const res = await fetch('/api/admin/cleanup-profielen', { method: 'POST', credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fout');
    result.innerHTML = `<span style="color:var(--accent)">✓ ${data.message}</span>`;
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

// ============================================================
// WERKBOEKJE GENERATOR — keuze: upload of nieuw via wizard
// ============================================================
async function openWerkboekjeGenerator() {
  const inst = await getSchoolInstellingen();

  openModal(`
    <h2>📓 Werkboekje maken</h2>
    <p class="modal-sub">Kies hoe je het werkboekje wilt aanmaken.</p>

    ${inst.schoolnaam
      ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:16px">
           🏫 <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ''}
         </div>`
      : Auth.isAdmin() ? `<div class="alert alert-info" style="margin-bottom:14px">
           <strong>Tip:</strong> Stel eerst de schoolnaam in via
           <a href="#" onclick="closeModalDirect();openInstellingenModal()" style="color:var(--accent)">⚙️ Instellingen</a>.
         </div>` : ''
    }

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">

      <div onclick="openWerkboekjeUpload()"
           style="border:1.5px solid var(--border-2);border-radius:var(--radius);padding:20px 16px;cursor:pointer;text-align:center;transition:border-color .15s"
           onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-2)'">
        <div style="font-size:28px;margin-bottom:8px">📤</div>
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">Bestand uploaden</div>
        <div style="font-size:12px;color:var(--ink-muted)">AI zet een Word/PDF om naar de standaard layout</div>
      </div>

      <div onclick="openWerkboekjeWizard()"
           style="border:1.5px solid var(--border-2);border-radius:var(--radius);padding:20px 16px;cursor:pointer;text-align:center;transition:border-color .15s"
           onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-2)'">
        <div style="font-size:28px;margin-bottom:8px">✏️</div>
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">Nieuw aanmaken</div>
        <div style="font-size:12px;color:var(--ink-muted)">Stap voor stap invullen via een formulier</div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
    </div>
  `);
}

// ============================================================
// UPLOAD → AI
// ============================================================
async function openWerkboekjeUpload() {
  const inst = await getSchoolInstellingen();
  openModal(`
    <h2>📤 Werkboekje uit bestand</h2>
    <p class="modal-sub">Upload een bestaand document. De AI analyseert het en zet het om naar de standaard layout met materiaalstaat, veiligheidsregels, machines en stappenplan.</p>

    ${inst.schoolnaam
      ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:12px">🏫 <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ''}</div>`
      : ''}

    <div class="form-field">
      <label>Titel (optioneel — AI kiest anders zelf)</label>
      <input id="wb-titel" type="text" placeholder="bijv. Wallmen — Wandkastje">
    </div>

    <div class="form-field">
      <label>Bestand * (Word of PDF)</label>
      <div class="upload-zone" onclick="document.getElementById('wb-bestand').click()" id="wb-zone"
           style="padding:24px;text-align:center;border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer">
        <div style="font-size:24px;margin-bottom:6px">↑</div>
        <div style="font-weight:500;margin-bottom:4px">Sleep bestand hierheen of klik</div>
        <div style="font-size:12px;color:var(--ink-muted)">.docx · .pdf — max 25 MB</div>
      </div>
      <input type="file" id="wb-bestand" accept=".docx,.doc,.pdf" style="display:none" onchange="toonBestandsnaamInZone(this,'wb-zone')">
    </div>

    <div id="wb-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="openWerkboekjeWizard()">← Terug</button>
      ${Auth.isAdmin() ? `<button class="btn" onclick="closeModalDirect();openInstellingenModal()">⚙️ Instellingen</button>` : ''}
      <button class="btn btn-primary" onclick="doGenererenWerkboekje()">📓 Genereren</button>
    </div>
  `);
}

async function doGenererenWerkboekje() {
  const bestandInput = document.getElementById('wb-bestand');
  const titel = document.getElementById('wb-titel').value.trim();
  const result = document.getElementById('wb-result');

  if (!bestandInput.files[0]) {
    result.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`;
    return;
  }

  result.innerHTML = `<span style="color:var(--amber)">⏳ AI analyseert document en bouwt werkboekje... (15-30 sec)</span>`;

  const fd = new FormData();
  fd.append('bestand', bestandInput.files[0]);
  if (titel) fd.append('titel', titel);

  try {
    const res = await fetch('/api/genereer-werkboekje', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    const waarschuwingHtml = data.waarschuwing
      ? `<div style="margin-top:8px;padding:10px 12px;background:#FEF3C7;border:1px solid #D97706;border-radius:6px;font-size:12px;color:#92400E">
           Waarschuwing: ${escHtml(data.waarschuwing)}<br>
           <span style="margin-top:4px;display:block">Tip: gebruik Nieuw aanmaken om zelf het werkboekje stap voor stap in te vullen.</span>
         </div>`
      : '';

    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        Klaar: <strong>${escHtml(data.titel)}</strong><br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          Werkboekje downloaden (.docx)
        </a>
      </div>${waarschuwingHtml}`;
  } catch (e) {
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('insufficient');
    if (isQuota) {
      result.innerHTML = `<div style="padding:12px;background:#FEF3C7;border:1px solid #D97706;border-radius:6px;font-size:13px;color:#92400E">
        Claude AI is tijdelijk niet beschikbaar (limiet bereikt).<br>
        <span style="font-size:12px;margin-top:6px;display:block">
          Klik op Terug en kies Nieuw aanmaken om handmatig een werkboekje te maken,
          of probeer het over enkele minuten opnieuw.
        </span>
      </div>`;
    } else {
      result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(msg)}</span>`;
    }
  }
}

// ============================================================
// NIEUW WERKBOEKJE — STAPPEN-WIZARD (zonder AI)
// ============================================================
function _wbWizardDefaults() {
  return {
    vak: '', profieldeel: '', opdrachtnummer: '1', duur: '',
    titel: '', leerdoelen: ['', '', ''],
    introductie: '',
    veiligheidsregels: ['Je werkpak en werkschoenen aantrekken.', 'Loshangende kleding is verboden.', 'Losse haren in een staart of knot.', 'Gehoorbescherming is verplicht bij machines.'],
    materiaalstaat: [
      { nummer: 1, aantal: '', benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' },
      { nummer: 2, aantal: '', benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' },
    ],
    machines: ['', ''],
    secties: [
      { titel: '', benodigdheden: [''], stappen: [
        { stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null },
        { stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null },
        { stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null }
      ]}
    ]
  };
}

const _wbWizard = {
  stap: 1,
  data: _wbWizardDefaults()
};

function openWerkboekjeWizard() {
  _wbWizard.stap = 1;
  _wbWizard.data = _wbWizardDefaults();
  renderWizardStap();
}

function renderWizardStap() {
  const s = _wbWizard.stap;
  const totaal = 6;
  const stapTitels = ['Algemeen', 'Leerdoelen & intro', 'Materialen', 'Veiligheid & machines', 'Stappenplan', 'Controleren'];

  let inhoud = '';

  if (s === 1) {
    inhoud = `
      <div class="form-grid">
        <div class="form-field">
          <label>Vak *</label>
          <input id="wz-vak" placeholder="bijv. BWI" value="${escHtml(_wbWizard.data.vak)}">
        </div>
        <div class="form-field">
          <label>Opdrachtnummer</label>
          <input id="wz-opdrnr" placeholder="bijv. 1" value="${escHtml(_wbWizard.data.opdrachtnummer)}">
        </div>
        <div class="form-field form-full">
          <label>Profieldeel / richting</label>
          <input id="wz-profiel" placeholder="bijv. Wonen en interieur" value="${escHtml(_wbWizard.data.profieldeel)}">
        </div>
        <div class="form-field form-full">
          <label>Titel opdracht *</label>
          <input id="wz-titel" placeholder="bijv. Wallmen — Wandkastje" value="${escHtml(_wbWizard.data.titel)}">
        </div>
        <div class="form-field form-full">
          <label>Duur</label>
          <input id="wz-duur" placeholder="bijv. 11 x 45 minuten" value="${escHtml(_wbWizard.data.duur)}">
        </div>
      </div>`;
  }

  else if (s === 2) {
    inhoud = `
      <div class="form-field">
        <label>Introductie (1-2 zinnen)</label>
        <textarea id="wz-intro" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;resize:vertical">${escHtml(_wbWizard.data.introductie)}</textarea>
      </div>
      <div class="form-field">
        <label>Leerdoelen (max. 4)</label>
        ${_wbWizard.data.leerdoelen.map((d, i) => `
          <input id="wz-doel-${i}" placeholder="De leerling kan ..." value="${escHtml(d)}" style="margin-bottom:6px">
        `).join('')}
        ${_wbWizard.data.leerdoelen.length < 4 ? `<button class="btn btn-sm" onclick="wizardVoegDoelToe()" style="margin-top:2px">+ Leerdoel toevoegen</button>` : ''}
      </div>`;
  }

  else if (s === 3) {
    inhoud = `
      <div class="form-field">
        <label>Materiaalstaat</label>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--surface-2)">
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Nr.</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Aantal</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Benaming</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Lengte</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Breedte</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Dikte</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;border:1px solid var(--border)">Soort hout</th>
                <th style="padding:6px 8px;border:1px solid var(--border)"></th>
              </tr>
            </thead>
            <tbody id="wz-mat-tbody">
              ${_wbWizard.data.materiaalstaat.map((r, i) => `
                <tr>
                  <td style="padding:4px 6px;border:1px solid var(--border);font-size:12px;color:var(--ink-muted)">${r.nummer}</td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-ant-${i}" value="${escHtml(r.aantal||'')}" placeholder="st." style="width:40px;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-ben-${i}" value="${escHtml(r.benaming)}" placeholder="Naam onderdeel" style="width:100%;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-len-${i}" value="${escHtml(r.lengte)}" placeholder="mm" style="width:60px;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-br-${i}" value="${escHtml(r.breedte)}" placeholder="mm" style="width:60px;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-dk-${i}" value="${escHtml(r.dikte)}" placeholder="mm" style="width:50px;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border)"><input id="wz-mat-sh-${i}" value="${escHtml(r.soortHout)}" placeholder="Multiplex" style="width:90px;border:none;font-size:13px;background:transparent"></td>
                  <td style="padding:2px 4px;border:1px solid var(--border);text-align:center">
                    <button onclick="wizardVerwijderMateriaal(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:14px">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <button class="btn btn-sm" onclick="wizardVoegMateriaalToe()" style="margin-top:8px">+ Rij toevoegen</button>
      </div>`;
  }

  else if (s === 4) {
    inhoud = `
      <div class="form-field">
        <label>Veiligheidsregels</label>
        ${_wbWizard.data.veiligheidsregels.map((r, i) => `
          <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
            <input id="wz-veil-${i}" value="${escHtml(r)}" placeholder="Veiligheidsregel" style="flex:1">
            <button onclick="wizardVerwijderVeilRegel(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px;padding:4px">✕</button>
          </div>
        `).join('')}
        ${_wbWizard.data.veiligheidsregels.length < 6 ? `<button class="btn btn-sm" onclick="wizardVoegVeilRegelToe()">+ Regel toevoegen</button>` : ''}
      </div>
      <div class="form-field" style="margin-top:16px">
        <label>Machines en gereedschappen</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${_wbWizard.data.machines.map((m, i) => `
            <div style="display:flex;gap:6px;align-items:center">
              <input id="wz-mac-${i}" value="${escHtml(m)}" placeholder="bijv. Invalzaag" style="flex:1">
              <button onclick="wizardVerwijderMachine(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px;padding:4px">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-sm" onclick="wizardVoegMachineToe()" style="margin-top:8px">+ Machine toevoegen</button>
      </div>`;
  }

  else if (s === 5) {
    inhoud = _wbWizard.data.secties.map((sectie, si) => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:600;font-size:14px;color:var(--accent)">Opdracht ${si + 1}</div>
          ${_wbWizard.data.secties.length > 1 ? `<button onclick="wizardVerwijderSectie(${si})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:12px">Verwijderen</button>` : ''}
        </div>
        <div class="form-field">
          <label>Naam opdracht</label>
          <input id="wz-sec-titel-${si}" value="${escHtml(sectie.titel)}" placeholder="bijv. Materiaal pakken en aftekenen">
        </div>
        <div class="form-field">
          <label>Benodigdheden (komma-gescheiden)</label>
          <input id="wz-sec-ben-${si}" value="${escHtml(sectie.benodigdheden.join(', '))}" placeholder="bijv. Potlood, Duimstok, Winkelhaak">
        </div>
        <div class="form-field">
          <label>Stappen</label>
          <div style="font-size:11px;color:var(--ink-muted);margin-bottom:8px">Per stap: max 250 tekens tekst. Kies type: foto (afbeelding + tekst naast elkaar) of tekening (volledige pagina).</div>
          ${sectie.stappen.map((stap, pi) => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px;background:var(--surface)">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <span style="font-weight:600;font-size:13px;color:var(--accent);min-width:20px">Stap ${pi + 1}</span>
                <select id="wz-stap-type-${si}-${pi}" style="font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" onchange="wizardWijzigStapType(${si},${pi},this.value)">
                  <option value="foto" ${(stap.type||'foto')==='foto'?'selected':''}>📷 Foto + tekst</option>
                  <option value="tekening" ${stap.type==='tekening'?'selected':''}>📐 Tekening (hele pagina)</option>
                </select>
                <button onclick="wizardVerwijderStap(${si},${pi})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:14px;margin-left:auto">✕</button>
              </div>
              ${(stap.type||'foto') === 'tekening' ? `
                <div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px">Deze stap krijgt een volledige pagina voor de tekening.</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <label style="font-size:12px;font-weight:500;min-width:60px">Tekening:</label>
                  <input type="file" id="wz-stap-afb-${si}-${pi}" accept="image/*" style="font-size:12px" onchange="wizardLaadAfbeelding(${si},${pi},this)">
                  ${stap.afbeeldingBase64 ? `<span style="font-size:11px;color:var(--accent)">✓ Geladen</span>` : ''}
                </div>
                <div style="margin-top:6px">
                  <label style="font-size:12px;font-weight:500">Beschrijving (optioneel)</label>
                  <textarea id="wz-sec-stap-${si}-${pi}" maxlength="250" rows="2" placeholder="Optionele beschrijving..." style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;resize:none;margin-top:3px">${escHtml(stap.stap||'')}</textarea>
                </div>
              ` : `
                <div style="display:flex;gap:8px">
                  <div style="flex:1">
                    <label style="font-size:12px;font-weight:500">Stap beschrijving * <span style="color:var(--ink-muted);font-weight:400">(max 250 tekens)</span></label>
                    <textarea id="wz-sec-stap-${si}-${pi}" maxlength="250" rows="3" placeholder="Beschrijf de stap concreet en kort..." style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;resize:none;margin-top:3px" oninput="wizardTelTekens(this,'wz-tc-${si}-${pi}')">${escHtml(stap.stap||'')}</textarea>
                    <div style="font-size:11px;color:var(--ink-muted);text-align:right"><span id="wz-tc-${si}-${pi}">${(stap.stap||'').length}</span>/250</div>
                  </div>
                  <div style="width:110px;flex-shrink:0">
                    <label style="font-size:12px;font-weight:500">Foto</label>
                    <div id="wz-afb-preview-${si}-${pi}" onclick="document.getElementById('wz-stap-afb-${si}-${pi}').click()" style="margin-top:3px;width:100%;height:80px;border:2px dashed var(--border);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-2)">
                      ${stap.afbeeldingBase64
                        ? `<img src="${stap.afbeeldingBase64}" style="width:100%;height:100%;object-fit:cover">`
                        : `<span style="font-size:10px;color:var(--ink-muted);text-align:center">+ Foto<br>uploaden</span>`}
                    </div>
                    <input type="file" id="wz-stap-afb-${si}-${pi}" accept="image/*" style="display:none" onchange="wizardLaadAfbeelding(${si},${pi},this)">
                    ${stap.afbeeldingBase64 ? `<button onclick="wizardVerwijderAfbeelding(${si},${pi})" style="font-size:10px;color:var(--red);border:none;background:none;cursor:pointer;width:100%;margin-top:3px">Verwijderen</button>` : ''}
                  </div>
                </div>
              `}
            </div>
          `).join('')}
          <button class="btn btn-sm" onclick="wizardVoegStapToe(${si})">+ Stap toevoegen</button>
        </div>
      </div>
    `).join('') + `
      ${_wbWizard.data.secties.length < 4 ? `<button class="btn btn-sm" onclick="wizardVoegSectieToe()">+ Opdracht toevoegen</button>` : ''}
    `;
  }

  else if (s === 6) {
    const aantalStappen = _wbWizard.data.secties.reduce((t, sec) => t + (sec.stappen || []).length, 0);
    const aantalMat = (_wbWizard.data.materiaalstaat || []).filter(r => r.benaming).length;
    inhoud = `
      <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">Overzicht</div>
        <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><span style="color:var(--ink-muted)">Vak:</span> <strong>${escHtml(_wbWizard.data.vak || '—')}</strong></div>
          <div><span style="color:var(--ink-muted)">Opdracht:</span> <strong>${escHtml(_wbWizard.data.opdrachtnummer || '1')}</strong></div>
          <div style="grid-column:1/-1"><span style="color:var(--ink-muted)">Titel:</span> <strong>${escHtml(_wbWizard.data.titel || '—')}</strong></div>
          ${_wbWizard.data.profieldeel ? `<div style="grid-column:1/-1"><span style="color:var(--ink-muted)">Profieldeel:</span> ${escHtml(_wbWizard.data.profieldeel)}</div>` : ''}
          ${_wbWizard.data.duur ? `<div><span style="color:var(--ink-muted)">Duur:</span> ${escHtml(_wbWizard.data.duur)}</div>` : ''}
          <div><span style="color:var(--ink-muted)">Leerdoelen:</span> ${_wbWizard.data.leerdoelen.filter(d => d).length}</div>
          <div><span style="color:var(--ink-muted)">Materialen:</span> ${aantalMat}</div>
          <div><span style="color:var(--ink-muted)">Veiligheidsregels:</span> ${(_wbWizard.data.veiligheidsregels || []).filter(r => r).length}</div>
          <div><span style="color:var(--ink-muted)">Machines:</span> ${(_wbWizard.data.machines || []).filter(m => m).length}</div>
          <div><span style="color:var(--ink-muted)">Opdrachten:</span> ${_wbWizard.data.secties.length}</div>
          <div><span style="color:var(--ink-muted)">Stappen totaal:</span> ${aantalStappen}</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--ink-muted)">Controleer het overzicht en klik op <strong>Werkboekje aanmaken</strong> om het .docx bestand te genereren.</div>
    `;
  }

  openModal(`
    <h2>✏️ Nieuw werkboekje — stap ${s} van ${totaal}: ${stapTitels[s - 1]}</h2>

    <div style="margin-bottom:16px">
      <div style="display:flex;gap:4px;margin-bottom:6px">
        ${stapTitels.map((t, i) => `
          <div style="flex:1;height:4px;border-radius:2px;background:${i < s ? 'var(--accent)' : 'var(--border)'}"></div>
        `).join('')}
      </div>
      <div style="font-size:12px;color:var(--ink-muted)">Stap ${s} van ${totaal}</div>
    </div>

    ${inhoud}

    <div id="wz-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      ${s === 1
        ? `<button class="btn" onclick="openWerkboekjeWizard()">← Terug</button>`
        : `<button class="btn" onclick="wizardVorigeStap()">← Vorige</button>`
      }
      ${s < totaal
        ? `<button class="btn btn-primary" onclick="wizardVolgendeStap()">Volgende →</button>`
        : `<button class="btn btn-primary" onclick="wizardGenereer()">📓 Werkboekje maken</button>`
      }
    </div>
  `);
}

// ── Wizard navigatie
function wizardVorigeStap() {
  wizardSlaStapOp();
  _wbWizard.stap--;
  renderWizardStap();
}

function wizardVolgendeStap() {
  wizardSlaStapOp();
  const fout = wizardValideerStap();
  if (fout) {
    document.getElementById('wz-result').innerHTML = `<span style="color:var(--red)">${escHtml(fout)}</span>`;
    return;
  }
  _wbWizard.stap++;
  renderWizardStap();
}

function wizardValideerStap() {
  const s = _wbWizard.stap;
  if (s === 1) {
    if (!_wbWizard.data.vak) return 'Vak is verplicht.';
    if (!_wbWizard.data.titel) return 'Titel is verplicht.';
  }
  return null;
}

// ── Sla huidige stap op in _wbWizard.data
function wizardSlaStapOp() {
  const s = _wbWizard.stap;
  if (s === 1) {
    _wbWizard.data.vak = document.getElementById('wz-vak')?.value.trim() || '';
    _wbWizard.data.opdrachtnummer = document.getElementById('wz-opdrnr')?.value.trim() || '1';
    _wbWizard.data.profieldeel = document.getElementById('wz-profiel')?.value.trim() || '';
    _wbWizard.data.titel = document.getElementById('wz-titel')?.value.trim() || '';
    _wbWizard.data.duur = document.getElementById('wz-duur')?.value.trim() || '';
  } else if (s === 2) {
    _wbWizard.data.introductie = document.getElementById('wz-intro')?.value.trim() || '';
    _wbWizard.data.leerdoelen = _wbWizard.data.leerdoelen.map((_, i) =>
      document.getElementById(`wz-doel-${i}`)?.value.trim() || ''
    ).filter(d => d);
  } else if (s === 3) {
    _wbWizard.data.materiaalstaat = _wbWizard.data.materiaalstaat.map((r, i) => ({
      nummer: r.nummer,
      aantal: document.getElementById(`wz-mat-ant-${i}`)?.value.trim() || '',
      benaming: document.getElementById(`wz-mat-ben-${i}`)?.value.trim() || '',
      lengte: document.getElementById(`wz-mat-len-${i}`)?.value.trim() || '',
      breedte: document.getElementById(`wz-mat-br-${i}`)?.value.trim() || '',
      dikte: document.getElementById(`wz-mat-dk-${i}`)?.value.trim() || '',
      soortHout: document.getElementById(`wz-mat-sh-${i}`)?.value.trim() || '',
    }));
  } else if (s === 4) {
    _wbWizard.data.veiligheidsregels = _wbWizard.data.veiligheidsregels.map((_, i) =>
      document.getElementById(`wz-veil-${i}`)?.value.trim() || ''
    ).filter(r => r);
    _wbWizard.data.machines = _wbWizard.data.machines.map((_, i) =>
      document.getElementById(`wz-mac-${i}`)?.value.trim() || ''
    ).filter(m => m);
  } else if (s === 5) {
    _wbWizard.data.secties = _wbWizard.data.secties.map((sectie, si) => ({
      titel: document.getElementById(`wz-sec-titel-${si}`)?.value.trim() || '',
      benodigdheden: (document.getElementById(`wz-sec-ben-${si}`)?.value || '').split(',').map(b => b.trim()).filter(b => b),
      stappen: sectie.stappen.map((stap, pi) => ({
        stap: (document.getElementById(`wz-sec-stap-${si}-${pi}`)?.value.trim() || '').slice(0, 250),
        type: document.getElementById(`wz-stap-type-${si}-${pi}`)?.value || 'foto',
        heeftAfbeelding: true,
        afbeeldingBase64: stap.afbeeldingBase64 || null,
        afbeeldingType: stap.afbeeldingType || null,
      })).filter(p => p.type === 'tekening' || p.stap)
    }));
  }
}

// ── Wizard: items toevoegen/verwijderen
function wizardVoegDoelToe() {
  wizardSlaStapOp();
  _wbWizard.data.leerdoelen.push('');
  renderWizardStap();
}
function wizardVoegMateriaalToe() {
  wizardSlaStapOp();
  const n = _wbWizard.data.materiaalstaat.length + 1;
  _wbWizard.data.materiaalstaat.push({ nummer: n, aantal: '', benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' });
  renderWizardStap();
}
function wizardVerwijderMateriaal(i) {
  wizardSlaStapOp();
  _wbWizard.data.materiaalstaat.splice(i, 1);
  _wbWizard.data.materiaalstaat.forEach((r, idx) => { r.nummer = idx + 1; });
  renderWizardStap();
}
function wizardVoegVeilRegelToe() {
  wizardSlaStapOp();
  _wbWizard.data.veiligheidsregels.push('');
  renderWizardStap();
}
function wizardVerwijderVeilRegel(i) {
  wizardSlaStapOp();
  _wbWizard.data.veiligheidsregels.splice(i, 1);
  renderWizardStap();
}
function wizardVoegMachineToe() {
  wizardSlaStapOp();
  _wbWizard.data.machines.push('');
  renderWizardStap();
}
function wizardVerwijderMachine(i) {
  wizardSlaStapOp();
  _wbWizard.data.machines.splice(i, 1);
  renderWizardStap();
}
function wizardVoegSectieToe() {
  wizardSlaStapOp();
  _wbWizard.data.secties.push({ titel: '', benodigdheden: [''], stappen: [{ stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null }, { stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null }] });
  renderWizardStap();
}
function wizardVerwijderSectie(i) {
  wizardSlaStapOp();
  _wbWizard.data.secties.splice(i, 1);
  renderWizardStap();
}
function wizardVoegStapToe(si) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen.push({ stap: '', type: 'foto', afbeeldingBase64: null, afbeeldingType: null });
  renderWizardStap();
}
function wizardVerwijderStap(si, pi) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen.splice(pi, 1);
  renderWizardStap();
}

function wizardTelTekens(ta, teller_id) {
  const el = document.getElementById(teller_id);
  if (el) el.textContent = ta.value.length;
}

function wizardWijzigStapType(si, pi, type) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen[pi].type = type;
  renderWizardStap();
}

function wizardVerwijderAfbeelding(si, pi) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen[pi].afbeeldingBase64 = null;
  _wbWizard.data.secties[si].stappen[pi].afbeeldingType = null;
  renderWizardStap();
}

function wizardLaadAfbeelding(si, pi, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Afbeelding is te groot (max 5 MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    wizardSlaStapOp();
    _wbWizard.data.secties[si].stappen[pi].afbeeldingBase64 = e.target.result;
    _wbWizard.data.secties[si].stappen[pi].afbeeldingType = file.type;
    renderWizardStap();
  };
  reader.readAsDataURL(file);
}

// ── Wizard: genereer het docx via de server
async function wizardGenereer() {
  wizardSlaStapOp();
  const result = document.getElementById('wz-result');
  result.innerHTML = `<span style="color:var(--amber)">⏳ Werkboekje wordt aangemaakt...</span>`;

  try {
    const res = await fetch('/api/genereer-werkboekje-handmatig', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_wbWizard.data)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');
    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        ✓ <strong>${escHtml(data.titel)}</strong> is klaar!<br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          ⬇ Werkboekje downloaden (.docx)
        </a>
      </div>`;
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

// ============================================================
// TOETS GENERATOR — keuze: upload (AI) of wizard (handmatig)
// ============================================================
async function openToetsGenerator() {
  const inst = await getSchoolInstellingen();

  openModal(`
    <h2>📝 Toets maken</h2>
    <p class="modal-sub">Kies hoe je de toets wilt aanmaken.</p>

    ${inst.schoolnaam
      ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:16px">
           🏫 <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ''}
         </div>`
      : Auth.isAdmin() ? `<div class="alert alert-info" style="margin-bottom:14px">
           <strong>Tip:</strong> Stel eerst de schoolnaam in via
           <a href="#" onclick="closeModalDirect();openInstellingenModal()" style="color:var(--accent)">⚙️ Instellingen</a>.
         </div>` : ''
    }

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
      <div onclick="openToetsUpload()"
           style="border:1.5px solid var(--border-2);border-radius:var(--radius);padding:20px 16px;cursor:pointer;text-align:center;transition:border-color .15s"
           onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-2)'">
        <div style="font-size:28px;margin-bottom:8px">📤</div>
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">Bestand uploaden</div>
        <div style="font-size:12px;color:var(--ink-muted)">AI maakt een toets in examen-stijl op basis van je lesmateriaal</div>
      </div>
      <div onclick="openToetsWizard()"
           style="border:1.5px solid var(--border-2);border-radius:var(--radius);padding:20px 16px;cursor:pointer;text-align:center;transition:border-color .15s"
           onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-2)'">
        <div style="font-size:28px;margin-bottom:8px">✏️</div>
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">Nieuw aanmaken</div>
        <div style="font-size:12px;color:var(--ink-muted)">Stap voor stap invullen — bronnen, open vragen en meerkeuze</div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
    </div>
  `);
}

// ── Upload → AI
async function openToetsUpload() {
  const inst = await getSchoolInstellingen();
  openModal(`
    <h2>📤 Toets uit bestand</h2>
    <p class="modal-sub">Upload lesmateriaal en de AI maakt er een toets van in officiele examen-stijl — met bronnen, pijltjes en meerkeuzetabellen.</p>
    ${inst.schoolnaam ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:12px">🏫 <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ''}</div>` : ''}

    <div class="form-grid">
      <div class="form-field">
        <label>Documentsoort *</label>
        <select id="ts-docsoort">
          <option value="Toets">Toets</option>
          <option value="Tentamen">Tentamen</option>
          <option value="Examen">Examen</option>
          <option value="Proefwerk">Proefwerk</option>
          <option value="Repetitie">Repetitie</option>
        </select>
      </div>
      <div class="form-field">
        <label>Vak *</label>
        <input id="ts-vak" placeholder="bijv. Aardrijkskunde" value="">
      </div>
      <div class="form-field">
        <label>Hoofdstuk / onderwerp</label>
        <input id="ts-hoofdstuk" placeholder="bijv. Hoofdstuk 3 – Klimaat" value="">
      </div>
      <div class="form-field">
        <label>Niveau</label>
        <input id="ts-niveau" placeholder="bijv. VMBO-GL en TL" value="VMBO-GL en TL">
      </div>
      <div class="form-field">
        <label>Aantal vragen</label>
        <input type="number" id="ts-vragen" value="10" min="1" max="50" placeholder="bijv. 10">
      </div>
    </div>

    <div class="form-field">
      <label>Bestand * (Word of PDF)</label>
      <div class="upload-zone" onclick="document.getElementById('ts-bestand').click()" id="ts-zone"
           style="padding:24px;text-align:center;border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer">
        <div style="font-size:24px;margin-bottom:6px">↑</div>
        <div style="font-weight:500;margin-bottom:4px">Sleep bestand hierheen of klik</div>
        <div style="font-size:12px;color:var(--ink-muted)">.docx · .pdf — max 25 MB</div>
      </div>
      <input type="file" id="ts-bestand" accept=".docx,.doc,.pdf" style="display:none" onchange="toonBestandsnaamInZone(this,'ts-zone')">
    </div>

    <div id="ts-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="openToetsGenerator()">← Terug</button>
      ${Auth.isAdmin() ? `<button class="btn" onclick="closeModalDirect();openInstellingenModal()">⚙️ Instellingen</button>` : ''}
      <button class="btn" onclick="doGenererenToets()">📝 Direct genereren</button>
      <button class="btn btn-primary" onclick="doAnalyseToets()">🔍 Analyseren &amp; bewerken</button>
    </div>
  `);
}

async function doGenererenToets() {
  const bestandInput = document.getElementById('ts-bestand');
  const vak = document.getElementById('ts-vak')?.value.trim() || '';
  const niveau = document.getElementById('ts-niveau')?.value.trim() || 'VMBO-GL en TL';
  const aantalVragen = document.getElementById('ts-vragen').value;
  const result = document.getElementById('ts-result');

  if (!bestandInput.files[0]) {
    result.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`;
    return;
  }
  if (!vak) {
    result.innerHTML = `<span style="color:var(--red)">Vul het vak in.</span>`;
    return;
  }
  result.innerHTML = `<span style="color:var(--amber)">⏳ AI bouwt toets in examen-stijl... (20-40 sec)</span>`;

  const fd = new FormData();
  fd.append('bestand', bestandInput.files[0]);
  fd.append('documentSoort', document.getElementById('ts-docsoort')?.value || 'Toets');
  fd.append('vak', vak);
  fd.append('niveau', niveau);
  fd.append('aantalVragen', aantalVragen);

  try {
    const res = await fetch('/api/genereer-toets', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');
    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        Klaar: <strong>${escHtml(data.titel)}</strong><br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          Toets downloaden (.docx)
        </a>
      </div>`;
    renderToetsen();
  } catch (e) {
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('AI_QUOTA') || msg.includes('insufficient');
    result.innerHTML = isQuota
      ? `<div style="padding:12px;background:#FEF3C7;border:1px solid #D97706;border-radius:6px;font-size:13px;color:#92400E">
           AI quota bereikt. Klik op Terug en kies Nieuw aanmaken om zonder AI een toets te maken.
         </div>`
      : `<span style="color:var(--red)">Fout: ${escHtml(msg)}</span>`;
  }
}

async function doAnalyseToets() {
  const bestandInput = document.getElementById('ts-bestand');
  const vak = document.getElementById('ts-vak')?.value.trim() || '';
  const niveau = document.getElementById('ts-niveau')?.value.trim() || 'VMBO-GL en TL';
  const hoofdstuk = document.getElementById('ts-hoofdstuk')?.value.trim() || '';
  const aantalVragen = document.getElementById('ts-vragen').value;
  const result = document.getElementById('ts-result');

  if (!bestandInput.files[0]) { result.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`; return; }
  if (!vak) { result.innerHTML = `<span style="color:var(--red)">Vul het vak in.</span>`; return; }
  result.innerHTML = `<span style="color:var(--amber)">⏳ AI analyseert lesmateriaal... (20-40 sec)</span>`;

  const fd = new FormData();
  fd.append('bestand', bestandInput.files[0]);
  fd.append('documentSoort', document.getElementById('ts-docsoort')?.value || 'Toets');
  fd.append('vak', vak);
  fd.append('niveau', niveau);
  fd.append('hoofdstuk', hoofdstuk);
  fd.append('aantalVragen', aantalVragen);

  try {
    const res = await fetch('/api/analyse-toets', { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Onbekende fout');

    // Laad resultaat in wizard
    Object.assign(_toetsWizard.data, json.data);
    _toetsWizard.stap = 1;
    _twAiAdvies = {};
    closeModalDirect();
    renderToetsWizardStap();
  } catch (e) {
    const msg = e.message || '';
    const isQuota = msg.includes('AI_QUOTA') || msg.includes('429') || msg.includes('quota');
    result.innerHTML = isQuota
      ? `<div style="padding:12px;background:#FEF3C7;border:1px solid #D97706;border-radius:6px;font-size:13px;color:#92400E">AI quota bereikt. Probeer het later of kies Nieuw aanmaken.</div>`
      : `<span style="color:var(--red)">Fout: ${escHtml(msg)}</span>`;
  }
}

// ============================================================
// TOETS WIZARD — handmatig aanmaken (5 stappen)
// ============================================================
const _toetsWizard = {
  stap: 1,
  data: {
    documentSoort: 'Toets', vak: '', niveauLabel: 'VMBO-GL en TL', jaar: new Date().getFullYear().toString(),
    hoofdstuk: '',
    tijdvak: 'tijdvak 1', datum: '', tijd: '13.30 - 15.30 uur',
    code: '', aantalPaginas: '',
    secties: [{
      titel: '',
      bronnen: [{ nummer: 1, ondertitel: '', tekst: '', figuurBase64: null, figuurType: null }],
      vragen: [
        { type: 'open', punten: 1, context: 'Lees bron 1.', vraag: '', antwoordRegels: 3 },
        { type: 'meerkeuze', punten: 1, context: 'Bekijk bron 1.', vraag: '', opties: [
          { letter: 'A', tekst: '' }, { letter: 'B', tekst: '' },
          { letter: 'C', tekst: '' }, { letter: 'D', tekst: '' }
        ]}
      ]
    }]
  }
};
let _twAiAdvies = {};

function openToetsWizard() {
  _toetsWizard.stap = 1;
  renderToetsWizardStap();
}

function renderToetsWizardStap() {
  const s = _toetsWizard.stap;
  const totaal = 4;
  const stapTitels = ['Algemeen', 'Bronnen', 'Vragen', 'Controleren'];

  let inhoud = '';

  if (s === 1) {
    inhoud = `
      <div class="form-grid">
        <div class="form-field">
          <label>Documentsoort *</label>
          <select id="tw-docsoort">
            <option value="Toets" ${(_toetsWizard.data.documentSoort||'Toets')==='Toets'?'selected':''}>Toets</option>
            <option value="Tentamen" ${(_toetsWizard.data.documentSoort||'')==='Tentamen'?'selected':''}>Tentamen</option>
            <option value="Examen" ${(_toetsWizard.data.documentSoort||'')==='Examen'?'selected':''}>Examen</option>
            <option value="Proefwerk" ${(_toetsWizard.data.documentSoort||'')==='Proefwerk'?'selected':''}>Proefwerk</option>
            <option value="Repetitie" ${(_toetsWizard.data.documentSoort||'')==='Repetitie'?'selected':''}>Repetitie</option>
          </select>
        </div>
        <div class="form-field">
          <label>Vak *</label>
          <input id="tw-vak" placeholder="bijv. Aardrijkskunde" value="${escHtml(_toetsWizard.data.vak)}">
        </div>
        <div class="form-field">
          <label>Hoofdstuk / onderwerp</label>
          <input id="tw-hoofdstuk" placeholder="bijv. Hoofdstuk 3 – Klimaat" value="${escHtml(_toetsWizard.data.hoofdstuk||'')}">
        </div>
        <div class="form-field">
          <label>Niveau</label>
          <input id="tw-niveau" placeholder="bijv. VMBO-GL en TL" value="${escHtml(_toetsWizard.data.niveauLabel)}">
        </div>
        <div class="form-field">
          <label>Jaar</label>
          <input id="tw-jaar" placeholder="${new Date().getFullYear()}" value="${escHtml(_toetsWizard.data.jaar)}">
        </div>
        <div class="form-field">
          <label>Datum (bijv. vrijdag 16 mei)</label>
          <input id="tw-datum" placeholder="vrijdag 16 mei" value="${escHtml(_toetsWizard.data.datum)}">
        </div>
        <div class="form-field">
          <label>Tijdvak</label>
          <input id="tw-tijdvak" value="${escHtml(_toetsWizard.data.tijdvak)}">
        </div>
        <div class="form-field">
          <label>Tijd (bijv. 13.30 - 15.30 uur)</label>
          <input id="tw-tijd" value="${escHtml(_toetsWizard.data.tijd)}">
        </div>
        <div class="form-field">
          <label>Code (optioneel)</label>
          <input id="tw-code" placeholder="bijv. GT-0000-a-25-1" value="${escHtml(_toetsWizard.data.code)}">
        </div>
      </div>`;
  }

  else if (s === 2) {
    inhoud = _toetsWizard.data.secties.map((sectie, si) => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
        <div style="font-weight:600;font-size:13px;color:var(--accent);margin-bottom:10px">Sectie ${si + 1}</div>
        <div class="form-field">
          <label>Thema-titel (bijv. Weer en klimaat)</label>
          <input id="tw-sec-titel-${si}" value="${escHtml(sectie.titel)}" placeholder="Bijv. Bevolking en ruimte">
        </div>
        ${sectie.bronnen.map((bron, bi) => `
          <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-weight:600;font-size:12px">bron ${bron.nummer}</span>
              ${sectie.bronnen.length > 1 ? `<button onclick="twVerwijderBron(${si},${bi})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:12px">Verwijderen</button>` : ''}
            </div>
            <div class="form-field" style="margin-bottom:6px">
              <label style="font-size:12px">Ondertitel</label>
              <input id="tw-bron-ot-${si}-${bi}" value="${escHtml(bron.ondertitel)}" placeholder="bijv. Weerbericht voor Nederland">
            </div>
            <div class="form-field">
              <label style="font-size:12px">Brontekst (gebruik Enter voor nieuwe regels)</label>
              <textarea id="tw-bron-tekst-${si}-${bi}" rows="4" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;resize:vertical">${escHtml(bron.tekst)}</textarea>
            </div>
            <div class="form-field" style="margin-bottom:0">
              <label style="font-size:12px">Figuur / afbeelding (optioneel)</label>
              ${bron.figuurBase64
                ? `<div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                     <img src="${bron.figuurBase64}" style="max-height:60px;max-width:120px;border:1px solid var(--border);border-radius:4px" alt="figuur">
                     <button onclick="twVerwijderFiguur(${si},${bi})" style="font-size:12px;color:var(--red);border:none;background:none;cursor:pointer">Verwijder figuur</button>
                   </div>`
                : `<input type="file" accept="image/*" style="font-size:12px" onchange="twLaadFiguur(${si},${bi},this)">`
              }
            </div>
          </div>
        `).join('')}
        <button class="btn btn-sm" onclick="twVoegBronToe(${si})">+ Bron toevoegen</button>
      </div>
    `).join('') + `
      ${_toetsWizard.data.secties.length < 4 ? `<button class="btn btn-sm" onclick="twVoegSectieToe()">+ Sectie/thema toevoegen</button>` : ''}
    `;
  }

  else if (s === 3) {
    inhoud = _toetsWizard.data.secties.map((sectie, si) => `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--accent)">
          ${escHtml(sectie.titel || `Sectie ${si + 1}`)}
        </div>
        ${sectie.vragen.map((v, vi) => `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
              <select id="tw-v-type-${si}-${vi}" style="font-size:12px;padding:4px 8px" onchange="twWijzigVraagType(${si},${vi},this.value)">
                <option value="open" ${v.type==='open'?'selected':''}>Open vraag</option>
                <option value="meerkeuze" ${v.type==='meerkeuze'?'selected':''}>Meerkeuze</option>
              </select>
              <select id="tw-v-punten-${si}-${vi}" style="font-size:12px;padding:4px 8px">
                ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(v.punten||1)===n?'selected':''}>${n} punt${n>1?'en':''}</option>`).join('')}
              </select>
              <input id="tw-v-ctx-${si}-${vi}" value="${escHtml(v.context||'')}" placeholder="bijv. Lees bron 1." style="flex:1;min-width:120px;font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:4px">
              ${sectie.vragen.length > 1 ? `<button onclick="twVerwijderVraag(${si},${vi})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:14px">✕</button>` : ''}
            </div>
            <textarea id="tw-v-vraag-${si}-${vi}" rows="2" placeholder="${v.type==='meerkeuze'?'Vraagstelling (bijv. Welke uitspraak is juist?)':'Vraagstelling hier invullen...'}" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;resize:vertical;margin-bottom:6px">${escHtml(v.vraag||'')}</textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <button onclick="twAiAdviseerVraag(${si},${vi})" class="btn btn-sm" style="font-size:11px">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/></svg>
                AI-advies
              </button>
              <span id="tw-ai-status-${si}-${vi}" style="font-size:11px;color:var(--ink-muted)"></span>
            </div>
            <div id="tw-ai-advies-${si}-${vi}" style="display:none;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px;font-size:12px"></div>
            ${v.type === 'meerkeuze' ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                ${(v.opties||[{letter:'A',tekst:''},{letter:'B',tekst:''},{letter:'C',tekst:''},{letter:'D',tekst:''}]).map((opt,oi) => `
                  <div style="display:flex;gap:4px;align-items:center">
                    <span style="font-weight:700;font-size:12px;min-width:16px">${opt.letter}</span>
                    <input id="tw-v-opt-${si}-${vi}-${oi}" value="${escHtml(opt.tekst||'')}" placeholder="Optie ${opt.letter}" style="flex:1;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px">
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:12px;color:var(--ink-muted)">Antwoordregels:</label>
                <select id="tw-v-regels-${si}-${vi}" style="font-size:12px;padding:3px 6px">
                  ${[2,3,4,5,6].map(n => `<option value="${n}" ${(v.antwoordRegels||3)===n?'selected':''}>${n}</option>`).join('')}
                </select>
              </div>
            `}
          </div>
        `).join('')}
        <button class="btn btn-sm" onclick="twVoegVraagToe(${si},'open')" style="margin-right:6px">+ Open vraag</button>
        <button class="btn btn-sm" onclick="twVoegVraagToe(${si},'meerkeuze')">+ Meerkeuze</button>
      </div>
    `).join('');
  }

  else if (s === 4) {
    const aantalVragen = _toetsWizard.data.secties.reduce((t,s) => t + (s.vragen||[]).length, 0);
    const maxPunten = _toetsWizard.data.secties.reduce((t,s) => t + (s.vragen||[]).reduce((tt,v) => tt + (parseInt(v.punten)||1), 0), 0);
    inhoud = `
      <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Overzicht</div>
        <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div><span style="color:var(--ink-muted)">Vak:</span> ${escHtml(_toetsWizard.data.vak)}</div>
          <div><span style="color:var(--ink-muted)">Niveau:</span> ${escHtml(_toetsWizard.data.niveauLabel)}</div>
          <div><span style="color:var(--ink-muted)">Datum:</span> ${escHtml(_toetsWizard.data.datum||'—')}</div>
          <div><span style="color:var(--ink-muted)">Secties:</span> ${_toetsWizard.data.secties.length}</div>
          <div><span style="color:var(--ink-muted)">Vragen:</span> ${aantalVragen}</div>
          <div><span style="color:var(--ink-muted)">Max punten:</span> ${maxPunten}</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--ink-muted)">Klik op Toets aanmaken om de toets te genereren als .docx bestand in officiële examen-stijl.</div>
    `;
  }

  openModal(`
    <h2>✏️ Nieuwe toets — stap ${s} van ${totaal}: ${stapTitels[s-1]}</h2>
    <div style="margin-bottom:16px">
      <div style="display:flex;gap:4px;margin-bottom:6px">
        ${stapTitels.map((_,i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i<s?'var(--accent)':'var(--border)'}"></div>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--ink-muted)">Stap ${s} van ${totaal}</div>
    </div>
    ${inhoud}
    <div id="tw-result" style="margin-top:8px;font-size:13px"></div>
    <div class="modal-actions">
      ${s === 1 ? `<button class="btn" onclick="openToetsGenerator()">← Terug</button>`
                : `<button class="btn" onclick="twVorigeStap()">← Vorige</button>`}
      ${s < totaal
        ? `<button class="btn btn-primary" onclick="twVolgendeStap()">Volgende →</button>`
        : `<button class="btn btn-primary" onclick="twGenereer()">📝 Toets aanmaken</button>`}
    </div>
  `);
}

function twVorigeStap() { twSlaOp(); _toetsWizard.stap--; renderToetsWizardStap(); }
function twVolgendeStap() {
  twSlaOp();
  const fout = twValideer();
  if (fout) { document.getElementById('tw-result').innerHTML = `<span style="color:var(--red)">${escHtml(fout)}</span>`; return; }
  _toetsWizard.stap++;
  renderToetsWizardStap();
}

function twValideer() {
  const s = _toetsWizard.stap;
  if (s === 1 && !_toetsWizard.data.vak) return 'Vak is verplicht.';
  return null;
}

function twSlaOp() {
  const s = _toetsWizard.stap;
  if (s === 1) {
    _toetsWizard.data.documentSoort = document.getElementById('tw-docsoort')?.value || 'Toets';
    _toetsWizard.data.vak = document.getElementById('tw-vak')?.value.trim() || '';
    _toetsWizard.data.hoofdstuk = document.getElementById('tw-hoofdstuk')?.value.trim() || '';
    _toetsWizard.data.niveauLabel = document.getElementById('tw-niveau')?.value.trim() || '';
    _toetsWizard.data.jaar = document.getElementById('tw-jaar')?.value.trim() || '';
    _toetsWizard.data.datum = document.getElementById('tw-datum')?.value.trim() || '';
    _toetsWizard.data.tijdvak = document.getElementById('tw-tijdvak')?.value.trim() || '';
    _toetsWizard.data.tijd = document.getElementById('tw-tijd')?.value.trim() || '';
    _toetsWizard.data.code = document.getElementById('tw-code')?.value.trim() || '';
  } else if (s === 2) {
    _toetsWizard.data.secties.forEach((sectie, si) => {
      sectie.titel = document.getElementById(`tw-sec-titel-${si}`)?.value.trim() || '';
      sectie.bronnen.forEach((bron, bi) => {
        bron.ondertitel = document.getElementById(`tw-bron-ot-${si}-${bi}`)?.value.trim() || '';
        bron.tekst = document.getElementById(`tw-bron-tekst-${si}-${bi}`)?.value.trim() || '';
      });
    });
  } else if (s === 3) {
    _toetsWizard.data.secties.forEach((sectie, si) => {
      sectie.vragen.forEach((v, vi) => {
        v.context = document.getElementById(`tw-v-ctx-${si}-${vi}`)?.value.trim() || '';
        v.vraag = document.getElementById(`tw-v-vraag-${si}-${vi}`)?.value.trim() || '';
        v.punten = parseInt(document.getElementById(`tw-v-punten-${si}-${vi}`)?.value) || 1;
        if (v.type === 'meerkeuze') {
          v.opties = (v.opties||[]).map((opt, oi) => ({
            letter: opt.letter,
            tekst: document.getElementById(`tw-v-opt-${si}-${vi}-${oi}`)?.value.trim() || ''
          }));
        } else {
          v.antwoordRegels = parseInt(document.getElementById(`tw-v-regels-${si}-${vi}`)?.value) || 3;
        }
      });
    });
  }
}

function twWijzigVraagType(si, vi, type) {
  twSlaOp();
  const v = _toetsWizard.data.secties[si].vragen[vi];
  v.type = type;
  if (type === 'meerkeuze' && !v.opties) {
    v.opties = [{letter:'A',tekst:''},{letter:'B',tekst:''},{letter:'C',tekst:''},{letter:'D',tekst:''}];
  }
  renderToetsWizardStap();
}

function twVoegBronToe(si) {
  twSlaOp();
  const sectie = _toetsWizard.data.secties[si];
  sectie.bronnen.push({ nummer: sectie.bronnen.length + 1, ondertitel: '', tekst: '', figuurBase64: null, figuurType: null });
  renderToetsWizardStap();
}
function twVerwijderBron(si, bi) {
  twSlaOp();
  _toetsWizard.data.secties[si].bronnen.splice(bi, 1);
  _toetsWizard.data.secties[si].bronnen.forEach((b, i) => { b.nummer = i + 1; });
  renderToetsWizardStap();
}
function twVoegSectieToe() {
  twSlaOp();
  const n = _toetsWizard.data.secties.reduce((t, s) => t + s.bronnen.length, 0);
  _toetsWizard.data.secties.push({
    titel: '', bronnen: [{ nummer: n + 1, ondertitel: '', tekst: '', figuurBase64: null, figuurType: null }],
    vragen: [{ type: 'open', punten: 1, context: '', vraag: '', antwoordRegels: 3 }]
  });
  renderToetsWizardStap();
}
function twVoegVraagToe(si, type) {
  twSlaOp();
  const v = { type, punten: 1, context: '', vraag: '', antwoordRegels: 3 };
  if (type === 'meerkeuze') v.opties = [{letter:'A',tekst:''},{letter:'B',tekst:''},{letter:'C',tekst:''},{letter:'D',tekst:''}];
  _toetsWizard.data.secties[si].vragen.push(v);
  renderToetsWizardStap();
}
function twVerwijderVraag(si, vi) {
  twSlaOp();
  _toetsWizard.data.secties[si].vragen.splice(vi, 1);
  renderToetsWizardStap();
}

function twLaadFiguur(si, bi, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    twSlaOp();
    _toetsWizard.data.secties[si].bronnen[bi].figuurBase64 = e.target.result;
    _toetsWizard.data.secties[si].bronnen[bi].figuurType = file.type;
    renderToetsWizardStap();
  };
  reader.readAsDataURL(file);
}

function twVerwijderFiguur(si, bi) {
  twSlaOp();
  _toetsWizard.data.secties[si].bronnen[bi].figuurBase64 = null;
  _toetsWizard.data.secties[si].bronnen[bi].figuurType = null;
  renderToetsWizardStap();
}

async function twAiAdviseerVraag(si, vi) {
  twSlaOp();
  const statusEl = document.getElementById(`tw-ai-status-${si}-${vi}`);
  const adviesEl = document.getElementById(`tw-ai-advies-${si}-${vi}`);
  if (!statusEl || !adviesEl) return;

  const v = _toetsWizard.data.secties[si]?.vragen[vi];
  if (!v || !v.vraag.trim()) {
    statusEl.textContent = 'Vul eerst een vraagstelling in.';
    return;
  }

  statusEl.textContent = '⏳ AI advies laden...';
  adviesEl.style.display = 'none';

  const ctx = {
    vak: _toetsWizard.data.vak,
    niveau: _toetsWizard.data.niveauLabel,
    hoofdstuk: _toetsWizard.data.hoofdstuk,
    vraagType: v.type,
    punten: v.punten,
    context: v.context,
    vraag: v.vraag,
    opties: v.opties || null,
    antwoordRegels: v.antwoordRegels || null,
  };

  try {
    const res = await fetch('/api/ai/wizard-stap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        type: 'toets-vraag',
        stapId: `vraag-${si}-${vi}`,
        systeemPrompt: `Je bent een ervaren docent die toetsvragen beoordeelt en verbetert voor ${_toetsWizard.data.vak || 'het vak'} op ${_toetsWizard.data.niveauLabel || 'VMBO'}-niveau. Geef concreet advies om de vraag te verbeteren: taalfouten, duidelijkheid, niveau-aansluiting. Geef ook een verbeterde versie van de vraag.`,
        userPrompt: `Beoordeel deze toetsvraag en geef verbeteradvies:\n\n${JSON.stringify(ctx, null, 2)}`,
        context: ctx,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    _twAiAdvies[`${si}-${vi}`] = data.suggestie;
    const sug = data.suggestie;
    const adviesTekst = sug.advies || sug.feedback || sug.verbetering || JSON.stringify(sug);
    const verbeterd = sug.vraag || sug.verbeterdVraag || null;

    adviesEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;color:var(--accent)">AI-advies:</div>
      <div style="margin-bottom:8px">${escHtml(adviesTekst)}</div>
      ${verbeterd ? `
        <div style="font-weight:600;margin-bottom:4px">Verbeterde vraag:</div>
        <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:4px;padding:8px;margin-bottom:8px;font-style:italic">${escHtml(verbeterd)}</div>
        <button onclick="twNeemAdviesOver(${si},${vi})" class="btn btn-sm btn-primary" style="font-size:11px">Advies overnemen</button>
      ` : ''}
    `;
    adviesEl.style.display = 'block';
    statusEl.textContent = '✓ AI-advies klaar';
  } catch (e) {
    statusEl.textContent = 'AI kon geen advies genereren.';
    console.warn('AI vraag advies fout:', e.message);
  }
}

function twNeemAdviesOver(si, vi) {
  const sug = _twAiAdvies[`${si}-${vi}`];
  if (!sug) return;
  const verbeterd = sug.vraag || sug.verbeterdVraag;
  if (!verbeterd) return;
  const el = document.getElementById(`tw-v-vraag-${si}-${vi}`);
  if (el) { el.value = verbeterd; _toetsWizard.data.secties[si].vragen[vi].vraag = verbeterd; }
  const adviesEl = document.getElementById(`tw-ai-advies-${si}-${vi}`);
  if (adviesEl) adviesEl.style.display = 'none';
  const statusEl = document.getElementById(`tw-ai-status-${si}-${vi}`);
  if (statusEl) statusEl.textContent = '✓ Overgenomen';
}

async function twGenereer() {
  twSlaOp();
  const result = document.getElementById('tw-result');
  result.innerHTML = `<span style="color:var(--amber)">⏳ Toets aanmaken...</span>`;
  try {
    const res = await fetch('/api/genereer-toets-handmatig', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_toetsWizard.data)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');
    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        Klaar: <strong>${escHtml(data.titel)}</strong><br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          Toets downloaden (.docx)
        </a>
      </div>`;
    renderToetsen();
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}
