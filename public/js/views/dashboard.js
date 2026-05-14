// ============================================================
// dashboard.js — Docent dagdashboard
// ============================================================

async function renderDashboard() {
  showLoading('dashboard');
  try {
    const [klassen, alleOpd, alleTaken, gebruikers, profielen, modules, werkboekjes, toetsen] = await Promise.all([
      API.getKlassen(),
      API.getOpdrachten(),
      API.getTaken(),
      API.getGebruikers(),
      API.getLesprofielen().catch(() => []),
      API.getLesModules().catch(() => []),
      API.getMaterialen('werkboekje').catch(() => []),
      API.getMaterialen('toets').catch(() => [])
    ]);

    const cw = getCurrentWeek();
    const nu = new Date();
    const vandaagNaam = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'][nu.getDay()];
    const datumLang = nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const uur = nu.getHours();
    const begroeting = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    const voornaam = Auth.currentUser?.naam?.split(' ')[0] || '';

    const mijnRooster = normaliseerDashboardRooster(await API.getRooster(Auth.currentUser?.id));
    const lessenVandaag = _dbVerrijkLessenMetModules(
      _dbMaakDagLessen(alleOpd, klassen, cw, mijnRooster, vandaagNaam),
      profielen,
      modules,
      werkboekjes,
      toetsen
    );
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
              <div class="td-widget-title">Benodigd vandaag</div>
              <div class="td-need-list">
                ${materialen.length ? materialen.map((g, i) => _dbKlasGroepHtml(g, i === 0)).join('') : `<div class="td-empty-small">Geen materiaal gekoppeld.</div>`}
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
    window._dbProfielen = profielen;
    window._dbModules = modules;
    window._dbWerkboekjes = werkboekjes;
    window._dbToetsen = toetsen;
    if (!window._dbWeergave) window._dbWeergave = 'tijdlijn';
    setTimeout(_dbVerversLesbriefKnoppen, 0);
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


function _dbVerrijkLessenMetModules(lessen, profielen, modules, werkboekjes, toetsen) {
  const profielMap = Object.fromEntries((profielen || []).map(p => [p.id, p]));
  const moduleMap = Object.fromEntries((modules || []).map(m => [m.id, m]));

  return (lessen || []).map(les => {
    const opdracht = les.opdracht || {};
    const profiel = opdracht.profielId ? profielMap[opdracht.profielId] : null;
    const module = profiel?.moduleId ? moduleMap[profiel.moduleId] : null;
    const stap = module ? _dbVindModuleStapVoorOpdracht(opdracht, module) : null;
    const praktijk = _dbPraktijkVoorOpdracht(opdracht, module, stap);
    const werkboekjesBijLes = _dbWerkboekjesVoorPraktijk(praktijk, werkboekjes);
    const theorieBijLes = _dbTheorieVoorStap(stap);
    const toetsenBijLes = _dbToetsenVoorStap(stap, toetsen);

    return {
      ...les,
      moduleContext: module ? { profiel, module, stap, theorie: theorieBijLes, praktijk, werkboekjes: werkboekjesBijLes, toetsen: toetsenBijLes } : null
    };
  });
}

function _dbVindModuleStapVoorOpdracht(opdracht, module) {
  const stappen = Array.isArray(module?.stappen) ? module.stappen : [];
  if (!stappen.length) return null;

  if (opdracht.stapIndex != null && stappen[Number(opdracht.stapIndex)]) return stappen[Number(opdracht.stapIndex)];
  if (opdracht.stapNaam) {
    const exact = stappen.find(s => _dbNorm(s.naam) === _dbNorm(opdracht.stapNaam));
    if (exact) return exact;
  }

  const tekst = _dbNorm([opdracht.naam, opdracht.beschrijving, opdracht.focus].filter(Boolean).join(' '));
  let beste = null;
  let score = 0;

  stappen.forEach(stap => {
    let s = 0;
    const stapNaam = _dbNorm(stap.naam || '');
    if (stapNaam && tekst.includes(stapNaam)) s += 8;
    (stap.lessen || []).forEach(les => {
      const naam = _dbNorm(typeof les === 'string' ? les : les.naam);
      if (!naam) return;
      if (tekst.includes(naam)) s += 6;
      naam.split(' ').filter(w => w.length > 4).forEach(w => { if (tekst.includes(w)) s += 1; });
    });
    if (s > score) { score = s; beste = stap; }
  });

  return score > 0 ? beste : stappen[0];
}

function _dbPraktijkVoorOpdracht(opdracht, module, stap) {
  const direct = Array.isArray(opdracht.praktijkOpdrachten) ? opdracht.praktijkOpdrachten : [];
  const vanStap = Array.isArray(stap?.praktijkOpdrachten) ? stap.praktijkOpdrachten : [];
  const stapIndex = Array.isArray(module?.stappen) && stap ? module.stappen.indexOf(stap) : -1;
  const gedeeld = (module?.gedeeldeOpdrachten || []).filter(o => {
    if (!Array.isArray(o.stappen) || !o.stappen.length) return true;
    return stapIndex >= 0 && o.stappen.map(Number).includes(stapIndex);
  });

  return [...direct, ...vanStap, ...gedeeld].filter(o => o && (o.naam || o.werkboekjeId || o.werkboekjeLink || o.werkboekjeBestand));
}


function _dbTheorieVoorStap(stap) {
  if (!stap) return [];
  const uit = [];
  if (stap.leerlingTaak) uit.push({ type: 'taak', naam: stap.leerlingTaak });
  (Array.isArray(stap.lessen) ? stap.lessen : []).forEach((les, i) => {
    const naam = typeof les === 'string' ? les : (les?.naam || les?.titel || 'Theorie');
    if (naam) uit.push({ type: 'theorie', naam, nummer: i + 1 });
  });
  if (stap.url) uit.push({ type: 'link', naam: 'Leslink', url: stap.url });
  return uit;
}

function _dbToetsenVoorStap(stap, toetsen) {
  if (!stap) return [];
  const map = Object.fromEntries((toetsen || []).map(t => [t.id, t]));
  const uit = [];
  if (stap.toetsId && map[stap.toetsId]?.bestandsnaam) {
    const t = map[stap.toetsId];
    uit.push({ naam: t.naam || t.bestandsnaam || 'Toets', url: '/uploads/' + encodeURIComponent(t.bestandsnaam) });
  }
  if (stap.toetsUrl) uit.push({ naam: 'Toets', url: stap.toetsUrl });
  return uit;
}

function _dbWerkboekjesVoorPraktijk(praktijk, werkboekjes) {
  const map = Object.fromEntries((werkboekjes || []).map(w => [w.id, w]));
  const gezien = new Set();
  const uit = [];

  (praktijk || []).forEach(o => {
    if (o.werkboekjeId && map[o.werkboekjeId] && !gezien.has('id:' + o.werkboekjeId)) {
      gezien.add('id:' + o.werkboekjeId);
      uit.push({ naam: map[o.werkboekjeId].naam || map[o.werkboekjeId].bestandsnaam || 'Werkboekje', url: '/uploads/' + encodeURIComponent(map[o.werkboekjeId].bestandsnaam || '') });
    }
    if (o.werkboekjeLink && !gezien.has('link:' + o.werkboekjeLink)) {
      gezien.add('link:' + o.werkboekjeLink);
      uit.push({ naam: o.naam ? 'Werkboekje ' + o.naam : 'Werkboekje', url: o.werkboekjeLink });
    }
    if (o.werkboekjeBestand && !o.werkboekjeId && !gezien.has('bestand:' + o.werkboekjeBestand)) {
      gezien.add('bestand:' + o.werkboekjeBestand);
      uit.push({ naam: o.naam ? 'Werkboekje ' + o.naam : o.werkboekjeBestand, url: '/uploads/' + encodeURIComponent(o.werkboekjeBestand) });
    }
  });

  return uit.filter(w => w.url && !w.url.endsWith('/uploads/'));
}

function _dbNorm(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function renderDashboardVandaag(lessen) {
  if (!lessen.length) {
    return `<div class="empty-state" style="padding:48px 24px"><p>Geen lessen voor vandaag ingesteld. Stel eerst je lesuren in bij Mijn rooster.</p><button class="btn btn-primary" style="margin-top:16px" onclick="showView('rooster')">Naar rooster →</button></div>`;
  }

  // Groepeer lessen met hetzelfde starttijdstip als gecombineerd blok
  const groepMap = new Map();
  lessen.forEach(les => {
    const key = les.start;
    if (!groepMap.has(key)) groepMap.set(key, []);
    groepMap.get(key).push(les);
  });

  const items = [];
  groepMap.forEach((groep, start) => {
    const sort = tijdNaarMinuten(start);
    if (groep.length > 1) {
      items.push({ type: 'combined', start, sort, lessen: groep });
    } else {
      items.push({ type: 'les', start, sort, les: groep[0] });
    }
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
    ${items.map(item => {
      if (item.type === 'pauze')    return renderDashboardPauze(item.start, item.eind);
      if (item.type === 'combined') return renderCombinedLesCard(item.lessen);
      return renderLesCard(item.les);
    }).join('')}
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
    <div class="td-lesson-toprow">
      <div class="td-class" style="background:${kleur}">${escHtml(afk)}</div>
      <div class="td-time"><strong>${escHtml(les.start)}</strong><span>→ ${escHtml(les.eind)}</span><em>${_dbFormatMinutenKort(les.minuten)}</em></div>
      <span class="td-status">${escHtml(status)}</span>
    </div>
    <h3 class="td-lesson-titel">${escHtml(o.naam)}</h3>
    <div class="td-colorbar" style="background:${kleur}"></div>
    <div class="td-lesson-body">
      <div class="td-meta">▣ ${escHtml(type)} <span>•</span> ${klas ? escHtml(klas.naam) : 'Geen klas'} <span>•</span> ${escHtml(lokaal)} ${les.lesuren?.length ? `<span>•</span> Lesuur ${les.lesuren.join(', ')}` : ''}</div>
      <p><strong>Focus:</strong> ${escHtml(o.focus || o.beschrijving || 'Les voorbereiden en uitvoeren volgens de planning.')}</p>
      <div class="td-lesson-actions">
        ${_dbMateriaalButtons(o, les.moduleContext)}
        ${Auth.canEdit() ? `<button class="td-finish${o.afgevinkt ? ' td-finish--done' : ''}" onclick="dashboardAfvinken('${o.id}')">✓ ${o.afgevinkt ? 'Heropenen' : 'Les afronden'}</button>` : ''}
        ${_dbLesbriefButton(o)}
        ${Auth.canEdit() ? `<button class="${o.opmerking ? 'td-opmerking--heeft' : ''}" onclick="dbOpenOpmerkingModal('${o.id}')">▣ Opmerking</button>` : ''}
      </div>
      ${_dbModulePraktijkHtml(les.moduleContext)}
      ${o.opmerking ? `<div class="td-note">${escHtml(o.opmerking)}</div>` : ''}
    </div>
  </article>`;
}

function renderCombinedLesCard(lessen) {
  const eersteStart = lessen[0].start;
  const eersteEind  = lessen[0].eind;
  const totaalMin   = Math.max(...lessen.map(l => l.minuten));
  const alleAfgerond = lessen.every(l => l.opdracht.afgevinkt);
  const geenAfgerond = lessen.every(l => !l.opdracht.afgevinkt);
  const status = alleAfgerond ? 'Afgerond' : geenAfgerond ? 'In uitvoering' : 'Deels afgerond';

  // Gedeelde titel als ze identiek zijn, anders beide tonen
  const namen = [...new Set(lessen.map(l => l.opdracht.naam))];
  const titel = namen.length === 1 ? namen[0] : namen.join(' / ');

  // Split kleurlijn per klas
  const kleurBalk = lessen.map(l => {
    const kleur = l.klas ? _klasKleur(l.klas.id) : '#94A3B8';
    return `<span style="flex:1;background:${kleur};height:3px;border-radius:999px"></span>`;
  }).join('');

  // Badges
  const badges = lessen.map(l => {
    const kleur = l.klas ? _klasKleur(l.klas.id) : '#94A3B8';
    const afk = l.klas ? (l.klas.naam.match(/\d+\s*[A-Z]+/)?.[0] || l.klas.naam.slice(0, 3)).replace(/\s/g, '').toUpperCase() : '?';
    return `<div class="td-class" style="background:${kleur}">${escHtml(afk)}</div>`;
  }).join('');

  // Gedeeld type/lokaal
  const type   = lessen[0].opdracht.type || 'Les';
  const lokaal = lessen[0].opdracht.lokaal || lessen[0].opdracht.leslokaal || (type.toLowerCase() === 'praktijk' ? 'Werkplaats' : 'Lokaal');
  const klasNamen = lessen.map(l => l.klas?.naam || '?').join(' + ');

  // Per-klas actierijen
  const klasActies = lessen.map(l => {
    const o = l.opdracht;
    const kleur = l.klas ? _klasKleur(l.klas.id) : '#94A3B8';
    const afk = l.klas ? (l.klas.naam.match(/\d+\s*[A-Z]+/)?.[0] || l.klas.naam.slice(0, 3)).replace(/\s/g, '').toUpperCase() : '?';
    return `<div class="td-combined-klas-row">
      <div class="td-class td-class--sm" style="background:${kleur}">${escHtml(afk)}</div>
      <div class="td-lesson-actions">
        ${Auth.canEdit() ? `<button class="td-finish${o.afgevinkt ? ' td-finish--done' : ''}" onclick="dashboardAfvinken('${o.id}')">✓ ${o.afgevinkt ? 'Heropenen' : 'Les afronden'}</button>` : ''}
        <button id="db-lesbrief-btn-${escHtml(String(o.id))}" data-lesbrief-opdracht="${escHtml(String(o.id))}" onclick="openLesbrief('${escHtml(String(o.id))}')">▤ Lesbrief</button>
        ${Auth.canEdit() ? `<button class="${o.opmerking ? 'td-opmerking--heeft' : ''}" onclick="dbOpenOpmerkingModal('${o.id}')">▣ Opmerking</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Gedeelde focus (eerste les, of beide als verschillend)
  const foci = [...new Set(lessen.map(l => l.opdracht.focus || l.opdracht.beschrijving).filter(Boolean))];
  const focusTekst = foci.length ? foci.join(' / ') : 'Les voorbereiden en uitvoeren volgens de planning.';

  return `<article class="td-lesson td-lesson--combined ${alleAfgerond ? 'is-done' : ''}">
    <div class="td-lesson-toprow">
      ${badges}
      <div class="td-time"><strong>${escHtml(eersteStart)}</strong><span>→ ${escHtml(eersteEind)}</span><em>${_dbFormatMinutenKort(totaalMin)}</em></div>
      <span class="td-status">${escHtml(status)}</span>
    </div>
    <h3 class="td-lesson-titel">${escHtml(titel)}</h3>
    <div class="td-combined-colorbar">${kleurBalk}</div>
    <div class="td-lesson-body">
      <div class="td-meta">▣ ${escHtml(type)} <span>•</span> ${escHtml(klasNamen)} <span>•</span> ${escHtml(lokaal)}</div>
      <p><strong>Focus:</strong> ${escHtml(focusTekst)}</p>
      ${klasActies}
      ${lessen.map(l => _dbModulePraktijkHtml(l.moduleContext)).filter(Boolean).join('')}
    </div>
  </article>`;
}

function _dbModulePraktijkHtml(ctx) {
  if (!ctx || (!ctx.theorie?.length && !ctx.praktijk?.length && !ctx.werkboekjes?.length && !ctx.toetsen?.length)) return '';

  return `<div class="td-module-praktijk" style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
    ${ctx.stap?.naam ? `<div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px">Module stap: <strong>${escHtml(ctx.stap.naam)}</strong></div>` : ''}

    ${ctx.theorie?.length ? `<div style="font-size:12.5px;color:var(--ink-2);line-height:1.6;margin-bottom:4px">📖 Theorie: ${ctx.theorie.map(t => t.url ? `<a href="${escHtml(t.url)}" target="_blank" rel="noopener" style="color:var(--blue-text);font-weight:600;text-decoration:none">${escHtml(t.naam)}</a>` : escHtml(t.naam)).join(' · ')}</div>` : ''}

    ${ctx.praktijk?.length ? `<div style="font-size:12.5px;color:var(--ink-2);line-height:1.6">🔧 Praktijk: ${ctx.praktijk.map(o => escHtml(o.naam || 'Praktijkopdracht')).join(' · ')}</div>` : ''}

    ${(ctx.werkboekjes?.length || ctx.toetsen?.length) ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
      ${(ctx.werkboekjes || []).map(w => `<a href="${escHtml(w.url)}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:#15803d;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:6px 10px;text-decoration:none">📗 Download ${escHtml(w.naam || 'werkboekje')}</a>`).join('')}
      ${(ctx.toetsen || []).map(t => `<a href="${escHtml(t.url)}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:6px 10px;text-decoration:none">📝 Download ${escHtml(t.naam || 'toets')}</a>`).join('')}
    </div>` : ''}
  </div>`;
}


function _dbLesbriefButton(o) {
  const id = String(o?.id || '');
  return `<button id="db-lesbrief-btn-${escHtml(id)}" data-lesbrief-opdracht="${escHtml(id)}" onclick="openLesbrief('${escHtml(id)}')">▤ Lesbrief</button>`;
}

async function _dbVerversLesbriefKnoppen() {
  const knoppen = Array.from(document.querySelectorAll('[data-lesbrief-opdracht]'));
  if (!knoppen.length || !window.API?.getLesbriefByOpdracht) return;

  await Promise.all(knoppen.map(async (btn) => {
    const opdrachtId = btn.getAttribute('data-lesbrief-opdracht');
    if (!opdrachtId) return;
    try {
      const lijst = await API.getLesbriefByOpdracht(opdrachtId);
      const lb = Array.isArray(lijst) && lijst.length ? lijst[0] : null;
      if (lb && lb.id) {
        btn.innerHTML = '▤ Lesbrief bekijken';
        btn.title = 'Lesbrief openen, bewerken of downloaden';
        btn.classList.add('td-lesbrief-ready');
        btn.dataset.lesbriefId = lb.id;
      } else {
        btn.innerHTML = '▤ Lesbrief';
        btn.title = 'Lesbrief maken';
        btn.classList.remove('td-lesbrief-ready');
        delete btn.dataset.lesbriefId;
      }
    } catch (e) {
      // Dashboard mag niet stuk lopen door een lesbrief-check.
    }
  }));
}

window.markDashboardLesbriefGemaakt = function(opdrachtId) {
  const btn = document.querySelector(`[data-lesbrief-opdracht="${CSS.escape(String(opdrachtId || ''))}"]`);
  if (!btn) return;
  btn.innerHTML = '▤ Lesbrief bekijken';
  btn.title = 'Lesbrief openen, bewerken of downloaden';
  btn.classList.add('td-lesbrief-ready');
};

function _dbMateriaalButtons(o) {
  const knoppen = [];

  const lesmateriaal = _dbEersteWaarde(o.theorieLink, o.lesmateriaalLink, o.lesmateriaalUrl, o.materiaalLink, o.materiaalUrl);
  const presentatie = _dbEersteWaarde(o.presentatieLink, o.presentatieUrl, o.presentatieBestand, o.slidesLink, o.slidesUrl);

  if (lesmateriaal) knoppen.push(_dbGekoppeldeKnop(lesmateriaal, 'Lesmateriaal'));
  if (presentatie) knoppen.push(_dbGekoppeldeKnop(presentatie, 'Presentatie'));

  // Werkboekjes en toetsen worden niet meer als losse actieknoppen bovenaan getoond.
  // Die staan onder de module stap als duidelijke downloadknoppen.
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
  const groepen = new Map();
  (lessen || []).forEach(({ opdracht: o, klas, moduleContext }) => {
    const klasId  = klas?.id   || 'onbekend';
    const klasNaam = klas?.naam || 'Geen klas';
    const kleur   = klas ? _klasKleur(klas.id) : '#94A3B8';
    if (!groepen.has(klasId)) groepen.set(klasId, { klasNaam, kleur, items: [] });
    const g = groepen.get(klasId);
    if (o.materiaal) g.items.push({ naam: o.materiaal, type: 'Materiaal' });
    if (o.materialen) String(o.materialen).split('\n').filter(Boolean).forEach(m => g.items.push({ naam: m.trim(), type: 'Materiaal' }));
    (moduleContext?.theorie  || []).forEach(t => g.items.push({ naam: t.naam || 'Theorie',           type: 'Theorie' }));
    (moduleContext?.praktijk || []).forEach(p => g.items.push({ naam: p.naam || 'Praktijkopdracht',  type: 'Praktijk' }));
    (moduleContext?.werkboekjes || []).forEach(w => g.items.push({ naam: w.naam || 'Werkboekje',     type: 'Download' }));
    (moduleContext?.toetsen   || []).forEach(t => g.items.push({ naam: t.naam || 'Toets',            type: 'Download' }));
    if (!g.items.length) g.items.push({ naam: o.type?.toLowerCase() === 'praktijk' ? 'Praktijkmateriaal' : 'Lesmateriaal', type: 'Materiaal' });
  });
  return Array.from(groepen.values());
}

function _dbKlasGroepHtml(g, defaultOpen = false) {
  const id = `need-${Math.random().toString(36).slice(2)}`;
  const items = g.items.map(item =>
    `<div class="td-need"><span>${escHtml(item.naam)}</span><em>${escHtml(item.type)}</em></div>`
  ).join('');
  return `<div class="td-need-group${defaultOpen ? ' open' : ''}">
    <button class="td-need-klas" onclick="this.closest('.td-need-group').classList.toggle('open')">
      <span class="td-need-klas-dot" style="background:${g.kleur}"></span>
      <strong>${escHtml(g.klasNaam)}</strong>
      <em>${g.items.length} item${g.items.length !== 1 ? 's' : ''}</em>
      <svg class="td-need-chevron" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div class="td-need-items">${items}</div>
  </div>`;
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
  setTimeout(_dbVerversLesbriefKnoppen, 0);
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
  const les = (window._dbDagLessen || []).find(l => l.opdracht?.id == id);
  // Als al afgerond: direct heropenen zonder modal
  if (les?.opdracht?.afgevinkt) {
    try { await API.afvinken(id); renderDashboard(); }
    catch(e) { showError(e.message); }
    return;
  }

  // Takenlijst per categorie
  const ctx = les?.moduleContext;
  const o   = les?.opdracht;
  const secties = [];

  // Theorie
  const theorieTaken = [];
  (ctx?.theorie || []).forEach(t => {
    // De les zelf (URL aanwezig = klikbare taak)
    if (t.url) theorieTaken.push({ label: t.naam || 'Theorieles', icon: '🔗', url: t.url });
    else       theorieTaken.push({ label: t.naam || 'Theorieles', icon: '📖' });
  });
  if (o?.theorieLink || o?.lesmateriaalLink)
    theorieTaken.push({ label: 'ELO / Lesmateriaal', icon: '🔗', url: o.theorieLink || o.lesmateriaalLink });
  if (theorieTaken.length) secties.push({ titel: 'Theorie', icon: '📖', taken: theorieTaken });

  // Praktijk
  const praktijkTaken = [];
  (ctx?.praktijk || []).forEach(p => {
    praktijkTaken.push({ label: p.naam || 'Praktijkopdracht', icon: '🔧', url: p.url || null });
  });
  if (o?.presentatieLink) praktijkTaken.push({ label: 'Presentatie', icon: '🖥️', url: o.presentatieLink });
  if (praktijkTaken.length) secties.push({ titel: 'Praktijk', icon: '🔧', taken: praktijkTaken });

  // Werkboekjes & toetsen
  const downloadTaken = [
    ...(ctx?.werkboekjes || []).map(w => ({ label: w.naam || 'Werkboekje', icon: '📗', url: w.url || null })),
    ...(ctx?.toetsen    || []).map(t => ({ label: t.naam || 'Toets',       icon: '📝', url: t.url || null })),
  ];
  if (downloadTaken.length) secties.push({ titel: 'Downloads', icon: '📎', taken: downloadTaken });

  let idx = 0;
  const sectiHtml = secties.map(s => {
    const rijen = s.taken.map(t => {
      const i = idx++;
      const link = t.url
        ? `<a href="${escHtml(t.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escHtml(t.label)}</a>`
        : escHtml(t.label);
      return `<label class="db-taak-item">
        <input type="checkbox" id="dbtaak-${i}">
        <span class="db-taak-check"></span>
        <span class="db-taak-icon">${t.icon}</span>
        <span class="db-taak-label">${link}</span>
      </label>`;
    }).join('');
    return `<div class="db-taak-sectie">
      <div class="db-taak-sectie-titel">${s.icon} ${escHtml(s.titel)}</div>
      ${rijen}
    </div>`;
  }).join('');

  const klasNaam = les?.klas?.naam || '';
  openModal(`
    <h2>Les afronden${klasNaam ? ` — ${escHtml(klasNaam)}` : ''}</h2>
    <p class="modal-sub">Vink af wat je hebt behandeld en klik daarna op <strong>Bevestig afronden</strong>.</p>
    <div class="db-taak-lijst">
      ${secties.length ? sectiHtml : '<p class="db-taak-leeg">Geen gekoppelde taken gevonden. Je kunt de les direct afronden.</p>'}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="dashboardAfvinkenBevestig('${escHtml(String(id))}')">✓ Bevestig afronden</button>
    </div>
  `);
}

async function dashboardAfvinkenBevestig(id) {
  closeModalDirect();
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
