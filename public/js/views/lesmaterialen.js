// ============================================================
// public/js/views/lesmaterialen.js
// Lesmaterialen omgeving: toetsen en werkboekjes
// ============================================================

// ============================================================
// RENDER TOETSEN PAGINA
// ============================================================
async function renderLesmaterialen() {
  showLoading('lesmaterialen');
  try {
    const [klassen, alleOpd, materialen, bibliotheek] = await Promise.all([
      API.getKlassen(), API.getOpdrachten(), API.getMaterialen(),
      fetch('/api/werkboekje-bibliotheek', { credentials: 'same-origin' }).then(r => r.json()).catch(() => [])
    ]);
    const readonly = !Auth.canEdit();
    const metToets = alleOpd.filter(o => o.toetsBestand);
    const metTheorie = alleOpd.filter(o => o.theorieLink);
    const toetsBib = materialen.filter(m => m.type === 'toets');
    const werkBoekBib = materialen.filter(m => m.type === 'werkboekje');

    const renderMateriaalRijen = (lijst) => lijst.map(m => {
      const datum = m.aangemaakt ? m.aangemaakt.slice(0, 10) : '';
      return `
        <div class="tw-mat-rij">
          <div class="tw-mat-naam">
            <strong>${escHtml(m.naam)}</strong>
            ${m.vak ? `<span style="font-size:11px;color:var(--ink-muted)">${escHtml(m.vak)}</span>` : ''}
          </div>
          <div class="tw-mat-meta">${datum}</div>
          <a href="/uploads/${encodeURIComponent(m.bestandsnaam)}" target="_blank" download="${escHtml(m.bestandsnaam)}"
             class="btn btn-sm">⬇ Download</a>
          ${!readonly ? `<button class="btn btn-sm" onclick="matKoppelAanActiviteit('${m.id}','${escHtml(m.naam)}','${escHtml(m.bestandsnaam)}')">Koppelen</button>` : ''}
          ${!readonly ? `<button class="tw-del-btn" onclick="matVerwijder('${m.id}')">Verwijderen</button>` : ''}
        </div>`;
    }).join('');

    document.getElementById('view-lesmaterialen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesmaterialen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${!readonly ? `
            <button class="btn" onclick="openWerkboekjeWizard()">📓 Werkboekje maken</button>
            <button class="btn btn-primary" onclick="openToetsGenerator()">📝 Toets genereren</button>
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
        <div class="card-header">
          <div><h2>📗 Werkboekjes bibliotheek (${bibliotheek.length})</h2>
          <div class="card-meta">Geüploade en handmatige werkboekjes — koppelbaar aan praktijkopdrachten in les modules</div></div>
          ${!readonly ? `<button class="btn btn-sm btn-primary" onclick="openWerkboekjeVoorBibliotheek(null)">+ Nieuw werkboekje</button>` : ''}
        </div>
        ${bibliotheek.length === 0
          ? `<div class="empty-state"><h3>Nog geen werkboekjes in de bibliotheek</h3><p>Maak een werkboekje via de knop rechtsboven.</p></div>`
          : `<div class="lm-grid" style="padding:16px 20px">
              ${bibliotheek.map(w => `
                <div class="lm-kaart">
                  <div class="lm-kaart-type">
                    <span class="lm-type-pill" style="background:#D97706">Werkboekje</span>
                    ${w.niveau ? `<span style="font-size:11.5px;color:var(--ink-3)">${escHtml(w.niveau)}</span>` : ''}
                  </div>
                  <div class="lm-kaart-naam">${escHtml(w.naam || w.data?.titel || 'Zonder naam')}</div>
                  ${w.beschrijving ? `<div class="lm-kaart-meta">${escHtml(w.beschrijving)}</div>` : '<div class="lm-kaart-meta"></div>'}
                  <div class="lm-kaart-acties">
                    <button class="btn btn-sm" style="flex:1" onclick="openWerkboekjeVoorBibliotheek('${w.id}')">Bewerken</button>
                    ${!readonly ? `<button class="icon-btn" style="color:var(--red);border-color:rgba(220,38,38,0.3)" onclick="verwijderBibliotheekWerkboekje('${w.id}','${escHtml(w.naam || w.data?.titel || 'dit werkboekje')}')" title="Verwijderen">🗑</button>` : ''}
                  </div>
                </div>`).join('')}
            </div>`
        }
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>Toetsen (gekoppeld aan opdrachten) (${metToets.length})</h2></div></div>
        ${metToets.length === 0
          ? `<div class="empty-state"><p>Geen gekoppelde toetsbestanden in opdrachten.</p></div>`
          : metToets.map(o => {
              const klas = klassen.find(k => k.id === o.klasId);
              return `<div class="tw-mat-rij">
                <div class="tw-mat-naam" style="flex:2">
                  <a href="/uploads/${escHtml(o.toetsBestand)}" target="_blank" style="color:var(--accent);font-size:13px">${escHtml(o.toetsBestand)}</a>
                  <span style="font-size:12px;color:var(--ink-muted)">${escHtml(o.naam || '')}</span>
                </div>
                <div style="font-size:13px">${escHtml(klas?.naam || '—')}</div>
                <div class="tw-mat-meta">Week ${o.weeknummer || '—'}</div>
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
    renderLesmaterialen();
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
  zone.innerHTML = `<div style="font-size:22px;margin-bottom:6px">📄</div>
    <div style="font-weight:600;margin-bottom:4px;color:var(--accent)">${escHtml(file.name)}</div>
    <div style="font-size:12px;color:var(--ink-muted)">${(file.size / 1024 / 1024).toFixed(2)} MB — klik om te wijzigen</div>`;
  zone.style.borderColor = 'var(--accent)';
  zone.style.background = 'var(--accent-dim)';
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
    <hr style="margin:22px 0;border:none;border-top:1px solid var(--border)">
    <h3 style="font-size:14px;font-weight:700;margin:0 0 4px">Databeheer</h3>
    <p class="lb-progress-label" style="margin:0 0 12px">Verwijder verweesde data van profielen die al zijn verwijderd.</p>
    <div id="cleanup-result" style="font-size:13px;margin-bottom:10px"></div>
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

    <div class="tw-keuze-grid">
      <div class="tw-keuze-kaart" onclick="openToetsUpload()">
        <div class="tw-keuze-icoon">📤</div>
        <div class="tw-keuze-titel">Bestand uploaden</div>
        <div class="tw-keuze-sub">AI maakt een toets in examen-stijl op basis van je lesmateriaal</div>
      </div>
      <div class="tw-keuze-kaart" onclick="openToetsWizard()">
        <div class="tw-keuze-icoon">✏️</div>
        <div class="tw-keuze-titel">Nieuw aanmaken</div>
        <div class="tw-keuze-sub">Stap voor stap invullen — bronnen, open vragen en meerkeuze</div>
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
    renderLesmaterialen();
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
      <div class="tw-sectie">
        <div class="tw-sectie-header">
          <span>Sectie ${si + 1}</span>
        </div>
        <div class="form-field">
          <label>Thema-titel (bijv. Weer en klimaat)</label>
          <input id="tw-sec-titel-${si}" value="${escHtml(sectie.titel)}" placeholder="Bijv. Bevolking en ruimte">
        </div>
        ${sectie.bronnen.map((bron, bi) => `
          <div class="tw-bron-blok">
            <div class="tw-bron-header">
              <span class="tw-bron-nr">bron ${bron.nummer}</span>
              ${sectie.bronnen.length > 1 ? `<button class="tw-bron-del" onclick="twVerwijderBron(${si},${bi})">Verwijderen</button>` : ''}
            </div>
            <div class="form-field" style="margin-bottom:6px">
              <label style="font-size:12px">Ondertitel</label>
              <input id="tw-bron-ot-${si}-${bi}" value="${escHtml(bron.ondertitel)}" placeholder="bijv. Weerbericht voor Nederland">
            </div>
            <div class="form-field">
              <label style="font-size:12px">Brontekst (gebruik Enter voor nieuwe regels)</label>
              <textarea id="tw-bron-tekst-${si}-${bi}" rows="4" class="tw-mini-textarea">${escHtml(bron.tekst)}</textarea>
            </div>
            <div class="form-field" style="margin-bottom:0">
              <label style="font-size:12px">Figuur / afbeelding (optioneel)</label>
              ${bron.figuurBase64
                ? `<div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                     <img src="${bron.figuurBase64}" style="max-height:60px;max-width:120px;border:1px solid var(--border);border-radius:4px" alt="figuur">
                     <button class="tw-bron-del" onclick="twVerwijderFiguur(${si},${bi})">Verwijder figuur</button>
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
        <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--accent)">
          ${escHtml(sectie.titel || `Sectie ${si + 1}`)}
        </div>
        ${sectie.vragen.map((v, vi) => `
          <div class="tw-vraag-blok">
            <div class="tw-vraag-acties">
              <select id="tw-v-type-${si}-${vi}" class="tw-mini-select" onchange="twWijzigVraagType(${si},${vi},this.value)">
                <option value="open" ${v.type==='open'?'selected':''}>Open vraag</option>
                <option value="meerkeuze" ${v.type==='meerkeuze'?'selected':''}>Meerkeuze</option>
              </select>
              <select id="tw-v-punten-${si}-${vi}" class="tw-mini-select">
                ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(v.punten||1)===n?'selected':''}>${n} punt${n>1?'en':''}</option>`).join('')}
              </select>
              <input id="tw-v-ctx-${si}-${vi}" class="tw-mini-input" value="${escHtml(v.context||'')}" placeholder="bijv. Lees bron 1.">
              ${sectie.vragen.length > 1 ? `<button class="tw-vraag-del" onclick="twVerwijderVraag(${si},${vi})">✕</button>` : ''}
            </div>
            <textarea id="tw-v-vraag-${si}-${vi}" rows="2" class="tw-mini-textarea" placeholder="${v.type==='meerkeuze'?'Vraagstelling (bijv. Welke uitspraak is juist?)':'Vraagstelling hier invullen...'}">${escHtml(v.vraag||'')}</textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <button onclick="twAiAdviseerVraag(${si},${vi})" class="btn btn-sm" style="font-size:11px">✨ AI-advies</button>
              <span id="tw-ai-status-${si}-${vi}" style="font-size:11px;color:var(--ink-muted)"></span>
            </div>
            <div id="tw-ai-advies-${si}-${vi}" class="tw-ai-advies-blok"></div>
            ${v.type === 'meerkeuze' ? `
              <div class="tw-mk-grid">
                ${(v.opties||[{letter:'A',tekst:''},{letter:'B',tekst:''},{letter:'C',tekst:''},{letter:'D',tekst:''}]).map((opt,oi) => `
                  <div class="tw-mk-opt">
                    <span class="tw-mk-letter">${opt.letter}</span>
                    <input id="tw-v-opt-${si}-${vi}-${oi}" class="tw-mini-input" value="${escHtml(opt.tekst||'')}" placeholder="Optie ${opt.letter}">
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:12px;color:var(--ink-muted)">Antwoordregels:</label>
                <select id="tw-v-regels-${si}-${vi}" class="tw-mini-select">
                  ${[2,3,4,5,6].map(n => `<option value="${n}" ${(v.antwoordRegels||3)===n?'selected':''}>${n}</option>`).join('')}
                </select>
              </div>
            `}
          </div>
        `).join('')}
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="btn btn-sm" onclick="twVoegVraagToe(${si},'open')">+ Open vraag</button>
          <button class="btn btn-sm" onclick="twVoegVraagToe(${si},'meerkeuze')">+ Meerkeuze</button>
        </div>
      </div>
    `).join('');
  }

  else if (s === 4) {
    const aantalVragen = _toetsWizard.data.secties.reduce((t,s) => t + (s.vragen||[]).length, 0);
    const maxPunten = _toetsWizard.data.secties.reduce((t,s) => t + (s.vragen||[]).reduce((tt,v) => tt + (parseInt(v.punten)||1), 0), 0);
    inhoud = `
      <div class="tw-ovz-blok">
        <div class="tw-ovz-titel">Overzicht</div>
        <div class="tw-ovz-grid">
          <div><span style="color:var(--ink-muted)">Vak:</span> ${escHtml(_toetsWizard.data.vak)}</div>
          <div><span style="color:var(--ink-muted)">Niveau:</span> ${escHtml(_toetsWizard.data.niveauLabel)}</div>
          <div><span style="color:var(--ink-muted)">Datum:</span> ${escHtml(_toetsWizard.data.datum||'—')}</div>
          <div><span style="color:var(--ink-muted)">Secties:</span> ${_toetsWizard.data.secties.length}</div>
          <div><span style="color:var(--ink-muted)">Vragen:</span> ${aantalVragen}</div>
          <div><span style="color:var(--ink-muted)">Max punten:</span> ${maxPunten}</div>
        </div>
      </div>
      <p class="lb-progress-label">Klik op Toets aanmaken om de toets te genereren als .docx bestand in officiële examen-stijl.</p>
    `;
  }

  openModal(`
    <h2 style="margin:0 0 4px;font-size:19px;font-weight:700;letter-spacing:-0.3px">✏️ Nieuwe toets — ${stapTitels[s-1]}</h2>
    <div class="lb-progress-wrap">
      <div class="lb-progress-bar">
        ${stapTitels.map((t,i) => `<div class="lb-progress-seg${i < s ? ' actief' : ''}" title="${t}"></div>`).join('')}
      </div>
      <div class="lb-progress-label">Stap ${s} van ${totaal} — ${stapTitels[s-1]}</div>
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
      <div class="tw-ai-advies-titel">AI-advies:</div>
      <div style="margin-bottom:8px">${escHtml(adviesTekst)}</div>
      ${verbeterd ? `
        <div style="font-weight:600;margin-bottom:4px">Verbeterde vraag:</div>
        <div class="tw-ai-verbeterd">${escHtml(verbeterd)}</div>
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
    renderLesmaterialen();
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}
