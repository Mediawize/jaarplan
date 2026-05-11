// ============================================================
// dashboard.js — Docent dagdashboard
// ============================================================

async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [klassen, alleOpd, alleTaken, gebruikers] = await Promise.all([
      API.getKlassen(), API.getOpdrachten(), API.getTaken(), API.getGebruikers()
    ]);

    const cw = getCurrentWeek();
    const nu = new Date();
    const vandaagNaam = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'][nu.getDay()];
    const datumLang = nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const uur = nu.getHours();
    const begroeting = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    const voornaam = Auth.currentUser?.naam?.split(' ')[0] || '';

    const mijnRooster = normaliseerDashboardRooster(await API.getRooster(Auth.currentUser?.id));
    const lessenVandaag = _dbMaakDagLessen(alleOpd, klassen, cw, mijnRooster, vandaagNaam);
    const openTaken = (alleTaken || [])
      .filter(t => !t.afgerond)
      .sort((a, b) => _dbDatumWaarde(a.deadline) - _dbDatumWaarde(b.deadline));
    const materialen = _dbBenodigdVandaag(lessenVandaag);
    const totaalMin = lessenVandaag.reduce((som, les) => som + les.minuten, 0);
    const leerlingen = lessenVandaag.reduce((som, les) => som + (parseInt(les.klas?.aantalLeerlingen || les.klas?.leerlingen || 0) || 0), 0);

    document.getElementById('view-dashboard').innerHTML = `
      ${Auth.isManagement() ? `<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>U bent ingelogd als management — u kunt alles bekijken maar niet wijzigen.</div>` : ''}

      <div class="teacher-dashboard">
        <div class="td-topbar">
          <div>
            <h1>${escHtml(begroeting)} ${escHtml(voornaam)}! <span>👋</span></h1>
            <p>Hier is je overzicht voor vandaag, ${escHtml(datumLang)}.</p>
          </div>
          <div class="td-top-actions">
            <button class="td-btn td-btn-light" onclick="showView('jaarplanning')">
              <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v4M14 2v4M3 8h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Weekoverzicht
            </button>
            ${Auth.canEdit() ? `<button class="td-btn td-btn-primary" onclick="showView('jaarplanning')">+ Les voorbereiden</button>` : ''}
          </div>
        </div>

        <div class="td-layout">
          <main class="td-main">
            <section class="td-stats">
              ${_dbStatCard('📅', 'Vandaag', `${lessenVandaag.length} lessen`, 'rood')}
              ${_dbStatCard('🕘', 'Totaal lesduur', _dbFormatMinuten(totaalMin), 'oranje')}
              ${_dbStatCard('👥', 'Leerlingen', leerlingen || '—', 'blauw')}
              ${_dbStatCard('✅', 'Taken te doen', openTaken.length, 'groen')}
            </section>

            <div class="td-section-head">
              <h2>${escHtml(_dbKapitaal(vandaagNaam))} ${escHtml(nu.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }))}</h2>
              <label class="td-view-select">Weergave:
                <select onchange="window._dbWeergave=this.value;_herlaadDashboardLijst()">
                  <option value="tijdlijn">Tijdlijn</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>

            <div id="db-activiteiten-wrap">
              ${renderDashboardVandaag(lessenVandaag)}
            </div>
          </main>

          <aside class="td-side">
            <section class="td-widget">
              <div class="td-widget-title">Mijn taken vandaag <span>${openTaken.length}</span></div>
              <div class="td-task-list">
                ${openTaken.length ? openTaken.slice(0, 6).map(t => _dbTaakRegel(t)).join('') : `<div class="td-empty-small">Geen open taken.</div>`}
              </div>
              <button class="td-link" onclick="showView('taken')">Alle taken bekijken →</button>
            </section>

            <section class="td-widget">
              <div class="td-widget-title">Benodigd vandaag <span class="td-ok">✓</span></div>
              <div class="td-need-list">
                ${materialen.length ? materialen.map(m => _dbMateriaalRegel(m)).join('') : `<div class="td-empty-small">Geen materiaal gekoppeld.</div>`}
              </div>
              <button class="td-link" onclick="showView('lesmaterialen')">Alles bekijken →</button>
            </section>

            ${Auth.canEdit() ? `
            <section class="td-widget td-actions">
              <div class="td-widget-title">Snelle acties</div>
              <button onclick="showView('lesmaterialen')">▣ Nieuw lesmateriaal maken</button>
              <button onclick="openDashboardNotitiePlaceholder()">✦ AI lesassistent <span>Nieuw</span></button>
              <button onclick="showView('klassen')">▣ Bericht naar klas sturen</button>
              <button onclick="showView('toetsen')">☑ Les evalueren</button>
            </section>` : ''}

            <section class="td-tip">
              <div>💡 <strong>Tip van de dag</strong></div>
              <p>Vergeet niet de veiligheidsinstructie te herhalen bij de praktijklessen.</p>
            </section>
          </aside>
        </div>
      </div>
    `;

    window._dbKlassen = klassen;
    window._dbAlleOpd = alleOpd;
    window._dbDagLessen = lessenVandaag;
    window._dbTaken = alleTaken;
    window._dbWeergave = 'tijdlijn';
  } catch(e) { showError('Fout bij laden dashboard: ' + e.message); }
}

function _dbStatCard(icon, label, waarde, kleur) {
  return `<div class="td-stat td-stat-${kleur}">
    <div class="td-stat-icon">${icon}</div>
    <div><div class="td-stat-label">${escHtml(label)}</div><div class="td-stat-value">${escHtml(String(waarde))}</div></div>
  </div>`;
}

function normaliseerDashboardRooster(rooster) {
  const output = {};
  Object.entries(rooster || {}).forEach(([klasId, waarde]) => {
    output[klasId] = {};
    if (Array.isArray(waarde)) {
      waarde.forEach(dag => { output[klasId][String(dag).toLowerCase()] = [1]; });
    } else if (waarde && typeof waarde === 'object') {
      Object.entries(waarde).forEach(([dag, uren]) => {
        output[klasId][String(dag).toLowerCase()] = Array.isArray(uren) ? uren.map(Number).filter(Boolean).sort((a,b)=>a-b) : [];
      });
    }
  });
  return output;
}

function dashboardRoosterTijden(leerjaar) {
  const lj = parseInt(leerjaar, 10);
  const onderbouw = lj === 1 || lj === 2;
  return {
    1: ['08:30','09:15'],
    2: ['09:15','10:00'],
    3: ['10:20','11:05'],
    4: ['11:05','11:50'],
    5: onderbouw ? ['12:15','13:00'] : ['11:50','12:35'],
    6: ['13:00','13:45'],
    7: ['13:45','14:30'],
    8: ['14:45','15:30']
  };
}

function dashboardPauzes(leerjaar) {
  const lj = parseInt(leerjaar, 10);
  const onderbouw = lj === 1 || lj === 2;
  return onderbouw
    ? [['10:00','10:20'], ['11:50','12:15'], ['14:30','14:45']]
    : [['10:00','10:20'], ['12:35','13:00'], ['14:30','14:45']];
}

function _dbMaakDagLessen(alleOpd, klassen, cw, rooster, vandaagNaam) {
  const dag = String(vandaagNaam || '').toLowerCase();
  const lessen = [];

  klassen.forEach(klas => {
    const uren = (((rooster[klas.id] || {})[dag]) || []).map(Number).sort((a, b) => a - b);
    if (!uren.length) return;

    const blokken = maakLesuurBlokken(uren);
    const opdrachten = (alleOpd || [])
      .filter(o => o.klasId === klas.id && weekInRange(o.weken, cw))
      .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));

    blokken.forEach((blok, index) => {
      const opdracht = opdrachten[index] || opdrachten[0];
      if (!opdracht) return;
      const tijden = dashboardRoosterTijden(klas.leerjaar);
      const start = tijden[blok[0]]?.[0] || '08:30';
      const eind = tijden[blok[blok.length - 1]]?.[1] || _dbTelMinuten(start, 45 * blok.length);
      lessen.push({
        opdracht,
        klas,
        start,
        eind,
        minuten: 45 * blok.length,
        lesuren: blok,
        sort: tijdNaarMinuten(start)
      });
    });
  });

  return lessen.sort((a, b) => a.sort - b.sort);
}

function maakLesuurBlokken(uren) {
  const blokken = [];
  let huidig = [];
  uren.forEach(uur => {
    if (!huidig.length || uur === huidig[huidig.length - 1] + 1) huidig.push(uur);
    else { blokken.push(huidig); huidig = [uur]; }
  });
  if (huidig.length) blokken.push(huidig);
  return blokken;
}

function renderDashboardVandaag(lessen) {
  if (!lessen.length) {
    return `<div class="empty-state" style="padding:48px 24px"><p>Geen lessen voor vandaag ingesteld. Stel eerst je lesuren in bij Mijn rooster.</p><button class="btn btn-primary" style="margin-top:16px" onclick="showView('rooster')">Naar rooster →</button></div>`;
  }

  const items = [];
  lessen.forEach(les => {
    items.push({ type: 'les', start: les.start, sort: tijdNaarMinuten(les.start), les });
  });

  const leerjaar = lessen[0]?.klas?.leerjaar || 3;
  dashboardPauzes(leerjaar).forEach(([start, eind]) => {
    const begin = tijdNaarMinuten(start);
    const einde = tijdNaarMinuten(eind);
    const heeftLesErvoor = lessen.some(l => tijdNaarMinuten(l.start) < begin);
    const heeftLesErna = lessen.some(l => tijdNaarMinuten(l.eind) > einde);
    if (heeftLesErvoor && heeftLesErna) items.push({ type: 'pauze', start, eind, sort: begin });
  });

  items.sort((a, b) => a.sort - b.sort);

  return `<div class="td-timeline">
    ${items.map(item => item.type === 'pauze' ? renderDashboardPauze(item.start, item.eind) : renderLesCard(item.les)).join('')}
  </div>`;
}

function renderDashboardPauze(start, eind) {
  return `<div class="td-pause"><div class="td-time"><strong>${escHtml(start)}</strong><span>${escHtml(eind)}</span></div><div class="td-pause-card">🍴 <strong>Pauze</strong><span>${tijdNaarMinuten(eind) - tijdNaarMinuten(start)} minuten</span></div></div>`;
}

function tijdNaarMinuten(tijd) {
  const [u, m] = String(tijd || '00:00').split(':').map(Number);
  return (u || 0) * 60 + (m || 0);
}

function renderLesCard(les) {
  const o = les.opdracht;
  const klas = les.klas;
  const kleur = klas ? _klasKleur(klas.id) : '#94A3B8';
  const afk = klas ? (klas.naam.match(/\d+\s*[A-Z]+/)?.[0] || klas.naam.slice(0, 3)).replace(/\s/g, '').toUpperCase() : '?';
  const type = (o.type || 'Les');
  const lokaal = o.lokaal || o.leslokaal || (type.toLowerCase() === 'praktijk' ? 'Werkplaats' : 'Lokaal');
  const status = o.afgevinkt ? 'Afgerond' : 'In uitvoering';

  return `<article class="td-lesson ${o.afgevinkt ? 'is-done' : ''}" id="lescard-${o.id}">
    <div class="td-time"><strong>${escHtml(les.start)}</strong><span>${escHtml(les.eind)}</span><em>${_dbFormatMinutenKort(les.minuten)}</em></div>
    <div class="td-colorbar" style="background:${kleur}"></div>
    <div class="td-class" style="background:${kleur}">${escHtml(afk)}</div>
    <div class="td-lesson-body">
      <div class="td-lesson-main">
        <div>
          <h3>${escHtml(o.naam)}</h3>
          <div class="td-meta">▣ ${escHtml(type)} <span>•</span> ${klas ? escHtml(klas.naam) : 'Geen klas'} <span>•</span> ${escHtml(lokaal)} ${les.lesuren?.length ? `<span>•</span> Lesuur ${les.lesuren.join(', ')}` : ''}</div>
          <p><strong>Focus:</strong> ${escHtml(o.focus || o.beschrijving || 'Les voorbereiden en uitvoeren volgens de planning.')}</p>
        </div>
        <span class="td-status">${escHtml(status)}</span>
      </div>
      <div class="td-lesson-actions">
        ${_dbMateriaalButtons(o)}
        <button onclick="openLesbrief('${o.id}')">▤ Lesbrief</button>
        ${Auth.canEdit() ? `<button class="td-finish" onclick="dashboardAfvinken('${o.id}')">✓ ${o.afgevinkt ? 'Heropenen' : 'Les afronden'}</button><button onclick="dbOpenOpmerkingModal('${o.id}')">▣ Opmerking</button>` : ''}
      </div>
      ${o.opmerking ? `<div class="td-note">${escHtml(o.opmerking)}</div>` : ''}
    </div>
  </article>`;
}

function _dbMateriaalButtons(o) {
  const knoppen = [];

  const lesmateriaal = _dbEersteWaarde(o.theorieLink, o.lesmateriaalLink, o.lesmateriaalUrl, o.materiaalLink, o.materiaalUrl);
  const presentatie = _dbEersteWaarde(o.presentatieLink, o.presentatieUrl, o.presentatieBestand, o.slidesLink, o.slidesUrl);
  const werkboekje = _dbEersteWaarde(o.werkboekLink, o.werkboekjeLink, o.werkboekUrl, o.werkboekjeUrl);

  if (lesmateriaal) knoppen.push(_dbGekoppeldeKnop(lesmateriaal, 'Lesmateriaal'));
  if (presentatie) knoppen.push(_dbGekoppeldeKnop(presentatie, 'Presentatie'));
  if (werkboekje) knoppen.push(_dbGekoppeldeKnop(werkboekje, 'Werkboekje'));

  return knoppen.join('');
}

function _dbEersteWaarde(...waardes) {
  return waardes.find(v => typeof v === 'string' && v.trim())?.trim() || null;
}

function _dbGekoppeldeKnop(link, label) {
  return `<a href="${escHtml(link)}" target="_blank" rel="noopener">▤ ${escHtml(label)}</a>`;
}

function _dbTaakRegel(t) {
  const tijd = t.deadline ? new Date(t.deadline).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="td-task">
    <button class="td-task-check" onclick="dashboardTaakAfvinken('${t.id}')"></button>
    <span>${escHtml(t.naam)}</span>
    ${tijd ? `<em>${escHtml(tijd)}</em>` : ''}
  </div>`;
}

function _dbBenodigdVandaag(lessen) {
  const lijst = [];
  lessen.forEach(({ opdracht: o, klas }) => {
    const label = klas?.naam || '';
    if (o.materiaal) lijst.push({ naam: o.materiaal, aantal: label });
    if (o.materialen) String(o.materialen).split('\n').filter(Boolean).forEach(m => lijst.push({ naam: m.trim(), aantal: label }));
  });
  if (lijst.length) return lijst.slice(0, 6);
  return lessen.slice(0, 5).map(({ opdracht: o, klas }) => ({ naam: o.type?.toLowerCase() === 'praktijk' ? 'Praktijkmateriaal' : 'Lesmateriaal', aantal: klas?.naam || '' }));
}

function _dbMateriaalRegel(m) {
  return `<div class="td-need"><span>▣ ${escHtml(m.naam)}</span>${m.aantal ? `<em>${escHtml(m.aantal)}</em>` : ''}</div>`;
}

function _klasKleur(klasId) {
  const palet = ['#2563EB','#E11D48','#7C3AED','#0891B2','#EA580C','#16A34A','#4F46E5'];
  let h = 0;
  for (let i = 0; i < (klasId || '').length; i++) h = klasId.charCodeAt(i) + ((h << 5) - h);
  return palet[Math.abs(h) % palet.length];
}

function _dbTelMinuten(tijd, minuten) {
  const [u, m] = tijd.split(':').map(Number);
  const d = new Date();
  d.setHours(u, m + minuten, 0, 0);
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}
function _dbFormatMinuten(min) { const u = Math.floor(min / 60); const m = min % 60; return `${u}u${m ? ' ' + m + 'm' : ''}`; }
function _dbFormatMinutenKort(min) { return min === 60 ? '1u' : min > 60 ? `${Math.floor(min / 60)}u ${min % 60 || ''}`.trim() : `${min}m`; }
function _dbDatumWaarde(d) { return d ? new Date(d).getTime() : 9999999999999; }
function _dbKapitaal(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function switchDashboardTab() { _herlaadDashboardLijst(); }
function filterDashboardKlas() { _herlaadDashboardLijst(); }
function _herlaadDashboardLijst() {
  const wrap = document.getElementById('db-activiteiten-wrap');
  if (wrap) wrap.innerHTML = renderDashboardVandaag(window._dbDagLessen || []);
}

function dbOpenOpmerkingModal(id) {
  const opd = (window._dbAlleOpd || []).find(o => o.id === id);
  openModal(`
    <h2>Opmerking toevoegen</h2>
    <p class="modal-sub">Voeg een korte notitie toe bij deze les.</p>
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
  try { await API.setOpmerking(id, tekst); closeModalDirect(); renderDashboard(); }
  catch(e) { showError(e.message); }
}

function openDashboardNotitiePlaceholder() {
  openModal(`<h2>AI lesassistent</h2><p class="modal-sub">Deze knop kan straks openen naar de centrale AI-wizard.</p><div class="modal-actions"><button class="btn btn-primary" onclick="closeModalDirect()">Sluiten</button></div>`);
}

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
