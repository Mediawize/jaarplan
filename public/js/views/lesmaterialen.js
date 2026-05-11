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
                    ${w.data?.bestandsnaam ? `<a class="btn btn-sm" href="/uploads/${encodeURIComponent(w.data.bestandsnaam)}" target="_blank" download style="flex:1;text-align:center">Download</a>` : `<button class="btn btn-sm" style="flex:1" onclick="openWerkboekjeVoorBibliotheek('${w.id}')">Bewerken</button>`}
                    ${w.data?.bestandsnaam ? `<button class="btn btn-sm" onclick="openWerkboekjeVoorBibliotheek('${w.id}')">Bewerken</button>` : ''}
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

// Maak de lesmaterialen functies expliciet beschikbaar voor app.js en inline knoppen.
window.renderLesmaterialen = renderLesmaterialen;
window.matVerwijder = matVerwijder;
window.matKoppelAanActiviteit = matKoppelAanActiviteit;
window.matFilterNiveau = matFilterNiveau;
window.matLaadWeken = matLaadWeken;
window.matSlaKoppelingOp = matSlaKoppelingOp;
