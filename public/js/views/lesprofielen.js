function openImportModal() {
  openModal(`
    <h2>Lesprofiel importeren</h2>
    <p class="modal-sub">Upload een ingevuld Word bestand (.docx) om automatisch een lesprofiel aan te maken.</p>
    <div class="alert alert-info" style="margin-bottom:16px">
      <strong>Stap 1:</strong> Download de template via "⬇ Template downloaden"<br>
      <strong>Stap 2:</strong> Laat ChatGPT of Claude hem invullen, of doe het zelf<br>
      <strong>Stap 3:</strong> Upload het ingevulde bestand hier
    </div>
    <div class="upload-zone" onclick="document.getElementById('import-input').click()" id="import-zone">
      <div class="upload-icon">↑</div>
      <div style="font-weight:500;margin-bottom:4px">Klik om een ingevuld .docx bestand te kiezen</div>
      <div style="font-size:12px">Alleen .docx bestanden</div>
    </div>
    <input type="file" id="import-input" accept=".docx" style="display:none" onchange="doImportLesprofiel(this)">
    <div id="import-result" style="margin-top:12px;font-size:13px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
    </div>
  `);
}

async function doImportLesprofiel(input) {
  const file = input.files[0];
  if (!file) return;
  const result = document.getElementById('import-result');
  const zone = document.getElementById('import-zone');
  zone.style.borderColor = 'var(--accent)';
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bestand wordt verwerkt...</span>`;
  const formData = new FormData();
  formData.append('bestand', file);
  try {
    const res = await fetch('/api/import-lesprofiel', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      result.innerHTML = `<div class="alert alert-success">✓ ${escHtml(data.info)}</div>`;
      setTimeout(() => { closeModalDirect(); renderLesprofielen(); }, 1500);
    } else {
      result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red);border:1px solid rgba(176,58,46,0.2)">✗ ${escHtml(data.error)}</div>`;
    }
  } catch(e) {
    result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red);border:1px solid rgba(176,58,46,0.2)">✗ Upload mislukt: ${escHtml(e.message)}</div>`;
  }
}

async function renderLesprofielen() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesprofielen').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`;
    return;
  }
  showLoading('lesprofielen');
  try {
    const [profielen, vakken] = await Promise.all([API.getLesprofielen(), API.getVakken()]);
    const perVak = {};
    profielen.forEach(p => { if (!perVak[p.vakId]) perVak[p.vakId] = []; perVak[p.vakId].push(p); });

    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesprofielen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <a href="/api/lesprofiel-template" class="btn btn-sm" download>⬇ Template</a>
          <button class="btn btn-sm" onclick="openImportModal()">↑ Importeren</button>
          <button class="btn btn-sm btn-primary" onclick="openProfielModal()">+ Nieuw lesprofiel</button>
        </div>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Een lesprofiel is een blok van meerdere weken met activiteiten per week. Koppel het aan een startweek in de jaarplanning om het automatisch in te vullen.
      </div>
      ${profielen.length===0?`<div class="card"><div class="empty-state"><h3>Nog geen lesprofielen</h3><button class="btn btn-primary" onclick="openProfielModal()">Eerste lesprofiel aanmaken</button></div></div>`:`
      ${vakken.map(vak=>{
        const vp=perVak[vak.id]||[]; if(!vp.length)return '';
        return `<div class="card" style="margin-bottom:20px">
          <div class="card-header">
            <div><h2>${escHtml(vak.naam)} — ${escHtml(vak.volledig)}</h2><div class="card-meta">${vp.length} profiel${vp.length!==1?'en':''}</div></div>
            <button class="btn btn-sm btn-primary" onclick="openProfielModal('${vak.id}')">+ Profiel voor ${escHtml(vak.naam)}</button>
          </div>
          <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            ${vp.map(p=>{
              const aantalActs=(p.weken||[]).reduce((t,w)=>t+(w.activiteiten?.length||0),0);
              return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;cursor:pointer;transition:box-shadow .15s" onclick="openProfielDetail('${p.id}')" onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='none'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                  <div style="font-weight:600;font-size:14px">${escHtml(p.naam)}</div>
                  <div style="display:flex;gap:4px">
                    <button class="icon-btn" onclick="event.stopPropagation();openProfielModal('${p.vakId}','${p.id}')" title="Bewerken"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    <button class="icon-btn" onclick="event.stopPropagation();verwijderProfiel('${p.id}')" style="color:var(--red)" title="Verwijderen"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                  </div>
                </div>
                <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">${p.niveau?'<span class="badge badge-blue" style="margin-right:4px">'+p.niveau+'</span>':''}${p.aantalWeken} weken · ${aantalActs} activiteiten · ${p.urenPerWeek} uur/week</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${(p.weken||[]).slice(0,4).map((w,i)=>`<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--cream);border:1px solid var(--border);color:var(--ink-muted)">W${i+1}: ${(w.activiteiten||[]).map(a=>a.type[0]).join('+')||'—'}</span>`).join('')}
                  ${p.aantalWeken>4?`<span style="font-size:10px;color:var(--ink-muted)">+${p.aantalWeken-4}</span>`:''}
                </div>
                <button class="btn btn-sm btn-primary" style="width:100%;margin-top:12px" onclick="event.stopPropagation();openKoppelModal('${p.id}')">Koppelen aan planning →</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}`}
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openProfielModal(vakId=null, profielId=null) {
  const [vakken, profielen] = await Promise.all([API.getVakken(), API.getLesprofielen()]);
  const p = profielId ? profielen.find(x=>x.id===profielId) : null;
  const selectedVak = vakId||p?.vakId||vakken[0]?.id;
  openModal(`
    <h2>${p?'Lesprofiel bewerken':'Nieuw lesprofiel'}</h2>
    <p class="modal-sub">Stel het profiel in. Je vult de weekinhoud daarna in.</p>
    <div class="form-grid">
      <div class="form-field"><label>Naam *</label><input id="prof-naam" placeholder="bijv. Introductie ondernemen" value="${escHtml(p?.naam||'')}"></div>
      <div class="form-field"><label>Vak *</label><select id="prof-vak">${vakken.map(v=>`<option value="${v.id}" ${v.id===selectedVak?'selected':''}>${escHtml(v.naam)} — ${escHtml(v.volledig)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Niveau</label><select id="prof-niveau"><option value="" ${!p?.niveau?'selected':''}>— Geen niveau —</option>${['VMBO-B','VMBO-K','VMBO-GT','HAVO','VWO'].map(n=>`<option value="${n}" ${p?.niveau===n?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="form-field"><label>Aantal weken *</label><select id="prof-weken">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${(p?.aantalWeken||4)===n?'selected':''}>${n} ${n===1?'week':'weken'}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren per week</label><select id="prof-uren">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${(p?.urenPerWeek||3)===n?'selected':''}>${n} uur/week</option>`).join('')}</select></div>
      <div class="form-field form-full"><label>Beschrijving</label><textarea id="prof-beschrijving">${escHtml(p?.beschrijving||'')}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveProfiel('${profielId||''}')">Profiel aanmaken →</button>
    </div>
  `);
}

async function saveProfiel(profielId) {
  const naam = document.getElementById('prof-naam').value.trim();
  const vakId = document.getElementById('prof-vak').value;
  const niveau = document.getElementById('prof-niveau').value;
  const aantalWeken = parseInt(document.getElementById('prof-weken').value);
  const urenPerWeek = parseInt(document.getElementById('prof-uren').value);
  const beschrijving = document.getElementById('prof-beschrijving').value.trim();
  if (!naam||!vakId) { alert('Vul naam en vak in.'); return; }

  let weken;
  if (profielId) {
    const bestaand = (await API.getLesprofielen()).find(x=>x.id===profielId);
    weken = Array.from({length:aantalWeken},(_,i)=>bestaand?.weken?.[i]||{weekIndex:i+1,thema:'',activiteiten:[]});
  } else {
    weken = Array.from({length:aantalWeken},(_,i)=>({weekIndex:i+1,thema:'',activiteiten:[]}));
  }

  try {
    let id = profielId;
    if (profielId) { await API.updateLesprofiel(profielId, {naam,vakId,niveau,aantalWeken,urenPerWeek,beschrijving,weken}); }
    else { const r = await API.addLesprofiel({naam,vakId,niveau,aantalWeken,urenPerWeek,beschrijving,weken}); id = r.id; }
    closeModalDirect();
    openProfielDetail(id);
  } catch(e) { showError(e.message); }
}

async function openProfielDetail(profielId) {
  const [profielen, vakken] = await Promise.all([API.getLesprofielen(), API.getVakken()]);
  const p = profielen.find(x=>x.id===profielId);
  if (!p) return;
  const vak = vakken.find(v=>v.id===p.vakId);

  const overlay = document.createElement('div');
  overlay.id = 'profiel-detail-overlay';
  const isMobiel = window.innerWidth <= 768;
  overlay.style.cssText = `position:fixed;top:${isMobiel?'56px':'0'};left:${isMobiel?'0':'var(--sidebar-w,256px)'};right:0;bottom:0;background:#F8F7F4;z-index:400;overflow-y:auto;padding:${isMobiel?'16px':'28px 36px'}`;
  overlay.innerHTML = `
    <div style="max-width:960px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="document.getElementById('profiel-detail-overlay').remove();renderLesprofielen()">← Terug</button>
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:#78716C">Lesprofiel · ${escHtml(vak?.naam||'')}</div>
          <div style="font-size:20px;font-weight:600;letter-spacing:-0.4px;color:#1C1917">${escHtml(p.naam)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap">
          <span style="font-size:12px;color:#78716C">${p.aantalWeken} weken · ${p.urenPerWeek} uur/week</span>
          <button class="btn btn-sm btn-primary" onclick="openKoppelModal('${p.id}')">Koppelen aan planning →</button>
        </div>
      </div>
      <div id="profiel-weken-container">
        ${renderProfielWekenHTML(p)}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function renderProfielWekenHTML(p) {
  return (p.weken||[]).map((w,i)=>`
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div><h2>Week ${i+1}</h2><div class="card-meta">${p.urenPerWeek} uur beschikbaar</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" placeholder="Thema van deze week..." value="${escHtml(w.thema||'')}"
            onchange="updateProfielWeekThemaAsync('${p.id}',${i},this.value)"
            style="padding:7px 12px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13px;width:220px;outline:none">
          <button class="btn btn-sm btn-primary" onclick="openActiviteitModal('${p.id}',${i})">+ Activiteit</button>
        </div>
      </div>
      <div id="activiteiten-week-${p.id}-${i}">
        ${renderActiviteitenHTML(p,i)}
      </div>
      ${(w.activiteiten||[]).length===0?`<div style="padding:20px 24px;color:var(--ink-muted);font-size:13px">Nog geen activiteiten. Klik op "+ Activiteit".</div>`:''}
    </div>
  `).join('');
}

function renderActiviteitenHTML(p, weekIdx) {
  const w = p.weken[weekIdx];
  if (!w?.activiteiten?.length) return '';
  const kleuren = {'Theorie':'badge-blue','Praktijk':'badge-green','Toets':'badge-amber','Presentatie':'badge-gray','Overig':'badge-gray'};
  return `<table class="data-table">
    <thead><tr><th>Type</th><th>Uren</th><th>Omschrijving</th><th>Syllabus</th><th>Link / bestand</th><th style="width:80px"></th></tr></thead>
    <tbody>
      ${w.activiteiten.map((a,ai)=>`<tr>
        <td><span class="badge ${kleuren[a.type]||'badge-gray'}">${escHtml(a.type)}</span></td>
        <td style="font-size:13px;font-weight:500">${a.uren} uur</td>
        <td style="font-size:13px">${escHtml(a.omschrijving||'—')}</td>
        <td style="font-size:12px;color:#78716C">${escHtml(a.syllabus||'—')}</td>
        <td>
          ${a.link?`<a href="${escHtml(a.link)}" class="text-link" target="_blank">${escHtml(a.link.length>35?a.link.slice(0,35)+'…':a.link)}</a>`:''}
          ${a.bestand?`<span class="badge badge-amber" style="font-size:11px">📄 ${escHtml(a.bestand)}</span>`:''}
          ${!a.link&&!a.bestand?'<span style="color:#A8A29E">—</span>':''}
        </td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="bewerkActiviteit('${p.id}',${weekIdx},${ai})" title="Bewerken">
              <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn" onclick="verwijderActiviteit('${p.id}',${weekIdx},${ai})" style="color:#DC2626" title="Verwijderen">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function bewerkActiviteit(profielId, weekIdx, actIdx) {
  API.getLesprofielen().then(profielen => {
    const p = profielen.find(x=>x.id===profielId);
    if (!p) return;
    const a = p.weken[weekIdx].activiteiten[actIdx];
    openModal(`
      <h2>Activiteit bewerken</h2>
      <div class="form-grid">
        <div class="form-field"><label>Type *</label><select id="act-type">
          ${['Theorie','Praktijk','Toets','Presentatie','Overig'].map(t=>`<option value="${t}" ${a.type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
        <div class="form-field"><label>Uren *</label><select id="act-uren">
          ${[0.5,1,1.5,2,2.5,3,4,5,6,7,8].map(u=>`<option value="${u}" ${a.uren==u?'selected':''}>${u} uur</option>`).join('')}
        </select></div>
        <div class="form-field form-full"><label>Omschrijving</label><input id="act-omschrijving" value="${escHtml(a.omschrijving||'')}"></div>
        <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..." value="${escHtml(a.link||'')}"></div>
        <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1" value="${escHtml(a.syllabus||'')}"></div>
        <div class="form-field form-full"><label>Bestandsnaam</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf" value="${escHtml(a.bestand||'')}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModalDirect()">Annuleren</button>
        <button class="btn btn-primary" onclick="slaActiviteitBewerkingOp('${profielId}',${weekIdx},${actIdx})">Opslaan</button>
      </div>
    `);
  });
}

async function slaActiviteitBewerkingOp(profielId, weekIdx, actIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();

  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===profielId);
  if (!p) return;

  p.weken[weekIdx].activiteiten[actIdx] = { type, uren, omschrijving, link, syllabus, bestand: bestand||null };
  await API.updateLesprofiel(profielId, { weken: p.weken });

  closeModalDirect();
  const bijgewerkt = (await API.getLesprofielen()).find(x=>x.id===profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container && bijgewerkt) container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
}

async function updateProfielWeekThemaAsync(profielId, weekIdx, thema) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===profielId);
  if (!p) return;
  p.weken[weekIdx].thema = thema;
  await API.updateLesprofiel(profielId, {weken: p.weken});
}

function openActiviteitModal(profielId, weekIdx) {
  openModal(`
    <h2>Activiteit toevoegen</h2>
    <div class="form-grid">
      <div class="form-field"><label>Type *</label><select id="act-type">
        <option>Theorie</option><option>Praktijk</option><option>Toets</option><option>Presentatie</option><option>Overig</option>
      </select></div>
      <div class="form-field"><label>Uren *</label><select id="act-uren">
        ${[0.5,1,1.5,2,2.5,3,4].map(u=>`<option value="${u}" ${u===1?'selected':''}>${u} uur</option>`).join('')}
      </select></div>
      <div class="form-field form-full"><label>Omschrijving</label><input id="act-omschrijving" placeholder="bijv. Uitleg businessmodel canvas"></div>
      <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..."></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1"></div>
      <div class="form-field form-full"><label>Bestandsnaam (na uploaden)</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaActiviteitOp('${profielId}',${weekIdx})">Toevoegen</button>
    </div>
  `);
}

async function slaActiviteitOp(profielId, weekIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===profielId);
  if (!p) return;
  p.weken[weekIdx].activiteiten = p.weken[weekIdx].activiteiten||[];
  p.weken[weekIdx].activiteiten.push({type,uren,omschrijving,link,syllabus,bestand:bestand||null});
  await API.updateLesprofiel(profielId, {weken:p.weken});
  closeModalDirect();
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  const bijgewerkt = (await API.getLesprofielen()).find(x=>x.id===profielId);
  if (container&&bijgewerkt) { container.innerHTML=renderActiviteitenHTML(bijgewerkt,weekIdx); const empty=container.nextElementSibling; if(empty&&empty.textContent.includes('Nog geen'))empty.style.display='none'; }
}

async function verwijderActiviteit(profielId, weekIdx, actIdx) {
  if (!confirm('Activiteit verwijderen?')) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===profielId);
  p.weken[weekIdx].activiteiten.splice(actIdx,1);
  await API.updateLesprofiel(profielId,{weken:p.weken});
  const bijgewerkt = (await API.getLesprofielen()).find(x=>x.id===profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container&&bijgewerkt) container.innerHTML=renderActiviteitenHTML(bijgewerkt,weekIdx);
}

async function verwijderProfiel(id) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===id);
  if (!confirm(`Lesprofiel "${p?.naam}" verwijderen?`)) return;
  try { await API.deleteLesprofiel(id); renderLesprofielen(); }
  catch(e) { showError(e.message); }
}

async function openKoppelModal(profielId) {
  const [profielen, klassen, vakken] = await Promise.all([API.getLesprofielen(), API.getKlassen(), API.getVakken()]);
  const p = profielen.find(x=>x.id===profielId);
  if (!p) return;
  const vak = vakken.find(v=>v.id===p.vakId);
  const relevante = klassen.filter(k=>k.vakId===p.vakId && (!p.niveau || k.niveau===p.niveau));

  // Check of dit profiel al gekoppeld is aan een klas
  const alleOpd = await API.getOpdrachten();
  const alGekoppeld = alleOpd.filter(o => o.profielId === profielId);
  const gekoppeldeKlassen = [...new Set(alGekoppeld.map(o => o.klasId))];
  const gekoppeldeKlasNamen = gekoppeldeKlassen.map(id => klassen.find(k=>k.id===id)?.naam).filter(Boolean);

  openModal(`
    <h2>Profiel koppelen aan planning</h2>
    <p class="modal-sub">Koppel "<strong>${escHtml(p.naam)}</strong>" (${p.aantalWeken} weken) aan een startweek.</p>
    ${gekoppeldeKlasNamen.length > 0 ? `
    <div class="alert alert-info" style="margin-bottom:16px">
      ⚠️ Dit profiel is al gekoppeld aan: <strong>${escHtml(gekoppeldeKlasNamen.join(', '))}</strong><br>
      <span style="font-size:12px">Bij opnieuw koppelen aan dezelfde klas worden de oude opdrachten eerst verwijderd en opnieuw aangemaakt.</span>
    </div>` : ''}
    <div class="form-grid">
      <div class="form-field"><label>Klas *</label><select id="koppel-klas" onchange="laadKoppelWeken('${p.id}')">
        ${relevante.length===0?`<option value="">Geen klassen met vak ${escHtml(vak?.naam)}</option>`:relevante.map(k=>`<option value="${k.id}">${escHtml(k.naam)} — ${escHtml(k.schooljaar)}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Startweek *</label><select id="koppel-startweek"><option value="">— Selecteer klas eerst —</option></select></div>
    </div>
    <div id="koppel-preview" style="margin-top:12px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaKoppelingOp('${profielId}')">Koppelen → planning invullen</button>
    </div>
  `);
  setTimeout(()=>laadKoppelWeken(profielId),100);
}

async function laadKoppelWeken(profielId) {
  const klasId = document.getElementById('koppel-klas')?.value;
  if (!klasId) return;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k=>k.id===klasId);
  if (!klas) return;
  const weken = (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie);
  const sel = document.getElementById('koppel-startweek');
  if (!sel) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x=>x.id===profielId);
  sel.innerHTML = `<option value="">— Selecteer startweek —</option>`+weken.map(w=>`<option value="${w.weeknummer}">Wk ${w.weeknummer} · ${w.van} – ${w.tot}${w.thema?' · '+w.thema:''}</option>`).join('');
  sel.onchange = () => {
    const sw = parseInt(sel.value);
    if (!sw||!p) return;
    const schoolWeken = weken.filter(w=>w.weeknummer>=sw).slice(0,p.aantalWeken);
    document.getElementById('koppel-preview').innerHTML = `<div class="alert alert-success">Profiel wordt gekoppeld aan week ${schoolWeken[0]?.weeknummer||sw} t/m ${schoolWeken[schoolWeken.length-1]?.weeknummer||sw+p.aantalWeken-1}<br><small style="opacity:.7">${schoolWeken.length} schoolweken</small></div>`;
  };
}

async function slaKoppelingOp(profielId) {
  const klasId = document.getElementById('koppel-klas').value;
  const startweek = parseInt(document.getElementById('koppel-startweek').value);
  if (!klasId||!startweek) { alert('Selecteer een klas en startweek.'); return; }
  const [profielen, klassen] = await Promise.all([API.getLesprofielen(), API.getKlassen()]);
  const p = profielen.find(x=>x.id===profielId);
  const klas = klassen.find(k=>k.id===klasId);

  // Verwijder bestaande opdrachten van dit profiel+klas combinatie
  const bestaandeOpd = await API.getOpdrachten(klasId);
  const teVerwijderen = bestaandeOpd.filter(o => o.profielId === profielId);
  for (const o of teVerwijderen) {
    await API.deleteOpdracht(o.id);
  }

  const alleWeken = (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie);
  const startIdx = alleWeken.findIndex(w=>w.weeknummer===startweek);
  const schoolWeken = alleWeken.slice(startIdx, startIdx+p.aantalWeken);

  for (let i=0; i<schoolWeken.length; i++) {
    const sw = schoolWeken[i];
    const pw = p.weken[i];
    if (!pw) continue;
    for (const act of (pw.activiteiten||[])) {
      await API.addOpdracht({
        naam: act.omschrijving||`${act.type} — ${p.naam}`,
        klasId, periode: getPeriodeVoorWeekLP(sw.weeknummer),
        weeknummer: sw.weeknummer, weken: String(sw.weeknummer),
        schooljaar: klas.schooljaar, type: act.type, uren: act.uren,
        syllabuscodes: act.syllabus||'', werkboekLink:'',
        beschrijving: `Uit lesprofiel: ${p.naam} (week ${i+1} van ${p.aantalWeken})`,
        theorieLink: act.link||'', toetsBestand: act.bestand||null, profielId: p.id,
      });
    }
    if (pw.thema) await API.updateWeekThema(sw.id, pw.thema);
  }

  closeModalDirect();
  document.getElementById('profiel-detail-overlay')?.remove();
  window._selectedKlas = klasId;
  showView('jaarplanning');
}

function getPeriodeVoorWeekLP(wn) {
  if (wn>=35&&wn<=43) return 1;
  if (wn>=44||wn<=8) return 2;
  if (wn>=9&&wn<=18) return 3;
  return 4;
}
