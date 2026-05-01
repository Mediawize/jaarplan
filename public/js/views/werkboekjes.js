// ============================================================
// public/js/views/werkboekjes.js
// Werkboekje wizard: upload-analyse, AI per stap, afbeeldingen, preview en PDF
// Deze functies overrulen bewust de oude werkboekje-functies uit toetsen.js.
// ============================================================

const WB_LEEG = () => ({
  stap: 1,
  uploadTekst: '',
  uploadBestand: null,
  afbeeldingen: [],
  previewHtml: '',
  data: {
    titel: '',
    vak: '',
    profieldeel: '',
    opdrachtnummer: '1',
    duur: '',
    introductie: '',
    leerdoelen: ['', '', ''],
    veiligheidsregels: [
      'Werkpak en veiligheidsschoenen dragen.',
      'Loshangende kleding vastmaken of niet dragen.',
      'Losse haren in een staart of knot.',
      'Gehoorbescherming dragen bij gebruik van machines.'
    ],
    materiaalstaat: [
      { nummer: 1, benaming: '', aantal: '', lengte: '', breedte: '', dikte: '', soortHout: '' }
    ],
    machines: [
      { naam: '', omschrijving: '', afbeeldingBase64: null }
    ],
    secties: [
      { titel: 'Stappenplan', benodigdheden: [], stappen: [
        { stap: '', tip: '', letop: '', afbeeldingBase64: null, afbeeldingLabel: '' }
      ]}
    ]
  }
});

let _werkboekjeWizard = WB_LEEG();

function wbReset() {
  _werkboekjeWizard = WB_LEEG();
}

async function wbJson(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    const kort = text.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`Server gaf geen JSON terug. Waarschijnlijk klopt de API-route niet of je bent uitgelogd. Antwoord begon met: ${kort}`);
  }
  if (!res.ok) throw new Error(data.error || `Serverfout ${res.status}`);
  return data;
}

async function openWerkboekjeGenerator() {
  wbReset();
  wbRenderStap();
}

function wbClose() {
  wbReset();
  closeModalDirect();
}

function wbProgress() {
  const labels = ['Upload', 'Algemeen', 'Leerdoelen', 'Materiaal', 'Stappen', 'Voorbeeld'];
  return `<div style="display:flex;gap:6px;margin:12px 0 18px;flex-wrap:wrap">${labels.map((l, i) => {
    const nr = i + 1;
    const actief = nr === _werkboekjeWizard.stap;
    const klaar = nr < _werkboekjeWizard.stap;
    return `<span style="font-size:12px;padding:5px 9px;border-radius:999px;border:1px solid ${actief ? 'var(--accent)' : 'var(--border)'};background:${actief ? 'var(--accent-dim)' : klaar ? 'var(--surface-2)' : 'transparent'};color:${actief ? 'var(--accent-text)' : 'var(--ink-muted)'}">${nr}. ${l}</span>`;
  }).join('')}</div>`;
}

function wbRenderStap() {
  const s = _werkboekjeWizard.stap;
  let inhoud = '';

  if (s === 1) inhoud = wbStapUpload();
  if (s === 2) inhoud = wbStapAlgemeen();
  if (s === 3) inhoud = wbStapLeerdoelen();
  if (s === 4) inhoud = wbStapMateriaal();
  if (s === 5) inhoud = wbStapStappen();
  if (s === 6) inhoud = wbStapPreview();

  openModal(`
    <h2>📓 Werkboekje maken</h2>
    <p class="modal-sub">Werk op dezelfde manier als de toets-wizard. Je kunt uploaden, AI per stap gebruiken en alles zelf aanpassen.</p>
    ${wbProgress()}
    <div id="wb-status" style="font-size:13px;margin-bottom:8px"></div>
    ${inhoud}
    <div class="modal-actions">
      ${s === 1 ? `<button class="btn" onclick="wbClose()">Annuleren</button>` : `<button class="btn" onclick="wbVorige()">← Vorige</button>`}
      ${s < 6 ? `<button class="btn btn-primary" onclick="wbVolgende()">Volgende →</button>` : `<button class="btn btn-primary" onclick="wbOpslaan()">Opslaan</button>`}
    </div>
  `);
}

function wbStapUpload() {
  const imgs = _werkboekjeWizard.afbeeldingen || [];
  return `
    <div class="form-field">
      <label>Upload bronbestand of syllabus (optioneel)</label>
      <div class="upload-zone" onclick="document.getElementById('wb-upload-file').click()" id="wb-upload-zone"
           style="padding:22px;text-align:center;border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer">
        <div style="font-size:24px;margin-bottom:6px">📤</div>
        <div style="font-weight:500">Upload PDF of Word-bestand</div>
        <div style="font-size:12px;color:var(--ink-muted)">AI haalt titel, leerdoelen, materialen, gereedschap en stappen eruit.</div>
      </div>
      <input id="wb-upload-file" type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" onchange="wbUploadGekozen(this)">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" onclick="wbAnalyseUpload()">✨ Upload analyseren</button>
      <button class="btn" onclick="wbVolgende()">Overslaan en leeg beginnen</button>
    </div>
    ${_werkboekjeWizard.uploadTekst ? `<div class="alert alert-info">Upload is geanalyseerd. Je kunt alle velden in de volgende stappen nog aanpassen.</div>` : ''}
    ${imgs.length ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:8px">${imgs.length} afbeelding(en) gevonden in de upload. Die kun je kiezen bij gereedschap en stappen.</div>` : ''}
  `;
}

function wbUploadGekozen(input) {
  const file = input.files?.[0];
  if (!file) return;
  _werkboekjeWizard.uploadBestand = file;
  const zone = document.getElementById('wb-upload-zone');
  if (zone) zone.innerHTML = `<div style="font-size:22px">📄</div><div style="font-weight:600;color:var(--accent)">${escHtml(file.name)}</div><div style="font-size:12px;color:var(--ink-muted)">${(file.size/1024/1024).toFixed(2)} MB</div>`;
}

async function wbAnalyseUpload() {
  const status = document.getElementById('wb-status');
  const file = _werkboekjeWizard.uploadBestand || document.getElementById('wb-upload-file')?.files?.[0];
  if (!file) { status.innerHTML = `<span style="color:var(--red)">Kies eerst een bestand of klik op overslaan.</span>`; return; }
  status.innerHTML = `<span style="color:var(--amber)">⏳ Upload wordt geanalyseerd...</span>`;
  try {
    const fd = new FormData();
    fd.append('bestand', file);
    const res = await fetch('/api/analyse-werkboekje-upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const out = await wbJson(res);
    _werkboekjeWizard.uploadTekst = out.tekst || '';
    _werkboekjeWizard.afbeeldingen = out.afbeeldingen || [];
    if (out.data) wbMergeData(out.data);
    _werkboekjeWizard.stap = 2;
    wbRenderStap();
  } catch (e) {
    status.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

function wbStapAlgemeen() {
  const d = _werkboekjeWizard.data;
  return `
    <div class="form-grid">
      <div class="form-field"><label>Vak *</label><input id="wb-vak" value="${escHtml(d.vak)}" placeholder="bijv. PIE of BWI"></div>
      <div class="form-field"><label>Opdrachtnummer</label><input id="wb-opdr" value="${escHtml(d.opdrachtnummer)}"></div>
      <div class="form-field form-full"><label>Titel *</label><input id="wb-titel" value="${escHtml(d.titel)}" placeholder="Titel van de opdracht"></div>
      <div class="form-field"><label>Profieldeel / richting</label><input id="wb-profiel" value="${escHtml(d.profieldeel)}"></div>
      <div class="form-field"><label>Duur</label><input id="wb-duur" value="${escHtml(d.duur)}" placeholder="bijv. 6 × 45 minuten"></div>
      <div class="form-field form-full"><label>Beschrijving / introductie</label><textarea id="wb-intro" rows="3" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm)">${escHtml(d.introductie)}</textarea></div>
    </div>
    <button class="btn" onclick="wbAiStap('algemeen')">✨ AI vul titel, duur en beschrijving aan</button>
  `;
}

function wbStapLeerdoelen() {
  const doelen = _werkboekjeWizard.data.leerdoelen.length ? _werkboekjeWizard.data.leerdoelen : [''];
  return `
    <div class="form-field">
      <label>Leerdoelen</label>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:8px">Laat AI dit invullen of pas ze zelf aan. Gebruik concrete zinnen: De leerling kan...</p>
      ${doelen.map((d, i) => `<input id="wb-doel-${i}" value="${escHtml(d)}" placeholder="De leerling kan ..." style="margin-bottom:6px">`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="wbVoegDoelToe()">+ Leerdoel</button>
      <button class="btn" onclick="wbAiStap('leerdoelen')">✨ Leerdoelen met AI</button>
    </div>
  `;
}

function wbStapMateriaal() {
  const d = _werkboekjeWizard.data;
  return `
    <div class="form-field">
      <label>Materiaalstaat</label>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--surface-2)"><th>Nr</th><th>Benaming</th><th>Aantal</th><th>Lengte</th><th>Breedte</th><th>Dikte</th><th>Soort</th><th></th></tr></thead>
        <tbody>${(d.materiaalstaat || []).map((r,i)=>`
          <tr>
            <td>${i+1}</td>
            <td><input id="wb-mat-ben-${i}" value="${escHtml(r.benaming||'')}"></td>
            <td><input id="wb-mat-aantal-${i}" value="${escHtml(r.aantal||'')}"></td>
            <td><input id="wb-mat-len-${i}" value="${escHtml(r.lengte||'')}"></td>
            <td><input id="wb-mat-br-${i}" value="${escHtml(r.breedte||'')}"></td>
            <td><input id="wb-mat-dik-${i}" value="${escHtml(r.dikte||'')}"></td>
            <td><input id="wb-mat-soort-${i}" value="${escHtml(r.soortHout||'')}"></td>
            <td><button class="btn btn-sm" onclick="wbVerwijderMateriaal(${i})">×</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <button class="btn btn-sm" onclick="wbVoegMateriaalToe()" style="margin-top:8px">+ Materiaal</button>
    </div>

    <div class="form-field">
      <label>Gereedschappen en machines</label>
      ${(d.machines || []).map((m,i)=>`
        <div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px">
          <input id="wb-tool-naam-${i}" value="${escHtml(typeof m === 'string' ? m : (m.naam||''))}" placeholder="Gereedschap of machine" style="margin-bottom:6px">
          <input id="wb-tool-om-${i}" value="${escHtml(m.omschrijving||'')}" placeholder="Korte omschrijving" style="margin-bottom:6px">
          ${wbAfbeeldingKeuze(`wb-tool-img-${i}`, m.afbeeldingBase64)}
          <button class="btn btn-sm" onclick="wbVerwijderTool(${i})">Verwijderen</button>
        </div>`).join('')}
      <button class="btn btn-sm" onclick="wbVoegToolToe()">+ Gereedschap</button>
    </div>

    <div class="form-field">
      <label>Veiligheid</label>
      ${(d.veiligheidsregels || []).map((v,i)=>`<input id="wb-veilig-${i}" value="${escHtml(v)}" style="margin-bottom:6px">`).join('')}
      <button class="btn btn-sm" onclick="wbVoegVeiligheidToe()">+ Veiligheidsregel</button>
    </div>

    <button class="btn" onclick="wbAiStap('materiaal')">✨ Materiaal, gereedschap en veiligheid met AI</button>
  `;
}

function wbStapStappen() {
  const secties = _werkboekjeWizard.data.secties || [];
  return `
    <div class="form-field">
      <label>Stappenplan</label>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:8px">Elke stap kan tekst, tip, let-op en een afbeelding krijgen. Afbeeldingen kun je uploaden of kiezen uit de upload.</p>
      ${secties.map((sec,si)=>`
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">
          <input id="wb-sec-titel-${si}" value="${escHtml(sec.titel||'')}" placeholder="Sectietitel" style="font-weight:600;margin-bottom:8px">
          <input id="wb-sec-ben-${si}" value="${escHtml((sec.benodigdheden||[]).join(', '))}" placeholder="Benodigdheden, gescheiden met komma's" style="margin-bottom:8px">
          ${(sec.stappen||[]).map((st,pi)=>`
            <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
              <label style="font-size:12px;color:var(--ink-muted)">Stap ${pi+1}</label>
              <textarea id="wb-stap-${si}-${pi}" rows="2" maxlength="350" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px">${escHtml(st.stap||'')}</textarea>
              <input id="wb-stap-tip-${si}-${pi}" value="${escHtml(st.tip||'')}" placeholder="Tip (optioneel)" style="margin-bottom:6px">
              <input id="wb-stap-letop-${si}-${pi}" value="${escHtml(st.letop||'')}" placeholder="Let op (optioneel)" style="margin-bottom:6px">
              ${wbAfbeeldingKeuze(`wb-stap-img-${si}-${pi}`, st.afbeeldingBase64)}
              <button class="btn btn-sm" onclick="wbAiStap('stap', ${si}, ${pi})">✨ AI vul deze stap aan</button>
              <button class="btn btn-sm" onclick="wbVerwijderStap(${si},${pi})">Verwijderen</button>
            </div>`).join('')}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <button class="btn btn-sm" onclick="wbVoegStapToe(${si})">+ Stap</button>
            <button class="btn btn-sm" onclick="wbAiStap('stappen', ${si})">✨ Deze sectie met AI</button>
            <button class="btn btn-sm" onclick="wbVerwijderSectie(${si})">Sectie verwijderen</button>
          </div>
        </div>`).join('')}
      <button class="btn" onclick="wbVoegSectieToe()">+ Sectie</button>
    </div>
    <button class="btn" onclick="wbAiStap('stappen')">✨ Volledig stappenplan met AI</button>
  `;
}

function wbAfbeeldingKeuze(id, huidige) {
  const opties = (_werkboekjeWizard.afbeeldingen || []).map((img, i) => `<option value="${i}">${escHtml(img.naam || ('Afbeelding ' + (i+1)))}</option>`).join('');
  return `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0">
      ${huidige ? `<img src="${huidige}" style="width:80px;height:55px;object-fit:cover;border:1px solid var(--border);border-radius:6px">` : `<span style="font-size:12px;color:var(--ink-muted)">Geen afbeelding</span>`}
      <input type="file" accept="image/*" id="${id}-file" style="display:none" onchange="wbUploadAfbeelding('${id}', this)">
      <button type="button" class="btn btn-sm" onclick="document.getElementById('${id}-file').click()">Upload afbeelding</button>
      ${opties ? `<select id="${id}-select" style="max-width:180px"><option value="">Kies uit upload</option>${opties}</select><button type="button" class="btn btn-sm" onclick="wbKiesAfbeelding('${id}')">Kiezen</button>` : ''}
      <input type="hidden" id="${id}" value="${escHtml(huidige || '')}">
    </div>`;
}

function wbStapPreview() {
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn" onclick="wbMaakPreview()">🔄 Voorbeeld vernieuwen</button>
      <button class="btn" onclick="wbDownloadPdf()">⬇ Download PDF</button>
    </div>
    <div id="wb-preview-wrap" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:white;max-height:65vh;overflow-y:auto">
      ${_werkboekjeWizard.previewHtml ? _werkboekjeWizard.previewHtml : `<div style="padding:20px;color:var(--ink-muted)">Klik op voorbeeld vernieuwen.</div>`}
    </div>
  `;
}

function wbSlaStapOp() {
  const s = _werkboekjeWizard.stap;
  const d = _werkboekjeWizard.data;
  if (s === 2) {
    d.vak = document.getElementById('wb-vak')?.value.trim() || '';
    d.opdrachtnummer = document.getElementById('wb-opdr')?.value.trim() || '1';
    d.titel = document.getElementById('wb-titel')?.value.trim() || '';
    d.profieldeel = document.getElementById('wb-profiel')?.value.trim() || '';
    d.duur = document.getElementById('wb-duur')?.value.trim() || '';
    d.introductie = document.getElementById('wb-intro')?.value.trim() || '';
  }
  if (s === 3) {
    d.leerdoelen = (d.leerdoelen || []).map((_,i)=>document.getElementById(`wb-doel-${i}`)?.value.trim() || '').filter(Boolean);
  }
  if (s === 4) {
    d.materiaalstaat = (d.materiaalstaat || []).map((r,i)=>({
      nummer: i + 1,
      benaming: document.getElementById(`wb-mat-ben-${i}`)?.value.trim() || '',
      aantal: document.getElementById(`wb-mat-aantal-${i}`)?.value.trim() || '',
      lengte: document.getElementById(`wb-mat-len-${i}`)?.value.trim() || '',
      breedte: document.getElementById(`wb-mat-br-${i}`)?.value.trim() || '',
      dikte: document.getElementById(`wb-mat-dik-${i}`)?.value.trim() || '',
      soortHout: document.getElementById(`wb-mat-soort-${i}`)?.value.trim() || ''
    })).filter(r=>r.benaming || r.aantal || r.lengte || r.breedte || r.dikte || r.soortHout);
    d.machines = (d.machines || []).map((m,i)=>({
      naam: document.getElementById(`wb-tool-naam-${i}`)?.value.trim() || '',
      omschrijving: document.getElementById(`wb-tool-om-${i}`)?.value.trim() || '',
      afbeeldingBase64: document.getElementById(`wb-tool-img-${i}`)?.value || m.afbeeldingBase64 || null
    })).filter(m=>m.naam || m.omschrijving || m.afbeeldingBase64);
    d.veiligheidsregels = (d.veiligheidsregels || []).map((_,i)=>document.getElementById(`wb-veilig-${i}`)?.value.trim() || '').filter(Boolean);
  }
  if (s === 5) {
    d.secties = (d.secties || []).map((sec,si)=>({
      titel: document.getElementById(`wb-sec-titel-${si}`)?.value.trim() || '',
      benodigdheden: (document.getElementById(`wb-sec-ben-${si}`)?.value || '').split(',').map(x=>x.trim()).filter(Boolean),
      stappen: (sec.stappen || []).map((st,pi)=>({
        stap: document.getElementById(`wb-stap-${si}-${pi}`)?.value.trim() || '',
        tip: document.getElementById(`wb-stap-tip-${si}-${pi}`)?.value.trim() || '',
        letop: document.getElementById(`wb-stap-letop-${si}-${pi}`)?.value.trim() || '',
        afbeeldingBase64: document.getElementById(`wb-stap-img-${si}-${pi}`)?.value || st.afbeeldingBase64 || null,
        afbeeldingLabel: st.afbeeldingLabel || ''
      })).filter(x=>x.stap || x.tip || x.letop || x.afbeeldingBase64)
    })).filter(sec=>sec.titel || sec.stappen.length);
  }
}

function wbVolgende() {
  wbSlaStapOp();
  if (_werkboekjeWizard.stap === 2 && !_werkboekjeWizard.data.titel) { document.getElementById('wb-status').innerHTML = `<span style="color:var(--red)">Titel is verplicht.</span>`; return; }
  if (_werkboekjeWizard.stap < 6) _werkboekjeWizard.stap++;
  wbRenderStap();
  if (_werkboekjeWizard.stap === 6) wbMaakPreview();
}
function wbVorige() { wbSlaStapOp(); if (_werkboekjeWizard.stap > 1) _werkboekjeWizard.stap--; wbRenderStap(); }

function wbMergeData(partial) {
  const d = _werkboekjeWizard.data;
  for (const key of ['titel','vak','profieldeel','opdrachtnummer','duur','introductie']) if (partial[key]) d[key] = partial[key];
  if (Array.isArray(partial.leerdoelen) && partial.leerdoelen.length) d.leerdoelen = partial.leerdoelen;
  if (Array.isArray(partial.veiligheidsregels) && partial.veiligheidsregels.length) d.veiligheidsregels = partial.veiligheidsregels;
  if (Array.isArray(partial.materiaalstaat) && partial.materiaalstaat.length) d.materiaalstaat = partial.materiaalstaat.map((r,i)=>({ nummer:i+1, ...r }));
  if (Array.isArray(partial.machines) && partial.machines.length) d.machines = partial.machines.map(m => typeof m === 'string' ? { naam:m, omschrijving:'', afbeeldingBase64:null } : m);
  if (Array.isArray(partial.secties) && partial.secties.length) d.secties = partial.secties;
}

async function wbAiStap(type, si = null, pi = null) {
  wbSlaStapOp();
  const status = document.getElementById('wb-status');
  status.innerHTML = `<span style="color:var(--amber)">⏳ AI vult ${escHtml(type)} aan...</span>`;
  try {
    const res = await fetch('/api/ai-werkboekje-stap', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sectieIndex: si, stapIndex: pi, data: _werkboekjeWizard.data, uploadTekst: _werkboekjeWizard.uploadTekst })
    });
    const out = await wbJson(res);
    if (out.data) wbMergeData(out.data);
    status.innerHTML = `<span style="color:var(--accent)">✓ AI-aanvulling geplaatst. Controleer en pas aan waar nodig.</span>`;
    wbRenderStap();
  } catch (e) {
    status.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

function wbVoegDoelToe(){ wbSlaStapOp(); _werkboekjeWizard.data.leerdoelen.push(''); wbRenderStap(); }
function wbVoegMateriaalToe(){ wbSlaStapOp(); _werkboekjeWizard.data.materiaalstaat.push({nummer:_werkboekjeWizard.data.materiaalstaat.length+1,benaming:'',aantal:'',lengte:'',breedte:'',dikte:'',soortHout:''}); wbRenderStap(); }
function wbVerwijderMateriaal(i){ wbSlaStapOp(); _werkboekjeWizard.data.materiaalstaat.splice(i,1); wbRenderStap(); }
function wbVoegToolToe(){ wbSlaStapOp(); _werkboekjeWizard.data.machines.push({naam:'',omschrijving:'',afbeeldingBase64:null}); wbRenderStap(); }
function wbVerwijderTool(i){ wbSlaStapOp(); _werkboekjeWizard.data.machines.splice(i,1); wbRenderStap(); }
function wbVoegVeiligheidToe(){ wbSlaStapOp(); _werkboekjeWizard.data.veiligheidsregels.push(''); wbRenderStap(); }
function wbVoegSectieToe(){ wbSlaStapOp(); _werkboekjeWizard.data.secties.push({titel:'', benodigdheden:[], stappen:[{stap:'',tip:'',letop:'',afbeeldingBase64:null}]}); wbRenderStap(); }
function wbVerwijderSectie(si){ wbSlaStapOp(); _werkboekjeWizard.data.secties.splice(si,1); wbRenderStap(); }
function wbVoegStapToe(si){ wbSlaStapOp(); _werkboekjeWizard.data.secties[si].stappen.push({stap:'',tip:'',letop:'',afbeeldingBase64:null}); wbRenderStap(); }
function wbVerwijderStap(si,pi){ wbSlaStapOp(); _werkboekjeWizard.data.secties[si].stappen.splice(pi,1); wbRenderStap(); }

function wbUploadAfbeelding(id, input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById(id).value = e.target.result; wbSlaStapOp(); wbRenderStap(); };
  reader.readAsDataURL(file);
}
function wbKiesAfbeelding(id) {
  const idx = document.getElementById(`${id}-select`)?.value;
  if (idx === '') return;
  const img = _werkboekjeWizard.afbeeldingen[Number(idx)];
  if (!img) return;
  document.getElementById(id).value = img.dataUrl;
  wbSlaStapOp(); wbRenderStap();
}

async function wbMaakPreview() {
  wbSlaStapOp();
  const wrap = document.getElementById('wb-preview-wrap');
  if (wrap) wrap.innerHTML = `<div style="padding:20px;color:var(--ink-muted)">Voorbeeld wordt gemaakt...</div>`;
  try {
    const res = await fetch('/api/werkboekje-preview-html', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_werkboekjeWizard.data)
    });
    const out = await wbJson(res);
    _werkboekjeWizard.previewHtml = out.html || '';
    const w = document.getElementById('wb-preview-wrap');
    if (w) w.innerHTML = _werkboekjeWizard.previewHtml;
  } catch (e) {
    if (wrap) wrap.innerHTML = `<div style="padding:20px;color:var(--red)">Fout: ${escHtml(e.message)}</div>`;
  }
}

async function wbDownloadPdf() {
  if (!_werkboekjeWizard.previewHtml) await wbMaakPreview();
  const element = document.getElementById('wb-preview-wrap');
  if (!element) return;
  if (!window.html2pdf) { alert('PDF-bibliotheek is nog niet geladen. Probeer opnieuw of gebruik Afdrukken > Opslaan als PDF.'); return; }
  const opt = {
    margin: 0,
    filename: `${(_werkboekjeWizard.data.titel || 'werkboekje').replace(/[^a-z0-9_-]+/gi, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  await html2pdf().set(opt).from(element).save();
}

async function wbOpslaan() {
  wbSlaStapOp();
  const status = document.getElementById('wb-status');
  status.innerHTML = `<span style="color:var(--amber)">⏳ Opslaan...</span>`;
  try {
    const res = await fetch('/api/genereer-werkboekje-handmatig', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_werkboekjeWizard.data)
    });
    const out = await wbJson(res);
    status.innerHTML = `<span style="color:var(--accent)">✓ Werkboekje opgeslagen.</span>`;
    setTimeout(() => { closeModalDirect(); if (typeof renderToetsen === 'function') renderToetsen(); }, 900);
  } catch(e) {
    status.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}
