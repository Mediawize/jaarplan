// ============================================================
// dashboard.js — Dashboard met lessen per dag/week
// ============================================================

async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [klassen, alleOpd, alleTaken] = await Promise.all([
      API.getKlassen(), API.getOpdrachten(), API.getTaken()
    ]);
    const cw = getCurrentWeek();
    const nu = new Date();

    const uur = nu.getHours();
    const begroeting = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    const voornaam = Auth.currentUser?.naam?.split(' ')[0] || '';

    // Voortgang deze week
    const opdDezeWeek = alleOpd.filter(o => weekInRange(o.weken, cw));
    const afgerondDezeWeek = opdDezeWeek.filter(o => o.afgevinkt).length;
    const voortgangPct = opdDezeWeek.length ? Math.round((afgerondDezeWeek / opdDezeWeek.length) * 100) : 0;
    const donutR = 28;
    const donutOmtrek = +(2 * Math.PI * donutR).toFixed(1);
    const donutVuld = +((voortgangPct / 100) * donutOmtrek).toFixed(1);

    document.getElementById('view-dashboard').innerHTML = `
      ${Auth.isManagement() ? `<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>U bent ingelogd als management — u kunt alles bekijken maar niet wijzigen.</div>` : ''}

      <div class="db-layout">

        <!-- ── HOOFDINHOUD ── -->
        <div class="db-main">

          <!-- Begroeting -->
          <div class="db-greeting-row">
            <div>
              <h1 class="db-begroeting">${escHtml(begroeting)} ${escHtml(voornaam)}!</h1>
              <div class="db-datum-sub">Hier is je planning voor vandaag.</div>
            </div>
          </div>

          <!-- Mobiele voortgang banner -->
          <div class="db-mobile-vg">
            <div class="db-mobile-vg-top">
              <span class="db-mobile-vg-label">Week ${cw} — voortgang</span>
              <strong class="db-mobile-vg-pct">${voortgangPct}%</strong>
            </div>
            <div class="db-mobile-vg-balk">
              <div class="db-mobile-vg-fill" style="width:${voortgangPct}%"></div>
            </div>
            <div class="db-mobile-vg-sub">${afgerondDezeWeek} van ${opdDezeWeek.length} lessen afgerond</div>
          </div>

          <!-- Tabs + Filter -->
          <div class="db-tabs-row">
            <div class="db-tabs">
              <button class="db-tab db-tab-actief" id="tab-vandaag" onclick="switchDashboardTab('vandaag')">
                <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16M6 12h2M10 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Vandaag
              </button>
              <button class="db-tab" id="tab-week" onclick="switchDashboardTab('week')">
                <svg viewBox="0 0 20 20" fill="none"><path d="M2 8h16M6 2v4M14 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>
                Week
              </button>
              <button class="db-tab" onclick="showView('jaarplanning')">
                <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 8h16M6 2v2M14 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Jaarplanning
              </button>
            </div>
            <div class="db-filter-wrap">
              <svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px;color:var(--ink-3);flex-shrink:0"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              <select class="db-filter-select" id="db-klas-filter" onchange="filterDashboardKlas(this.value)">
                <option value="">Alle klassen</option>
                ${klassen.map(k => `<option value="${k.id}">${escHtml(k.naam)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Activiteitenlijst -->
          <div id="db-activiteiten-wrap">
            ${renderDashboardVandaag(alleOpd, klassen, cw)}
          </div>

        </div>

        <!-- ── RECHTERPANEEL ── -->
        <div class="db-right-panel">

          <!-- Voortgang widget -->
          <div class="db-widget">
            <div class="db-widget-title">Voortgang deze week</div>
            <div class="db-voortgang-wrap">
              <div class="db-donut-wrap">
                <svg viewBox="0 0 80 80" class="db-donut">
                  <circle cx="40" cy="40" r="${donutR}" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
                  <circle cx="40" cy="40" r="${donutR}" fill="none" stroke="var(--accent)" stroke-width="10"
                    stroke-dasharray="${donutVuld} ${donutOmtrek}"
                    stroke-dashoffset="${(donutOmtrek * 0.25).toFixed(1)}"
                    stroke-linecap="round"/>
                  <text x="40" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)" font-family="Geist,sans-serif">${voortgangPct}%</text>
                  <text x="40" y="51" text-anchor="middle" font-size="8" fill="var(--ink-3)" font-family="Geist,sans-serif">afgerond</text>
                </svg>
              </div>
              <div class="db-voortgang-info">
                <div class="db-voortgang-getal">${afgerondDezeWeek} van ${opdDezeWeek.length}</div>
                <div class="db-voortgang-label">lessen afgerond</div>
                <button class="db-voortgang-link" onclick="showView('jaarplanning')">Bekijk weekoverzicht →</button>
              </div>
            </div>
          </div>

          <!-- Legenda -->
          <div class="db-widget">
            <div class="db-widget-title">Legenda</div>
            <div class="db-legenda">
              <div class="db-legenda-item"><span class="db-legenda-dot" style="background:var(--blue)"></span>Nog te geven</div>
              <div class="db-legenda-item"><span class="db-legenda-dot" style="background:var(--amber)"></span>In uitvoering</div>
              <div class="db-legenda-item"><span class="db-legenda-dot" style="background:var(--accent)"></span>Afgerond</div>
              <div class="db-legenda-item"><span class="db-legenda-dot" style="background:var(--ink-4)"></span>Geannuleerd</div>
            </div>
          </div>

          <!-- Snelle acties -->
          ${Auth.canEdit() ? `
          <div class="db-widget">
            <div class="db-widget-title">Snelle acties</div>
            <div class="db-snelle-acties">
              <button class="db-snelle-actie" onclick="showView('jaarplanning')">
                <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Les toevoegen
              </button>
              <button class="db-snelle-actie" onclick="openDashboardNotitiePlaceholder()">
                <svg viewBox="0 0 20 20" fill="none"><path d="M4 4h12v10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 14l3 3v-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
                Notitie toevoegen
              </button>
              <button class="db-snelle-actie" onclick="showView('lesprofielen')">
                <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h8M6 11h8M6 15h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Materiaal toevoegen
              </button>
              <button class="db-snelle-actie" onclick="showView('toetsen')">
                <svg viewBox="0 0 20 20" fill="none"><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>
                Evaluatie toevoegen
              </button>
            </div>
          </div>` : ''}

        </div>
      </div>
    `;

    window._dbKlassen = klassen;
    window._dbAlleOpd = alleOpd;
    window._dbTaken = alleTaken;
    window._dbTab = 'vandaag';
    window._dbKlasFilter = '';

  } catch(e) { showError('Fout bij laden dashboard: ' + e.message); }
}

// ============================================================
// LES KAART — expandable
// ============================================================
function _klasKleur(klasId) {
  const palet = ['#2563EB','#9333EA','#D97706','#0891B2','#DC2626','#4F46E5','#059669'];
  let h = 0;
  for (let i = 0; i < (klasId||'').length; i++) h = klasId.charCodeAt(i) + ((h << 5) - h);
  return palet[Math.abs(h) % palet.length];
}

function _statusInfo(o, cw) {
  if (o.afgevinkt) return { label: 'Afgerond', cls: 'db-status-afgerond' };
  const start = parseInt((o.weken || '0').split('-')[0]);
  if (!isNaN(start) && start <= cw) return { label: 'In uitvoering', cls: 'db-status-uitvoering' };
  return { label: 'Nog te geven', cls: 'db-status-nog' };
}

function _typeInfo(type) {
  switch ((type || '').toLowerCase()) {
    case 'theorie':  return { icoon: '📖', kleur: 'var(--blue)',   label: 'Theorie' };
    case 'praktijk': return { icoon: '🔧', kleur: 'var(--accent)', label: 'Praktijk' };
    case 'toets':    return { icoon: '✅', kleur: 'var(--amber)',   label: 'Toets' };
    default:         return { icoon: '📋', kleur: 'var(--ink-3)',   label: type || 'Les' };
  }
}

function renderLesCard(o, klas, cw) {
  const status = _statusInfo(o, cw);
  const kleur = klas ? _klasKleur(klas.id) : '#A8A29E';
  const afk = klas
    ? (klas.naam.match(/\d+\s*[A-Z]/)?.[0] || klas.naam.slice(0, 2)).replace(/\s/g, '').toUpperCase()
    : '?';
  const ti = _typeInfo(o.type);
  const heeftLinks = o.theorieLink || o.werkboekLink || o.toetsBestand;
  const isToets = (o.type || '').toLowerCase() === 'toets';

  return `
    <div class="db-les-card ${o.afgevinkt ? 'db-les-afgerond' : ''}" id="lescard-${o.id}">
      <div class="db-les-header" onclick="toggleLesCard('${o.id}')">
        <div class="db-les-header-left">
          <div class="db-klas-cirkel" style="background:${kleur}">${escHtml(afk)}</div>
          <div class="db-les-tekst">
            <div class="db-les-naam">${escHtml(o.naam)}</div>
            <div class="db-les-sub">
              <span style="color:${ti.kleur};font-weight:500">${ti.icoon} ${ti.label}</span>
              ${klas ? ` · ${escHtml(klas.naam)}` : ''}
              ${o.uren ? ` · ${o.uren}u` : ''}
              ${o.weken ? ` · Week ${escHtml(o.weken)}` : ''}
            </div>
          </div>
        </div>
        <div class="db-les-header-right">
          <span class="db-status-badge ${status.cls}">${status.label}</span>
          <svg class="db-chevron" id="chev-${o.id}" viewBox="0 0 20 20" fill="none">
            <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <div class="db-les-body" id="lesbody-${o.id}" style="display:none">
        ${o.beschrijving ? `<p class="db-les-beschrijving">${escHtml(o.beschrijving)}</p>` : ''}

        ${heeftLinks ? `
        <div class="db-les-materialen">
          ${o.theorieLink ? `
            <a href="${escHtml(o.theorieLink)}" target="_blank" rel="noopener" class="db-mat-btn" onclick="event.stopPropagation()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 2h8l4 4v12H5V2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 2v4h4" stroke="currentColor" stroke-width="1.5"/></svg>
              <div><div class="db-mat-label">Lesmateriaal</div><div class="db-mat-sub">Bekijk theoriemateriaal</div></div>
              <svg viewBox="0 0 20 20" fill="none" class="db-mat-arrow"><path d="M7 13L13 7M13 7H8M13 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>` : ''}
          ${o.werkboekLink ? `
            <a href="${escHtml(o.werkboekLink)}" target="_blank" rel="noopener" class="db-mat-btn db-mat-lesbrief" onclick="event.stopPropagation()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 3h9l4 4v11H4V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 3v4h4M7 9h6M7 12h6M7 15h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              <div><div class="db-mat-label">Werkboek</div><div class="db-mat-sub">Leerling werkboek</div></div>
              <svg viewBox="0 0 20 20" fill="none" class="db-mat-arrow"><path d="M7 13L13 7M13 7H8M13 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>` : ''}
          ${o.toetsBestand ? `
            <div class="db-mat-btn db-mat-toets">
              <svg viewBox="0 0 20 20" fill="none"><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>
              <div><div class="db-mat-label">Toets</div><div class="db-mat-sub">${escHtml(o.toetsBestand)}</div></div>
            </div>` : ''}
        </div>` : ''}

        <div class="db-les-acties">
          ${!isToets ? `
          <button class="db-lesbrief-btn" onclick="openLesbrief('${o.id}');event.stopPropagation()" title="Lesbrief bekijken of genereren">
            <svg viewBox="0 0 20 20" fill="none"><path d="M4 3h9l4 4v11H4V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 3v4h4M7 9h6M7 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Lesbrief
          </button>` : ''}
          ${Auth.canEdit() ? `
          <button class="db-afronden-btn ${o.afgevinkt ? 'db-afronden-klaar' : ''}" onclick="dashboardAfvinken('${o.id}');event.stopPropagation()">
            <svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${o.afgevinkt ? 'Afgerond ✓' : 'Afronden'}
          </button>
          <button class="db-opmerking-btn" onclick="dbOpenOpmerkingModal('${o.id}');event.stopPropagation()">
            <svg viewBox="0 0 20 20" fill="none"><path d="M4 4h12v10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 14l3 3v-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            Opmerking
          </button>` : ''}
        </div>

        ${o.opmerking ? `<div class="db-les-opmerking">
          <svg viewBox="0 0 20 20" fill="none" style="width:13px;height:13px;flex-shrink:0;margin-top:1px"><path d="M4 4h12v10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 14l3 3v-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          ${escHtml(o.opmerking)}
        </div>` : ''}
        ${o.afgevinktDoor ? `<div style="font-size:11px;color:var(--ink-4);margin-top:10px;display:flex;align-items:center;gap:5px">
          <svg viewBox="0 0 20 20" fill="none" style="width:12px;height:12px"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Afgerond door ${escHtml(o.afgevinktDoor)}
        </div>` : ''}
      </div>
    </div>
  `;
}

function toggleLesCard(id) {
  const body = document.getElementById(`lesbody-${id}`);
  const chev = document.getElementById(`chev-${id}`);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ============================================================
// TAB: VANDAAG — activiteiten deze week
// ============================================================
function renderDashboardVandaag(alleOpd, klassen, cw) {
  const opds = alleOpd
    .filter(o => weekInRange(o.weken, cw))
    .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));

  if (!opds.length) {
    return `<div class="empty-state" style="padding:48px 24px">
      <p>Geen activiteiten gepland voor week ${cw}.</p>
      <button class="btn btn-primary" style="margin-top:16px" onclick="showView('jaarplanning')">Naar jaarplanning →</button>
    </div>`;
  }

  return `
    <div class="db-les-lijst">
      ${opds.map(o => renderLesCard(o, klassen.find(k => k.id === o.klasId), cw)).join('')}
    </div>
    <div class="db-bottom-tip">💡 Tip: Klik op een les om deze in detail te bekijken en aan te passen.</div>
  `;
}

// ============================================================
// TAB: WEEK — komende weken gegroepeerd
// ============================================================
function renderDashboardWeek(alleOpd, klassen, cw) {
  const opds = alleOpd
    .filter(o => {
      const s = parseInt((o.weken || '0').split('-')[0]);
      return s >= cw && s <= cw + 4;
    })
    .sort((a, b) => parseInt(a.weken) - parseInt(b.weken));

  if (!opds.length) {
    return `<div class="empty-state" style="padding:48px 24px">
      <p>Geen activiteiten de komende weken.</p>
    </div>`;
  }

  const perWeek = {};
  opds.forEach(o => {
    const w = (o.weken || '').split('-')[0].trim();
    if (!perWeek[w]) perWeek[w] = [];
    perWeek[w].push(o);
  });

  return Object.entries(perWeek).map(([wk, list]) => `
    <div class="db-week-sectie">
      <div class="db-week-label">
        <span class="week-pill ${parseInt(wk) === cw ? 'current' : ''}">Week ${wk}</span>
        <span class="db-week-count">${list.length} activiteit${list.length !== 1 ? 'en' : ''}</span>
      </div>
      <div class="db-les-lijst">
        ${list.map(o => renderLesCard(o, klassen.find(k => k.id === o.klasId), cw)).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// TAB WISSELEN + FILTER
// ============================================================
function switchDashboardTab(tab) {
  ['vandaag', 'week'].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.classList.toggle('db-tab-actief', t === tab);
  });
  window._dbTab = tab;
  _herlaadDashboardLijst();
}

function filterDashboardKlas(klasId) {
  window._dbKlasFilter = klasId;
  _herlaadDashboardLijst();
}

function _herlaadDashboardLijst() {
  const alleOpd = window._dbAlleOpd || [];
  const klassen = window._dbKlassen || [];
  const cw = getCurrentWeek();
  const filter = window._dbKlasFilter || '';
  const tab = window._dbTab || 'vandaag';
  const gefilterd = filter ? alleOpd.filter(o => o.klasId === filter) : alleOpd;
  const wrap = document.getElementById('db-activiteiten-wrap');
  if (!wrap) return;
  wrap.innerHTML = tab === 'vandaag'
    ? renderDashboardVandaag(gefilterd, klassen, cw)
    : renderDashboardWeek(gefilterd, klassen, cw);
}

// ============================================================
// OPMERKING MODAL
// ============================================================
function dbOpenOpmerkingModal(id) {
  const opd = (window._dbAlleOpd || []).find(o => o.id === id);
  openModal(`
    <h2>Opmerking toevoegen</h2>
    <p class="modal-sub">Voeg een persoonlijke notitie toe bij deze activiteit.</p>
    <div class="form-field">
      <label>Opmerking</label>
      <textarea id="db-opmerking-tekst" rows="4" style="width:100%;padding:10px 12px;border:1.5px solid var(--border-2);border-radius:var(--radius-sm);font-family:var(--font);font-size:14px;resize:vertical;background:var(--surface)">${escHtml(opd?.opmerking || '')}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaOpmerkingOp('${id}')">Opslaan</button>
    </div>
  `);
}

async function slaOpmerkingOp(id) {
  const tekst = document.getElementById('db-opmerking-tekst')?.value || '';
  try {
    await API.setOpmerking(id, tekst);
    closeModalDirect();
    renderDashboard();
  } catch(e) { showError(e.message); }
}

function openDashboardNotitiePlaceholder() {
  openModal(`
    <h2>Notitie toevoegen</h2>
    <p class="modal-sub">Voeg een persoonlijke notitie toe via de opmerking bij een activiteit.</p>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModalDirect()">Sluiten</button>
    </div>
  `);
}

// ============================================================
// AFVINKEN
// ============================================================
async function dashboardAfvinken(id) {
  try { await API.afvinken(id); renderDashboard(); }
  catch(e) { showError(e.message); }
}

async function dashboardTaakAfvinken(id) {
  try { await API.taakAfvinken(id); renderDashboard(); }
  catch(e) { showError(e.message); }
}

async function dashboardTaakOppakken(id) {
  try { await API.taakOppakken(id); renderDashboard(); }
  catch(e) { showError(e.message); }
}
