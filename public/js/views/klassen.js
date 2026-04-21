async function renderKlassen() {
  showLoading('klassen');
  try {
    const [klassen, vakken, gebruikers, alleOpd] = await Promise.all([API.getKlassen(), API.getVakken(), API.getGebruikers(), API.getOpdrachten()]);
    const readonly = !Auth.canEdit();
    const cw = getCurrentWeek();

    document.getElementById('view-klassen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Klassen</h1></div>
        ${!readonly?`<button class="btn btn-primary" onclick="openKlasModal()">+ Klas toevoegen</button>`:''}
      </div>
      ${readonly?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus</div>`:''}
      ${klassen.length===0?`<div class="empty-state"><h3>Geen klassen</h3>${!readonly?`<button class="btn btn-primary" onclick="openKlasModal()">Eerste klas aanmaken</button>`:''}</div>`:`
      <div class="klas-grid">
        ${klassen.map(k => {
          const vak = vakken.find(v=>v.id===k.vakId);
          const docent = gebruikers.find(u=>u.id===k.docentId);
          const opd = alleOpd.filter(o=>o.klasId===k.id);
          const afg = opd.filter(o=>{const e=parseInt((o.weken||'99').split('-').pop().trim());return e<cw;}).length;
          const progress = opd.length?Math.round((afg/opd.length)*100):0;
          return `<div class="klas-card">
            <div class="klas-card-top">
              <div>
                <div class="klas-naam">${escHtml(k.naam)}${k.roulatie?` <span style="font-size:10px;font-weight:600;padding:2px 6px;background:var(--amber-dim);color:var(--amber-text);border-radius:10px">Roulatie</span>`:''}</div>
                <div class="klas-meta-row">Leerjaar ${k.leerjaar||'?'} · ${escHtml(k.niveau)} · ${escHtml(vak?.naam||'—')}${docent?`<br>${escHtml(docent.naam)} ${escHtml(docent.achternaam)}`:''}${k.urenPerWeek?`<br>${k.urenPerWeek} uur/week`:''}${k.roulatie?`<br><span style="color:var(--amber-text)">⟳ ${k.roulatieBlok}w aan / ${k.roulatieBlok}w af · start wk ${k.roulatieStart}</span>`:''}</div>
              </div>
              ${!readonly?`<div style="display:flex;gap:6px">
                <button class="icon-btn" onclick="openKlasModal('${k.id}')"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button class="icon-btn" onclick="deleteKlas('${k.id}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
              </div>`:''}
            </div>
            <div style="margin-bottom:10px"><span class="badge badge-green">${escHtml(vak?.naam||'—')}</span><span style="font-size:11px;color:var(--ink-3);margin-left:6px">${escHtml(k.schooljaar||'')}</span></div>
            <div class="klas-progress"><div class="klas-progress-fill" style="width:${progress}%"></div></div>
            <div class="klas-progress-label"><span>${opd.length} opdrachten</span><span>${progress}%</span></div>
            <button class="btn btn-sm" style="margin-top:12px;width:100%" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')">Planning openen →</button>
          </div>`;
        }).join('')}
      </div>`}
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openKlasModal(id = null) {
  const [vakken, gebruikers, schooljaren] = await Promise.all([API.getVakken(), API.getGebruikers(), API.getSchooljaren()]);
  const k = id ? (await API.getKlassen()).find(x=>x.id===id) : null;
  const docenten = gebruikers.filter(u=>u.rol==='docent'||u.rol==='admin');

  // Genereer weekopties 1-52
  const weekOpties = [];
  for (let w = 35; w <= 52; w++) weekOpties.push(w);
  for (let w = 1; w <= 28; w++) weekOpties.push(w);

  openModal(`
    <h2>${k?'Klas bewerken':'Nieuwe klas aanmaken'}</h2>
    <p class="modal-sub">Vul de gegevens van de klas in.</p>
    <div class="form-grid">
      <div class="form-field"><label>Klasnaam *</label><input id="klas-naam" placeholder="bijv. 3 HAVO A" value="${escHtml(k?.naam||'')}"></div>
      <div class="form-field"><label>Schooljaar *</label><select id="klas-schooljaar">
        ${schooljaren.map(sj=>`<option value="${sj.naam}" ${k?.schooljaar===sj.naam?'selected':''}>${sj.naam}</option>`).join('')}
        ${!schooljaren.length?`<option value="2025-2026">2025-2026</option>`:''}
      </select></div>
      <div class="form-field"><label>Leerjaar *</label><select id="klas-leerjaar">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${(k?.leerjaar||3)==n?'selected':''}>Leerjaar ${n}</option>`).join('')}</select></div>
      <div class="form-field"><label>Niveau *</label><select id="klas-niveau">${['VMBO-B','VMBO-K','VMBO-GT','HAVO','VWO'].map(n=>`<option value="${n}" ${k?.niveau===n?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="form-field"><label>Vak *</label><select id="klas-vak">${vakken.map(v=>`<option value="${v.id}" ${k?.vakId===v.id?'selected':''}>${escHtml(v.naam)} — ${escHtml(v.volledig||'')}</option>`).join('')}</select></div>
      <div class="form-field"><label>Docent koppelen</label><select id="klas-docent"><option value="">— Geen docent —</option>${docenten.map(d=>`<option value="${d.id}" ${k?.docentId===d.id?'selected':''}>${escHtml(d.naam)} ${escHtml(d.achternaam)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren per week</label><select id="klas-uren">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${(k?.urenPerWeek||3)===n?'selected':''}>${n} uur per week</option>`).join('')}</select></div>
    </div>

    <!-- Roulatie sectie -->
    <div style="margin-top:20px;padding:16px;background:var(--surface-2);border-radius:var(--radius);border:1.5px solid var(--border)">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:0">
        <input type="checkbox" id="klas-roulatie" ${k?.roulatie?'checked':''} onchange="toggleRoulatieOpties()" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--ink)">Roulatieklas</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:1px">Deze klas heeft een wisselend rooster — bijv. 5 weken les, 5 weken een andere klas</div>
        </div>
      </label>

      <div id="roulatie-opties" style="display:${k?.roulatie?'block':'none'};margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="form-grid">
          <div class="form-field">
            <label>Weken per blok</label>
            <select id="klas-roulatie-blok">
              ${[2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${(k?.roulatieBlok||5)===n?'selected':''}>${n} weken aan / ${n} weken af</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Startweek eerste blok</label>
            <select id="klas-roulatie-start">
              ${weekOpties.map(w=>`<option value="${w}" ${(k?.roulatieStart||35)===w?'selected':''}>Week ${w}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="roulatie-preview" style="margin-top:10px;font-size:12px;color:var(--ink-3)"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveKlas('${id||''}')">Opslaan</button>
    </div>
  `);

  // Preview updaten bij wijziging
  if (k?.roulatie) updateRoulatiePreview();
  document.getElementById('klas-roulatie-blok')?.addEventListener('change', updateRoulatiePreview);
  document.getElementById('klas-roulatie-start')?.addEventListener('change', updateRoulatiePreview);
}

function toggleRoulatieOpties() {
  const aan = document.getElementById('klas-roulatie')?.checked;
  const opties = document.getElementById('roulatie-opties');
  if (opties) opties.style.display = aan ? 'block' : 'none';
  if (aan) updateRoulatiePreview();
}

function updateRoulatiePreview() {
  const blok = parseInt(document.getElementById('klas-roulatie-blok')?.value || 5);
  const start = parseInt(document.getElementById('klas-roulatie-start')?.value || 35);
  const preview = document.getElementById('roulatie-preview');
  if (!preview) return;

  // Bereken de eerste 3 actieve blokken
  const schoolWeekNummers = [];
  for (let w = 35; w <= 52; w++) schoolWeekNummers.push(w);
  for (let w = 1; w <= 28; w++) schoolWeekNummers.push(w);

  function weekNaarIdx(wn) {
    return wn >= 35 ? wn - 35 : wn + (52 - 35) + 1;
  }

  const startIdx = weekNaarIdx(start);
  const blokken = [];
  let blokStart = null;

  schoolWeekNummers.forEach(wn => {
    const idx = weekNaarIdx(wn);
    let diff = idx - startIdx;
    if (diff < 0) diff += 53;
    const pos = diff % (blok * 2);
    const actief = pos < blok;

    if (actief && blokStart === null) blokStart = wn;
    if (!actief && blokStart !== null) {
      const prevWn = schoolWeekNummers[schoolWeekNummers.indexOf(wn) - 1];
      blokken.push(`wk ${blokStart}–${prevWn}`);
      blokStart = null;
    }
  });
  if (blokStart !== null) blokken.push(`wk ${blokStart}–28`);

  const eerste3 = blokken.slice(0, 3);
  preview.innerHTML = `<span style="color:var(--accent-text);font-weight:500">Actief in:</span> ${eerste3.join(', ')}${blokken.length > 3 ? ', ...' : ''}`;
}

async function saveKlas(id) {
  const data = {
    naam: document.getElementById('klas-naam').value.trim(),
    schooljaar: document.getElementById('klas-schooljaar').value,
    leerjaar: parseInt(document.getElementById('klas-leerjaar').value),
    niveau: document.getElementById('klas-niveau').value,
    vakId: document.getElementById('klas-vak').value,
    docentId: document.getElementById('klas-docent').value || null,
    urenPerWeek: parseInt(document.getElementById('klas-uren').value),
    roulatie: document.getElementById('klas-roulatie')?.checked || false,
    roulatieBlok: parseInt(document.getElementById('klas-roulatie-blok')?.value || 5),
    roulatieStart: parseInt(document.getElementById('klas-roulatie-start')?.value || 35),
  };
  if (!data.naam || !data.schooljaar || !data.vakId) { alert('Vul alle verplichte velden in.'); return; }
  try {
    if (id) { await API.updateKlas(id, data); } else { await API.addKlas(data); }
    Cache.invalidate('klassen');
    closeModalDirect();
    renderKlassen();
  } catch(e) { showError(e.message); }
}

async function deleteKlas(id) {
  if (!confirm('Klas verwijderen? Dit verwijdert ook alle gekoppelde opdrachten.')) return;
  try { await API.deleteKlas(id); Cache.invalidateAll(); renderKlassen(); }
  catch(e) { showError(e.message); }
}
