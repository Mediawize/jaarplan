async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [stats, klassen, alleOpd, alleTaken] = await Promise.all([
      API.getStats(), API.getKlassen(), API.getOpdrachten(), API.getTaken()
    ]);
    const cw = getCurrentWeek();
    const nu = new Date();
    const dagNamen = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
    const vandaag = dagNamen[nu.getDay()];
    const isWeekend = nu.getDay() === 0 || nu.getDay() === 6;

    // Rooster ophalen
    let rooster = {};
    try { rooster = await API.getRooster(Auth.currentUser?.id); } catch(e) {}
    const heeftRooster = Object.keys(rooster).length > 0;

    // Filter klassen op rooster + roulatie
    const klassenVandaag = isWeekend ? [] : klassen.filter(k => {
      // Moet in rooster staan
      if (heeftRooster && !(rooster[k.id]||[]).includes(vandaag)) return false;
      // Roulatieklas: check of deze week actief is
      if (k.roulatie && !isRoulatieWeekActief(k, cw)) return false;
      return true;
    });

    const relevanteKlasIds = heeftRooster && !isWeekend
      ? klassenVandaag.map(k => k.id)
      : klassen.filter(k => !k.roulatie || isRoulatieWeekActief(k, cw)).map(k => k.id);

    // Komende opdrachten — roulatieweken overslaan
    const komend = alleOpd.filter(o => {
      if (!relevanteKlasIds.includes(o.klasId)) return false;
      const start = parseInt((o.weken||'').split('-')[0]);
      if (start < cw || start > cw + 6) return false;
      // Check roulatie voor de klas
      const klas = klassen.find(k => k.id === o.klasId);
      if (klas?.roulatie && !isRoulatieWeekActief(klas, start)) return false;
      return true;
    }).sort((a,b) => parseInt(a.weken)-parseInt(b.weken)).slice(0, 8);

    // Komende taken
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
          <div class="breadcrumb">${getSchooljaarLabel()} · Week ${cw} · ${vandaag}</div>
          <h1>Goedendag, ${escHtml(Auth.currentUser?.naam?.split(' ')[0]||'')}</h1>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Klassen</div><div class="stat-value">${stats.aantalKlassen}</div><div class="stat-sub">actief schooljaar</div></div>
        <div class="stat-card"><div class="stat-label">Opdrachten</div><div class="stat-value">${stats.aantalOpdrachten}</div><div class="stat-sub">gepland dit jaar</div></div>
        <div class="stat-card"><div class="stat-label">Toetsen</div><div class="stat-value">${stats.aantalToetsen}</div><div class="stat-sub">beschikbaar</div></div>
        <div class="stat-card"><div class="stat-label">Vakken</div><div class="stat-value">${stats.aantalVakken}</div><div class="stat-sub">in gebruik</div></div>
      </div>

      <!-- Vandaag badge -->
      ${heeftRooster && !isWeekend ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.05em">Vandaag (${vandaag} · wk ${cw}):</span>
        ${klassenVandaag.length === 0
          ? `<span style="font-size:13px;color:var(--ink-3)">Geen actieve klassen</span>`
          : klassenVandaag.map(k => `
            <span style="padding:4px 10px;background:${k.roulatie?'var(--amber-dim)':'var(--accent-dim)'};color:${k.roulatie?'var(--amber-text)':'var(--accent-text)'};border-radius:20px;font-size:12px;font-weight:600">
              ${escHtml(k.naam)}${k.roulatie?' ⟳':''}
            </span>`).join('')
        }
        <button class="btn btn-sm" onclick="showView('rooster')" style="margin-left:auto">
          <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16M6 12h2M10 12h2M14 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Rooster
        </button>
      </div>` : !heeftRooster ? `
      <div style="background:var(--amber-dim);border:1px solid rgba(217,119,6,0.2);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span style="font-size:13px;color:var(--amber-text);font-weight:500">Stel je rooster in voor een gepersonaliseerd dashboard.</span>
        <button class="btn btn-sm" onclick="showView('rooster')">Rooster instellen →</button>
      </div>` : ''}

      <!-- KOMENDE ACTIVITEITEN -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><h2>Komende activiteiten</h2><div class="card-meta">Week ${cw} – ${cw+6}${heeftRooster&&!isWeekend?' · alleen actieve klassen':''}</div></div>
          ${heeftRooster && !isWeekend ? `
          <button onclick="toggleDashboardFilter()" id="filter-toggle-btn" class="btn btn-sm">
            <svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Toon alles
          </button>` : ''}
        </div>
        <div id="activiteiten-container">
          ${renderActiviteitenLijst(komend, takenKomend, klassen, heeftKomend, nu)}
        </div>
      </div>

      <!-- MIJN KLASSEN — alleen actieve roulatieklassen tonen -->
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
            ? `<div class="empty-state"><h3>Nog geen klassen</h3></div>`
            : `<div class="klas-grid">
                ${(heeftRooster && !isWeekend && klassenVandaag.length > 0 ? klassenVandaag : klassen.filter(k => !k.roulatie || isRoulatieWeekActief(k, cw)).slice(0,6)).map(k => {
                  const opd = alleOpd.filter(o=>o.klasId===k.id);
                  const afg = opd.filter(o=>{const e=parseInt((o.weken||'99').split('-').pop().trim());return e<cw;}).length;
                  const pct = opd.length?Math.round((afg/opd.length)*100):0;
                  return `<div class="klas-card" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')" style="cursor:pointer">
                    <div class="klas-card-top">
                      <div class="klas-naam">${escHtml(k.naam)}${k.roulatie?` <span style="font-size:10px;font-weight:600;padding:1px 5px;background:var(--amber-dim);color:var(--amber-text);border-radius:10px">⟳</span>`:''}</div>
                    </div>
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

    window._dashboardAlles = false;
    window._dashboardKomend = komend;
    window._dashboardTakenKomend = takenKomend;
    window._dashboardKlassen = klassen;
    window._dashboardAlleOpd = alleOpd;
    window._dashboardRooster = rooster;
    window._dashboardVandaag = vandaag;

  } catch(e) { showError('Fout bij laden dashboard: ' + e.message); }
}

function renderActiviteitenLijst(komend, takenKomend, klassen, heeftKomend, nu) {
  if (!heeftKomend) {
    return `<div class="empty-state" style="padding:28px 20px"><p>Geen activiteiten gepland voor de komende weken.</p></div>`;
  }
  return `<div>${komend.map(o => {
    const klas = klassen.find(k => k.id === o.klasId);
    const cw = getCurrentWeek();
    const isNu = weekInRange(o.weken, cw);
    const afgevinkt = !!o.afgevinkt;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);${afgevinkt?'opacity:0.55':''}${isNu?'background:rgba(22,163,74,0.02)':''}">
      ${Auth.canEdit() ? `<button onclick="dashboardAfvinken('${o.id}')" style="width:26px;height:26px;border-radius:50%;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-2)'};background:${afgevinkt?'var(--accent)':'#fff'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
        ${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
      </button>` : `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${afgevinkt?'var(--accent)':'var(--border-2)'};background:${afgevinkt?'var(--accent)':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</div>`}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="week-pill ${isNu?'current':''}" style="font-size:11px">Wk ${o.weken}</span>
          <span style="font-size:13px;font-weight:600;${afgevinkt?'text-decoration:line-through;color:var(--ink-3)':''}">${escHtml(o.naam)}</span>
          <span class="badge ${typeKleur(o.type)}" style="font-size:10px">${escHtml(o.type)}</span>
        </div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${escHtml(klas?.naam||'—')}${klas?.roulatie?' ⟳':''}
          ${o.afgevinktDoor?`<span style="margin-left:6px;font-size:11px;font-weight:700;font-family:monospace;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px">${escHtml(o.afgevinktDoor)}</span>`:''}
        </div>
      </div>
      <button onclick="window._selectedKlas='${o.klasId}';showView('jaarplanning')" style="width:28px;height:28px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--ink-3)">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`;
  }).join('')}
  ${takenKomend.map(t => {
    const d = new Date(t.deadline);
    const binnenkort = (d - nu) < 3*24*60*60*1000;
    const heeftOpgepakt = (t.opgepakt||[]).includes(Auth.currentUser?.id);
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border)">
      ${Auth.canEdit()?`<button onclick="dashboardTaakAfvinken('${t.id}')" style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border-2);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0"></button>`:`<div style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border-2);background:#fff;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:var(--amber-dim);color:var(--amber-text)">📅 ${d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}</span>
          <span style="font-size:13px;font-weight:600">${escHtml(t.naam)}</span>
          <span class="badge badge-amber" style="font-size:10px">Taak</span>
          ${binnenkort?`<span style="font-size:10px;font-weight:700;color:var(--red)">⚠ Binnenkort</span>`:''}
        </div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:2px;display:flex;align-items:center;gap:6px">
          Sectietaak
          ${Auth.canEdit()?`<button onclick="dashboardTaakOppakken('${t.id}')" style="font-size:11px;padding:2px 8px;border-radius:5px;border:1.5px solid ${heeftOpgepakt?'var(--accent)':'var(--border-2)'};background:${heeftOpgepakt?'var(--accent-dim)':'#fff'};color:${heeftOpgepakt?'var(--accent-text)':'var(--ink-3)'};cursor:pointer;font-weight:500">${heeftOpgepakt?'✓ Opgepakt':'+ Oppakken'}</button>`:''}
        </div>
      </div>
      <button onclick="showView('taken')" style="width:28px;height:28px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--ink-3)">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`;
  }).join('')}</div>`;
}

async function toggleDashboardFilter() {
  const btn = document.getElementById('filter-toggle-btn');
  window._dashboardAlles = !window._dashboardAlles;
  const nu = new Date();
  const cw = getCurrentWeek();
  const klassen = window._dashboardKlassen;
  const alleOpd = window._dashboardAlleOpd;
  const rooster = window._dashboardRooster;
  const vandaag = window._dashboardVandaag;

  let komend;
  if (window._dashboardAlles) {
    komend = alleOpd.filter(o => {
      const start = parseInt((o.weken||'').split('-')[0]);
      return start >= cw && start <= cw + 6;
    }).sort((a,b) => parseInt(a.weken)-parseInt(b.weken)).slice(0, 12);
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Alleen vandaag`;
  } else {
    const relevanteKlasIds = klassen.filter(k => (rooster[k.id]||[]).includes(vandaag) && (!k.roulatie || isRoulatieWeekActief(k, cw))).map(k => k.id);
    komend = alleOpd.filter(o => {
      if (!relevanteKlasIds.includes(o.klasId)) return false;
      const start = parseInt((o.weken||'').split('-')[0]);
      return start >= cw && start <= cw + 6;
    }).sort((a,b) => parseInt(a.weken)-parseInt(b.weken)).slice(0, 8);
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Toon alles`;
  }

  const takenKomend = window._dashboardTakenKomend || [];
  const heeftKomend = komend.length > 0 || takenKomend.length > 0;
  document.getElementById('activiteiten-container').innerHTML = renderActiviteitenLijst(komend, takenKomend, klassen, heeftKomend, nu);
}

async function dashboardAfvinken(id) { try { await API.afvinken(id); renderDashboard(); } catch(e) { showError(e.message); } }
async function dashboardTaakAfvinken(id) { try { await API.taakAfvinken(id); renderDashboard(); } catch(e) { showError(e.message); } }
async function dashboardTaakOppakken(id) { try { await API.taakOppakken(id); renderDashboard(); } catch(e) { showError(e.message); } }
