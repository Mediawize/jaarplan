// ============================================================
// public/js/views/toetsen.js
// NIEUW: Werkboekje generator, Toets generator, School instellingen modal
// ============================================================

async function renderToetsen() {
  showLoading('toetsen');
  try {
    const [klassen, alleOpd] = await Promise.all([API.getKlassen(), API.getOpdrachten()]);
    const readonly = !Auth.canEdit();
    const metToets = alleOpd.filter(o=>o.toetsBestand);
    const metTheorie = alleOpd.filter(o=>o.theorieLink);

    document.getElementById('view-toetsen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Toetsen & Materialen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${!readonly?`
            <button class="btn" onclick="openWerkboekjeGenerator()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📓</span> Werkboekje maken
            </button>
            <button class="btn" onclick="openToetsGenerator()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📝</span> Toets genereren
            </button>
            <button class="btn btn-primary" onclick="openOpdrachtModal()">+ Materiaal koppelen</button>
          `:''}
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>Toetsen (${metToets.length})</h2><div class="card-meta">Alle gekoppelde toetsbestanden</div></div></div>
        ${metToets.length===0?`<div class="empty-state"><h3>Geen toetsen</h3><p>Koppel een toetsbestand bij een activiteit in de jaarplanning.</p></div>`:`
        <table class="data-table">
          <thead><tr><th>Bestand</th><th>Activiteit</th><th>Klas</th><th>Week</th><th>Syllabus</th>${!readonly?'<th></th>':''}</tr></thead>
          <tbody>
            ${metToets.sort((a,b)=>parseInt(a.weken||0)-parseInt(b.weken||0)).map(o=>{
              const klas=klassen.find(k=>k.id===o.klasId);
              return `<tr>
                <td><span style="display:inline-flex;align-items:center;gap:8px"><span style="font-size:20px">📄</span><span style="font-weight:500">${escHtml(o.toetsBestand)}</span></span></td>
                <td>${escHtml(o.naam)}</td>
                <td>${escHtml(klas?.naam||'—')}</td>
                <td><span class="week-pill">Wk ${o.weken||o.weeknummer}</span></td>
                <td style="font-size:12px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)||'—'}</td>
                ${!readonly?`<td><button class="btn btn-sm" onclick="window._selectedKlas='${o.klasId}';openOpdrachtModal('${o.id}','${o.klasId}')">Bewerk</button></td>`:''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>Theorie & links (${metTheorie.length})</h2><div class="card-meta">Alle gekoppelde theorie-links</div></div></div>
        ${metTheorie.length===0?`<div class="empty-state"><h3>Geen theorie-links</h3></div>`:`
        <table class="data-table">
          <thead><tr><th>Activiteit</th><th>Klas</th><th>Week</th><th>Link</th></tr></thead>
          <tbody>
            ${metTheorie.sort((a,b)=>parseInt(a.weken||0)-parseInt(b.weken||0)).map(o=>{
              const klas=klassen.find(k=>k.id===o.klasId);
              return `<tr>
                <td style="font-weight:500">${escHtml(o.naam)}</td>
                <td>${escHtml(klas?.naam||'—')}</td>
                <td><span class="week-pill">Wk ${o.weken||o.weeknummer}</span></td>
                <td><a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank">${escHtml(o.theorieLink.length>50?o.theorieLink.slice(0,50)+'…':o.theorieLink)}</a></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>

      ${!readonly?`
      <div class="card">
        <div class="card-header"><h2>Bestand uploaden</h2></div>
        <div style="padding:24px">
          <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
            <div class="upload-icon">↑</div>
            <div style="font-weight:500;margin-bottom:4px">Sleep een bestand hierheen of klik om te bladeren</div>
            <div style="font-size:12px">PDF, Word of PowerPoint — max 25 MB</div>
          </div>
          <input type="file" id="file-input" accept=".pdf,.doc,.docx,.ppt,.pptx" style="display:none" onchange="uploadBestand(this)">
          <div id="upload-result" style="margin-top:12px;font-size:13px;color:var(--ink-muted)"></div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:8px">Na het uploaden koppelt u de bestandsnaam aan een activiteit via de jaarplanning.</div>
        </div>
      </div>`:''}
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function uploadBestand(input) {
  const file = input.files[0];
  if (!file) return;
  const result = document.getElementById('upload-result');
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bestand wordt geüpload...</span>`;
  const formData = new FormData();
  formData.append('bestand', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.bestandsnaam) {
      result.innerHTML = `<span style="color:var(--accent)">✓ Geüpload als: <strong>${escHtml(data.bestandsnaam)}</strong></span><br><span style="font-size:11px;color:var(--ink-muted)">Kopieer deze naam en plak bij een activiteit in de jaarplanning.</span>`;
    } else {
      result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(data.error||'Onbekende fout')}</span>`;
    }
  } catch(e) {
    result.innerHTML = `<span style="color:var(--red)">Upload mislukt.</span>`;
  }
}

// ============================================================
// SCHOOL INSTELLINGEN HELPER
// ============================================================
async function getSchoolInstellingen() {
  try {
    const res = await fetch('/api/instellingen');
    return await res.json();
  } catch { return { schoolnaam: '', logoBestand: null }; }
}

// ============================================================
// INSTELLINGEN MODAL (admin only)
// ============================================================
async function openInstellingenModal() {
  if (!Auth.isAdmin()) return;
  const inst = await getSchoolInstellingen();
  openModal(`
    <h2>⚙️ School instellingen</h2>
    <p class="modal-sub">Het logo en de schoolnaam worden gebruikt in alle gegenereerde werkboekjes en toetsen.</p>

    <div class="form-field">
      <label>Schoolnaam *</label>
      <input id="inst-schoolnaam" type="text" value="${escHtml(inst.schoolnaam)}" placeholder="bijv. Atlas College">
    </div>

    <div class="form-field">
      <label>Logo (PNG, JPG of SVG)</label>
      ${inst.logoBestand
        ? `<div style="margin-bottom:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;align-items:center;gap:10px">
            <img src="/uploads/${escHtml(inst.logoBestand)}" style="height:36px;object-fit:contain">
            <span style="font-size:12px;color:var(--ink-muted)">Huidig logo</span>
           </div>`
        : `<div style="margin-bottom:8px;font-size:13px;color:var(--ink-muted)">Nog geen logo ingesteld</div>`}
      <div class="upload-zone" onclick="document.getElementById('inst-logo-input').click()" id="inst-logo-zone">
        <div class="upload-icon">↑</div>
        <div style="font-weight:500;margin-bottom:4px">Klik om een logo te kiezen</div>
        <div style="font-size:12px">PNG, JPG of SVG — max 5 MB</div>
      </div>
      <input type="file" id="inst-logo-input" accept=".png,.jpg,.jpeg,.svg" style="display:none" onchange="previewLogo(this)">
      <div id="inst-logo-preview" style="margin-top:8px"></div>
    </div>

    <div id="inst-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaInstellingenOp()">Opslaan</button>
    </div>
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// ============================================================
// WERKBOEKJE GENERATOR MODAL
// ============================================================
async function openWerkboekjeGenerator() {
  const inst = await getSchoolInstellingen();
  const heeftInstellingen = !!(inst.schoolnaam);

  openModal(`
    <h2>📓 Werkboekje maken</h2>
    <p class="modal-sub">Upload een Word, PDF of PowerPoint bestand. De AI maakt er een professioneel werkboekje van met jouw schoolhuisstijl.</p>

    ${!heeftInstellingen && Auth.isAdmin() ? `
      <div class="alert alert-info" style="margin-bottom:14px">
        <strong>Tip:</strong> Stel eerst de schoolnaam en het logo in via
        <a href="#" onclick="closeModalDirect();openInstellingenModal()" style="color:var(--accent)">⚙️ Instellingen</a>
        voor een complete huisstijl in de documenten.
      </div>` : ''}

    ${inst.schoolnaam ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:14px">🏫 School: <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ' · <a href=\'#\' onclick=\'closeModalDirect();openInstellingenModal()\' style=\'color:var(--accent)\'>Logo toevoegen</a>'}</div>` : ''}

    <div class="form-field">
      <label>Titel werkboekje (optioneel — AI kiest anders zelf)</label>
      <input id="wb-titel" type="text" placeholder="bijv. Elektrotechniek – Module 3">
    </div>

    <div class="form-field">
      <label>Bestand * (Word, PDF of PowerPoint)</label>
      <div class="upload-zone" onclick="document.getElementById('wb-bestand').click()" id="wb-zone">
        <div class="upload-icon">↑</div>
        <div style="font-weight:500;margin-bottom:4px">Sleep bestand hierheen of klik</div>
        <div style="font-size:12px">.docx · .pdf · .pptx — max 25 MB</div>
      </div>
      <input type="file" id="wb-bestand" accept=".docx,.doc,.pdf,.pptx,.ppt" style="display:none" onchange="toonBestandsnaamInZone(this,'wb-zone')">
    </div>

    <div id="wb-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${Auth.isAdmin() ? `<button class="btn" onclick="closeModalDirect();openInstellingenModal()">⚙️ Instellingen</button>` : ''}
      <button class="btn btn-primary" onclick="doGenererenWerkboekje()">📓 Genereren</button>
    </div>
  `);
}

function toonBestandsnaamInZone(input, zoneId) {
  const file = input.files[0];
  if (!file) return;
  const zone = document.getElementById(zoneId);
  zone.innerHTML = `<div style="font-size:20px">📄</div>
    <div style="font-weight:500;margin-bottom:4px;color:var(--accent)">${escHtml(file.name)}</div>
    <div style="font-size:12px">${(file.size/1024/1024).toFixed(2)} MB — klik om te wijzigen</div>`;
  zone.style.borderColor = 'var(--accent)';
}

async function doGenererenWerkboekje() {
  const bestandInput = document.getElementById('wb-bestand');
  const titel = document.getElementById('wb-titel').value.trim();
  const result = document.getElementById('wb-result');

  if (!bestandInput.files[0]) {
    result.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`;
    return;
  }

  result.innerHTML = `<span style="color:var(--amber)">⏳ AI analyseert document en bouwt werkboekje... (15–30 sec)</span>`;

  const fd = new FormData();
  fd.append('bestand', bestandInput.files[0]);
  if (titel) fd.append('titel', titel);

  try {
    const res = await fetch('/api/genereer-werkboekje', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        ✓ <strong>${escHtml(data.titel)}</strong> is klaar!
        <br>
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
// TOETS GENERATOR MODAL
// ============================================================
async function openToetsGenerator() {
  const inst = await getSchoolInstellingen();
  const heeftInstellingen = !!(inst.schoolnaam);

  openModal(`
    <h2>📝 Toets genereren</h2>
    <p class="modal-sub">Upload lesmateriaal en de AI maakt er een complete toets van — met vragen, antwoordruimtes en puntenverdeling.</p>

    ${!heeftInstellingen && Auth.isAdmin() ? `
      <div class="alert alert-info" style="margin-bottom:14px">
        <strong>Tip:</strong> Stel eerst de schoolnaam en het logo in via
        <a href="#" onclick="closeModalDirect();openInstellingenModal()" style="color:var(--accent)">⚙️ Instellingen</a>.
      </div>` : ''}

    ${inst.schoolnaam ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:14px">🏫 School: <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ' · <a href=\'#\' onclick=\'closeModalDirect();openInstellingenModal()\' style=\'color:var(--accent)\'>Logo toevoegen</a>'}</div>` : ''}

    <div class="form-grid">
      <div class="form-field">
        <label>Naam toets (optioneel)</label>
        <input id="ts-titel" type="text" placeholder="bijv. Proefwerk H3 – Elektra">
      </div>
      <div class="form-field">
        <label>Aantal vragen</label>
        <select id="ts-vragen">
          <option value="5">5 vragen</option>
          <option value="10" selected>10 vragen</option>
          <option value="15">15 vragen</option>
          <option value="20">20 vragen</option>
        </select>
      </div>
    </div>

    <div class="form-field">
      <label>Bestand * (Word, PDF of PowerPoint)</label>
      <div class="upload-zone" onclick="document.getElementById('ts-bestand').click()" id="ts-zone">
        <div class="upload-icon">↑</div>
        <div style="font-weight:500;margin-bottom:4px">Sleep bestand hierheen of klik</div>
        <div style="font-size:12px">.docx · .pdf · .pptx — max 25 MB</div>
      </div>
      <input type="file" id="ts-bestand" accept=".docx,.doc,.pdf,.pptx,.ppt" style="display:none" onchange="toonBestandsnaamInZone(this,'ts-zone')">
    </div>

    <div id="ts-result" style="margin-top:8px;font-size:13px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${Auth.isAdmin() ? `<button class="btn" onclick="closeModalDirect();openInstellingenModal()">⚙️ Instellingen</button>` : ''}
      <button class="btn btn-primary" onclick="doGenererenToets()">📝 Toets genereren</button>
    </div>
  `);
}

async function doGenererenToets() {
  const bestandInput = document.getElementById('ts-bestand');
  const titel = document.getElementById('ts-titel').value.trim();
  const aantalVragen = document.getElementById('ts-vragen').value;
  const result = document.getElementById('ts-result');

  if (!bestandInput.files[0]) {
    result.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`;
    return;
  }

  result.innerHTML = `<span style="color:var(--amber)">⏳ AI analyseert inhoud en stelt ${aantalVragen} vragen op... (15–30 sec)</span>`;

  const fd = new FormData();
  fd.append('bestand', bestandInput.files[0]);
  if (titel) fd.append('titel', titel);
  fd.append('aantalVragen', aantalVragen);

  try {
    const res = await fetch('/api/genereer-toets', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    result.innerHTML = `
      <div class="alert alert-info" style="background:var(--accent-dim);border:1px solid rgba(45,90,61,0.2);color:var(--accent-text)">
        ✓ <strong>${escHtml(data.titel)}</strong> is klaar!
        <br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          ⬇ Toets downloaden (.docx)
        </a>
      </div>`;
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}
