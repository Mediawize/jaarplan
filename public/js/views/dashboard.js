async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [stats, klassen, alleOpd, alleTaken] = await Promise.all([
      API.getStats(), API.getKlassen(), API.getOpdrachten(), API.getTaken()
    ]);
    const cw = getCurrentWeek();

    // Komende opdrachten (komende 6 weken)
    const komend = alleOpd.filter(o => {
      const start = parseInt((o.weken||'').split('-')[0]);
      return start >= cw && start <= cw + 6;
    }).sort((a,b) => parseInt(a.weken)-parseInt(b.weken)).slice(0, 8);

    // Komende taken met deadline
    const nu = new Date();
    const over6w = new Date(); over6w.setDate(nu.getDate() + 42);
    const takenKomend = (alleTaken||[]).filter(t => {
      if (t.afgerond || !t.deadline) return false;
      const d = new Date(t.deadline);
      return d >= nu && d <= over6w;
    }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 4);

    const heeftKomend = komend.length > 0 || takenKomend.length > 0;

    document.getElementById('view-dashboard').innerHTML = `
      ${Auth.isManagement()?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>U bent ingelogd als management — u kunt alles bekijken maar niet wijzigen.</div>`:''}

      <div class="page-header">
        <div class="page-header-left">
          <div class="breadcrumb">${getSchooljaarLabel()} · Week ${cw}</div>
          <h1>Goedendag, ${escHtml(Auth.currentUser?.naam?.split(' ')[0]||'')}</h1>
        </div>
      </div>

      <!-- Statistieken -->
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Klassen</div><div class="stat-value">${stats.aantalKlassen}</div><div class="stat-sub">actief schooljaar</div></div>
        <div class="stat-card"><div class="stat-label">Opdrachten</div><div class="stat-value">${stats.aantalOpdrachten}</div><div class="stat-sub">gepland dit jaar</div></div>
        <div class="stat-card"><div class="stat-label">Toetsen</div><div class="stat-value">${stats.aantalToetsen}</div><div class="stat-sub">beschikbaar</div></div>
        <div class="stat-card"><div class="stat-label">Vakken</div><div class="stat-value">${stats.aantalVakken}</div><div class="stat-sub">in gebruik</div></div>
      </div>

      <!-- KOMENDE ACTIVITEITEN — bovenaan, met afvinkknop -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>Komende activiteiten</h2><div class="card-meta">Week ${cw} – ${cw+6}</div></div>
        </div>
        ${!heeftKomend
          ? `<div class="empty-state" style="padding:28px 20px"><p>Geen activiteiten gepland voor de komende weken.</p></div>`
          : `<div style="padding:0">
              ${komend.map(o => {
                const klas = klassen.find(k => k.id === o.klasId);
                const isNu = weekInRange(o.weken, cw);
                const afgevinkt = !!o.afgevinkt;
                const kanAfvinken = Auth.canEdit();
                return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);${afgevinkt?'opacity:0.55':''}${isNu?'background:rgba(22,163,74,0.02)':''}">
                  <!-- Afvinken -->
                  ${kanAfvinken ? `<button onclick="dashboardAfvinken('${o.id}')" title="${afgevinkt?'Terugzetten':'Afvinken'}"
                    style="width:26px;height:26px;border-radius:50%;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-2)'};background:${afgevinkt?'var(--accent)':'#fff'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
                    ${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
                  </button>` : `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-2)'};background:${afgevinkt?'var(--accent)':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    ${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
                  </div>`}
                  <!-- Inhoud -->
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span class="week-pill ${isNu?'current':''}" style="font-size:11px">Wk ${o.weken}</span>
                      <span style="font-size:13px;font-weight:600;${afgevinkt?'text-decoration:line-through;color:var(--ink-3)':''}">${escHtml(o.naam)}</span>
                      <span class="badge ${typeKleur(o.type)}" style="font-size:10px">${escHtml(o.type)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${escHtml(klas?.naam||'—')}
                      ${o.afgevinktDoor ? `<span style="margin-left:6px;font-size:11px;font-weight:700;font-family:monospace;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px">${escHtml(o.afgevinktDoor)}</span>` : ''}
                    </div>
                  </div>
                  <!-- Link naar jaarplanning -->
                  <button onclick="window._selectedKlas='${o.klasId}';showView('jaarplanning')" title="Open in jaarplanning"
                    style="width:28px;height:28px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--ink-3)">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>`;
              }).join('')}
              ${takenKomend.map(t => {
                const d = new Date(t.deadline);
                const telaatBinnen3 = (d - nu) < 3*24*60*60*1000;
                const heeftOpgepakt = (t.opgepakt||[]).includes(Auth.currentUser?.id);
                return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border)">
                  <!-- Afvinken taak -->
                  ${Auth.canEdit() ? `<button onclick="dashboardTaakAfvinken('${t.id}')" title="Taak afvinken"
                    style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border-2);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
                  </button>` : `<div style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border-2);background:#fff;flex-shrink:0"></div>`}
                  <!-- Inhoud taak -->
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:var(--amber-dim);color:var(--amber-text)">
                        📅 ${d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}
                      </span>
                      <span style="font-size:13px;font-weight:600">${escHtml(t.naam)}</span>
                      <span class="badge badge-amber" style="font-size:10px">Taak</span>
                      ${telaatBinnen3 ? `<span style="font-size:10px;font-weight:700;color:var(--red)">⚠ Binnenkort</span>` : ''}
                    </div>
                    <div style="font-size:12px;color:var(--ink-3);margin-top:2px;display:flex;align-items:center;gap:6px">
                      Sectietaak
                      ${Auth.canEdit() && !t.afgerond ? `<button onclick="dashboardTaakOppakken('${t.id}')"
                        style="font-size:11px;padding:2px 8px;border-radius:5px;border:1.5px solid ${heeftOpgepakt?'var(--accent)':'var(--border-2)'};background:${heeftOpgepakt?'var(--accent-dim)':'#fff'};color:${heeftOpgepakt?'var(--accent-text)':'var(--ink-3)'};cursor:pointer;font-weight:500">
                        ${heeftOpgepakt ? '✓ Opgepakt' : '+ Oppakken'}
                      </button>` : ''}
                    </div>
                  </div>
                  <!-- Link naar taken -->
                  <button onclick="showView('taken')" title="Open in taken"
                    style="width:28px;height:28px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--ink-3)">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>`;
              }).join('')}
            </div>`
        }
      </div>

      <!-- MIJN KLASSEN -->
      <div class="card">
        <div class="card-header">
          <div><h2>Mijn klassen</h2><div class="card-meta">Klik op een klas voor de jaarplanning</div></div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-sm" onclick="showView('klassen')">Alle klassen</button>
            ${Auth.canEdit()?`<button class="btn btn-primary" onclick="openKlasModal()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Nieuwe klas
            </button>`:''}
          </div>
        </div>
        <div style="padding:20px">
          ${klassen.length===0
            ? `<div class="empty-state"><h3>Nog geen klassen</h3>${Auth.canEdit()?`<button class="btn btn-primary" onclick="openKlasModal()">Klas aanmaken</button>`:''}</div>`
            : `<div class="klas-grid">
                ${klassen.slice(0,6).map(k => {
                  const opd = alleOpd.filter(o=>o.klasId===k.id);
                  const afg = opd.filter(o=>{const e=parseInt((o.weken||'99').split('-').pop().trim());return e<cw;}).length;
                  const pct = opd.length?Math.round((afg/opd.length)*100):0;
                  return `<div class="klas-card" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')" style="cursor:pointer">
                    <div class="klas-card-top"><div class="klas-naam">${escHtml(k.naam)}</div></div>
                    <div class="klas-meta-row">Leerjaar ${k.leerjaar||'?'} · ${escHtml(k.niveau)} · ${escHtml(k.schooljaar||'')}</div>
                    <div class="klas-progress"><div class="klas-progress-fill" style="width:${pct}%"></div></div>
                    <div class="klas-progress-label"><span>${opd.length} opdrachten</span><span>${pct}%</span></div>
                  </div>`;
                }).join('')}
              </div>`
          }
        </div>
      </div>
    `;
  } catch(e) { showError('Fout bij laden dashboard: ' + e.message); }
}

// Afvinken van opdracht direct vanuit dashboard
async function dashboardAfvinken(opdrachtId) {
  try {
    await API.afvinken(opdrachtId);
    renderDashboard();
  } catch(e) { showError(e.message); }
}

// Afvinken van taak direct vanuit dashboard
async function dashboardTaakAfvinken(taakId) {
  try {
    await API.taakAfvinken(taakId);
    renderDashboard();
  } catch(e) { showError(e.message); }
}

// Oppakken van taak direct vanuit dashboard
async function dashboardTaakOppakken(taakId) {
  try {
    await API.taakOppakken(taakId);
    renderDashboard();
  } catch(e) { showError(e.message); }
}
