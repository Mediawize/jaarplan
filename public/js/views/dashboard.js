// ============================================================
// dashboard.js — Dashboard met mobiel-vriendelijke activiteitenkaarten
// MOBIEL: grote touch targets, duidelijke knoppen, link-buttons zichtbaar
// ============================================================

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
      if (heeftRooster && !(rooster[k.id]||[]).includes(vandaag)) return false;
      if (k.roulatie && !isRoulatieWeekActief(k, cw)) return false;
      return true;
    });

    const relevanteKlasIds = heeftRooster && !isWeekend
      ? klassenVandaag.map(k => k.id)
      : klassen.filter(k => !k.roulatie || isRoulatieWeekActief(k, cw)).map(k => k.id);

    // Komende opdrachten
    const komend = alleOpd.filter(o => {
      if (!relevanteKlasIds.includes(o.klasId)) return false;
      const start = parseInt((o.weken||'').split('-')[0]);
      if (start < cw || start > cw + 6) return false;
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

      <!-- Stat grid: verborgen op mobiel, niet relevant voor docenten onderweg -->
      <div class="stat-grid db-stat-grid-desktop">
        <div class="stat-card"><div class="stat-label">Klassen</div><div class="stat-value">${stats.aantalKlassen}</div><div class="stat-sub">actief schooljaar</div></div>
        <div class="stat-card"><div class="stat-label">Opdrachten</div><div class="stat-value">${stats.aantalOpdrachten}</div><div class="stat-sub">gepland dit jaar</div></div>
        <div class="stat-card"><div class="stat-label">Toetsen</div><div class="stat-value">${stats.aantalToetsen}</div><div class="stat-sub">beschikbaar</div></div>
        <div class="stat-card"><div class="stat-label">Vakken</div><div class="stat-value">${stats.aantalVakken}</div><div class="stat-sub">in gebruik</div></div>
      </div>

      <!-- Vandaag badge -->
      ${heeftRooster && !isWeekend ? `
      <div class="db-vandaag-row">
        <span class="db-vandaag-label">Vandaag (${vandaag} · wk ${cw}):</span>
        <div class="db-vandaag-klassen">
          ${klassenVandaag.length === 0
            ? `<span style="font-size:13px;color:var(--ink-3)">Geen actieve klassen</span>`
            : klassenVandaag.map(k => `
              <span class="db-klas-badge ${k.roulatie?'db-klas-badge-roulatie':''}">
                ${escHtml(k.naam)}${k.roulatie?' ⟳':''}
              </span>`).join('')
          }
        </div>
        <button class="btn btn-sm db-rooster-btn" onclick="showView('rooster')">
          <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Rooster
        </button>
      </div>` : !heeftRooster ? `
      <div class="db-rooster-tip">
        <span>Stel je rooster in voor een gepersonaliseerd dashboard.</span>
        <button class="btn btn-sm" onclick="showView('rooster')">Rooster instellen →</button>
      </div>` : ''}

      <!-- KOMENDE ACTIVITEITEN -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>Komende activiteiten</h2>
            <div class="card-meta">Week ${cw} – ${cw+6}${heeftRooster&&!isWeekend?' · alleen actieve klassen':''}</div>
          </div>
          ${heeftRooster && !isWeekend ?
            `<button id="filter-toggle-btn" class="btn btn-sm" onclick="toggleDashboardFilter()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Toon alles
            </button>` : ''}
        </div>
        <div id="activiteiten-container">
          ${renderActiviteitenLijst(komend, takenKomend, klassen, heeftKomend, nu)}
        </div>
      </div>

      <!-- Klasoverzicht: alleen desktop -->
      <div class="db-klasoverzicht-desktop">
        <div class="card">
          <div class="card-header"><h2>Voortgang per klas</h2></div>
          ${klassen.length === 0
            ? `<div class="empty-state"><p>Nog geen klassen.</p></div>`
            : `<div style="padding:16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
                ${klassen.filter(k => !k.roulatie || isRoulatieWeekActief(k, cw)).map(k => {
                  const opd = alleOpd.filter(o => o.klasId === k.id);
                  const afgevinkt = opd.filter(o => o.afgevinkt).length;
                  const pct = opd.length ? Math.round((afgevinkt/opd.length)*100) : 0;
                  return `<div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')">
                    <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escHtml(k.naam)}</div>
                    <div style="font-size:11px;color:var(--ink-3);margin-bottom:8px">${escHtml(k.niveau)} · ${escHtml(k.schooljaar||'')}</div>
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

// ============================================================
// ACTIVITEITEN LIJST — mobiel-vriendelijke kaarten
// ============================================================
function renderActiviteitenLijst(komend, takenKomend, klassen, heeftKomend, nu) {
  if (!heeftKomend) {
    return `<div class="empty-state" style="padding:28px 20px"><p>Geen activiteiten gepland voor de komende weken.</p></div>`;
  }

  const cw = getCurrentWeek();

  const opdrachtenHTML = komend.map(o => {
    const klas = klassen.find(k => k.id === o.klasId);
    const isNu = weekInRange(o.weken, cw);
    const afgevinkt = !!o.afgevinkt;
    const heeftLinks = o.theorieLink || o.werkboekLink || o.toetsBestand;

    return `<div class="db-activiteit-kaart ${afgevinkt ? 'db-activiteit-afgevinkt' : ''} ${isNu ? 'db-activiteit-nu' : ''}">

      <!-- Linkerbalk kleur -->
      <div class="db-activiteit-balk" style="background:${typeKleurHex(o.type)}"></div>

      <!-- Inhoud -->
      <div class="db-activiteit-body">

        <!-- Rij 1: week + klas + badge -->
        <div class="db-activiteit-meta">
          <span class="week-pill ${isNu?'current':''}" style="font-size:11px">Wk ${o.weken}</span>
          <span class="db-activiteit-klas">${escHtml(klas?.naam||'—')}</span>
          <span class="badge ${typeKleur(o.type)}" style="font-size:10px">${escHtml(o.type)}</span>
          ${isNu ? `<span class="db-nu-badge">● Nu</span>` : ''}
        </div>

        <!-- Naam -->
        <div class="db-activiteit-naam ${afgevinkt?'db-naam-afgevinkt':''}">${escHtml(o.naam)}</div>

        <!-- Beschrijving -->
        ${o.beschrijving ? `<div class="db-activiteit-beschr">${escHtml(o.beschrijving)}</div>` : ''}

        <!-- Link-knoppen: theorie, werkboek, toets -->
        ${heeftLinks ? `
        <div class="db-activiteit-links">
          ${o.theorieLink ? `
            <a href="${escHtml(o.theorieLink)}" target="_blank" rel="noopener" class="db-link-btn db-link-theorie" onclick="event.stopPropagation()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 4h8l4 4v8H4V4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 4v4h4M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Theorie
            </a>` : ''}
          ${o.werkboekLink ? `
            <a href="${escHtml(o.werkboekLink)}" target="_blank" rel="noopener" class="db-link-btn db-link-werkboek" onclick="event.stopPropagation()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 3h8l4 4v11H4V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 3v4h4" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h6M7 13h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Werkboek
            </a>` : ''}
          ${o.toetsBestand ? `
            <span class="db-link-btn db-link-toets">
              <svg viewBox="0 0 20 20" fill="none"><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>
              ${escHtml(o.toetsBestand)}
            </span>` : ''}
        </div>` : ''}

        <!-- Afvinken rij -->
        ${Auth.canEdit() ? `
        <div class="db-activiteit-acties">
          ${o.afgevinktDoor ? `<span class="db-afgevinkt-door">${escHtml(o.afgevinktDoor)}</span>` : ''}
          <button
            class="db-afvinken-btn ${afgevinkt ? 'db-afvinken-btn-klaar' : ''}"
            onclick="dashboardAfvinken('${o.id}')"
          >
            ${afgevinkt
              ? `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Klaar`
              : `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/></svg> Afvinken`
            }
          </button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  const takenHTML = takenKomend.map(t => {
    const d = new Date(t.deadline);
    const binnenkort = (d - nu) < 3*24*60*60*1000;
    const heeftOpgepakt = (t.opgepakt||[]).includes(Auth.currentUser?.id);
    return `<div class="db-activiteit-kaart db-activiteit-taak">
      <div class="db-activiteit-balk" style="background:var(--amber)"></div>
      <div class="db-activiteit-body">
        <div class="db-activiteit-meta">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:var(--amber-dim);color:var(--amber-text)">
            📅 ${d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}
          </span>
          <span class="badge badge-amber" style="font-size:10px">Taak</span>
          ${binnenkort ? `<span style="font-size:10px;font-weight:700;color:var(--red)">⚠ Binnenkort</span>` : ''}
        </div>
        <div class="db-activiteit-naam">${escHtml(t.naam)}</div>
        ${t.beschrijving ? `<div class="db-activiteit-beschr">${escHtml(t.beschrijving)}</div>` : ''}
        ${Auth.canEdit() ? `
        <div class="db-activiteit-acties">
          <button
            class="db-oppakken-btn ${heeftOpgepakt ? 'db-oppakken-btn-actief' : ''}"
            onclick="dashboardTaakOppakken('${t.id}')"
          >${heeftOpgepakt ? '✓ Opgepakt' : '+ Oppakken'}</button>
          <button
            class="db-afvinken-btn"
            onclick="dashboardTaakAfvinken('${t.id}')"
          >
            <svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Afgerond
          </button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div class="db-activiteiten-lijst">${opdrachtenHTML}${takenHTML}</div>`;
}

function typeKleurHex(t) {
  const m = {
    'Theorie':'#2563EB','Opdracht':'#16A34A','Groepsopdracht':'#16A34A',
    'Toets':'#D97706','Eindtoets':'#DC2626','Praktijk':'#9333EA',
    'Project':'#0891B2','Presentatie':'#78716C','Overig':'#A8A29E',
  };
  return m[t] || '#A8A29E';
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
