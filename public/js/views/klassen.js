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
          const klasDocenten = (k.docenten||[k.docentId]).filter(Boolean).map(id => gebruikers.find(u=>u.id===id)).filter(Boolean);
          const opd = alleOpd.filter(o=>o.klasId===k.id);
          const afg = opd.filter(o=>{const e=parseInt((o.weken||'99').split('-').pop().trim());return e<cw;}).length;
          const progress = opd.length?Math.round((afg/opd.length)*100):0;
          return `<div class="klas-card">
            <div class="klas-card-top">
              <div>
                <div class="klas-naam">${escHtml(k.naam)}</div>
                <div class="klas-meta-row">Leerjaar ${k.leerjaar||'?'} · ${escHtml(k.niveau)} · ${escHtml(vak?.naam||'—')}${klasDocenten.length?`<br>${klasDocenten.map(d=>escHtml(d.naam+' '+d.achternaam)).join(', ')}`:''}${k.urenPerWeek?`<br>${k.urenPerWeek} uur/week`:''}</div>
              </div>
              ${!readonly?`<div style="display:flex;gap:6px">
                <button class="icon-btn" onclick="openKlasModal('${k.id}')"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button class="icon-btn" onclick="deleteKlas('${k.id}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
              </div>`:''}
            </div>
            <div style="margin-bottom:10px"><span class="badge badge-green">${escHtml(vak?.naam||'—')}</span><span style="font-size:11px;color:var(--ink-muted);margin-left:6px">${escHtml(k.schooljaar||'')}</span></div>
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
  const [vakken, gebruikers, schooljaren, alleKlassen] = await Promise.all([API.getVakken(), API.getGebruikers(), API.getSchooljaren(), API.getKlassen()]);
  const k = id ? alleKlassen.find(x=>x.id===id) : null;
  const docenten = gebruikers.filter(u=>u.rol==='docent'||u.rol==='admin');
  const gekoppeldeDocenten = k?.docenten || (k?.docentId ? [k.docentId] : []);

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
      <div class="form-field"><label>Uren per week</label><select id="klas-uren">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${(k?.urenPerWeek||3)===n?'selected':''}>${n} uur per week</option>`).join('')}</select></div>
      <div class="form-field form-full">
        <label>Docenten koppelen</label>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
          ${docenten.map(d=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border:1.5px solid var(--border-med);border-radius:var(--radius);transition:border-color .12s" onclick="this.style.borderColor=document.getElementById('klas-doc-${d.id}').checked?'var(--accent)':'var(--border-med)'">
            <input type="checkbox" id="klas-doc-${d.id}" class="klas-docent-cb" value="${d.id}" ${gekoppeldeDocenten.includes(d.id)?'checked':''}>
            <span>${escHtml(d.naam)} ${escHtml(d.achternaam)}</span>
            <span style="font-size:11px;color:var(--ink-muted);margin-left:auto">${escHtml(d.rol)}</span>
          </label>`).join('')}
        </div>
        ${docenten.length===0?`<div style="color:var(--ink-muted);font-size:13px">Geen docenten beschikbaar.</div>`:''}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveKlas('${id||''}')">Opslaan</button>
    </div>
  `);
  // Fix border color for already checked items
  setTimeout(() => {
    docenten.forEach(d => {
      const cb = document.getElementById(`klas-doc-${d.id}`);
      if (cb?.checked) cb.closest('label').style.borderColor = 'var(--accent)';
    });
  }, 50);
}

async function saveKlas(id) {
  const docenten = Array.from(document.querySelectorAll('.klas-docent-cb:checked')).map(cb => cb.value);
  const data = {
    naam: document.getElementById('klas-naam').value.trim(),
    schooljaar: document.getElementById('klas-schooljaar').value,
    leerjaar: parseInt(document.getElementById('klas-leerjaar').value),
    niveau: document.getElementById('klas-niveau').value,
    vakId: document.getElementById('klas-vak').value,
    docentId: docenten[0] || null, // eerste docent blijft hoofddocent voor compatibiliteit
    docenten,
    urenPerWeek: parseInt(document.getElementById('klas-uren').value),
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
