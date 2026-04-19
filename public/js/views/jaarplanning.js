async function renderJaarplanning() {
  const readonly = !Auth.canEdit();
  showLoading('jaarplanning');
  try {
    const klassen = await API.getKlassen();
    if (klassen.length === 0) {
      document.getElementById('view-jaarplanning').innerHTML = `<div class="page-header"><div class="page-header-left"><h1>Jaarplanning</h1></div></div><div class="empty-state"><h3>Geen klassen</h3></div>`;
      return;
    }
    if (!window._selectedKlas || !klassen.find(k=>k.id===window._selectedKlas)) window._selectedKlas = klassen[0].id;
    const klas = klassen.find(k=>k.id===window._selectedKlas);
    const [weken, opdrachten, vakken, gebruikers] = await Promise.all([
      API.getWeken(klas.schooljaar),
      API.getOpdrachten(window._selectedKlas),
      API.getVakken(),
      API.getGebruikers(),
    ]);
    const vak = vakken.find(v=>v.id===klas.vakId);
    const docent = gebruikers.find(u=>u.id===klas.docentId);
    const cw = getCurrentWeek();
    const heeftWeken = weken && weken.length > 0;
    const totaal = opdrachten.length;
    const afgevinktN = opdrachten.filter(o=>o.afgevinkt).length;
    const pct = totaal>0?Math.round((afgevinktN/totaal)*100):0;
    const periodes={1:[],2:[],3:[],4:[]};
    if(heeftWeken) weken.forEach(w=>{
      const wn=w.weeknummer; let p=1;
      if((wn>=44)||(wn<=8))p=2; else if(wn>=9&&wn<=18)p=3; else if(wn>=19&&wn<=26)p=4;
      periodes[p].push(w);
    });
    const pNamen={1:'Periode 1 — september t/m november',2:'Periode 2 — december t/m februari',3:'Periode 3 — maart t/m mei',4:'Periode 4 — juni t/m juli'};

    document.getElementById('view-jaarplanning').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <div class="breadcrumb"><span onclick="showView('klassen')" style="cursor:pointer;color:var(--accent)">Klassen</span> › Jaarplanning</div>
          <h1>${escHtml(klas.naam)}</h1>
        </div>
        <select id="klas-select" onchange="window._selectedKlas=this.value;renderJaarplanning()" style="padding:9px 14px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13.5px;background:#fff;color:var(--ink);font-weight:500">
          ${klassen.map(k=>`<option value="${k.id}" ${k.id===window._selectedKlas?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
      </div>
      ${readonly?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus</div>`:''}
      <div class="card" style="margin-bottom:16px;padding:0">
        <div style="display:flex;align-items:center;gap:24px;padding:16px 24px;flex-wrap:wrap">
          <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Vak</div><span class="badge badge-green">${escHtml(vak?.naam||'—')} — ${escHtml(vak?.volledig||'')}</span></div>
          <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Niveau</div><span style="font-weight:500">Leerjaar ${klas.leerjaar} · ${escHtml(klas.niveau)}</span></div>
          <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Docent</div><span>${docent?escHtml(docent.naam+' '+docent.achternaam):'—'}</span></div>
          <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Uren/week</div><span>${klas.urenPerWeek||'?'} uur</span></div>
          <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Voortgang</div><span style="font-weight:500;color:var(--accent)">${afgevinktN}/${totaal} (${pct}%)</span></div>
          <div style="flex:1;min-width:120px"><div class="klas-progress" style="margin-bottom:0"><div class="klas-progress-fill" style="width:${pct}%"></div></div></div>
        </div>
      </div>
      ${!heeftWeken?`<div class="card"><div class="empty-state"><h3>Geen weekstructuur</h3><p>Voor schooljaar <strong>${escHtml(klas.schooljaar)}</strong> zijn nog geen weken gegenereerd.</p>${Auth.isAdmin()?`<button class="btn btn-primary" onclick="showView('schooljaren')">Schooljaar aanmaken</button>`:'<p>Vraag de beheerder.</p>'}</div></div>`:`
      ${[1,2,3,4].map(p=>{
        const pw=periodes[p]; if(!pw.length)return '';
        return `<div class="card">
          <div class="card-header"><div><h2>${pNamen[p]}</h2><div class="card-meta">${pw.filter(w=>!w.isVakantie).length} schoolweken</div></div></div>
          <table class="data-table">
            <thead><tr>
              <th style="width:70px">Week</th><th style="width:120px">Datum</th><th style="width:170px">Thema</th>
              <th>Activiteiten</th>${!readonly?'<th style="width:90px"></th>':''}
            </tr></thead>
            <tbody>
              ${pw.map(w=>{
                const wOpd=opdrachten.filter(o=>{
                  if(o.weeknummer===w.weeknummer&&o.schooljaar===klas.schooljaar)return true;
                  if(o.weken)return weekInRange(o.weken,w.weeknummer);
                  return false;
                });
                const isNu=w.weeknummer===cw;
                const alleKlaar=wOpd.length>0&&wOpd.every(o=>o.afgevinkt);
                if(w.isVakantie) return `<tr style="background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(196,130,26,0.03) 4px,rgba(196,130,26,0.03) 8px)">
                  <td><span class="week-pill">${w.weeknummer}</span></td>
                  <td style="font-size:12px;color:var(--ink-muted)">${w.van} – ${w.tot}</td>
                  <td colspan="${!readonly?3:2}"><span class="badge badge-amber">${w.vakantieNaam}</span></td>
                </tr>`;
                return `<tr class="${isNu?'planning-row-active':''}" style="${alleKlaar?'background:rgba(45,90,61,0.04)':''}">
                  <td>
                    <span class="week-pill ${isNu?'current':''}">${w.weeknummer}</span>
                    ${isNu?'<div style="font-size:10px;color:var(--accent);font-weight:700;margin-top:2px">NU</div>':''}
                    ${alleKlaar?'<div style="font-size:10px;color:var(--accent);margin-top:2px">✓ klaar</div>':''}
                  </td>
                  <td style="font-size:12px;color:var(--ink-muted)">${w.van}<br>${w.tot}</td>
                  <td>${!readonly
                    ?`<span class="week-thema-inline" data-weekid="${w.id}" onclick="editWeekThemaInline(this)" style="display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${w.thema?'transparent':'var(--border-med)'};cursor:pointer;font-size:12px;color:${w.thema?'var(--ink)':'var(--ink-muted)'};min-height:28px">${escHtml(w.thema)||'<span style="opacity:.5">+ Thema</span>'}</span>`
                    :`<span style="font-size:12px;color:var(--ink-muted)">${escHtml(w.thema)||'—'}</span>`
                  }</td>
                  <td>${wOpd.length===0?`<span style="font-size:12px;color:var(--border-med)">—</span>`:wOpd.map(o=>renderActiviteitRij(o,readonly)).join('')}</td>
                  ${!readonly?`<td style="vertical-align:top;padding-top:14px"><button class="btn btn-sm" onclick="openOpdrachtModal(null,'${window._selectedKlas}',${p},${w.weeknummer})">+ Activiteit</button></td>`:''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      }).join('')}`}
    `;
  } catch(e) { showError('Fout bij laden: ' + e.message); }
}

function renderActiviteitRij(o, readonly) {
  const afgevinkt=o.afgevinkt||o.afgevinkt===1;
  const initialen=o.afgevinktDoor||'';
  const datum=o.afgevinktOp?new Date(o.afgevinktOp).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}):'';
  const heeftOpmerking=o.opmerking&&o.opmerking.trim();
  return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:8px;background:${afgevinkt?'rgba(45,90,61,0.06)':'var(--cream)'};border:1px solid ${afgevinkt?'rgba(45,90,61,0.15)':'var(--border)'}">
    ${!readonly
      ?`<div style="flex-shrink:0;margin-top:1px"><button onclick="doAfvinken('${o.id}')" style="width:22px;height:22px;border-radius:5px;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-med)'};background:${afgevinkt?'var(--accent)':'#fff'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all .15s">${afgevinkt?'<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</button></div>`
      :`<div style="flex-shrink:0;margin-top:1px"><div style="width:22px;height:22px;border-radius:5px;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-med)'};background:${afgevinkt?'var(--accent)':'#fff'};display:flex;align-items:center;justify-content:center">${afgevinkt?'<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</div></div>`
    }
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="badge ${typeKleur(o.type)}" style="font-size:10px;padding:2px 6px">${escHtml(o.type)}</span>
        <span style="font-size:12px;font-weight:500;${afgevinkt?'text-decoration:line-through;color:var(--ink-muted)':''}">${escHtml(o.naam)}</span>
        ${o.uren?`<span style="font-size:11px;color:var(--ink-muted)">${o.uren}u</span>`:''}
        ${o.syllabuscodes?`<span style="font-size:10px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)}</span>`:''}
        ${o.theorieLink?`<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank" style="font-size:11px">link ↗</a>`:''}
        ${o.toetsBestand?`<span class="badge badge-amber" style="font-size:10px;padding:2px 5px">📄</span>`:''}
      </div>
      ${afgevinkt&&initialen?`<div style="display:flex;align-items:center;gap:5px;margin-top:4px"><span style="font-size:11px;font-weight:700;font-family:monospace;background:var(--accent);color:#fff;padding:1px 6px;border-radius:4px">${escHtml(initialen)}</span><span style="font-size:11px;color:var(--ink-muted)">${datum}</span></div>`:''}
      ${heeftOpmerking?`<div style="margin-top:5px;padding:5px 8px;background:#fff;border-left:3px solid var(--amber);border-radius:0 4px 4px 0;font-size:12px;color:var(--ink-light)">💬 ${escHtml(o.opmerking)}</div>`:''}
      ${!readonly?`<button onclick="openOpmerkingModal('${o.id}','${escHtml(o.naam)}')" style="margin-top:5px;font-size:11px;color:${heeftOpmerking?'var(--amber)':'var(--ink-muted)'};background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">${heeftOpmerking?'✏️ Opmerking bewerken':'+ Opmerking toevoegen'}</button>`:''}
    </div>
  </div>`;
}

async function doAfvinken(opdrachtId) {
  try { await API.afvinken(opdrachtId); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}

function openOpmerkingModal(opdrachtId, naam) {
  // Haal huidige opmerking op uit DOM
  const btn = document.querySelector(`button[onclick="openOpmerkingModal('${opdrachtId}','${escHtml(naam)}')"]`);
  const heeftOpmerking = btn && btn.textContent.includes('bewerken');
  openModal(`
    <h2>Opmerking</h2>
    <p class="modal-sub">${escHtml(naam)}</p>
    <div class="form-field"><label>Opmerking / bijzonderheden</label>
      <textarea id="opmerking-tekst" placeholder="Bijv. 'Jan niet aanwezig', 'Iemand uitgestuurd'..." style="min-height:100px"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveOpmerking('${opdrachtId}')">Opslaan</button>
    </div>
  `);
  // Laad bestaande opmerking
  API.getOpdrachten(window._selectedKlas).then(opds => {
    const o = opds.find(x=>x.id===opdrachtId);
    if (o?.opmerking) document.getElementById('opmerking-tekst').value = o.opmerking;
  });
}

async function saveOpmerking(opdrachtId) {
  const tekst = document.getElementById('opmerking-tekst').value.trim();
  try { await API.setOpmerking(opdrachtId, tekst || null); closeModalDirect(); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}

function editWeekThemaInline(el) {
  const weekId = el.dataset.weekid;
  const huidig = el.querySelector('span[style*="opacity"]') ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type='text'; input.value=huidig;
  input.style.cssText='padding:4px 6px;border:1.5px solid var(--accent);border-radius:6px;font-size:12px;font-family:DM Sans,sans-serif;width:100%;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  async function opslaan() {
    const nieuw = input.value.trim();
    await API.updateWeekThema(weekId, nieuw);
    const span=document.createElement('span');
    span.className='week-thema-inline'; span.dataset.weekid=weekId;
    span.onclick=function(){editWeekThemaInline(this);};
    span.style.cssText=`display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${nieuw?'transparent':'var(--border-med)'};cursor:pointer;font-size:12px;color:${nieuw?'var(--ink)':'var(--ink-muted)'};min-height:28px`;
    span.innerHTML=nieuw?escHtml(nieuw):'<span style="opacity:.5">+ Thema</span>';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();opslaan();}if(e.key==='Escape')opslaan();});
}

async function openOpdrachtModal(opdrachtId=null, klasId=null, defaultPeriode=1, defaultWeek=null) {
  const klassen = await API.getKlassen();
  const selectedKlas = klasId||window._selectedKlas||(klassen[0]?.id);
  const klas = klassen.find(k=>k.id===selectedKlas);
  const weken = klas ? (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie) : [];
  let o = null;
  if (opdrachtId) { const opds = await API.getOpdrachten(selectedKlas); o = opds.find(x=>x.id===opdrachtId); }
  openModal(`
    <h2>${o?'Activiteit bewerken':'Activiteit toevoegen'}</h2>
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam *</label><input type="text" id="o-naam" value="${escHtml(o?.naam||'')}"></div>
      <div class="form-field"><label>Klas *</label><select id="o-klas" onchange="refreshWekenSelectAsync()">${klassen.map(k=>`<option value="${k.id}" ${k.id===selectedKlas?'selected':''}>${escHtml(k.naam)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Week *</label><select id="o-weeknummer"><option value="">— Selecteer week —</option>${weken.map(w=>`<option value="${w.weeknummer}" ${(o?.weeknummer===w.weeknummer)||defaultWeek===w.weeknummer?'selected':''}>Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema?' · '+w.thema:''}</option>`).join('')}</select></div>
      <div class="form-field"><label>Type *</label><select id="o-type">${['Theorie','Praktijk','Toets','Opdracht','Groepsopdracht','Presentatie','Project','Overig'].map(t=>`<option value="${t}" ${o?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren</label><select id="o-uren"><option value="">—</option>${[0.5,1,1.5,2,2.5,3,4].map(u=>`<option value="${u}" ${o?.uren==u?'selected':''}>${u} uur</option>`).join('')}</select></div>
      <div class="form-field"><label>Periode</label><select id="o-periode">${[1,2,3,4].map(p=>`<option value="${p}" ${(o?.periode||defaultPeriode)==p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input type="text" id="o-syllabus" placeholder="PIE-1.1, PIE-1.2" value="${escHtml(o?.syllabuscodes||'')}"></div>
      <div class="form-field form-full"><label>Beschrijving</label><textarea id="o-beschrijving">${escHtml(o?.beschrijving||'')}</textarea></div>
      <div class="form-field form-full"><label>Link (theorie/opdracht/toets)</label><input type="text" id="o-theorie" value="${escHtml(o?.theorieLink||'')}"></div>
      <div class="form-field form-full"><label>Toetsbestand</label><input type="text" id="o-toets" placeholder="bijv. toets_p1.pdf" value="${escHtml(o?.toetsBestand||'')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${o?`<button class="btn btn-danger" onclick="deleteOpdrachtFromModal('${o.id}')">Verwijderen</button>`:''}
      <button class="btn btn-primary" onclick="saveOpdracht('${opdrachtId||''}','${selectedKlas}')">Opslaan</button>
    </div>
  `);
}

async function refreshWekenSelectAsync() {
  const klasId = document.getElementById('o-klas')?.value;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k=>k.id===klasId);
  if (!klas) return;
  const weken = (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie);
  const sel = document.getElementById('o-weeknummer');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecteer week —</option>`+weken.map(w=>`<option value="${w.weeknummer}">Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema?' · '+w.thema:''}</option>`).join('');
}

async function saveOpdracht(opdrachtId, defaultKlasId) {
  const naam = document.getElementById('o-naam').value.trim();
  const klasId = document.getElementById('o-klas').value || defaultKlasId;
  const weeknummer = parseInt(document.getElementById('o-weeknummer').value);
  const type = document.getElementById('o-type').value;
  const uren = document.getElementById('o-uren').value?parseFloat(document.getElementById('o-uren').value):null;
  const periode = parseInt(document.getElementById('o-periode').value);
  const syllabuscodes = document.getElementById('o-syllabus').value.trim();
  const beschrijving = document.getElementById('o-beschrijving').value.trim();
  const theorieLink = document.getElementById('o-theorie').value.trim();
  const toetsBestand = document.getElementById('o-toets').value.trim()||null;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k=>k.id===klasId);
  if (!naam||!klasId||!weeknummer||!type) { alert('Vul naam, klas, week en type in.'); return; }
  const data = { naam, klasId, periode, weeknummer, weken: String(weeknummer), schooljaar: klas?.schooljaar, type, uren, syllabuscodes, werkboekLink:'', beschrijving, theorieLink, toetsBestand };
  try {
    if (opdrachtId) { await API.updateOpdracht(opdrachtId, data); } else { await API.addOpdracht(data); }
    window._selectedKlas = klasId;
    closeModalDirect();
    renderJaarplanning();
  } catch(e) { showError(e.message); }
}

async function deleteOpdrachtFromModal(id) {
  if (!confirm('Activiteit verwijderen?')) return;
  try { await API.deleteOpdracht(id); closeModalDirect(); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}
