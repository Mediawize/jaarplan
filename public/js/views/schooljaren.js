async function renderSchooljaren() {
  if (!Auth.isAdmin()) { document.getElementById('view-schooljaren').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`; return; }
  showLoading('schooljaren');
  try {
    const schooljaren = await API.getSchooljaren();
    document.getElementById('view-schooljaren').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Schooljaren</h1></div>
        <button class="btn btn-primary" onclick="openSchooljaarModal()">+ Schooljaar aanmaken</button>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">Wanneer je een schooljaar aanmaakt worden automatisch alle schoolweken gegenereerd met Noord-Holland VMBO vakanties.</div>
      ${schooljaren.length===0?`<div class="card"><div class="empty-state"><h3>Nog geen schooljaren</h3><button class="btn btn-primary" onclick="openSchooljaarModal()">Eerste schooljaar aanmaken</button></div></div>`:`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        ${schooljaren.map(sj=>`<div class="card" style="margin-bottom:0">
          <div style="padding:20px 22px">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px">
              <div><div style="font-family:'DM Serif Display',serif;font-size:22px">${sj.naam}</div></div>
              <span class="badge badge-green">Actief</span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm" style="flex:1" onclick="bekijkWekenOverzicht('${sj.naam}')">Weken bekijken</button>
              <button class="icon-btn" onclick="deleteSchooljaar('${sj.naam}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div id="weken-overzicht"></div>`}
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

function openSchooljaarModal() {
  const beschikbaar = ['2024-2025','2025-2026','2026-2027'];
  openModal(`
    <h2>Schooljaar aanmaken</h2>
    <p class="modal-sub">Schoolweken worden automatisch gegenereerd met Noord-Holland VMBO vakanties.</p>
    <div class="form-field">
      <label>Schooljaar *</label>
      <select id="sj-jaar">
        <option value="">— Selecteer schooljaar —</option>
        ${beschikbaar.map(j=>`<option value="${j}">${j}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveSchooljaar()">Aanmaken</button>
    </div>
  `);
}

async function saveSchooljaar() {
  const jaar = document.getElementById('sj-jaar').value;
  if (!jaar) { alert('Selecteer een schooljaar.'); return; }
  try { await API.addSchooljaar(jaar); closeModalDirect(); renderSchooljaren(); }
  catch(e) { showError(e.message); }
}

async function deleteSchooljaar(naam) {
  if (!confirm(`Schooljaar ${naam} verwijderen?`)) return;
  try { await API.deleteSchooljaar(naam); renderSchooljaren(); }
  catch(e) { showError(e.message); }
}

async function bekijkWekenOverzicht(schooljaar) {
  const el = document.getElementById('weken-overzicht');
  el.innerHTML = '<div style="padding:20px;color:var(--ink-muted)">Weken laden...</div>';
  try {
    const weken = await API.getWeken(schooljaar);
    const periodes = {1:[],2:[],3:[],4:[]};
    weken.forEach(w => {
      const wn = w.weeknummer; let p=1;
      if((wn>=44)||(wn<=8))p=2; else if(wn>=9&&wn<=18)p=3; else if(wn>=19&&wn<=26)p=4;
      periodes[p].push(w);
    });
    const pNamen={1:'Periode 1',2:'Periode 2',3:'Periode 3',4:'Periode 4'};
    const cw = getCurrentWeek();
    el.innerHTML = `<div class="card">
      <div class="card-header"><h2>Weekoverzicht ${schooljaar}</h2><div class="card-meta">${weken.length} weken</div></div>
      ${[1,2,3,4].map(p=>{
        const pw=periodes[p]; if(!pw.length)return '';
        return `<div style="border-bottom:1px solid var(--border)">
          <div style="padding:10px 24px;background:var(--cream);font-size:12px;font-weight:700;text-transform:uppercase;color:var(--ink-muted)">${pNamen[p]}</div>
          <table class="data-table">
            <thead><tr><th style="width:70px">Week</th><th style="width:140px">Datum</th><th>Thema</th><th style="width:120px">Status</th></tr></thead>
            <tbody>${pw.map(w=>`<tr style="${w.isVakantie?'opacity:.55':''}">
              <td><span class="week-pill ${w.weeknummer===cw?'current':''}">${w.weeknummer}</span></td>
              <td style="font-size:12px;color:var(--ink-muted)">${w.van} – ${w.tot}</td>
              <td>${w.isVakantie
                ?`<span class="badge badge-amber">${w.vakantieNaam}</span>`
                :`<span class="week-thema-cel" data-weekid="${w.id}" data-schooljaar="${schooljaar}" onclick="editWeekThemaSj(this)" style="display:inline-block;min-width:200px;padding:4px 8px;border-radius:6px;border:1px dashed ${w.thema?'transparent':'var(--border-med)'};cursor:pointer;font-size:13px;color:${w.thema?'var(--ink)':'var(--ink-muted)'}">${w.thema||'+ Thema toevoegen'}</span>`
              }</td>
              <td><span style="font-size:12px;color:${w.isVakantie?'var(--amber)':'var(--ink-muted)'}">${w.isVakantie?'Vakantie':'Schoolweek'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
      }).join('')}
    </div>`;
  } catch(e) { showError(e.message); }
}

async function editWeekThemaSj(el) {
  const weekId = el.dataset.weekid, schooljaar = el.dataset.schooljaar;
  const huidig = el.textContent.trim()==='+ Thema toevoegen' ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type='text'; input.value=huidig;
  input.style.cssText='padding:4px 8px;border:1.5px solid var(--accent);border-radius:6px;font-size:13px;font-family:DM Sans,sans-serif;min-width:200px;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  async function opslaan() {
    const nieuw = input.value.trim();
    await API.updateWeekThema(weekId, nieuw);
    const span = document.createElement('span');
    span.className='week-thema-cel'; span.dataset.weekid=weekId; span.dataset.schooljaar=schooljaar;
    span.onclick=function(){editWeekThemaSj(this);};
    span.style.cssText=`display:inline-block;min-width:200px;padding:4px 8px;border-radius:6px;border:1px dashed ${nieuw?'transparent':'var(--border-med)'};cursor:pointer;font-size:13px;color:${nieuw?'var(--ink)':'var(--ink-muted)'}`;
    span.textContent=nieuw||'+ Thema toevoegen';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();opslaan();}if(e.key==='Escape')opslaan();});
}
