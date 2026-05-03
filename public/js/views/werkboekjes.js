// ============================================================
// public/js/views/werkboekjes.js
// Werkboekje wizard — eigen flow, upload analyse, AI-voorstellen,
// afbeeldingen, preview en PDF via browser print
// ============================================================

let _wbState = null;
let _wbTemplateCss = null;

async function wbLaadTemplateCss() {
  if (_wbTemplateCss !== null) return _wbTemplateCss;
  try {
    const r = await fetch('/templates/werkboekje_template_v2.html');
    const html = await r.text();
    const m = html.match(/<style>([\s\S]*?)<\/style>/);
    _wbTemplateCss = m ? m[1] : '';
  } catch { _wbTemplateCss = ''; }
  return _wbTemplateCss;
}

function wbLegeData() {
  return {
    vak: '', profieldeel: '', opdrachtnummer: '1', niveau: '', duur: '',
    titel: '', introductie: '', opmerkingen: '',
    leerdoelen: ['', '', ''],
    veiligheidsregels: [
      'Werkpak en veiligheidsschoenen dragen.',
      'Loshangende kleding vastmaken of uitdoen.',
      'Losse haren in een staart of knot.',
      'Gehoorbescherming dragen bij gebruik van machines.'
    ],
    materiaalstaat: [
      { nummer: 1, benaming: '', aantal: '', lengte: '', breedte: '', dikte: '', soortHout: '' },
      { nummer: 2, benaming: '', aantal: '', lengte: '', breedte: '', dikte: '', soortHout: '' }
    ],
    machines: [{ naam: '', omschrijving: '', afbeeldingBase64: null }, { naam: '', omschrijving: '', afbeeldingBase64: null }],
    secties: [{ titel: 'Stappenplan', benodigdheden: [], stappen: [
      { stap: '', type: 'foto', tip: '', afbeeldingBase64: null, bijschrift: '' },
      { stap: '', type: 'foto', tip: '', afbeeldingBase64: null, bijschrift: '' },
      { stap: '', type: 'foto', tip: '', afbeeldingBase64: null, bijschrift: '' }
    ]}]
  };
}

function wbReset() {
  _wbState = {
    stap: 1,
    totaal: 6,
    busy: false,
    busyText: '',
    uploadFile: null,
    uploadAnalyse: null,
    aiVoorstellen: {},
    laatsteHtml: '',
    laatsteBestand: null,
    data: wbLegeData()
  };
}

function openWerkboekjeWizard() {
  wbReset();
  wbRender();
}

function wbSetBusy(bezig, tekst) {
  _wbState.busy = !!bezig;
  _wbState.busyText = tekst || '';
  wbRender();
}

function wbDisabledAttr() { return _wbState?.busy ? 'disabled aria-disabled="true"' : ''; }
function wbDisabledStyle() { return _wbState?.busy ? 'opacity:.45;cursor:not-allowed;filter:grayscale(.2);' : ''; }
function wbEsc(v) { return typeof escHtml === 'function' ? escHtml(v ?? '') : String(v ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function wbVal(id) { return document.getElementById(id)?.value?.trim() || ''; }

function wbOpenModal(content) {
  openModal(content);
  const box = document.querySelector('#modal-overlay .modal-box');
  if (box) box.classList.add('werkboekje-modal-box');
  wbAutoResizeTextareas();
}

function wbAutoResizeTextareas() {
  setTimeout(() => {
    document.querySelectorAll('#modal-overlay .werkboekje-modal-box textarea').forEach(t => {
      const resize = () => {
        t.style.height = 'auto';
        t.style.overflowY = 'hidden';
        t.style.height = Math.max(96, t.scrollHeight + 4) + 'px';
      };
      if (!t.dataset.wbAutoresize) {
        t.addEventListener('input', resize);
        t.dataset.wbAutoresize = '1';
      }
      resize();
    });
  }, 30);
}


function wbRender() {
  if (!_wbState) wbReset();
  const s = _wbState.stap;
  const titels = ['Upload', 'Algemeen', 'Leerdoelen', 'Materiaal', 'Veiligheid', 'Stappen & preview'];
  let inhoud = '';

  if (s === 1) inhoud = wbStapUploadHtml();
  if (s === 2) inhoud = wbStapAlgemeenHtml();
  if (s === 3) inhoud = wbStapLeerdoelenHtml();
  if (s === 4) inhoud = wbStapMateriaalHtml();
  if (s === 5) inhoud = wbStapVeiligheidHtml();
  if (s === 6) inhoud = wbStapStappenHtml();

  wbOpenModal(`
    <h2>📓 Werkboekje maken — stap ${s} van ${_wbState.totaal}: ${titels[s - 1]}</h2>
    <div style="margin-bottom:14px">
      <div style="display:flex;gap:4px;margin-bottom:6px">
        ${titels.map((_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i < s ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--ink-muted)">${_wbState.busy ? `⏳ ${wbEsc(_wbState.busyText || 'Bezig...')}` : 'Je kunt alles aanpassen voordat je opslaat.'}</div>
    </div>
    ${inhoud}
    <div id="wb-result" style="margin-top:10px;font-size:13px"></div>
    <div class="modal-actions">
      ${s === 1 ? `<button class="btn" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbAnnuleer()">Annuleren</button>` : `<button class="btn" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVorige()">← Vorige</button>`}
      ${s < _wbState.totaal ? `<button class="btn btn-primary" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVolgende()">Volgende →</button>` : `<button class="btn btn-primary" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbMaakVoorbeeld()">Voorbeeld maken</button>`}
    </div>
  `);
}

function wbAnnuleer() { if (_wbState?.busy) return; closeModalDirect(); wbReset(); }
function wbVorige() { if (_wbState.busy) return; wbSlaStapOp(); _wbState.stap = Math.max(1, _wbState.stap - 1); wbRender(); }
function wbVolgende() { if (_wbState.busy) return; wbSlaStapOp(); const fout = wbValideer(); if (fout) { document.getElementById('wb-result').innerHTML = `<span style="color:var(--red)">${wbEsc(fout)}</span>`; return; } _wbState.stap++; wbRender(); }
function wbValideer() { if (_wbState.stap === 2 && !_wbState.data.titel) return 'Titel is verplicht.'; return null; }

function wbStapUploadHtml() {
  const a = _wbState.uploadAnalyse;
  return `
    <p class="modal-sub">Upload optioneel een Word- of PDF-bestand. De analyse wordt als voorstel getoond. Er wordt niets blind overschreven.</p>
    <div class="form-field">
      <label>Bestand uploaden</label>
      <div class="upload-zone" onclick="if(!_wbState.busy)document.getElementById('wb-upload').click()" id="wb-upload-zone" style="padding:22px;text-align:center;border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer">
        <div style="font-size:24px;margin-bottom:6px">↑</div>
        <div style="font-weight:500">Sleep bestand hierheen of klik</div>
        <div style="font-size:12px;color:var(--ink-muted)">.docx · .pdf · afbeeldingen kunnen later per stap</div>
      </div>
      <input type="file" id="wb-upload" accept=".docx,.doc,.pdf" style="display:none" onchange="wbUploadGekozen(this)">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn btn-primary" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbAnalyseerUpload()">AI analyseer upload</button>
      <button class="btn" style="${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVolgende()">Overslaan</button>
    </div>
    ${a ? `<div class="alert alert-info" style="margin-top:12px">
      <strong>Analyse gevonden:</strong> ${wbEsc(a.titel || 'Werkboekje')}<br>
      <span style="font-size:12px;color:var(--ink-muted)">${(a.leerdoelen||[]).length} leerdoelen · ${(a.materiaalstaat||[]).length} materiaalregels · ${(a.secties||[]).reduce((t,s)=>t+(s.stappen||[]).length,0)} stappen</span>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="wbGebruikUploadAnalyse()">Gebruik analyse als startpunt</button>
        <button class="btn" onclick="wbToonAnalyseVoorstel()">Bekijk voorstel</button>
      </div>
    </div>` : ''}
    <div id="wb-upload-voorstel"></div>
  `;
}

function wbUploadGekozen(input) {
  if (_wbState.busy) return;
  _wbState.uploadFile = input.files?.[0] || null;
  const zone = document.getElementById('wb-upload-zone');
  if (zone && _wbState.uploadFile) zone.innerHTML = `<div style="font-size:22px">📄</div><strong>${wbEsc(_wbState.uploadFile.name)}</strong><div style="font-size:12px;color:var(--ink-muted)">Klik op AI analyseer upload</div>`;
}

async function wbAnalyseerUpload() {
  if (_wbState.busy) return;
  const input = document.getElementById('wb-upload');
  const file = _wbState.uploadFile || input?.files?.[0];
  if (!file) { document.getElementById('wb-result').innerHTML = `<span style="color:var(--red)">Kies eerst een bestand.</span>`; return; }
  _wbState.uploadFile = file;
  wbSetBusy(true, 'AI analyseert upload. Volgende is tijdelijk uitgeschakeld.');
  try {
    const fd = new FormData();
    fd.append('bestand', file);
    const res = await fetch('/api/analyse-werkboekje', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await wbJsonOfThrow(res);
    _wbState.uploadAnalyse = data.data || data;
    wbSetBusy(false, '');
  } catch (e) {
    wbSetBusy(false, '');
    setTimeout(() => { const el = document.getElementById('wb-result'); if (el) el.innerHTML = `<span style="color:var(--red)">Fout: ${wbEsc(e.message)}</span>`; }, 50);
  }
}

function wbGebruikUploadAnalyse() {
  if (!_wbState.uploadAnalyse || _wbState.busy) return;
  _wbState.data = wbNormaliseerData({ ...wbLegeData(), ..._wbState.uploadAnalyse });
  _wbState.stap = 2;
  wbRender();
}

function wbToonAnalyseVoorstel() {
  const el = document.getElementById('wb-upload-voorstel');
  if (!el || !_wbState.uploadAnalyse) return;
  el.innerHTML = `<pre style="white-space:pre-wrap;max-height:240px;overflow:auto;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px">${wbEsc(JSON.stringify(_wbState.uploadAnalyse, null, 2))}</pre>`;
}

function wbStapAlgemeenHtml() {
  const d = _wbState.data;
  return `
    <div class="form-grid">
      <div class="form-field"><label>Vak</label><input id="wb-vak" value="${wbEsc(d.vak)}" placeholder="bijv. PIE"></div>
      <div class="form-field"><label>Niveau</label><input id="wb-niveau" value="${wbEsc(d.niveau)}" placeholder="bijv. vmbo gl / havo 2"></div>
      <div class="form-field"><label>Opdrachtnummer</label><input id="wb-opdrnr" value="${wbEsc(d.opdrachtnummer)}"></div>
      <div class="form-field"><label>Duur</label><input id="wb-duur" value="${wbEsc(d.duur)}" placeholder="bijv. 6 x 45 minuten"></div>
      <div class="form-field form-full"><label>Profieldeel / richting</label><input id="wb-profiel" value="${wbEsc(d.profieldeel)}" placeholder="bijv. Produceren, Installeren en Energie"></div>
      <div class="form-field form-full"><label>Titel opdracht *</label><input id="wb-titel" value="${wbEsc(d.titel)}" placeholder="bijv. Elektronisch dobbelspel"></div>
      <div class="form-field form-full"><label>Beschrijving / introductie</label><textarea id="wb-intro" rows="3" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm)">${wbEsc(d.introductie)}</textarea>
        <button class="btn btn-sm" style="margin-top:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('introductie')">AI voorstel voor beschrijving</button>
        <div id="wb-ai-introductie">${wbVoorstelHtml('introductie')}</div>
      </div>
      <div class="form-field form-full"><label>Opmerkingen / aandachtspunten voor AI</label><textarea id="wb-opmerkingen" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm)" placeholder="Bijv. weinig tekst, veel praktijk, vmbo-leerlingen, stap voor stap uitleg">${wbEsc(d.opmerkingen)}</textarea></div>
    </div>`;
}

function wbStapLeerdoelenHtml() {
  const d = _wbState.data;
  return `
    <div class="form-field">
      <label>Leerdoelen</label>
      ${d.leerdoelen.map((doel, i) => `<div style="display:flex;gap:6px;margin-bottom:6px"><input id="wb-doel-${i}" value="${wbEsc(doel)}" placeholder="De leerling kan ..." style="flex:1"><button onclick="wbVerwijderLeerdoel(${i})" class="btn btn-sm">✕</button></div>`).join('')}
      <button class="btn btn-sm" onclick="wbVoegLeerdoelToe()">+ Leerdoel toevoegen</button>
      <button class="btn btn-sm" style="margin-left:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('leerdoelen')">AI voorstel leerdoelen</button>
      <div id="wb-ai-leerdoelen">${wbVoorstelHtml('leerdoelen')}</div>
    </div>`;
}

function wbStapMateriaalHtml() {
  const d = _wbState.data;
  return `
    <div class="form-field">
      <label>Materiaalstaat</label>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th>Nr</th><th>Benaming</th><th>Aantal</th><th>Lengte</th><th>Breedte</th><th>Dikte</th><th>Materiaal</th><th></th></tr></thead>
        <tbody>${d.materiaalstaat.map((r,i)=>`<tr>
          <td>${i+1}</td><td><input id="wb-mat-ben-${i}" value="${wbEsc(r.benaming)}"></td><td><input id="wb-mat-aan-${i}" value="${wbEsc(r.aantal)}"></td><td><input id="wb-mat-len-${i}" value="${wbEsc(r.lengte)}"></td><td><input id="wb-mat-bre-${i}" value="${wbEsc(r.breedte)}"></td><td><input id="wb-mat-dik-${i}" value="${wbEsc(r.dikte)}"></td><td><input id="wb-mat-soort-${i}" value="${wbEsc(r.soortHout)}"></td><td><button class="btn btn-sm" onclick="wbVerwijderMateriaal(${i})">✕</button></td>
        </tr>`).join('')}</tbody></table></div>
      <button class="btn btn-sm" onclick="wbVoegMateriaalToe()">+ Materiaal</button>
      <button class="btn btn-sm" style="margin-left:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('materiaalstaat')">AI voorstel materiaalstaat</button>
      <div id="wb-ai-materiaalstaat">${wbVoorstelHtml('materiaalstaat')}</div>
    </div>`;
}

function wbStapVeiligheidHtml() {
  const d = _wbState.data;
  return `
    <div class="form-field"><label>Veiligheidsregels</label>
      ${d.veiligheidsregels.map((r,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px"><input id="wb-veil-${i}" value="${wbEsc(r)}" style="flex:1"><button class="btn btn-sm" onclick="wbVerwijderVeiligheid(${i})">✕</button></div>`).join('')}
      <button class="btn btn-sm" onclick="wbVoegVeiligheidToe()">+ Regel</button>
      <button class="btn btn-sm" style="margin-left:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('veiligheid')">AI voorstel veiligheid</button>
      <div id="wb-ai-veiligheid">${wbVoorstelHtml('veiligheid')}</div>
    </div>
    <div class="form-field" style="margin-top:14px"><label>Gereedschappen en machines</label>
      ${d.machines.map((m,i)=>`<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px"><div style="display:flex;gap:6px"><input id="wb-mac-naam-${i}" value="${wbEsc(m.naam || m)}" placeholder="Naam" style="flex:1"><input id="wb-mac-oms-${i}" value="${wbEsc(m.omschrijving||'')}" placeholder="Omschrijving" style="flex:1"><button class="btn btn-sm" onclick="wbVerwijderMachine(${i})">✕</button></div><div style="margin-top:6px"><input type="file" accept="image/*" onchange="wbLaadMachineAfbeelding(${i},this)"> ${m.afbeeldingBase64 ? '<span style="color:var(--accent);font-size:12px">✓ afbeelding geladen</span>' : ''}</div></div>`).join('')}
      <button class="btn btn-sm" onclick="wbVoegMachineToe()">+ Gereedschap</button>
      <button class="btn btn-sm" style="margin-left:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('machines')">AI voorstel gereedschap</button>
      <div id="wb-ai-machines">${wbVoorstelHtml('machines')}</div>
    </div>`;
}

function wbStapStappenHtml() {
  const d = _wbState.data;
  return d.secties.map((sec, si)=>`
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px"><strong>Onderdeel ${si+1}</strong>${d.secties.length>1?`<button class="btn btn-sm" onclick="wbVerwijderSectie(${si})">Verwijderen</button>`:''}</div>
      <div class="form-field"><label>Titel onderdeel</label><input id="wb-sec-titel-${si}" value="${wbEsc(sec.titel)}"></div>
      <div class="form-field"><label>Benodigdheden (komma gescheiden)</label><input id="wb-sec-ben-${si}" value="${wbEsc((sec.benodigdheden||[]).join(', '))}"></div>
      ${(sec.stappen||[]).map((st,pi)=>{
        const type = st.type||'foto';
        const isTekening = type === 'tekening';
        const isUpload = type === 'tekening-upload';
        const isSpeciaal = isTekening || isUpload;
        return `<div style="border:1px solid ${isSpeciaal?'var(--amber)':'var(--border)'};border-radius:8px;padding:8px;margin-bottom:8px;background:${isSpeciaal?'var(--amber-dim, #fffbf0)':'var(--surface)'}">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <strong style="color:var(--accent)">Stap ${pi+1}</strong>
          <select id="wb-stap-type-${si}-${pi}" onchange="wbSlaStapOp();wbRender()">
            <option value="foto" ${type==='foto'?'selected':''}>📷 Foto + tekst</option>
            <option value="tekening" ${isTekening?'selected':''}>📐 Tekenvak (hele pagina)</option>
            <option value="tekening-upload" ${isUpload?'selected':''}>🖼️ Tekening uploaden (hele pagina)</option>
          </select>
          <button class="btn btn-sm" style="margin-left:auto" onclick="wbVerwijderStap(${si},${pi})">✕</button>
        </div>
        ${isTekening
          ? `<div style="background:white;border:1.5px dashed var(--amber,#f59f00);border-radius:6px;padding:12px;text-align:center;color:var(--ink-muted);font-size:12px;margin-bottom:6px">
               📐 <strong>Tekenvak (ruitjes, A4-liggend, hele pagina)</strong> — leerling tekent hier zelf
             </div>
             <input id="wb-stap-tekst-${si}-${pi}" value="${wbEsc(st.stap)}" maxlength="200"
               placeholder="Opdracht boven de tekenpagina (optioneel)"
               style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px">`
          : isUpload
          ? `<div style="background:white;border:1.5px dashed var(--amber,#f59f00);border-radius:6px;padding:12px;text-align:center;color:var(--ink-muted);font-size:12px;margin-bottom:6px">
               🖼️ <strong>Geüploade tekening (hele pagina)</strong> — vult de volledige pagina
             </div>
             <input id="wb-stap-tekst-${si}-${pi}" value="${wbEsc(st.stap)}" maxlength="200"
               placeholder="Opdracht boven de afbeelding (optioneel)"
               style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;margin-bottom:6px">
             <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <input type="file" accept="image/*" onchange="wbLaadStapAfbeelding(${si},${pi},this)">
               ${st.afbeeldingBase64?'<span style="color:var(--accent);font-size:12px">✓ afbeelding geladen</span>':''}
             </div>`
          : `<textarea id="wb-stap-tekst-${si}-${pi}" maxlength="500" rows="3"
               style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm)"
               placeholder="Beschrijf de stap concreet">${wbEsc(st.stap)}</textarea>
             <input id="wb-stap-tip-${si}-${pi}" value="${wbEsc(st.tip)}" placeholder="Tip of let-op tekst" style="margin-top:6px;width:100%">
             <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <input type="file" accept="image/*" onchange="wbLaadStapAfbeelding(${si},${pi},this)">
               ${st.afbeeldingBase64?'<span style="color:var(--accent);font-size:12px">✓ afbeelding geladen</span>':''}
               <input id="wb-stap-bijschrift-${si}-${pi}" value="${wbEsc(st.bijschrift)}" placeholder="Bijschrift" style="flex:1;min-width:160px">
             </div>`
        }
        ${type==='foto'?`<button class="btn btn-sm" style="margin-top:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('stap:${si}:${pi}')">AI verbeter deze stap</button>`:''}
        <div id="wb-ai-stap-${si}-${pi}">${wbVoorstelHtml(`stap:${si}:${pi}`)}</div>
      </div>`;}).join('')}
      <button class="btn btn-sm" onclick="wbVoegStapToe(${si})">+ Stap</button>
      <button class="btn btn-sm" style="margin-left:6px;${wbDisabledStyle()}" ${wbDisabledAttr()} onclick="wbVraagAiSuggestie('sectie:${si}')">AI voorstel stappen voor dit onderdeel</button>
      <div id="wb-ai-sectie-${si}">${wbVoorstelHtml(`sectie:${si}`)}</div>
    </div>`).join('') + `<button class="btn btn-sm" onclick="wbVoegSectieToe()">+ Onderdeel toevoegen</button>`;
}

function wbSlaStapOp() {
  const d = _wbState.data;
  if (_wbState.stap === 2) {
    d.vak = wbVal('wb-vak'); d.niveau = wbVal('wb-niveau'); d.opdrachtnummer = wbVal('wb-opdrnr') || '1'; d.duur = wbVal('wb-duur'); d.profieldeel = wbVal('wb-profiel'); d.titel = wbVal('wb-titel'); d.introductie = wbVal('wb-intro'); d.opmerkingen = wbVal('wb-opmerkingen');
  } else if (_wbState.stap === 3) {
    d.leerdoelen = d.leerdoelen.map((_,i)=>wbVal(`wb-doel-${i}`)).filter(Boolean);
  } else if (_wbState.stap === 4) {
    d.materiaalstaat = d.materiaalstaat.map((r,i)=>({ nummer:i+1, benaming:wbVal(`wb-mat-ben-${i}`), aantal:wbVal(`wb-mat-aan-${i}`), lengte:wbVal(`wb-mat-len-${i}`), breedte:wbVal(`wb-mat-bre-${i}`), dikte:wbVal(`wb-mat-dik-${i}`), soortHout:wbVal(`wb-mat-soort-${i}`)})).filter(r=>r.benaming||r.aantal||r.lengte||r.breedte||r.dikte||r.soortHout);
  } else if (_wbState.stap === 5) {
    d.veiligheidsregels = d.veiligheidsregels.map((_,i)=>wbVal(`wb-veil-${i}`)).filter(Boolean);
    d.machines = d.machines.map((m,i)=>({ naam:wbVal(`wb-mac-naam-${i}`), omschrijving:wbVal(`wb-mac-oms-${i}`), afbeeldingBase64:m.afbeeldingBase64||null })).filter(m=>m.naam||m.omschrijving||m.afbeeldingBase64);
  } else if (_wbState.stap === 6) {
    d.secties = d.secties.map((sec,si)=>({ titel:wbVal(`wb-sec-titel-${si}`), benodigdheden:(document.getElementById(`wb-sec-ben-${si}`)?.value||'').split(',').map(x=>x.trim()).filter(Boolean), stappen:(sec.stappen||[]).map((st,pi)=>({ stap:wbVal(`wb-stap-tekst-${si}-${pi}`), type:document.getElementById(`wb-stap-type-${si}-${pi}`)?.value||'foto', tip:wbVal(`wb-stap-tip-${si}-${pi}`), afbeeldingBase64:st.afbeeldingBase64||null, bijschrift:wbVal(`wb-stap-bijschrift-${si}-${pi}`)})).filter(st=>st.type==='tekening'||st.type==='tekening-upload'||st.stap||st.afbeeldingBase64) })).filter(sec=>sec.titel || sec.stappen.length);
  }
}

function wbNormaliseerData(data) {
  data.leerdoelen = Array.isArray(data.leerdoelen) ? data.leerdoelen.filter(Boolean) : [];
  if (!data.leerdoelen.length) data.leerdoelen = ['', '', ''];
  data.materiaalstaat = Array.isArray(data.materiaalstaat) ? data.materiaalstaat.map((r,i)=>({ nummer:i+1, benaming:r.benaming||r.naam||'', aantal:r.aantal||'', lengte:r.lengte||'', breedte:r.breedte||'', dikte:r.dikte||'', soortHout:r.soortHout||r.materiaal||'' })) : [];
  data.machines = Array.isArray(data.machines) ? data.machines.map(m => typeof m === 'string' ? { naam:m, omschrijving:'', afbeeldingBase64:null } : { naam:m.naam||'', omschrijving:m.omschrijving||'', afbeeldingBase64:m.afbeeldingBase64||null }) : [];
  data.secties = Array.isArray(data.secties) && data.secties.length ? data.secties.map(s=>({ titel:s.titel||'Stappenplan', benodigdheden:Array.isArray(s.benodigdheden)?s.benodigdheden:[], stappen:Array.isArray(s.stappen)?s.stappen.map(st=>({ stap:st.stap||st.tekst||'', type:st.type||'foto', tip:st.tip||'', afbeeldingBase64:st.afbeeldingBase64||null, bijschrift:st.bijschrift||'' })):[] })) : wbLegeData().secties;
  return data;
}

function wbVoegLeerdoelToe(){ wbSlaStapOp(); _wbState.data.leerdoelen.push(''); wbRender(); }
function wbVerwijderLeerdoel(i){ wbSlaStapOp(); _wbState.data.leerdoelen.splice(i,1); wbRender(); }
function wbVoegMateriaalToe(){ wbSlaStapOp(); _wbState.data.materiaalstaat.push({nummer:_wbState.data.materiaalstaat.length+1,benaming:'',aantal:'',lengte:'',breedte:'',dikte:'',soortHout:''}); wbRender(); }
function wbVerwijderMateriaal(i){ wbSlaStapOp(); _wbState.data.materiaalstaat.splice(i,1); wbRender(); }
function wbVoegVeiligheidToe(){ wbSlaStapOp(); _wbState.data.veiligheidsregels.push(''); wbRender(); }
function wbVerwijderVeiligheid(i){ wbSlaStapOp(); _wbState.data.veiligheidsregels.splice(i,1); wbRender(); }
function wbVoegMachineToe(){ wbSlaStapOp(); _wbState.data.machines.push({naam:'',omschrijving:'',afbeeldingBase64:null}); wbRender(); }
function wbVerwijderMachine(i){ wbSlaStapOp(); _wbState.data.machines.splice(i,1); wbRender(); }
function wbVoegSectieToe(){ wbSlaStapOp(); _wbState.data.secties.push({titel:'',benodigdheden:[],stappen:[{stap:'',type:'foto',tip:'',afbeeldingBase64:null,bijschrift:''}]}); wbRender(); }
function wbVerwijderSectie(i){ wbSlaStapOp(); _wbState.data.secties.splice(i,1); wbRender(); }
function wbVoegStapToe(si){ wbSlaStapOp(); _wbState.data.secties[si].stappen.push({stap:'',type:'foto',tip:'',afbeeldingBase64:null,bijschrift:''}); wbRender(); }
function wbVerwijderStap(si,pi){ wbSlaStapOp(); _wbState.data.secties[si].stappen.splice(pi,1); wbRender(); }

function wbLaadStapAfbeelding(si, pi, input) { wbLaadAfbeelding(input, src => { wbSlaStapOp(); _wbState.data.secties[si].stappen[pi].afbeeldingBase64 = src; wbRender(); }); }
function wbLaadMachineAfbeelding(i, input) { wbLaadAfbeelding(input, src => { wbSlaStapOp(); _wbState.data.machines[i].afbeeldingBase64 = src; wbRender(); }); }
function wbLaadAfbeelding(input, cb) { const file = input.files?.[0]; if (!file) return; if (file.size > 6*1024*1024) { alert('Afbeelding is te groot. Max 6 MB.'); return; } const r = new FileReader(); r.onload = e => cb(e.target.result); r.readAsDataURL(file); }

async function wbVraagAiSuggestie(stapId) {
  if (_wbState.busy) return;
  wbSlaStapOp();
  wbSetBusy(true, 'AI maakt een voorstel. Je huidige tekst blijft staan.');
  try {
    const d = _wbState.data;
    const basis = `Werkboekje: "${d.titel||'onbekend'}" | Vak: ${d.vak||'techniek'} | Niveau: ${d.niveau||''} | Wat wordt er gemaakt: ${d.introductie||d.titel||''}`;

    let userPrompt = '';

    if (stapId === 'leerdoelen') {
      userPrompt = `${basis}
Al ingevulde leerdoelen: ${(d.leerdoelen||[]).filter(Boolean).join('; ') || 'nog geen'}
Maak 3-4 concrete leerdoelen die passen bij dit onderwerp en wat er gemaakt wordt. JSON: {"leerdoelen":["..."]}`;
    }
    else if (stapId === 'introductie') {
      userPrompt = `${basis}
Al ingevulde introductie: "${d.introductie||''}"
Verbeter of schrijf een korte leerlinggerichte introductie die uitlegt wat er gemaakt wordt en waarom. JSON: {"introductie":"..."}`;
    }
    else if (stapId === 'materiaalstaat') {
      const bestaand = (d.materiaalstaat||[]).filter(r=>r.benaming).map(r=>r.benaming).join(', ');
      userPrompt = `${basis}
Al ingevuld materiaal: ${bestaand||'nog geen'}
Maak een passende materiaalstaat voor dit product. JSON: {"materiaalstaat":[{"benaming":"","aantal":"","lengte":"","breedte":"","dikte":"","soortHout":""}]}`;
    }
    else if (stapId === 'veiligheid') {
      const machines = (d.machines||[]).filter(m=>m.naam).map(m=>m.naam).join(', ');
      userPrompt = `${basis}
Gebruikte gereedschappen/machines: ${machines||'onbekend'}
Maak passende veiligheidsregels voor dit werkboekje. JSON: {"veiligheidsregels":["..."]}`;
    }
    else if (stapId === 'machines') {
      userPrompt = `${basis}
Al ingevulde stappen: ${(d.secties||[]).flatMap(s=>s.stappen||[]).map(s=>s.stap).filter(Boolean).join('; ')||'nog geen'}
Welke gereedschappen en machines zijn nodig voor dit product? JSON: {"machines":[{"naam":"","omschrijving":""}]}`;
    }
    else if (stapId.startsWith('stap:')) {
      const [,si,pi] = stapId.split(':').map((x,i)=>i?Number(x):x);
      const sec = d.secties?.[si];
      const st = sec?.stappen?.[pi];
      const anderStappen = (sec?.stappen||[]).filter((_,i)=>i!==pi).map(s=>s.stap).filter(Boolean).join('; ');
      userPrompt = `${basis}
Onderdeel: "${sec?.titel||''}"
Huidige staptekst: "${st?.stap||''}"
Andere stappen in dit onderdeel: ${anderStappen||'geen'}
Verbeter de staptekst zodat die concreet en leerlinggericht is. Geef eventueel een tip. JSON: {"stap":"...","tip":"..."}`;
    }
    else if (stapId.startsWith('sectie:')) {
      const si = Number(stapId.split(':')[1]);
      const sec = d.secties?.[si];
      const andereSecs = (d.secties||[]).filter((_,i)=>i!==si).map(s=>s.titel).filter(Boolean).join(', ');
      userPrompt = `${basis}
Dit onderdeel: "${sec?.titel||''}"
Andere onderdelen in het werkboekje: ${andereSecs||'geen'}
Al ingevulde stappen: ${(sec?.stappen||[]).map(s=>s.stap).filter(Boolean).join('; ')||'nog geen'}
Maak concrete stappen voor dit onderdeel die logisch aansluiten op het geheel. JSON: {"stappen":[{"stap":"...","tip":""}]}`;
    }
    else {
      userPrompt = `${basis}\nMaak een praktisch voorstel voor dit onderdeel. Geef alleen JSON terug.`;
    }

    const context = { stapId, data: d };
    const res = await fetch('/api/ai/wizard-stap', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'werkboekje', stapId, systeemPrompt:'Je helpt een docent techniek met het invullen van een werkboekje. Schrijf kort, praktisch en leerlinggericht in het Nederlands. Geef ALLEEN geldige JSON terug, geen uitleg erbuiten.', userPrompt, context }) });
    const data = await wbJsonOfThrow(res);
    _wbState.aiVoorstellen[stapId] = data.suggestie || data;
    wbSetBusy(false, '');
  } catch (e) {
    wbSetBusy(false, '');
    setTimeout(()=>{ const el=document.getElementById('wb-result'); if(el) el.innerHTML=`<span style="color:var(--red)">AI fout: ${wbEsc(e.message)}</span>`; },50);
  }
}

function wbVoorstelHtml(stapId) {
  const v = _wbState.aiVoorstellen[stapId];
  if (!v) return '';
  return `<div style="margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2)"><div style="font-weight:600;margin-bottom:6px">AI voorstel</div><pre style="white-space:pre-wrap;font-size:12px;margin:0;max-height:160px;overflow:auto">${wbEsc(JSON.stringify(v,null,2))}</pre><button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="wbGebruikAiVoorstel('${stapId}')">Gebruik dit voorstel</button></div>`;
}

function wbGebruikAiVoorstel(stapId) {
  wbSlaStapOp();
  const v = _wbState.aiVoorstellen[stapId];
  if (!v) return;
  const d = _wbState.data;
  if (stapId === 'leerdoelen' && Array.isArray(v.leerdoelen)) d.leerdoelen = v.leerdoelen;
  else if (stapId === 'introductie' && v.introductie) d.introductie = v.introductie;
  else if (stapId === 'materiaalstaat' && Array.isArray(v.materiaalstaat)) d.materiaalstaat = v.materiaalstaat.map((r,i)=>({nummer:i+1,...r}));
  else if (stapId === 'veiligheid' && Array.isArray(v.veiligheidsregels)) d.veiligheidsregels = v.veiligheidsregels;
  else if (stapId === 'machines' && Array.isArray(v.machines)) d.machines = v.machines.map(m=>typeof m==='string'?{naam:m,omschrijving:'',afbeeldingBase64:null}:{...m,afbeeldingBase64:null});
  else if (stapId.startsWith('stap:')) { const [,si,pi]=stapId.split(':').map((x,i)=>i?Number(x):x); if (d.secties[si]?.stappen?.[pi]) { if (v.stap) d.secties[si].stappen[pi].stap = v.stap; if (v.tip) d.secties[si].stappen[pi].tip = v.tip; } }
  else if (stapId.startsWith('sectie:')) { const si=Number(stapId.split(':')[1]); if (d.secties[si] && Array.isArray(v.stappen)) d.secties[si].stappen = v.stappen.map(st=>({stap:st.stap||'',tip:st.tip||'',type:'foto',afbeeldingBase64:null,bijschrift:''})); }
  delete _wbState.aiVoorstellen[stapId];
  wbRender();
}

async function wbMaakVoorbeeld() {
  if (_wbState.busy) return;
  wbSlaStapOp();
  _wbState.laatsteHtml = await wbBouwHtml(_wbState.data);
  wbOpenModal(`
    <h2>Voorbeeld werkboekje</h2>
    <p class="modal-sub">Controleer het voorbeeld. Je kunt terug om aan te passen. Opslaan maakt het bestand aan; PDF gebruikt dezelfde volledige layout.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn" onclick="wbRender()">← Terug aanpassen</button>
      <button class="btn btn-primary" onclick="wbOpslaan()">Opslaan als materiaal</button>
      <button class="btn" onclick="wbDownloadPdf()">Download PDF</button>
      <button class="btn" onclick="wbAnnuleer()">Afsluiten zonder opslaan</button>
    </div>
    <iframe id="wb-preview-frame" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px;background:white"></iframe>
    <div id="wb-save-result" style="margin-top:10px;font-size:13px"></div>
  `);
  setTimeout(()=>{ const f=document.getElementById('wb-preview-frame'); if(f) f.srcdoc=_wbState.laatsteHtml; },50);
}

async function wbOpslaan() {
  if (_wbState.busy) return;
  const result = document.getElementById('wb-save-result');
  if (result) result.innerHTML = `<span style="color:var(--amber)">⏳ Werkboekje wordt opgeslagen...</span>`;
  _wbState.busy = true;
  try {
    const res = await fetch('/api/genereer-werkboekje-handmatig', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(_wbState.data) });
    const data = await wbJsonOfThrow(res);
    _wbState.laatsteBestand = data.bestandsnaam;
    _wbState.busy = false;
    if (result) result.innerHTML = `<div class="alert alert-info">Klaar: <strong>${wbEsc(data.titel)}</strong><br><a href="/uploads/${wbEsc(data.bestandsnaam)}" download="${wbEsc(data.bestandsnaam)}" style="color:var(--accent);font-weight:600">Download Word-bestand</a> · <a href="#" onclick="wbDownloadPdf();return false" style="color:var(--accent);font-weight:600">Download PDF</a></div>`;
  } catch(e) { _wbState.busy=false; if(result) result.innerHTML=`<span style="color:var(--red)">Fout: ${wbEsc(e.message)}</span>`; }
}

async function wbDownloadPdf() {
  const html = _wbState?.laatsteHtml || await wbBouwHtml(_wbState.data);
  const w = window.open('', '_blank');
  if (!w) { alert('Popup geblokkeerd. Sta popups toe om PDF te maken.'); return; }
  w.document.open();
  w.document.write(html + `<script>window.onload=function(){setTimeout(function(){window.print();},300)}<\/script>`);
  w.document.close();
}

async function wbJsonOfThrow(res) {
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { throw new Error('Server gaf geen JSON terug. Waarschijnlijk raakt de API-route niet goed: ' + txt.slice(0,80)); }
  if (!res.ok || data.error) throw new Error(data.error || 'Onbekende fout');
  return data;
}

async function wbBouwHtml(data) {
  const d = wbNormaliseerData(JSON.parse(JSON.stringify(data || wbLegeData())));
  const css = await wbLaadTemplateCss();

  // ── Cover ──
  const cover = `<div class="cover"><div class="cover-inner">
    <div class="cover-label">${wbEsc(d.vak||'Techniek')} · ${wbEsc(d.profieldeel||'Praktijkopdracht')}</div>
    <h1>Opdracht<br><span class="accent">${wbEsc(d.titel||'Werkboekje')}</span></h1>
    <p class="cover-vak">${wbEsc(d.niveau||'')}${d.duur?' · '+wbEsc(d.duur):''}</p>
    <div class="cover-fields">
      <div class="cover-field"><label>Naam</label><div class="invul-lijn"></div></div>
      <div class="cover-field"><label>Klas</label><div class="invul-lijn"></div></div>
      <div class="cover-field"><label>Datum</label><div class="invul-lijn"></div></div>
      <div class="cover-field"><label>Docent</label><div class="invul-lijn"></div></div>
      <div class="cover-field span2"><label>Duur van de opdracht</label>
        <div class="duur-pill"><span>⏱</span><strong>${wbEsc(d.duur||'__ × 45 minuten')}</strong></div>
      </div>
    </div>
  </div></div>`;

  const secties = [];

  // ── Leerdoelen (alleen als er data is) ──
  const doelen = (d.leerdoelen||[]).filter(Boolean);
  if (d.introductie || doelen.length) {
    secties.push(`
      <div class="sectie-header"><div class="sectie-icon">🎯</div><h2>Leerdoelen</h2></div>
      ${d.introductie ? `<p style="margin-bottom:16px;font-size:14px;color:var(--tekst-zacht)">${wbEsc(d.introductie)}</p>` : ''}
      ${doelen.length ? `<ul class="checklist">${doelen.map(x=>`<li><span class="check-vakje"></span>${wbEsc(x)}</li>`).join('')}</ul>` : ''}
      <hr class="scheidingslijn">`);
  }

  // ── Materiaalstaat (alleen als er rijen met benaming zijn) ──
  const mat = (d.materiaalstaat||[]).filter(r=>r.benaming);
  if (mat.length) {
    secties.push(`
      <div class="sectie-header"><div class="sectie-icon">📋</div><h2>Materiaalstaat</h2></div>
      <table class="mat-tabel">
        <thead><tr><th>Nr.</th><th>Benaming</th><th>Aantal</th><th>Lengte</th><th>Breedte</th><th>Dikte</th><th>Soort materiaal</th></tr></thead>
        <tbody>${mat.map((r,i)=>`<tr>
          <td><span class="nr-cirkel">${i+1}</span></td>
          <td>${wbEsc(r.benaming)}</td>
          <td>${wbEsc(r.aantal||'')}</td>
          <td>${wbEsc(r.lengte||'')}</td>
          <td>${wbEsc(r.breedte||'')}</td>
          <td>${r.dikte?`<span class="dikte-tag">${wbEsc(r.dikte)} mm</span>`:''}</td>
          <td class="hout-type">${wbEsc(r.soortHout||'')}</td>
        </tr>`).join('')}</tbody>
      </table>
      <hr class="scheidingslijn">`);
  }

  // ── Veiligheid & Gereedschappen (alleen als er data is) ──
  const veilig = (d.veiligheidsregels||[]).filter(Boolean);
  const machines = (d.machines||[]).filter(m=>m.naam||m.omschrijving||m.afbeeldingBase64);
  if (veilig.length || machines.length) {
    secties.push(`
      ${veilig.length ? `
        <div class="sectie-header"><div class="sectie-icon">🦺</div><h2>Voorbereiding &amp; veiligheid</h2></div>
        <div class="veilig-raster">${veilig.map(r=>`
          <div class="veilig-kaart">
            <div class="veilig-vink"><svg viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2"/></svg></div>
            <p>${wbEsc(r)}</p>
          </div>`).join('')}
        </div>` : ''}
      ${machines.length ? `
        <div class="sectie-header" style="margin-top:${veilig.length?'32px':'0'};border-bottom-color:var(--rand)">
          <div class="sectie-icon" style="background:var(--middenblauw)">🔧</div>
          <h2 style="font-size:17px">Gereedschappen</h2>
        </div>
        <div class="tool-raster">${machines.map(m=>`
          <div class="tool-kaart">
            <div class="tool-foto">${m.afbeeldingBase64?`<img src="${m.afbeeldingBase64}" style="width:100%;height:100%;object-fit:cover">`:'<span>Foto hier</span>'}</div>
            <strong>${wbEsc(m.naam||'')}</strong>
            <small>${wbEsc(m.omschrijving||'')}</small>
          </div>`).join('')}
        </div>` : ''}
      <hr class="scheidingslijn">`);
  }

  // ── Stappenplan ──
  let stapNr = 0;
  const stapHtml = (d.secties||[]).filter(s=>s.stappen&&s.stappen.length).flatMap(sec =>
    sec.stappen.map(st => {
      stapNr++;
      if ((st.type||'foto') === 'tekening') {
        return `<div style="page-break-before:always;break-before:page;padding:14mm;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div class="stap-cirkel">${stapNr}</div>
            <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--donkerblauw)">${wbEsc(sec.titel||'Tekening')} ${stapNr}</h3>
          </div>
          ${st.stap?`<p style="font-size:15px;color:var(--tekst-zacht);margin:0 0 14px">${wbEsc(st.stap)}</p>`:''}
          <div class="tekenvak-wrapper" style="flex:1;display:flex;flex-direction:column">
            <div class="tekenvak ruitjes heeft-titelbalk" style="flex:1;min-height:180mm">
              <div class="tekenvak-titelbalk">
                <div class="tekenvak-titelbalk-veld"><span>Naam</span><div class="invul-lijn-klein"></div></div>
                <div class="tekenvak-titelbalk-veld"><span>Datum</span><div class="invul-lijn-klein"></div></div>
                <div class="tekenvak-titelbalk-veld"><span>Klas</span><div class="invul-lijn-klein"></div></div>
              </div>
            </div>
          </div>
        </div>`;
      }
      if ((st.type||'foto') === 'tekening-upload') {
        return `<div style="page-break-before:always;break-before:page;padding:14mm;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div class="stap-cirkel">${stapNr}</div>
            <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--donkerblauw)">${wbEsc(sec.titel||'Tekening')} ${stapNr}</h3>
          </div>
          ${st.stap?`<p style="font-size:15px;color:var(--tekst-zacht);margin:0 0 14px">${wbEsc(st.stap)}</p>`:''}
          <div style="flex:1;display:flex;align-items:center;justify-content:center">
            ${st.afbeeldingBase64
              ? `<img src="${st.afbeeldingBase64}" style="max-width:100%;max-height:220mm;object-fit:contain;border-radius:var(--radius);border:1px solid var(--rand)">`
              : `<div class="foto-vak" style="width:100%;min-height:180mm;height:100%"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg><span>Tekening hier plaatsen</span></div>`
            }
          </div>
        </div>`;
      }
      const fotoSvg = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`;
      return `<div class="stap">
        <div class="stap-nummering"><div class="stap-cirkel">${stapNr}</div></div>
        <div class="stap-kaart">
          <h3>${wbEsc(sec.titel||'Stap')} ${stapNr}</h3>
          ${st.stap?`<p>${wbEsc(st.stap)}</p>`:''}
          <div class="foto-rij een">
            <div class="foto-vak${st.afbeeldingBase64?' groot':''}">
              ${st.afbeeldingBase64
                ? `<img src="${st.afbeeldingBase64}" style="width:100%;height:100%;object-fit:cover">`
                : fotoSvg+'<span>Foto hier plaatsen</span>'}
              <div class="foto-label">${wbEsc(st.bijschrift||'Bijschrift')}</div>
            </div>
          </div>
          ${st.tip?`<div class="blok tip"><div class="blok-titel">💡 Tip</div>${wbEsc(st.tip)}</div>`:''}
        </div>
      </div>`;
    })
  ).join('');

  if (stapNr > 0) {
    secties.push(`
      <div class="sectie-header"><div class="sectie-icon">🪵</div><h2>Stappenplan</h2></div>
      <div class="stappen">${stapHtml}</div>
      <hr class="scheidingslijn">`);
  }

  // ── Succes ──
  secties.push(`<div class="succes-banner">
    <h2>Goed gedaan! 🎉</h2>
    <p>Controleer je eigen werk nog één keer op netheid en kwaliteit voor je inlevert.</p>
  </div>`);

  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
  <title>${wbEsc(d.titel||'Werkboekje')}</title>
  <style>
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{size:A4;margin:0}
    ${css}
    .tekenvak.heeft-titelbalk{padding-bottom:44px}
  </style></head><body>
  ${cover}
  <div class="pagina">${secties.join('\n')}</div>
  </body></html>`;
}
