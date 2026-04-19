async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [stats, klassen, alleOpd, gebruikers] = await Promise.all([API.getStats(), API.getKlassen(), API.getOpdrachten(), API.getGebruikers()]);
    const cw = getCurrentWeek();
    const komend = alleOpd.filter(o => {
      const start = parseInt((o.weken||'').split('-')[0]);
      return start >= cw && start <= cw + 6;
    }).sort((a,b) => parseInt(a.weken)-parseInt(b.weken)).slice(0,6);

    const hoofdklasIds = Auth.currentUser?.hoofdklassen || [];
    const hoofdklassen = klassen.filter(k => hoofdklasIds.includes(k.id));
    const andereKlassen = klassen.filter(k => !hoofdklasIds.includes(k.id));

    function klasKaart(k, isHoofd) {
      const vak = null; // vakken niet beschikbaar hier, tonen via badge
      const opd = alleOpd.filter(o=>o.klasId===k.id);
      const afg = opd.filter(o=>{const e=parseInt((o.weken||'99').split('-').pop().trim());return e<cw;}).length;
      const pct = opd.length?Math.round((afg/opd.length)*100):0;
      return `<div class="klas-card" style="${isHoofd?'border-color:var(--accent);':''}">
        <div class="klas-card-top">
          <div onclick="window._selectedKlas='${k.id}';showView('jaarplanning')" style="cursor:pointer;flex:1">
            <div class="klas-naam">${escHtml(k.naam)}</div>
            <div class="klas-meta-row">Leerjaar ${k.leerjaar||'?'} · ${escHtml(k.niveau)} · ${escHtml(k.schooljaar||'')}</div>
          </div>
          <button onclick="toggleHoofdklas('${k.id}')" title="${isHoofd?'Verwijder als hoofdklas':'Markeer als hoofdklas'}"
            style="background:none;border:none;cursor:pointer;font-size:20px;padding:4px;line-height:1;color:${isHoofd?'var(--amber)':'var(--border-med)'}">★</button>
        </div>
        <div class="klas-progress"><div class="klas-progress-fill" style="width:${pct}%"></div></div>
        <div class="klas-progress-label"><span>${opd.length} opdrachten</span><span>${pct}%</span></div>
        <button class="btn btn-sm" style="margin-top:10px;width:100%" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')">Planning openen →</button>
      </div>`;
    }

    document.getElementById('view-dashboard').innerHTML = `
      ${Auth.isManagement()?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>U bent ingelogd als management — u kunt alles bekijken maar niet wijzigen.</div>`:''}
      <div class="page-header">
        <div class="page-header-left">
          <div class="breadcrumb">${getSchooljaarLabel()} · Week ${cw}</div>
          <h1>Goedendag, ${escHtml(Auth.currentUser?.naam?.split(' ')[0]||'')}</h1>
        </div>
        ${Auth.canEdit()?`<button class="btn btn-primary" onclick="showView('klassen')"><svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Nieuwe klas</button>`:''}
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Klassen</div><div class="stat-value">${stats.aantalKlassen}</div><div class="stat-sub">actief schooljaar</div></div>
        <div class="stat-card"><div class="stat-label">Opdrachten</div><div class="stat-value">${stats.aantalOpdrachten}</div><div class="stat-sub">gepland dit jaar</div></div>
        <div class="stat-card"><div class="stat-label">Toetsen</div><div class="stat-value">${stats.aantalToetsen}</div><div class="stat-sub">beschikbaar</div></div>
        <div class="stat-card"><div class="stat-label">Vakken</div><div class="stat-value">${stats.aantalVakken}</div><div class="stat-sub">in gebruik</div></div>
      </div>

      ${hoofdklassen.length > 0 ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div><h2>★ Mijn hoofdklassen</h2><div class="card-meta">Klik op ★ om een klas als hoofdklas in te stellen</div></div></div>
        <div style="padding:20px"><div class="klas-grid">${hoofdklassen.map(k=>klasKaart(k,true)).join('')}</div></div>
      </div>` : ''}

      <div class="card">
        <div class="card-header">
          <div><h2>${hoofdklassen.length > 0 ? 'Overige klassen' : 'Mijn klassen'}</h2><div class="card-meta">${hoofdklassen.length > 0 ? 'Klik op ★ om als hoofdklas in te stellen' : 'Klik op ★ om een klas als hoofdklas in te stellen'}</div></div>
          <button class="btn btn-sm" onclick="showView('klassen')">Alle klassen</button>
        </div>
        <div style="padding:20px">
          ${klassen.length===0?`<div class="empty-state"><h3>Nog geen klassen</h3>${Auth.canEdit()?`<button class="btn btn-primary" onclick="showView('klassen')">Klas aanmaken</button>`:''}</div>`:`
          ${andereKlassen.length === 0 ? `<div style="color:var(--ink-muted);font-size:13px;padding:8px 0">Alle klassen zijn als hoofdklas ingesteld.</div>` : `
          <div class="klas-grid">${andereKlassen.map(k=>klasKaart(k,false)).join('')}</div>`}`}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Komende activiteiten</h2><div class="card-meta">Week ${cw} – ${cw+6}</div></div>
        ${komend.length===0?`<div class="empty-state"><p>Geen activiteiten gepland voor de komende weken.</p></div>`:`
        <table class="data-table">
          <thead><tr><th>Week</th><th>Klas</th><th>Activiteit</th><th>Type</th></tr></thead>
          <tbody>${komend.map(o=>{
            const klas=klassen.find(k=>k.id===o.klasId);
            const isNu=weekInRange(o.weken,cw);
            return `<tr class="${isNu?'planning-row-active':''}">
              <td><span class="week-pill ${isNu?'current':''}">Wk ${o.weken}</span></td>
              <td style="font-weight:500">${escHtml(klas?.naam||'—')}</td>
              <td><div style="font-weight:500">${escHtml(o.naam)}</div></td>
              <td><span class="badge ${typeKleur(o.type)}">${escHtml(o.type)}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>`}
      </div>
    `;
  } catch(e) { showError('Fout bij laden dashboard: ' + e.message); }
}

async function toggleHoofdklas(klasId) {
  const huidige = [...(Auth.currentUser?.hoofdklassen || [])];
  const nieuweHoofdklassen = huidige.includes(klasId)
    ? huidige.filter(id => id !== klasId)
    : [...huidige, klasId];
  try {
    await API.setHoofdklassen(Auth.currentUser.id, nieuweHoofdklassen);
    Auth.currentUser.hoofdklassen = nieuweHoofdklassen;
    renderDashboard();
  } catch(e) { showError(e.message); }
}
