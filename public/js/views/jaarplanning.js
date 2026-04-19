function renderJaarplanning() {
  const readonly = !Auth.canEdit();
  const klassen = Auth.getZichtbareKlassen();
  if (klassen.length === 0) {
    document.getElementById('view-jaarplanning').innerHTML = `<div class="page-header"><div class="page-header-left"><h1>Jaarplanning</h1></div></div><div class="empty-state"><h3>Geen klassen</h3><p>Maak eerst een klas aan.</p></div>`;
    return;
  }
  if (!window._selectedKlas || !klassen.find(k => k.id === window._selectedKlas)) window._selectedKlas = klassen[0].id;
  const klas = DB.getKlas(window._selectedKlas);
  const vak = DB.getVak(klas?.vakId);
  const docent = DB.getGebruiker(klas?.docentId);
  const schooljaar = klas?.schooljaar;
  const weken = DB.getWeken(schooljaar);
  const opdrachten = DB.getOpdrachten(window._selectedKlas);
  const cw = getCurrentWeek();
  const heeftWeken = weken && weken.length > 0;
  const totaalOpd = opdrachten.length;
  const afgevinktAantal = opdrachten.filter(o => o.afgevinkt).length;
  const pctDone = totaalOpd > 0 ? Math.round((afgevinktAantal / totaalOpd) * 100) : 0;
  const periodes = {1:[],2:[],3:[],4:[]};
  if (heeftWeken) weken.forEach(w => {
    const wn = w.weeknummer;
    let p = 1;
    if ((wn>=44)||(wn<=8)) p=2;
    else if (wn>=9&&wn<=18) p=3;
    else if (wn>=19&&wn<=26) p=4;
    periodes[p].push(w);
  });
  const pNamen = {1:'Periode 1 — september t/m november',2:'Periode 2 — december t/m februari',3:'Periode 3 — maart t/m mei',4:'Periode 4 — juni t/m juli'};

  document.getElementById('view-jaarplanning').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="breadcrumb"><span onclick="showView('klassen')" style="cursor:pointer;color:var(--accent)">Klassen</span> › Jaarplanning</div>
        <h1>${escHtml(klas?.naam||'—')}</h1>
      </div>
      <div class="page-header-actions">
        <select id="klas-select" onchange="window._selectedKlas=this.value;renderJaarplanning()" style="padding:9px 14px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13.5px;background:#fff;color:var(--ink);font-weight:500">
          ${klassen.map(k=>`<option value="${k.id}" ${k.id===window._selectedKlas?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${readonly?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus</div>`:''}
    <div class="card" style="margin-bottom:16px;padding:0">
      <div style="display:flex;align-items:center;gap:24px;padding:16px 24px;flex-wrap:wrap">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Vak</div><span class="badge badge-green">${escHtml(vak?.naam||'—')} — ${escHtml(vak?.volledig||'')}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Niveau</div><span style="font-weight:500">Leerjaar ${klas?.leerjaar} · ${escHtml(klas?.niveau)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Docent</div><span>${docent?escHtml(docent.naam+' '+docent.achternaam):'—'}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Schooljaar</div><span>${escHtml(schooljaar)}</span></div>
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-muted);margin-bottom:3px">Voortgang</div><span style="font-weight:500;color:var(--accent)">${afgevinktAantal}/${totaalOpd} (${pctDone}%)</span></div>
        <div style="flex:1;min-width:120px"><div class="klas-progress" style="margin-bottom:0"><div class="klas-progress-fill" style="width:${pctDone}%"></div></div></div>
      </div>
    </div>
    ${!heeftWeken ? `<div class="card"><div class="empty-state"><h3>Geen weekstructuur</h3><p>Voor schooljaar <strong>${escHtml(schooljaar)}</strong> zijn nog geen weken gegenereerd.</p>${Auth.isAdmin()?`<button class="btn btn-primary" onclick="showView('schooljaren')">Schooljaar aanmaken</button>`:'<p>Vraag de beheerder.</p>'}</div></div>` :
    [1,2,3,4].map(p => {
      const pw = periodes[p];
      if (!pw.length) return '';
      return `<div class="card">
        <div class="card-header"><div><h2>${pNamen[p]}</h2><div class="card-meta">${pw.filter(w=>!w.isVakantie).length} schoolweken · ${pw.filter(w=>w.isVakantie).length} vakantieweken</div></div></div>
        <table class="data-table">
          <thead><tr>
            <th style="width:70px">Week</th>
            <th style="width:120px">Datum</th>
            <th style="width:170px">Thema</th>
            <th>Activiteiten</th>
            ${!readonly?'<th style="width:90px"></th>':''}
          </tr></thead>
          <tbody>
            ${pw.map(w => {
              const wOpd = opdrachten.filter(o => {
                if (o.weeknummer===w.weeknummer && o.schooljaar===schooljaar) return true;
                if (o.weken) return weekInRange(o.weken, w.weeknummer);
                return false;
              });
              const isNu = w.weeknummer===cw;
              const alleKlaar = wOpd.length>0 && wOpd.every(o=>o.afgevinkt);
              if (w.isVakantie) return `<tr style="background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(196,130,26,0.03) 4px,rgba(196,130,26,0.03) 8px)">
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
                  ?`<span class="week-thema-inline" data-weekid="${w.id}" data-schooljaar="${schooljaar}" onclick="editWeekThemaInline(this)" style="display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${w.thema?'transparent':'var(--border-med)'};cursor:pointer;font-size:12px;color:${w.thema?'var(--ink)':'var(--ink-muted)'};min-height:28px">${escHtml(w.thema)||'<span style="opacity:.5">+ Thema</span>'}</span>`
                  :`<span style="font-size:12px;color:var(--ink-muted)">${escHtml(w.thema)||'—'}</span>`
                }</td>
                <td>${wOpd.length===0?`<span style="font-size:12px;color:var(--border-med)">—</span>`:wOpd.map(o=>renderActiviteitRij(o,readonly)).join('')}</td>
                ${!readonly?`<td style="vertical-align:top;padding-top:14px"><button class="btn btn-sm" onclick="openOpdrachtModal(null,'${window._selectedKlas}',${p},${w.weeknummer})">+ Activiteit</button></td>`:''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('')}
  `;
}

function renderActiviteitRij(o, readonly) {
  const afgevinkt = o.afgevinkt;
  const initialen = o.afgevinktDoor||'';
  const datum = o.afgevinktOp ? new Date(o.afgevinktOp).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) : '';
  const heeftOpmerking = o.opmerking && o.opmerking.trim();
  return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:8px;background:${afgevinkt?'rgba(45,90,61,0.06)':'var(--cream)'};border:1px solid ${afgevinkt?'rgba(45,90,61,0.15)':'var(--border)'}">
    ${!readonly
      ?`<div style="flex-shrink:0;margin-top:1px"><button onclick="toggleAfvinken('${o.id}')" style="width:22px;height:22px;border-radius:5px;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-med)'};background:${afgevinkt?'var(--accent)':'#fff'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all .15s" title="${afgevinkt?'Ongedaan maken':'Afvinken'}">${afgevinkt?'<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</button></div>`
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
      ${!readonly?`<button onclick="openOpmerkingModal('${o.id}')" style="margin-top:5px;font-size:11px;color:${heeftOpmerking?'var(--amber)':'var(--ink-muted)'};background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">${heeftOpmerking?'✏️ Opmerking bewerken':'+ Opmerking toevoegen'}</button>`:''}
    </div>
  </div>`;
}

function toggleAfvinken(opdrachtId) {
  const o = DB.getOpdracht(opdrachtId);
  if (!o) return;
  const user = Auth.currentUser;
  const userObj = DB.getGebruiker(user.id);
  const klas = DB.getKlas(o.klasId);
  if (!Auth.isAdmin()) {
    const userVakken = userObj?.vakken||[];
    if (!userVakken.includes(klas?.vakId)) {
      const vak = DB.getVak(klas?.vakId);
      alert(`Je kunt alleen activiteiten afvinken voor vakken die aan jou zijn gekoppeld (${vak?.naam||'?'}).`);
      return;
    }
  }
  const initialen = getInitialen(userObj);
  if (o.afgevinkt) {
    DB.updateOpdracht(opdrachtId, {afgevinkt:false, afgevinktDoor:null, afgevinktOp:null});
  } else {
    DB.updateOpdracht(opdrachtId, {afgevinkt:true, afgevinktDoor:initialen, afgevinktOp:new Date().toISOString()});
  }
  renderJaarplanning();
}

function openOpmerkingModal(opdrachtId) {
  const o = DB.getOpdracht(opdrachtId);
  if (!o) return;
  openModal(`
    <h2>Opmerking</h2>
    <p class="modal-sub">${escHtml(o.naam)}</p>
    <div class="form-field">
      <label>Opmerking / bijzonderheden</label>
      <textarea id="opmerking-tekst" placeholder="Bijv. 'Jan niet aanwezig', 'Iemand uitgestuurd', 'Les uitgesteld'..." style="min-height:100px">${escHtml(o.opmerking||'')}</textarea>
    </div>
    ${o.opmerking?`<div style="font-size:12px;color:var(--ink-muted);margin-top:-8px;margin-bottom:12px">Leeg maken om de opmerking te verwijderen.</div>`:''}
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${o.opmerking?`<button class="btn btn-danger" onclick="saveOpmerking('${opdrachtId}',true)">Verwijderen</button>`:''}
      <button class="btn btn-primary" onclick="saveOpmerking('${opdrachtId}',false)">Opslaan</button>
    </div>
  `);
}

function saveOpmerking(opdrachtId, verwijderen) {
  const tekst = verwijderen ? '' : document.getElementById('opmerking-tekst').value.trim();
  DB.updateOpdracht(opdrachtId, {opmerking: tekst||null});
  closeModalDirect();
  renderJaarplanning();
}

function editWeekThemaInline(el) {
  const weekId = el.dataset.weekid, schooljaar = el.dataset.schooljaar;
  const huidig = el.querySelector('span[style*="opacity"]') ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type='text'; input.value=huidig;
  input.style.cssText='padding:4px 6px;border:1.5px solid var(--accent);border-radius:6px;font-size:12px;font-family:DM Sans,sans-serif;width:100%;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  function opslaan() {
    const nieuw = input.value.trim();
    DB.updateWeekThema(schooljaar, weekId, nieuw);
    const span = document.createElement('span');
    span.className='week-thema-inline'; span.dataset.weekid=weekId; span.dataset.schooljaar=schooljaar;
    span.onclick=function(){editWeekThemaInline(this);};
    span.style.cssText=`display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${nieuw?'transparent':'var(--border-med)'};cursor:pointer;font-size:12px;color:${nieuw?'var(--ink)':'var(--ink-muted)'};min-height:28px`;
    span.innerHTML=nieuw?escHtml(nieuw):'<span style="opacity:.5">+ Thema</span>';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();opslaan();}if(e.key==='Escape')opslaan();});
}

function openOpdrachtModal(opdrachtId=null, klasId=null, defaultPeriode=1, defaultWeek=null) {
  const o = opdrachtId ? DB.getOpdracht(opdrachtId) : null;
  const klassen = Auth.getZichtbareKlassen();
  const selectedKlas = klasId||o?.klasId||(klassen[0]?.id);
  const schooljaar = DB.getKlas(selectedKlas)?.schooljaar;
  const weken = schooljaar ? DB.getWeken(schooljaar).filter(w=>!w.isVakantie) : [];
  openModal(`
    <h2>${o?'Activiteit bewerken':'Activiteit toevoegen'}</h2>
    <p class="modal-sub">Vul de gegevens in voor de jaarplanning.</p>
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam *</label><input type="text" id="o-naam" placeholder="bijv. Theorie businessmodel canvas" value="${escHtml(o?.naam||'')}"></div>
      <div class="form-field"><label>Klas *</label><select id="o-klas" onchange="refreshWekenSelect()">${klassen.map(k=>`<option value="${k.id}" ${(klasId&&k.id===klasId)||o?.klasId===k.id?'selected':''}>${escHtml(k.naam)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Week *</label><select id="o-weeknummer"><option value="">— Selecteer week —</option>${weken.map(w=>`<option value="${w.weeknummer}" ${(o?.weeknummer===w.weeknummer)||defaultWeek===w.weeknummer?'selected':''}>Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema?' · '+w.thema:''}</option>`).join('')}</select></div>
      <div class="form-field"><label>Type *</label><select id="o-type">${['Theorie','Praktijk','Toets','Opdracht','Groepsopdracht','Presentatie','Project','Overig'].map(t=>`<option value="${t}" ${o?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren</label><select id="o-uren"><option value="">—</option>${[0.5,1,1.5,2,2.5,3,4].map(u=>`<option value="${u}" ${o?.uren==u?'selected':''}>${u} uur</option>`).join('')}</select></div>
      <div class="form-field"><label>Periode</label><select id="o-periode">${[1,2,3,4].map(p=>`<option value="${p}" ${(o?.periode||defaultPeriode)==p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input type="text" id="o-syllabus" placeholder="PIE-1.1, PIE-1.2" value="${escHtml(o?.syllabuscodes||'')}"></div>
      <div class="form-field form-full"><label>Beschrijving</label><textarea id="o-beschrijving" placeholder="Korte omschrijving...">${escHtml(o?.beschrijving||'')}</textarea></div>
      <div class="form-field form-full"><label>Link (theorie, opdracht of toets)</label><input type="text" id="o-theorie" placeholder="https://..." value="${escHtml(o?.theorieLink||'')}"></div>
      <div class="form-field form-full"><label>Toetsbestand (naam na uploaden)</label><input type="text" id="o-toets" placeholder="bijv. toets_periode1.pdf" value="${escHtml(o?.toetsBestand||'')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${o?`<button class="btn btn-danger" onclick="deleteOpdracht('${o.id}')">Verwijderen</button>`:''}
      <button class="btn btn-primary" onclick="saveOpdracht('${opdrachtId||''}')">Opslaan</button>
    </div>
  `);
}

function refreshWekenSelect() {
  const klasId=document.getElementById('o-klas')?.value;
  const schooljaar=DB.getKlas(klasId)?.schooljaar;
  const weken=schooljaar?DB.getWeken(schooljaar).filter(w=>!w.isVakantie):[];
  const sel=document.getElementById('o-weeknummer');
  if(!sel)return;
  sel.innerHTML=`<option value="">— Selecteer week —</option>`+weken.map(w=>`<option value="${w.weeknummer}">Wk ${w.weeknummer} (${w.van} – ${w.tot})${w.thema?' · '+w.thema:''}</option>`).join('');
}

function saveOpdracht(opdrachtId) {
  const naam=document.getElementById('o-naam').value.trim();
  const klasId=document.getElementById('o-klas').value;
  const weeknummer=parseInt(document.getElementById('o-weeknummer').value);
  const type=document.getElementById('o-type').value;
  const uren=document.getElementById('o-uren').value?parseFloat(document.getElementById('o-uren').value):null;
  const periode=parseInt(document.getElementById('o-periode').value);
  const syllabuscodes=document.getElementById('o-syllabus').value.trim();
  const beschrijving=document.getElementById('o-beschrijving').value.trim();
  const theorieLink=document.getElementById('o-theorie').value.trim();
  const toetsBestand=document.getElementById('o-toets').value.trim()||null;
  const schooljaar=DB.getKlas(klasId)?.schooljaar;
  if(!naam||!klasId||!weeknummer||!type){alert('Vul naam, klas, week en type in.');return;}
  const data={naam,klasId,periode,weeknummer,weken:String(weeknummer),schooljaar,type,uren,syllabuscodes,werkboekLink:'',beschrijving,theorieLink,toetsBestand};
  if(opdrachtId){DB.updateOpdracht(opdrachtId,data);}else{DB.addOpdracht(data);}
  window._selectedKlas=klasId;
  closeModalDirect();
  renderJaarplanning();
}

function deleteOpdracht(id) {
  const o=DB.getOpdracht(id);
  if(!confirm(`Activiteit "${o?.naam}" verwijderen?`))return;
  DB.deleteOpdracht(id);
  closeModalDirect();
  renderJaarplanning();
}
