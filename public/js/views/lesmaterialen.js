// ============================================================
// public/js/views/lesmaterialen.js
// Centrale lesmaterialen bibliotheek
// Toetsen en werkboekjes worden hier gemaakt, geüpload, opgeslagen en gedownload.
// ============================================================

function lmEsc(v) {
  return typeof escHtml === 'function'
    ? escHtml(v ?? '')
    : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function lmDownloadLink(m) {
  if (!m?.bestandsnaam) return '';
  return `/uploads/${encodeURIComponent(m.bestandsnaam)}`;
}

async function renderLesmaterialen() {
  showLoading('lesmaterialen');
  try {
    const materialen = await API.getMaterialen();
    const readonly = !Auth.canEdit();
    const toetsen = materialen.filter(m => m.type === 'toets');
    const werkboekjes = materialen.filter(m => m.type === 'werkboekje');

    const renderRijen = (lijst, leegTitel, leegTekst) => {
      if (!lijst.length) {
        return `<div class="empty-state"><h3>${lmEsc(leegTitel)}</h3><p>${lmEsc(leegTekst)}</p></div>`;
      }
      return `<div style="padding:4px 0">${lijst.map(m => {
        const datum = m.aangemaakt ? String(m.aangemaakt).slice(0, 10) : '';
        const naam = m.naam || m.bestandsnaam || 'Zonder naam';
        return `<div class="tw-mat-rij">
          <div class="tw-mat-naam" style="flex:2">
            <strong>${lmEsc(naam)}</strong>
            <span style="font-size:11px;color:var(--ink-muted)">${lmEsc(m.bestandsnaam || '')}${m.vak ? ` · ${lmEsc(m.vak)}` : ''}</span>
          </div>
          <div class="tw-mat-meta">${lmEsc(datum)}</div>
          ${m.bestandsnaam ? `<a href="${lmDownloadLink(m)}" target="_blank" download="${lmEsc(m.bestandsnaam)}" class="btn btn-sm">⬇ Download</a>` : ''}
          ${!readonly ? `<button class="tw-del-btn" onclick="matVerwijder('${lmEsc(m.id)}')">Verwijderen</button>` : ''}
        </div>`;
      }).join('')}</div>`;
    };

    document.getElementById('view-lesmaterialen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Lesmaterialen</h1>
          <p class="page-sub">Centrale bibliotheek voor toetsen en werkboekjes.</p>
        </div>
        ${!readonly ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn" onclick="openMateriaalUploadModal('werkboekje')">⬆ Werkboekje uploaden</button>
          <button class="btn" onclick="openWerkboekjeWizard()">📓 Werkboekje maken</button>
          <button class="btn" onclick="openMateriaalUploadModal('toets')">⬆ Toets uploaden</button>
          <button class="btn btn-primary" onclick="openToetsGenerator()">📝 Toets maken</button>
        </div>` : ''}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>📝 Toetsen (${toetsen.length})</h2>
            <div class="card-meta">Gemaakt via de wizard of handmatig geüpload. Koppelbaar in Lesmodule.</div>
          </div>
          ${!readonly ? `<button class="btn btn-sm" onclick="openMateriaalUploadModal('toets')">+ Upload toets</button>` : ''}
        </div>
        ${renderRijen(toetsen, 'Nog geen toetsen', 'Maak een toets via de wizard of upload een bestaand bestand.')}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>📓 Werkboekjes (${werkboekjes.length})</h2>
            <div class="card-meta">Gemaakt via de wizard of handmatig geüpload. Koppelbaar in Lesmodule.</div>
          </div>
          ${!readonly ? `<button class="btn btn-sm" onclick="openMateriaalUploadModal('werkboekje')">+ Upload werkboekje</button>` : ''}
        </div>
        ${renderRijen(werkboekjes, 'Nog geen werkboekjes', 'Maak een werkboekje via de wizard of upload een bestaand bestand.')}
      </div>
    `;
  } catch (e) {
    showError('Fout bij laden: ' + e.message);
  }
}

function openMateriaalUploadModal(type) {
  const isToets = type === 'toets';
  const titel = isToets ? 'Toets uploaden' : 'Werkboekje uploaden';
  const accept = isToets ? '.pdf,.doc,.docx' : '.pdf,.doc,.docx';
  openModal(`
    <h2>${isToets ? '📝' : '📓'} ${titel}</h2>
    <p class="modal-sub">Het bestand wordt opgeslagen in Lesmaterialen en kan daarna in Lesmodule worden gekoppeld.</p>
    <div id="mat-upload-result" style="font-size:13px;margin-bottom:8px"></div>
    <div class="form-field">
      <label>Naam *</label>
      <input id="mat-upload-naam" placeholder="Bijvoorbeeld Eindtoets schakelingen of Werkboekje speaker" />
    </div>
    <div class="form-field">
      <label>Vak</label>
      <input id="mat-upload-vak" placeholder="Bijvoorbeeld PIE, Techniek of NASK" />
    </div>
    <div class="form-field">
      <label>Bestand *</label>
      <input id="mat-upload-bestand" type="file" accept="${accept}" />
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="matUploadBestand('${type}')">Opslaan</button>
    </div>
  `);
}

async function matUploadBestand(type) {
  const result = document.getElementById('mat-upload-result');
  const naam = document.getElementById('mat-upload-naam')?.value.trim();
  const vak = document.getElementById('mat-upload-vak')?.value.trim() || '';
  const input = document.getElementById('mat-upload-bestand');
  const file = input?.files?.[0];
  if (!naam) { result.innerHTML = '<span style="color:var(--red)">Naam is verplicht.</span>'; return; }
  if (!file) { result.innerHTML = '<span style="color:var(--red)">Kies eerst een bestand.</span>'; return; }

  result.innerHTML = '<span style="color:var(--amber)">⏳ Uploaden...</span>';
  const fd = new FormData();
  fd.append('bestand', file);
  fd.append('type', type);
  fd.append('naam', naam);
  fd.append('vak', vak);

  try {
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Upload mislukt');
    result.innerHTML = `<span style="color:var(--accent)">✓ Opgeslagen</span>`;
    setTimeout(() => { closeModalDirect(); renderLesmaterialen(); }, 500);
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Fout: ${lmEsc(e.message)}</span>`;
  }
}

async function matVerwijder(id) {
  if (!confirm('Materiaal definitief verwijderen? Het bestand blijft mogelijk nog fysiek in uploads staan, maar verdwijnt uit de bibliotheek.')) return;
  try {
    await API.deleteMateriaal(id);
    renderLesmaterialen();
  } catch (e) {
    alert('Fout: ' + e.message);
  }
}

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


// Maak de lesmaterialen functies expliciet beschikbaar voor app.js en inline knoppen.
window.renderLesmaterialen = renderLesmaterialen;
window.openMateriaalUploadModal = openMateriaalUploadModal;
window.matUploadBestand = matUploadBestand;
window.matVerwijder = matVerwijder;
window.openInstellingenModal = openInstellingenModal;
window.previewLogo = previewLogo;
window.slaInstellingenOp = slaInstellingenOp;
window.cleanupProfielen = cleanupProfielen;
