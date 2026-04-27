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
    const [klassen, alleOpd] = await Promise.all([API.getKlassen(), API.getOpdrachten()]);
    const readonly = !Auth.canEdit();
    const metToets = alleOpd.filter(o => o.toetsBestand);
    const metTheorie = alleOpd.filter(o => o.theorieLink);

    const renderToetsRijen = (lijst) => lijst.map(o => {
      const klas = klassen.find(k => k.id === o.klasId);
      const naam = escHtml(o.naam || '');
      const klasNaam = escHtml(klas?.naam || '—');
      const week = o.weeknummer || '—';
      const syllabus = escHtml(o.syllabuscodes || '—');
      const bestand = escHtml(o.toetsBestand || '');
      return `<div style="padding:10px 20px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <div style="flex:2;min-width:120px">
          <a href="/uploads/${bestand}" target="_blank" style="color:var(--accent);font-weight:500;font-size:13px;word-break:break-all">${bestand}</a>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:2px">${naam}</div>
        </div>
        <div style="flex:1;min-width:80px;font-size:13px">${klasNaam}</div>
        <div style="font-size:12px;color:var(--ink-muted);white-space:nowrap">Week ${week}</div>
        ${syllabus !== '—' ? `<div style="font-size:11px;color:var(--ink-muted)">${syllabus}</div>` : ''}
        ${!readonly ? `<button class="btn btn-sm" onclick="openOpdrachtModal('${o.id}','${o.klasId}')">Bewerken</button>` : ''}
      </div>`;
    }).join('');

    const renderTheorieRijen = (lijst) => lijst.map(o => {
      const klas = klassen.find(k => k.id === o.klasId);
      const naam = escHtml(o.naam || '');
      const klasNaam = escHtml(klas?.naam || '—');
      const week = o.weeknummer || '—';
      const link = escHtml(o.theorieLink || '');
      const linkKort = o.theorieLink ? o.theorieLink.replace(/^https?:\/\//, '').slice(0, 50) + (o.theorieLink.length > 55 ? '…' : '') : '';
      return `<div style="padding:10px 20px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <div style="flex:2;min-width:120px">
          <a href="${link}" target="_blank" style="color:var(--accent);font-weight:500;font-size:13px;word-break:break-all">${escHtml(linkKort)}</a>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:2px">${naam}</div>
        </div>
        <div style="flex:1;min-width:80px;font-size:13px">${klasNaam}</div>
        <div style="font-size:12px;color:var(--ink-muted);white-space:nowrap">Week ${week}</div>
        ${!readonly ? `<button class="btn btn-sm" onclick="openOpdrachtModal('${o.id}','${o.klasId}')">Bewerken</button>` : ''}
      </div>`;
    }).join('');

    document.getElementById('view-toetsen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Toetsen & Materialen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${!readonly ? `
            <button class="btn" onclick="openWerkboekjeGenerator()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📓</span> Werkboekje maken
            </button>
            <button class="btn" onclick="openToetsGenerator()" style="display:inline-flex;align-items:center;gap:6px">
              <span style="font-size:15px">📝</span> Toets genereren
            </button>
            <button class="btn btn-primary" onclick="openOpdrachtModal()">+ Materiaal koppelen</button>
          ` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>Toetsen (${metToets.length})</h2><div class="card-meta">Alle gekoppelde toetsbestanden</div></div></div>
        ${metToets.length === 0
          ? `<div class="empty-state"><h3>Geen toetsen</h3><p>Koppel een toetsbestand bij een activiteit in de jaarplanning.</p></div>`
          : renderToetsRijen(metToets)}
      </div>

      <div class="card">
        <div class="card-header"><div><h2>Theorie materialen (${metTheorie.length})</h2><div class="card-meta">Alle gekoppelde theorie-links</div></div></div>
        ${metTheorie.length === 0
          ? `<div class="empty-state"><h3>Geen theorie-links</h3><p>Koppel een theorie-link bij een activiteit in de jaarplanning.</p></div>`
          : renderTheorieRijen(metTheorie)}
      </div>
    `;
  } catch (e) { showError('Fout bij laden: ' + e.message); }
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
      <button class="btn" onclick="openWerkboekjeGenerator()">← Terug</button>
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
        AI quota bereikt. Je OpenAI tegoed is op.<br>
        <span style="font-size:12px;margin-top:6px;display:block">
          Klik op Terug en kies Nieuw aanmaken om zonder AI een werkboekje te maken,
          of verleng je tegoed via platform.openai.com.
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
const _wbWizard = {
  stap: 1,
  data: {
    vak: '', profieldeel: '', opdrachtnummer: '1', duur: '',
    titel: '', leerdoelen: ['', '', ''],
    introductie: '',
    veiligheidsregels: ['Je werkpak en werkschoenen aantrekken.', 'Loshangende kleding is verboden.', 'Losse haren in een staart of knot.', 'Gehoorbescherming is verplicht bij machines.'],
    materiaalstaat: [
      { nummer: 1, benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' },
      { nummer: 2, benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' },
    ],
    machines: ['', ''],
    secties: [
      { titel: '', benodigdheden: [''], stappen: [{ stap: '' }, { stap: '' }, { stap: '' }] }
    ]
  }
};

function openWerkboekjeWizard() {
  _wbWizard.stap = 1;
  renderWizardStap();
}

function renderWizardStap() {
  const s = _wbWizard.stap;
  const totaal = 5;
  const progressPct = Math.round((s / totaal) * 100);

  const stapTitels = ['Algemeen', 'Leerdoelen & intro', 'Materialen', 'Veiligheid & machines', 'Stappenplan'];

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
          ${sectie.stappen.map((stap, pi) => `
            <div style="display:flex;gap:6px;margin-bottom:6px;align-items:flex-start">
              <span style="font-size:12px;color:var(--ink-muted);padding-top:10px;min-width:14px">${pi + 1}</span>
              <textarea id="wz-sec-stap-${si}-${pi}" rows="2" placeholder="Beschrijf de stap concreet..." style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical">${escHtml(stap.stap)}</textarea>
              <button onclick="wizardVerwijderStap(${si},${pi})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px;padding:4px;margin-top:6px">✕</button>
            </div>
          `).join('')}
          <button class="btn btn-sm" onclick="wizardVoegStapToe(${si})">+ Stap toevoegen</button>
        </div>
      </div>
    `).join('') + `
      ${_wbWizard.data.secties.length < 4 ? `<button class="btn btn-sm" onclick="wizardVoegSectieToe()">+ Opdracht toevoegen</button>` : ''}
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
        ? `<button class="btn" onclick="openWerkboekjeGenerator()">← Terug</button>`
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
      stappen: sectie.stappen.map((_, pi) => ({
        stap: document.getElementById(`wz-sec-stap-${si}-${pi}`)?.value.trim() || '',
        heeftAfbeelding: true
      })).filter(p => p.stap)
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
  _wbWizard.data.materiaalstaat.push({ nummer: n, benaming: '', lengte: '', breedte: '', dikte: '18', soortHout: 'Multiplex' });
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
  _wbWizard.data.secties.push({ titel: '', benodigdheden: [''], stappen: [{ stap: '' }, { stap: '' }] });
  renderWizardStap();
}
function wizardVerwijderSectie(i) {
  wizardSlaStapOp();
  _wbWizard.data.secties.splice(i, 1);
  renderWizardStap();
}
function wizardVoegStapToe(si) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen.push({ stap: '' });
  renderWizardStap();
}
function wizardVerwijderStap(si, pi) {
  wizardSlaStapOp();
  _wbWizard.data.secties[si].stappen.splice(pi, 1);
  renderWizardStap();
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

    ${inst.schoolnaam ? `<div style="font-size:13px;color:var(--ink-muted);margin-bottom:14px">🏫 <strong>${escHtml(inst.schoolnaam)}</strong>${inst.logoBestand ? ' · Logo ✓' : ` · <a href='#' onclick='closeModalDirect();openInstellingenModal()' style='color:var(--accent)'>Logo toevoegen</a>`}</div>` : ''}

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
      <label>Bestand * (Word, PDF)</label>
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
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${Auth.isAdmin() ? `<button class="btn" onclick="closeModalDirect();openInstellingenModal()">⚙️ Instellingen</button>` : ''}
      <button class="btn btn-primary" onclick="doGenererenToets()">📝 Genereren</button>
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
  result.innerHTML = `<span style="color:var(--amber)">⏳ AI maakt toets... (15–30 sec)</span>`;

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
        ✓ <strong>${escHtml(data.titel)}</strong> is klaar!<br>
        <a href="/uploads/${escHtml(data.bestandsnaam)}" download="${escHtml(data.bestandsnaam)}"
           style="color:var(--accent);font-weight:600;display:inline-block;margin-top:6px">
          ⬇ Toets downloaden (.docx)
        </a>
      </div>`;
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}
