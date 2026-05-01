// ============================================================
// public/js/views/werkboekjes.js
// Werkboekje wizard: upload/analyse, AI per stap, afbeeldingen,
// template-preview, PDF-download, opslaan/annuleren.
// ============================================================

let _werkboekjeWizard = null;
let _werkboekjeTemplateHtml = null;
let _werkboekjeLaatsteHtml = null;
let _werkboekjeOpgeslagenMateriaalId = null;

function wbEsc(v) {
  if (typeof escHtml === 'function') return escHtml(v == null ? '' : String(v));
  return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}
function wbAttr(v) { return wbEsc(v); }
function wbSafeId(v) { return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }

function resetWerkboekjeWizard() {
  _werkboekjeWizard = {
    stap: 1,
    uploads: [],
    afbeeldingen: [],
    aiOpties: ['basis', 'leerdoelen', 'materiaalstaat', 'gereedschappen', 'stappen_visueel'],
    data: leegWerkboekjeData()
  };
  _werkboekjeLaatsteHtml = null;
  _werkboekjeOpgeslagenMateriaalId = null;
}

function leegWerkboekjeData() {
  return {
    titel: '',
    vak: '',
    niveau: '',
    profieldeel: '',
    opdrachtnummer: '1',
    duur: '',
    introductie: '',
    leerdoelen: [''],
    veiligheidsregels: [
      'Werkpak en veiligheidsschoenen aan.',
      'Loshangende kleding vastmaken of uitdoen.',
      'Losse haren in een staart of knot.',
      'Gehoorbescherming verplicht bij machines.'
    ],
    materiaalstaat: [{ benaming:'', aantal:'', lengte:'', breedte:'', dikte:'', soortMateriaal:'' }],
    gereedschappen: [{ naam:'', omschrijving:'', afbeelding:'' }],
    stappen: [{ titel:'Voorbereiden', beschrijving:'', fotos:1, afbeeldingen:[], tip:'', letop:'', benodigdheden:[], checklist:[] }],
    reflectievragen: ['Wat ging goed?', 'Wat zou je volgende keer anders doen?']
  };
}

async function openWerkboekjeGenerator() {
  resetWerkboekjeWizard();
  await renderWerkboekjeWizard();
}

function sluitWerkboekjeWizard() {
  resetWerkboekjeWizard();
  if (typeof closeModalDirect === 'function') closeModalDirect();
}

async function laadWerkboekjeTemplate() {
  if (_werkboekjeTemplateHtml) return _werkboekjeTemplateHtml;
  const r = await fetch('/templates/werkboekje_template.html', { credentials:'same-origin' });
  if (!r.ok) throw new Error('Template niet gevonden');
  _werkboekjeTemplateHtml = await r.text();
  return _werkboekjeTemplateHtml;
}

async function renderWerkboekjeWizard() {
  const w = _werkboekjeWizard || (resetWerkboekjeWizard(), _werkboekjeWizard);
  const s = w.stap;
  const totaal = 7;
  const titels = [
    'Upload & basis',
    'AI-keuzes & leerdoelen',
    'Materiaalstaat',
    'Veiligheid & gereedschap',
    'Stappenplan',
    'Reflectie',
    'Voorbeeld & opslaan'
  ];

  let inhoud = '';
  if (s === 1) inhoud = renderWbStapUpload();
  if (s === 2) inhoud = renderWbStapAi();
  if (s === 3) inhoud = renderWbStapMateriaal();
  if (s === 4) inhoud = renderWbStapVeiligheid();
  if (s === 5) inhoud = renderWbStapStappen();
  if (s === 6) inhoud = renderWbStapReflectie();
  if (s === 7) inhoud = await renderWbStapPreview();

  openModal(`
    <h2>📓 Werkboekje maken — stap ${s} van ${totaal}</h2>
    <p class="modal-sub">${wbEsc(titels[s - 1])}. Alles blijft aanpasbaar voordat je opslaat.</p>
    <div style="display:flex;gap:5px;margin:0 0 16px">
      ${Array.from({ length:totaal }, (_, i) => `<div style="height:5px;flex:1;border-radius:999px;background:${i < s ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
    </div>
    ${inhoud}
    <div id="wb-result" style="margin-top:10px;font-size:13px"></div>
    <div class="modal-actions">
      ${s === 1 ? `<button class="btn" onclick="sluitWerkboekjeWizard()">Afsluiten</button>` : `<button class="btn" onclick="wbVorigeStap()">← Vorige</button>`}
      ${s < totaal ? `<button class="btn btn-primary" onclick="wbVolgendeStap()">Volgende →</button>` : `<button class="btn" onclick="wbDownloadPdf()">⬇ PDF downloaden</button><button class="btn" onclick="wbDownloadHtml()">HTML downloaden</button><button class="btn btn-primary" onclick="wbOpslaanHtml()">Opslaan</button><button class="btn" style="color:var(--red)" onclick="wbAfsluitenZonderOpslaan()">Afsluiten zonder opslaan</button>`}
    </div>
  `, { wide:true });
}

function renderWbStapUpload() {
  const d = _werkboekjeWizard.data;
  const imgs = _werkboekjeWizard.afbeeldingen || [];
  return `
    <div class="alert alert-info" style="margin-bottom:12px">
      Upload een syllabus, opdrachtbestand of losse afbeeldingen. De analyse probeert alvast titel, leerdoelen, materiaalstaat, gereedschappen en stappen te vullen.
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Upload bestand(en)</label>
        <input id="wb-upload" type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp">
        <div style="font-size:12px;color:var(--ink-muted);margin-top:5px">PDF/DOCX/TXT voor inhoud. Afbeeldingen kun je later kiezen bij gereedschap en stappen.</div>
      </div>
      <div class="form-field"><label>Titel</label><input id="wb-titel" value="${wbAttr(d.titel)}" placeholder="Bijv. Opdracht vogelhuisje"></div>
      <div class="form-field"><label>Vak / profiel</label><input id="wb-vak" value="${wbAttr(d.vak)}"></div>
      <div class="form-field"><label>Niveau / leerjaar</label><input id="wb-niveau" value="${wbAttr(d.niveau)}"></div>
      <div class="form-field"><label>Profieldeel / module</label><input id="wb-profieldeel" value="${wbAttr(d.profieldeel)}"></div>
      <div class="form-field"><label>Duur</label><input id="wb-duur" value="${wbAttr(d.duur)}" placeholder="Bijv. 6 x 45 minuten"></div>
    </div>
    <div class="form-field">
      <label>Beschrijving / opmerkingen aan AI</label>
      <textarea id="wb-intro" rows="4" placeholder="Bijv. weinig tekst, veel praktijk, vmbo basis, extra duidelijke stappen...">${wbEsc(d.introductie)}</textarea>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="wbAnalyseUpload()">✨ Upload analyseren met AI</button>
      <button class="btn" onclick="wbLeesAlleenAfbeeldingen()">🖼 Alleen afbeeldingen toevoegen</button>
    </div>
    ${imgs.length ? renderWbAfbeeldingenOverzicht() : ''}
  `;
}

function renderWbStapAi() {
  const opts = [
    ['basis', 'Basisgegevens', 'Titel, introductie, niveau, duur en profieldeel aanvullen.'],
    ['leerdoelen', 'Leerdoelen', 'Concrete leerdoelen laten formuleren.'],
    ['materiaalstaat', 'Materiaalstaat', 'Materiaal, aantallen en maten aanvullen.'],
    ['gereedschappen', 'Gereedschappen', 'Gereedschap en machines aanvullen.'],
    ['veiligheid', 'Veiligheid', 'Passende veiligheidsregels toevoegen.'],
    ['stappen_visueel', 'Visuele stappen', 'Korte concrete stappen met fotoplaatsen.'],
    ['differentiatie', 'Extra steun', 'Tips, let-op-blokken en checklists toevoegen.'],
    ['reflectie', 'Reflectievragen', 'Evaluatievragen maken.']
  ];
  return `
    <div class="alert alert-info" style="margin-bottom:12px">
      Je mag meerdere opties aanvinken. Elke optie voegt iets extra’s toe aan het werkboekje.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">
      ${opts.map(([id, t, sub]) => `
        <label style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" class="wb-ai-optie" value="${id}" ${_werkboekjeWizard.aiOpties.includes(id) ? 'checked' : ''}>
          <span><strong>${wbEsc(t)}</strong><br><small style="color:var(--ink-muted)">${wbEsc(sub)}</small></span>
        </label>`).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="wbAiAanvullen('alles')">✨ AI toepassen op aangevinkte opties</button>
      <button class="btn" onclick="wbAiAanvullen('leerdoelen')">✨ Alleen leerdoelen invullen</button>
    </div>
    <div class="form-field" style="margin-top:12px">
      <label>Leerdoelen</label>
      ${renderInputLijst('wb-doel', _werkboekjeWizard.data.leerdoelen)}
    </div>
    <button class="btn" onclick="wbVoegLijstItem('leerdoelen')">+ Leerdoel</button>
  `;
}

function renderWbStapMateriaal() {
  const rows = _werkboekjeWizard.data.materiaalstaat || [];
  return `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
      <h3 style="font-size:15px;margin:0">Materiaalstaat</h3>
      <button class="btn" onclick="wbAiAanvullen('materiaalstaat')">✨ AI materiaal aanvullen</button>
    </div>
    <div style="overflow:auto">
      <table class="data-table">
        <thead><tr><th>Benaming</th><th>Aantal</th><th>Lengte</th><th>Breedte</th><th>Dikte</th><th>Soort</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr>
            <td><input id="wb-mat-ben-${i}" value="${wbAttr(r.benaming || '')}"></td>
            <td><input id="wb-mat-aan-${i}" value="${wbAttr(r.aantal || '')}"></td>
            <td><input id="wb-mat-len-${i}" value="${wbAttr(r.lengte || '')}"></td>
            <td><input id="wb-mat-bre-${i}" value="${wbAttr(r.breedte || '')}"></td>
            <td><input id="wb-mat-dik-${i}" value="${wbAttr(r.dikte || '')}"></td>
            <td><input id="wb-mat-soort-${i}" value="${wbAttr(r.soortMateriaal || r.soortHout || '')}"></td>
            <td><button class="btn btn-sm" onclick="wbVerwijderMateriaal(${i})">×</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn" onclick="wbVoegMateriaal()">+ Materiaalregel</button>
  `;
}

function renderWbStapVeiligheid() {
  const d = _werkboekjeWizard.data;
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn" onclick="wbAiAanvullen('veiligheid_gereedschap')">✨ AI veiligheid/gereedschap aanvullen</button>
    </div>
    <div class="form-grid">
      <div>
        <h3 style="font-size:15px;margin-bottom:8px">Veiligheid</h3>
        ${renderInputLijst('wb-veilig', d.veiligheidsregels)}
        <button class="btn" onclick="wbVoegLijstItem('veiligheidsregels')">+ Veiligheidsregel</button>
      </div>
      <div>
        <h3 style="font-size:15px;margin-bottom:8px">Gereedschappen / machines</h3>
        ${(d.gereedschappen || []).map((g, i) => `
          <div class="card" style="padding:10px;margin-bottom:8px">
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px">
              <input id="wb-tool-naam-${i}" value="${wbAttr(g.naam || '')}" placeholder="Naam">
              <input id="wb-tool-om-${i}" value="${wbAttr(g.omschrijving || '')}" placeholder="Omschrijving">
              <button class="btn btn-sm" onclick="wbVerwijderTool(${i})">×</button>
            </div>
            ${renderAfbeeldingSelect(`wb-tool-img-${i}`, g.afbeelding || '')}
          </div>`).join('')}
        <button class="btn" onclick="wbVoegTool()">+ Gereedschap</button>
      </div>
    </div>
  `;
}

function renderWbStapStappen() {
  const stappen = _werkboekjeWizard.data.stappen || [];
  return `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
      <h3 style="font-size:15px;margin:0">Stappenplan</h3>
      <button class="btn" onclick="wbAiAanvullen('stappen')">✨ AI stappen aanvullen</button>
    </div>
    ${stappen.map((st, i) => `
      <div class="card" style="padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <h3 style="font-size:15px">Stap ${i + 1}</h3>
          <button class="btn btn-sm" onclick="wbVerwijderStap(${i})">Verwijderen</button>
        </div>
        <div class="form-grid">
          <div class="form-field"><label>Titel</label><input id="wb-stap-titel-${i}" value="${wbAttr(st.titel || '')}"></div>
          <div class="form-field"><label>Aantal fotovakken</label><select id="wb-stap-fotos-${i}"><option value="1" ${st.fotos == 1 ? 'selected' : ''}>1</option><option value="2" ${st.fotos == 2 ? 'selected' : ''}>2</option><option value="3" ${st.fotos == 3 ? 'selected' : ''}>3</option></select></div>
        </div>
        <div class="form-field"><label>Beschrijving</label><textarea id="wb-stap-beschrijving-${i}" rows="3">${wbEsc(st.beschrijving || '')}</textarea></div>
        <div class="form-grid">
          <div class="form-field"><label>Tip</label><input id="wb-stap-tip-${i}" value="${wbAttr(st.tip || '')}"></div>
          <div class="form-field"><label>Let op</label><input id="wb-stap-letop-${i}" value="${wbAttr(st.letop || '')}"></div>
        </div>
        <div class="form-field"><label>Benodigdheden (komma gescheiden)</label><input id="wb-stap-ben-${i}" value="${wbAttr((st.benodigdheden || []).join(', '))}"></div>
        <div class="form-field"><label>Checklist (komma gescheiden)</label><input id="wb-stap-check-${i}" value="${wbAttr((st.checklist || []).join(', '))}"></div>
        <div class="form-field"><label>Afbeeldingen bij deze stap</label>${renderMeerdereAfbeeldingSelects(i, st.afbeeldingen || [])}</div>
      </div>`).join('')}
    <button class="btn" onclick="wbVoegStap()">+ Stap toevoegen</button>
  `;
}

function renderWbStapReflectie() {
  return `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
      <h3 style="font-size:15px;margin:0">Reflectievragen</h3>
      <button class="btn" onclick="wbAiAanvullen('reflectie')">✨ AI reflectie aanvullen</button>
    </div>
    ${renderInputLijst('wb-reflectie', _werkboekjeWizard.data.reflectievragen)}
    <button class="btn" onclick="wbVoegLijstItem('reflectievragen')">+ Vraag</button>
  `;
}

async function renderWbStapPreview() {
  wbSlaStapOp();
  _werkboekjeLaatsteHtml = await bouwWerkboekjeHtml(_werkboekjeWizard.data);
  return `
    <div class="alert alert-info" style="margin-bottom:10px">Controleer het voorbeeld. Je kunt terug om alles aan te passen. PDF gebruikt hetzelfde template als hieronder.</div>
    <iframe id="wb-preview-frame" style="width:100%;height:620px;border:1px solid var(--border);border-radius:12px;background:white" srcdoc="${wbAttr(_werkboekjeLaatsteHtml)}"></iframe>
  `;
}

function renderInputLijst(prefix, arr) {
  return (arr || []).map((v, i) => `
    <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:6px">
      <input id="${prefix}-${i}" value="${wbAttr(v || '')}">
      <button class="btn btn-sm" onclick="wbVerwijderLijstItem('${prefix}',${i})">×</button>
    </div>`).join('');
}

function renderWbAfbeeldingenOverzicht() {
  const imgs = _werkboekjeWizard.afbeeldingen || [];
  return `
    <div style="margin-top:12px">
      <strong>Beschikbare afbeeldingen (${imgs.length})</strong>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px">
        ${imgs.map(img => `<div style="border:1px solid var(--border);border-radius:10px;padding:6px;background:white"><img src="${wbAttr(img.url)}" style="width:100%;height:80px;object-fit:cover;border-radius:8px"><div style="font-size:11px;color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${wbEsc(img.naam || 'Afbeelding')}</div></div>`).join('')}
      </div>
    </div>`;
}

function renderAfbeeldingSelect(id, selected) {
  const imgs = _werkboekjeWizard.afbeeldingen || [];
  if (!imgs.length) return `<div style="font-size:12px;color:var(--ink-muted)">Nog geen afbeeldingen beschikbaar. Voeg ze toe in stap 1.</div>`;
  return `<select id="${id}"><option value="">Geen afbeelding</option>${imgs.map(img => `<option value="${wbAttr(img.url)}" ${img.url === selected ? 'selected' : ''}>${wbEsc(img.naam || img.url)}</option>`).join('')}</select>`;
}

function renderMeerdereAfbeeldingSelects(stapIndex, selected) {
  const aantal = Math.max(1, Math.min(3, parseInt((_werkboekjeWizard.data.stappen[stapIndex] || {}).fotos) || 1));
  return Array.from({ length:aantal }, (_, j) => renderAfbeeldingSelect(`wb-stap-img-${stapIndex}-${j}`, selected[j] || '')).join('<div style="height:6px"></div>');
}

function wbSlaStapOp() {
  if (!_werkboekjeWizard) return;
  const d = _werkboekjeWizard.data;
  const q = id => document.getElementById(id);

  if (q('wb-upload')?.files?.length) _werkboekjeWizard.uploads = Array.from(q('wb-upload').files);
  if (q('wb-titel')) d.titel = q('wb-titel').value.trim();
  if (q('wb-vak')) d.vak = q('wb-vak').value.trim();
  if (q('wb-niveau')) d.niveau = q('wb-niveau').value.trim();
  if (q('wb-profieldeel')) d.profieldeel = q('wb-profieldeel').value.trim();
  if (q('wb-duur')) d.duur = q('wb-duur').value.trim();
  if (q('wb-intro')) d.introductie = q('wb-intro').value.trim();

  const checked = Array.from(document.querySelectorAll('.wb-ai-optie:checked')).map(x => x.value);
  if (document.querySelectorAll('.wb-ai-optie').length) _werkboekjeWizard.aiOpties = checked;

  d.leerdoelen = leesInputLijst('wb-doel');
  d.veiligheidsregels = leesInputLijst('wb-veilig');
  d.reflectievragen = leesInputLijst('wb-reflectie');

  if ((d.materiaalstaat || []).length && q('wb-mat-ben-0')) {
    d.materiaalstaat = d.materiaalstaat.map((_, i) => ({
      benaming: q(`wb-mat-ben-${i}`)?.value || '',
      aantal: q(`wb-mat-aan-${i}`)?.value || '',
      lengte: q(`wb-mat-len-${i}`)?.value || '',
      breedte: q(`wb-mat-bre-${i}`)?.value || '',
      dikte: q(`wb-mat-dik-${i}`)?.value || '',
      soortMateriaal: q(`wb-mat-soort-${i}`)?.value || ''
    }));
  }

  if ((d.gereedschappen || []).length && q('wb-tool-naam-0')) {
    d.gereedschappen = d.gereedschappen.map((_, i) => ({
      naam: q(`wb-tool-naam-${i}`)?.value || '',
      omschrijving: q(`wb-tool-om-${i}`)?.value || '',
      afbeelding: q(`wb-tool-img-${i}`)?.value || ''
    }));
  }

  if ((d.stappen || []).length && q('wb-stap-titel-0')) {
    d.stappen = d.stappen.map((st, i) => {
      const fotos = parseInt(q(`wb-stap-fotos-${i}`)?.value || st.fotos || 1);
      const afbeeldingen = Array.from({ length:Math.max(1, Math.min(3, fotos)) }, (_, j) => q(`wb-stap-img-${i}-${j}`)?.value || '').filter(Boolean);
      return {
        titel: q(`wb-stap-titel-${i}`)?.value || '',
        beschrijving: q(`wb-stap-beschrijving-${i}`)?.value || '',
        fotos,
        afbeeldingen,
        tip: q(`wb-stap-tip-${i}`)?.value || '',
        letop: q(`wb-stap-letop-${i}`)?.value || '',
        benodigdheden: splitKomma(q(`wb-stap-ben-${i}`)?.value || ''),
        checklist: splitKomma(q(`wb-stap-check-${i}`)?.value || '')
      };
    });
  }
}

function leesInputLijst(prefix) {
  const els = Array.from(document.querySelectorAll(`[id^="${prefix}-"]`));
  if (!els.length) return undefined;
  return els.map(x => x.value.trim()).filter(Boolean);
}
function splitKomma(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }

async function wbVolgendeStap() { wbSlaStapOp(); _werkboekjeWizard.stap++; await renderWerkboekjeWizard(); }
async function wbVorigeStap() { wbSlaStapOp(); _werkboekjeWizard.stap--; await renderWerkboekjeWizard(); }

async function wbLeesAlleenAfbeeldingen() {
  wbSlaStapOp();
  const result = document.getElementById('wb-result');
  if (!_werkboekjeWizard.uploads.length) { if (result) result.innerHTML = '<span style="color:var(--red)">Kies eerst één of meer afbeeldingen.</span>'; return; }
  await wbUploadBestanden(false);
  await renderWerkboekjeWizard();
}

async function wbAnalyseUpload() {
  wbSlaStapOp();
  const result = document.getElementById('wb-result');
  if (result) result.innerHTML = '<span style="color:var(--amber)">⏳ AI analyseert upload/invoer...</span>';
  try {
    const json = await wbUploadBestanden(true);
    if (json.data) _werkboekjeWizard.data = normaliseerWerkboekjeData(json.data);
    if (Array.isArray(json.afbeeldingen)) wbMergeAfbeeldingen(json.afbeeldingen);
    if (result) result.innerHTML = '<span style="color:var(--accent)">✓ Analyse klaar. Controleer en pas alles aan in de volgende stappen.</span>';
  } catch (e) {
    if (result) result.innerHTML = `<span style="color:var(--red)">Fout: ${wbEsc(e.message)}</span>`;
  }
}

async function wbAiAanvullen(optie) {
  wbSlaStapOp();
  const result = document.getElementById('wb-result');
  if (result) result.innerHTML = '<span style="color:var(--amber)">⏳ AI vult dit onderdeel aan...</span>';
  const oudeData = JSON.parse(JSON.stringify(_werkboekjeWizard.data));
  try {
    const fd = new FormData();
    fd.append('titel', oudeData.titel || '');
    fd.append('vak', oudeData.vak || '');
    fd.append('niveau', oudeData.niveau || '');
    fd.append('opdracht', JSON.stringify(oudeData, null, 2));
    fd.append('aiOpties', JSON.stringify(optie === 'alles' ? (_werkboekjeWizard.aiOpties || []) : [optie]));
    const res = await fetch('/api/werkboekje/analyse', { method:'POST', credentials:'same-origin', body:fd });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'AI aanvullen mislukt');
    _werkboekjeWizard.data = normaliseerWerkboekjeData({ ...oudeData, ...(json.data || {}) });
    if (result) result.innerHTML = '<span style="color:var(--accent)">✓ AI-aanvulling klaar.</span>';
    await renderWerkboekjeWizard();
  } catch (e) {
    if (result) result.innerHTML = `<span style="color:var(--red)">Fout: ${wbEsc(e.message)}</span>`;
  }
}

async function wbUploadBestanden(metAnalyse) {
  const fd = new FormData();
  (_werkboekjeWizard.uploads || []).forEach(f => fd.append('bestanden', f));
  fd.append('titel', _werkboekjeWizard.data.titel || '');
  fd.append('vak', _werkboekjeWizard.data.vak || '');
  fd.append('niveau', _werkboekjeWizard.data.niveau || '');
  fd.append('opdracht', _werkboekjeWizard.data.introductie || '');
  fd.append('aiOpties', JSON.stringify(metAnalyse ? (_werkboekjeWizard.aiOpties || []) : ['alleen_afbeeldingen']));
  const res = await fetch('/api/werkboekje/analyse', { method:'POST', credentials:'same-origin', body:fd });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Upload verwerken mislukt');
  if (Array.isArray(json.afbeeldingen)) wbMergeAfbeeldingen(json.afbeeldingen);
  return json;
}

function wbMergeAfbeeldingen(imgs) {
  const bestaand = new Set((_werkboekjeWizard.afbeeldingen || []).map(x => x.url));
  for (const img of imgs || []) {
    if (!img?.url || bestaand.has(img.url)) continue;
    _werkboekjeWizard.afbeeldingen.push(img);
    bestaand.add(img.url);
  }
}

function normaliseerWerkboekjeData(d) {
  const b = leegWerkboekjeData();
  d = d || {};
  const stappen = Array.isArray(d.stappen) ? d.stappen : (Array.isArray(d.secties)
    ? d.secties.flatMap(s => (s.stappen || []).map(p => ({
        titel: p.titel || s.titel || '',
        beschrijving: p.stap || p.beschrijving || '',
        fotos: p.fotos || (p.heeftAfbeelding ? 1 : 1),
        afbeeldingen: p.afbeeldingen || [],
        tip: p.tip || '',
        letop: p.letop || '',
        benodigdheden: p.benodigdheden || s.benodigdheden || [],
        checklist: p.checklist || []
      })))
    : b.stappen);

  return {
    ...b,
    ...d,
    leerdoelen: Array.isArray(d.leerdoelen) && d.leerdoelen.length ? d.leerdoelen : b.leerdoelen,
    veiligheidsregels: Array.isArray(d.veiligheidsregels) && d.veiligheidsregels.length ? d.veiligheidsregels : b.veiligheidsregels,
    materiaalstaat: Array.isArray(d.materiaalstaat) && d.materiaalstaat.length ? d.materiaalstaat : b.materiaalstaat,
    gereedschappen: Array.isArray(d.gereedschappen) && d.gereedschappen.length ? d.gereedschappen : (Array.isArray(d.machines) ? d.machines.map(x => typeof x === 'string' ? { naam:x, omschrijving:'', afbeelding:'' } : { ...x, afbeelding:x.afbeelding || '' }) : b.gereedschappen),
    stappen: stappen.length ? stappen.map(s => ({ fotos:1, afbeeldingen:[], tip:'', letop:'', benodigdheden:[], checklist:[], ...s })) : b.stappen,
    reflectievragen: Array.isArray(d.reflectievragen) && d.reflectievragen.length ? d.reflectievragen : b.reflectievragen
  };
}

function wbVoegLijstItem(veld) { wbSlaStapOp(); _werkboekjeWizard.data[veld] = _werkboekjeWizard.data[veld] || []; _werkboekjeWizard.data[veld].push(''); renderWerkboekjeWizard(); }
function wbVerwijderLijstItem(prefix, i) { wbSlaStapOp(); const map = { 'wb-doel':'leerdoelen', 'wb-veilig':'veiligheidsregels', 'wb-reflectie':'reflectievragen' }; const veld = map[prefix]; if (veld) { _werkboekjeWizard.data[veld].splice(i, 1); renderWerkboekjeWizard(); } }
function wbVoegMateriaal() { wbSlaStapOp(); _werkboekjeWizard.data.materiaalstaat.push({ benaming:'', aantal:'', lengte:'', breedte:'', dikte:'', soortMateriaal:'' }); renderWerkboekjeWizard(); }
function wbVerwijderMateriaal(i) { wbSlaStapOp(); _werkboekjeWizard.data.materiaalstaat.splice(i, 1); renderWerkboekjeWizard(); }
function wbVoegTool() { wbSlaStapOp(); _werkboekjeWizard.data.gereedschappen.push({ naam:'', omschrijving:'', afbeelding:'' }); renderWerkboekjeWizard(); }
function wbVerwijderTool(i) { wbSlaStapOp(); _werkboekjeWizard.data.gereedschappen.splice(i, 1); renderWerkboekjeWizard(); }
function wbVoegStap() { wbSlaStapOp(); _werkboekjeWizard.data.stappen.push({ titel:'', beschrijving:'', fotos:1, afbeeldingen:[], tip:'', letop:'', benodigdheden:[], checklist:[] }); renderWerkboekjeWizard(); }
function wbVerwijderStap(i) { wbSlaStapOp(); _werkboekjeWizard.data.stappen.splice(i, 1); renderWerkboekjeWizard(); }

async function bouwWerkboekjeHtml(data) {
  const tpl = await laadWerkboekjeTemplate();
  let css = (tpl.match(/<style>[\s\S]*?<\/style>/i) || [''])[0];
  css += `<style>@page{size:A4;margin:0} html,body{width:794px;min-height:1123px;background:#fff!important}.cover{page-break-after:always}.pagina{page-break-inside:auto}.stap,.sectie-header,.mat-tabel,.veilig-kaart,.tool-kaart,.schrijfvak,.succes-banner{break-inside:avoid;page-break-inside:avoid}.jp-no-print{display:none!important}</style>`;
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${wbEsc(data.titel || 'Werkboekje')}</title>${css}</head><body>${maakWerkboekjeBody(data)}</body></html>`;
}

function maakWerkboekjeBody(d) {
  const mat = (d.materiaalstaat || []).filter(r => Object.values(r || {}).some(Boolean));
  const tools = (d.gereedschappen || []).filter(g => g.naam || g.omschrijving || g.afbeelding);
  const stappen = (d.stappen || []).filter(s => s.titel || s.beschrijving);
  return `
    <div class="cover">
      <div class="cover-inner">
        <div class="cover-label">${wbEsc(d.vak || 'Techniek')} ${d.profieldeel ? '· ' + wbEsc(d.profieldeel) : ''}</div>
        <h1>Opdracht<br><span class="accent">${wbEsc(d.titel || 'Titel')}</span></h1>
        <p class="cover-vak">${wbEsc(d.niveau || d.vak || 'Vak / onderdeel')}</p>
        <div class="cover-fields">
          <div class="cover-field"><label>Naam</label><div class="invul-lijn"></div></div>
          <div class="cover-field"><label>Klas</label><div class="invul-lijn"></div></div>
          <div class="cover-field"><label>Datum</label><div class="invul-lijn"></div></div>
          <div class="cover-field"><label>Docent</label><div class="invul-lijn"></div></div>
          <div class="cover-field span2"><label>Duur van de opdracht</label><div class="duur-pill"><span>⏱</span><strong>${wbEsc(d.duur || '__ × 45 minuten')}</strong></div></div>
        </div>
      </div>
    </div>
    <div class="pagina">
      ${d.introductie ? `<div class="blok info"><div class="blok-titel">ℹ️ Opdracht</div>${wbEsc(d.introductie)}</div><hr class="scheidingslijn">` : ''}
      ${d.leerdoelen?.filter(Boolean).length ? `<div class="sectie-header"><div class="sectie-icon">🎯</div><h2>Leerdoelen</h2></div><div class="blok succes"><div class="blok-titel">Na deze opdracht kun je</div><ul>${d.leerdoelen.filter(Boolean).map(x => `<li>${wbEsc(x)}</li>`).join('')}</ul></div><hr class="scheidingslijn">` : ''}
      <div class="sectie-header"><div class="sectie-icon">📋</div><h2>Materiaalstaat</h2></div>
      <table class="mat-tabel"><thead><tr><th>Nr.</th><th>Benaming</th><th>Aantal</th><th>Lengte</th><th>Breedte</th><th>Dikte</th><th>Soort materiaal</th></tr></thead><tbody>${(mat.length ? mat : [{}]).map((r, i) => `<tr><td><span class="nr-cirkel">${i + 1}</span></td><td>${wbEsc(r.benaming || '')}</td><td>${wbEsc(r.aantal || '')}</td><td>${wbEsc(r.lengte || '')}</td><td>${wbEsc(r.breedte || '')}</td><td><span class="dikte-tag">${wbEsc(r.dikte || '__ mm')}</span></td><td class="hout-type">${wbEsc(r.soortMateriaal || r.soortHout || '')}</td></tr>`).join('')}</tbody></table>
      <hr class="scheidingslijn">
      <div class="sectie-header"><div class="sectie-icon">🦺</div><h2>Voorbereiding & veiligheid</h2></div>
      <div class="veilig-raster">${(d.veiligheidsregels || []).map(r => `<div class="veilig-kaart"><div class="veilig-vink"><svg viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2"/></svg></div><p>${wbEsc(r)}</p></div>`).join('')}</div>
      <div class="sectie-header" style="margin-top:32px; border-bottom-color:var(--rand);"><div class="sectie-icon" style="background:var(--middenblauw);">🔧</div><h2 style="font-size:17px;">Gereedschappen</h2></div>
      <div class="tool-raster">${(tools.length ? tools : [{ naam:'Gereedschap', omschrijving:'Omschrijving' }]).map(g => `<div class="tool-kaart">${maakToolFoto(g.afbeelding)}<strong>${wbEsc(g.naam || 'Gereedschap')}</strong><small>${wbEsc(g.omschrijving || '')}</small></div>`).join('')}</div>
      <hr class="scheidingslijn">
      <div class="sectie-header"><div class="sectie-icon">🪵</div><h2>Stappenplan</h2></div>
      <div class="stappen">${stappen.map((s, i) => maakStapHtml(s, i)).join('')}</div>
      <hr class="scheidingslijn">
      <div class="sectie-header"><div class="sectie-icon">✍️</div><h2>Reflectie</h2></div>
      ${(d.reflectievragen || []).map(v => `<div class="schrijfvak"><label>${wbEsc(v)}</label><div class="schrijflijnen"><span class="schrijflijn"></span><span class="schrijflijn"></span><span class="schrijflijn"></span></div></div>`).join('')}
      <div class="succes-banner"><h2>Goed gedaan! 🎉</h2><p>Controleer je eigen werk nog één keer op netheid en kwaliteit voor je inlevert.</p></div>
    </div>`;
}

function maakToolFoto(url) {
  if (url) return `<div class="tool-foto"><img src="${wbAttr(url)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-s)"></div>`;
  return `<div class="tool-foto"><span>Foto hier</span></div>`;
}

function maakStapHtml(s, i) {
  const imgs = Array.isArray(s.afbeeldingen) ? s.afbeeldingen.filter(Boolean) : [];
  const n = Math.max(1, Math.min(3, parseInt(s.fotos) || imgs.length || 1));
  const cls = n === 1 ? 'een' : n === 2 ? 'twee' : 'drie';
  return `<div class="stap"><div class="stap-nummering"><div class="stap-cirkel">${i + 1}</div></div><div class="stap-kaart"><h3>${wbEsc(s.titel || 'Stap titel')}</h3>${s.benodigdheden?.length ? `<div class="benodigd"><div class="benodigd-label">✓ Je hebt nodig:</div><div class="benodigd-items">${s.benodigdheden.map(b => `<span class="benodigd-item">${wbEsc(b)}</span>`).join('')}</div></div>` : ''}<p>${wbEsc(s.beschrijving || 'Beschrijving van de stap.')}</p><div class="foto-rij ${cls}">${Array.from({ length:n }, (_, j) => maakFotoVak(imgs[j], n, j)).join('')}</div>${s.checklist?.length ? `<ul class="checklist">${s.checklist.map(c => `<li><span class="check-vakje"></span>${wbEsc(c)}</li>`).join('')}</ul>` : ''}${s.tip ? `<div class="blok tip"><div class="blok-titel">💡 Tip</div>${wbEsc(s.tip)}</div>` : ''}${s.letop ? `<div class="blok letop"><div class="blok-titel">⚠️ Let op!</div>${wbEsc(s.letop)}</div>` : ''}</div></div>`;
}

function maakFotoVak(url, n, j) {
  if (url) return `<div class="foto-vak ${n === 1 ? 'groot' : ''}"><img src="${wbAttr(url)}" style="width:100%;height:100%;object-fit:cover"><div class="foto-label">Afbeelding ${j + 1}</div></div>`;
  return `<div class="foto-vak ${n === 1 ? 'groot' : ''}"><span>Foto hier plaatsen</span><div class="foto-label">Bijschrift ${j + 1}</div></div>`;
}

async function wbDownloadPdf() {
  wbSlaStapOp();
  _werkboekjeLaatsteHtml = await bouwWerkboekjeHtml(_werkboekjeWizard.data);
  const frame = document.getElementById('wb-preview-frame');
  if (frame) frame.srcdoc = _werkboekjeLaatsteHtml;
  if (!window.html2pdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const doc = frame?.contentDocument;
  const element = doc?.documentElement;
  if (!element) { alert('Voorbeeld niet gevonden.'); return; }
  await html2pdf().set({
    margin: 0,
    filename: `${(_werkboekjeWizard.data.titel || 'werkboekje').replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`,
    image: { type:'jpeg', quality:0.98 },
    html2canvas: { scale:2, useCORS:true, allowTaint:true, backgroundColor:'#ffffff', windowWidth:794, scrollY:0 },
    jsPDF: { unit:'mm', format:'a4', orientation:'portrait', compress:true },
    pagebreak: { mode:['css', 'legacy'], before:'.cover', avoid:['.stap', '.stap-kaart', '.sectie-header', '.tool-kaart', '.veilig-kaart'] }
  }).from(element).save();
}

async function wbDownloadHtml() {
  wbSlaStapOp();
  const html = await bouwWerkboekjeHtml(_werkboekjeWizard.data);
  const blob = new Blob([html], { type:'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(_werkboekjeWizard.data.titel || 'werkboekje').replace(/[^a-zA-Z0-9_-]+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function wbOpslaanHtml() {
  wbSlaStapOp();
  const result = document.getElementById('wb-result');
  if (result) result.innerHTML = '<span style="color:var(--amber)">⏳ Werkboekje wordt opgeslagen...</span>';
  _werkboekjeLaatsteHtml = await bouwWerkboekjeHtml(_werkboekjeWizard.data);
  try {
    const res = await fetch('/api/werkboekje/save-html', {
      method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ html:_werkboekjeLaatsteHtml, titel:_werkboekjeWizard.data.titel, vak:_werkboekjeWizard.data.vak })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Opslaan mislukt');
    _werkboekjeOpgeslagenMateriaalId = json.materiaalId;
    if (result) result.innerHTML = `<span style="color:var(--accent)">✓ Opgeslagen. Bestand: <a href="/uploads/${wbAttr(json.bestandsnaam)}" target="_blank">openen</a></span>`;
    setTimeout(() => { if (typeof closeModalDirect === 'function') closeModalDirect(); resetWerkboekjeWizard(); if (typeof renderToetsen === 'function') renderToetsen(); }, 600);
  } catch (e) {
    if (result) result.innerHTML = `<span style="color:var(--red)">Fout: ${wbEsc(e.message)}</span>`;
  }
}

async function wbAfsluitenZonderOpslaan() {
  if (_werkboekjeOpgeslagenMateriaalId) {
    try { await API.deleteMateriaal(_werkboekjeOpgeslagenMateriaalId); } catch (_) {}
  }
  sluitWerkboekjeWizard();
}
