async function renderJaarplanning() {
  const readonly = !Auth.canEdit();
  const isMobiel = window.innerWidth <= 768;
  showLoading('jaarplanning');
  try {
    const klassen = await API.getKlassen();
    if (klassen.length === 0) {
      document.getElementById('view-jaarplanning').innerHTML = `<div class="page-header"><div class="page-header-left"><h1>Jaarplanning</h1></div></div><div class="empty-state"><h3>Geen klassen</h3></div>`;
      return;
    }
    if (!window._selectedKlas || !klassen.find(k=>k.id===window._selectedKlas)) window._selectedKlas = klassen[0].id;
    const klas = klassen.find(k=>k.id===window._selectedKlas);
    const [weken, opdrachten, vakken, gebruikers] = await Promise.all([
      API.getWeken(klas.schooljaar),
      API.getOpdrachten(window._selectedKlas),
      API.getVakken(),
      API.getGebruikers(),
    ]);
    const vak = vakken.find(v=>v.id===klas.vakId);
    const cw = getCurrentWeek();
    const heeftWeken = weken && weken.length > 0;
    const totaal = opdrachten.length;
    const afgevinktN = opdrachten.filter(o=>o.afgevinkt).length;
    const pct = totaal>0?Math.round((afgevinktN/totaal)*100):0;

    if (isMobiel) {
      renderJaarplanningMobiel(klas, klassen, weken, opdrachten, vak, cw, heeftWeken, totaal, afgevinktN, pct, readonly);
    } else {
      renderJaarplanningDesktop(klas, klassen, weken, opdrachten, vak, vakken, gebruikers, cw, heeftWeken, totaal, afgevinktN, pct, readonly);
    }
  } catch(e) { showError('Fout bij laden: ' + e.message); }

  setTimeout(() => {
    const huidig = document.querySelector('.week-kaart.nu, .week-pill.current');
    if (huidig) (huidig.closest('[data-week]') || huidig.closest('tr'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

function renderJaarplanningMobiel(klas, klassen, weken, opdrachten, vak, cw, heeftWeken, totaal, afgevinktN, pct, readonly) {
  document.getElementById('view-jaarplanning').innerHTML = `
    <div style="background:#fff;border-bottom:1px solid rgba(28,25,23,0.08);padding:12px 16px;position:sticky;top:56px;z-index:50">
      <select onchange="window._selectedKlas=this.value;renderJaarplanning()"
        style="width:100%;padding:12px 13px;border:1.5px solid rgba(28,25,23,0.15);border-radius:10px;font-size:15px;background:#fff;color:#1C1917;font-weight:500;-webkit-appearance:none">
        ${klassen.map(k=>`<option value="${k.id}" ${k.id===klas.id?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
      </select>
    </div>
    <div style="background:#fff;padding:12px 16px;border-bottom:1px solid rgba(28,25,23,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;color:#44403C;font-weight:500">${escHtml(vak?.naam||'')} · ${escHtml(klas.niveau)} · Leerjaar ${klas.leerjaar}</span>
        <span style="font-size:13px;font-weight:600;color:#16A34A">${afgevinktN}/${totaal}</span>
      </div>
      <div style="height:5px;background:#ECEAE5;border-radius:3px">
        <div style="height:100%;width:${pct}%;background:#16A34A;border-radius:3px"></div>
      </div>
    </div>
    ${heeftWeken ? renderPeriodeTabs(weken, cw) : ''}
    <div id="week-kaarten-container" style="padding:12px 16px 100px">
      ${!heeftWeken
        ? `<div class="empty-state"><h3>Geen weekstructuur</h3><p>Vraag de beheerder een schooljaar aan te maken.</p></div>`
        : renderWeekKaartenHTML(weken, opdrachten, klas, cw, readonly)
      }
    </div>
    ${!readonly ? `
    <button onclick="openOpdrachtModal(null,'${klas.id}')"
      style="position:fixed;bottom:76px;right:16px;width:54px;height:54px;border-radius:50%;background:#16A34A;color:#fff;border:none;font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(22,163,74,0.4);z-index:100;cursor:pointer">+</button>` : ''}
  `;
  setTimeout(() => {
    const nuKaart = document.querySelector('.week-kaart.nu');
    if (nuKaart) nuKaart.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function renderPeriodeTabs(weken, cw) {
  const huidigeP = getPeriodeVoorWeek(cw);
  const pNamen = {1:'Sep–Nov',2:'Dec–Feb',3:'Mar–Mei',4:'Jun–Jul'};
  return `<div style="display:flex;background:#fff;border-bottom:1px solid rgba(28,25,23,0.08);overflow-x:auto">
    ${[1,2,3,4].map(p => {
      const heeft = weken.some(w => !w.isVakantie && getPeriodeVoorWeek(w.weeknummer) === p);
      if (!heeft) return '';
      const actief = huidigeP === p;
      return `<button onclick="scrollNaarPeriode(${p})"
        style="flex:1;min-width:80px;padding:12px 8px;border:none;background:none;font-size:13px;font-weight:${actief?600:400};color:${actief?'#16A34A':'#78716C'};border-bottom:2px solid ${actief?'#16A34A':'transparent'};cursor:pointer">
        P${p} <span style="font-size:11px;opacity:0.7">${pNamen[p]}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function getPeriodeVoorWeek(wn) {
  if (wn >= 35 && wn <= 43) return 1;
  if (wn >= 44 || wn <= 8) return 2;
  if (wn >= 9 && wn <= 18) return 3;
  return 4;
}

function scrollNaarPeriode(p) {
  const el = document.querySelector(`[data-periode="${p}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderWeekKaartenHTML(weken, opdrachten, klas, cw, readonly) {
  let html = '';
  let huidigePeriode = null;
  const pNamen = {1:'Periode 1',2:'Periode 2',3:'Periode 3',4:'Periode 4'};
  weken.forEach(w => {
    const periode = getPeriodeVoorWeek(w.weeknummer);
    if (periode !== huidigePeriode) {
      huidigePeriode = periode;
      html += `<div data-periode="${periode}" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#78716C;margin:16px 0 8px">${pNamen[periode]}</div>`;
    }
    if (w.isVakantie && (w.weektype === 'vakantie' || !w.weektype)) {
      html += `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:#FFFBEB;border-radius:10px;margin-bottom:8px;border:1px solid rgba(180,83,9,0.15)">
        <span style="font-size:12px;font-weight:700;color:#B45309;min-width:38px">Wk ${w.weeknummer}</span>
        <span style="font-size:13px;color:#B45309">🏖 ${escHtml(w.vakantieNaam)}</span>
        <span style="font-size:11px;color:#B45309;margin-left:auto">${w.van}</span>
        ${(Auth.isAdmin()||Auth.isManagement())?`<button onclick="openWeekBeheerModal('${w.id}','${klas.schooljaar}',${w.weeknummer},'${escHtml(w.van)}','${escHtml(w.tot)}')" style="width:26px;height:26px;border:1px solid rgba(180,83,9,0.2);border-radius:7px;background:#fff;font-size:12px;cursor:pointer">⚙</button>`:''}
      </div>`;
      return;
    }
    const wOpd = opdrachten.filter(o => {
      if (o.weeknummer === w.weeknummer && o.schooljaar === klas.schooljaar) return true;
      if (o.weken) return weekInRange(o.weken, w.weeknummer);
      return false;
    });
    const isNu = w.weeknummer === cw;
    const weekVoorbij = w.weeknummer < cw;
    const alleKlaar = wOpd.length > 0 && wOpd.every(o => o.afgevinkt);
    const geenAfgevinkt = wOpd.length > 0 && weekVoorbij && !alleKlaar;
    const wt = getWeektypeInfo(w);
    const dagnotities = w.dagnotities || [];

    let kaartBorder = '1px solid rgba(28,25,23,0.1)';
    let kaartBg = '#fff';
    if (wt.geblokkeerd) { kaartBorder = `1px solid ${wt.kleur}40`; kaartBg = wt.bg; }
    else if (isNu) { kaartBorder = '2px solid #16A34A'; kaartBg = '#FAFFFE'; }
    else if (alleKlaar) { kaartBorder = '1px solid rgba(22,163,74,0.25)'; kaartBg = '#FAFFFE'; }
    else if (geenAfgevinkt) { kaartBorder = '1px solid rgba(220,38,38,0.2)'; kaartBg = '#FFFAFA'; }
    else if (wt.bg) { kaartBorder = `1px solid ${wt.kleur}30`; kaartBg = wt.bg; }

    const isOpen = isNu || (weekVoorbij && geenAfgevinkt) || wt.geblokkeerd;
    html += `<div data-week="${w.weeknummer}" class="week-kaart${isNu?' nu':''}" style="background:${kaartBg};border:${kaartBorder};border-radius:12px;margin-bottom:10px;overflow:hidden">
      <div onclick="${wt.geblokkeerd?'':` toggleWeekKaart('${w.id}')`}" style="display:flex;align-items:center;gap:11px;padding:13px 14px;cursor:${wt.geblokkeerd?'default':'pointer'};-webkit-tap-highlight-color:transparent">
        <div style="min-width:40px;height:40px;border-radius:9px;background:${wt.geblokkeerd?wt.bg:isNu?'#16A34A':weekVoorbij&&!alleKlaar&&wOpd.length>0?'#FEE2E2':alleKlaar?'#DCFCE7':'#F2F1EE'};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:${wt.geblokkeerd?`1px solid ${wt.kleur}40`:'none'}">
          ${wt.geblokkeerd
            ? `<span style="font-size:18px">${wt.icon}</span>`
            : `<span style="font-size:9px;font-weight:700;text-transform:uppercase;color:${isNu?'rgba(255,255,255,0.7)':weekVoorbij&&!alleKlaar&&wOpd.length>0?'#B91C1C':alleKlaar?'#15803D':'#78716C'};line-height:1">wk</span>
               <span style="font-size:15px;font-weight:700;color:${isNu?'#fff':weekVoorbij&&!alleKlaar&&wOpd.length>0?'#B91C1C':alleKlaar?'#15803D':'#1C1917'};line-height:1.1">${w.weeknummer}</span>`
          }
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:${wt.geblokkeerd?wt.kleur:'#1C1917'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${wt.geblokkeerd ? `${wt.icon} ${escHtml(w.vakantieNaam||wt.label)}` : w.thema ? escHtml(w.thema) : `<span style="color:#A8A29E;font-weight:400;font-size:13px">Geen thema</span>`}
          </div>
          <div style="font-size:12px;color:#78716C;margin-top:1px">
            ${wt.geblokkeerd?'':`Wk ${w.weeknummer} · `}${w.van} – ${w.tot}
            ${wt.label&&!wt.geblokkeerd?`<span style="margin-left:5px;font-size:11px;font-weight:600;color:${wt.kleur}">${wt.icon} ${wt.label}</span>`:''}
          </div>
          ${dagnotities.length ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${dagnotities.map(n=>renderDagnotitieTag(n)).join('')}</div>` : ''}
        </div>
        ${isNu ? `<span style="font-size:11px;font-weight:700;color:#16A34A;background:#DCFCE7;padding:3px 8px;border-radius:20px;flex-shrink:0">NU</span>` : ''}
        ${alleKlaar ? `<span style="font-size:18px;flex-shrink:0">✓</span>` : ''}
        ${(Auth.isAdmin()||Auth.isManagement()) ? `<button onclick="event.stopPropagation();openWeekBeheerModal('${w.id}','${klas.schooljaar}',${w.weeknummer},'${escHtml(w.van)}','${escHtml(w.tot)}')" style="width:30px;height:30px;border:1px solid rgba(28,25,23,0.12);border-radius:8px;background:#fff;font-size:14px;cursor:pointer;flex-shrink:0" title="Week beheren">⚙</button>` : ''}
        ${!wt.geblokkeerd?`<svg id="chevron-${w.id}" width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;color:#A8A29E;transform:${isOpen?'rotate(180deg)':'rotate(0deg)'};transition:transform 0.2s"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`:''}
      </div>
      <div id="week-body-${w.id}" style="display:${isOpen?'block':'none'}">
        <div style="border-top:1px solid rgba(28,25,23,0.07)">
          ${wOpd.length === 0
            ? `<div style="padding:14px;font-size:13px;color:#A8A29E;text-align:center">
                Geen activiteiten${!readonly?` — <button onclick="openOpdrachtModal(null,'${klas.id}',1,${w.weeknummer})" style="background:none;border:none;color:#16A34A;font-size:13px;cursor:pointer;font-weight:600;text-decoration:underline">+ Toevoegen</button>`:''}
              </div>`
            : wOpd.map(o => renderActiviteitKaart(o, readonly, w.weeknummer, klas.id)).join('')
          }
          ${wOpd.length > 0 && !readonly ? `
          <div style="padding:10px 14px">
            <button onclick="openOpdrachtModal(null,'${klas.id}',1,${w.weeknummer})"
              style="width:100%;padding:11px;border:1.5px dashed rgba(28,25,23,0.15);border-radius:9px;background:none;color:#78716C;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent">
              + Activiteit toevoegen
            </button>
          </div>` : ''}
          ${!readonly ? `
          <div style="padding:0 14px 12px">
            <input type="text" placeholder="+ Thema instellen..." value="${escHtml(w.thema||'')}"
              onchange="API.updateWeekThema('${w.id}', this.value)"
              style="width:100%;padding:10px 12px;border:1.5px solid rgba(28,25,23,0.1);border-radius:9px;font-size:13px;color:#1C1917;background:#F8F7F4;-webkit-appearance:none">
          </div>` : ''}
        </div>
      </div>
    </div>`;
  });
  return html;
}

function toggleWeekKaart(weekId) {
  const body = document.getElementById(`week-body-${weekId}`);
  const chevron = document.getElementById(`chevron-${weekId}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

function renderActiviteitKaart(o, readonly, weeknummer, klasId) {
  const afgevinkt = o.afgevinkt || o.afgevinkt === 1;
  const heeftOpmerking = o.opmerking && o.opmerking.trim();
  const cw = getCurrentWeek();
  const weekVoorbij = weeknummer < cw;
  let bgKleur = '#F8F7F4', borderLinks = '3px solid #E5E3DF';
  if (afgevinkt && heeftOpmerking) { bgKleur='#FFFBEB'; borderLinks='3px solid #D97706'; }
  else if (afgevinkt) { bgKleur='#F0FDF4'; borderLinks='3px solid #16A34A'; }
  else if (weekVoorbij) { bgKleur='#FFF5F5'; borderLinks='3px solid #DC2626'; }
  const typeKleuren = {'Theorie':{bg:'#DBEAFE',text:'#1D4ED8'},'Praktijk':{bg:'#DCFCE7',text:'#15803D'},'Toets':{bg:'#FEF3C7',text:'#B45309'},'Presentatie':{bg:'#F3E8FF',text:'#7E22CE'},'Overig':{bg:'#F2F1EE',text:'#44403C'}};
  const tk = typeKleuren[o.type] || typeKleuren['Overig'];
  return `<div style="display:flex;border-bottom:1px solid rgba(28,25,23,0.06)">
    ${!readonly ? `<button onclick="doAfvinken('${o.id}')"
      style="width:60px;min-height:64px;border:none;background:${afgevinkt?'#DCFCE7':'#F8F7F4'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;border-right:1px solid rgba(28,25,23,0.06);-webkit-tap-highlight-color:transparent">
      <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${afgevinkt?'#16A34A':'rgba(28,25,23,0.2)'};background:${afgevinkt?'#16A34A':'#fff'};display:flex;align-items:center;justify-content:center">
        ${afgevinkt?'<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
      </div>
    </button>` : ''}
    <div style="flex:1;padding:12px 13px;background:${bgKleur};border-left:${borderLinks}" onclick="${!readonly?`openOpmerkingModal('${o.id}','${escHtml(o.naam.replace(/'/g,"\\'").replace(/"/g,'&quot;'))}')`:''}" style="cursor:${!readonly?'pointer':'default'}">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;background:${tk.bg};color:${tk.text};flex-shrink:0;margin-top:1px">${escHtml(o.type)}</span>
        <span style="font-size:14px;font-weight:500;color:#1C1917;line-height:1.4;${afgevinkt&&!heeftOpmerking?'text-decoration:line-through;color:#A8A29E':''}">${escHtml(o.naam)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:0">
        ${o.uren?`<span style="font-size:12px;color:#78716C">${o.uren} uur</span>`:''}
        ${o.syllabuscodes?`<span style="font-size:11px;color:#A8A29E">${escHtml(o.syllabuscodes)}</span>`:''}
        ${o.theorieLink?`<a href="${escHtml(o.theorieLink)}" target="_blank" style="font-size:12px;color:#2563EB" onclick="event.stopPropagation()">↗ Link</a>`:''}
        ${o.afgevinktDoor?`<span style="font-size:11px;font-weight:700;font-family:monospace;background:#16A34A;color:#fff;padding:1px 6px;border-radius:4px">${escHtml(o.afgevinktDoor)}</span>`:''}
      </div>
      ${heeftOpmerking?`<div style="margin-top:7px;padding:7px 10px;background:#fff;border-left:2px solid #D97706;border-radius:0 6px 6px 0;font-size:13px;color:#44403C">
        💬 ${escHtml(o.opmerking)}
        ${!readonly?`<button onclick="event.stopPropagation();vinktOpmerkingAf('${o.id}')" style="display:block;margin-top:5px;font-size:12px;color:#16A34A;background:none;border:1px solid #16A34A;border-radius:5px;padding:3px 10px;cursor:pointer">✓ Opgelost</button>`:''}
      </div>`:''}
      ${!readonly&&!heeftOpmerking?`<div style="font-size:11px;color:#C0BDB8;margin-top:4px">Tik voor opmerking</div>`:''}
    </div>
  </div>`;
}

function renderJaarplanningDesktop(klas, klassen, weken, opdrachten, vak, vakken, gebruikers, cw, heeftWeken, totaal, afgevinktN, pct, readonly) {
  const periodes={1:[],2:[],3:[],4:[]};
  if(heeftWeken) weken.forEach(w=>{
    const wn=w.weeknummer; let p=1;
    if((wn>=44)||(wn<=8))p=2; else if(wn>=9&&wn<=18)p=3; else if(wn>=19&&wn<=26)p=4;
    periodes[p].push(w);
  });
  const pNamen={1:'Periode 1 — september t/m november',2:'Periode 2 — december t/m februari',3:'Periode 3 — maart t/m mei',4:'Periode 4 — juni t/m juli'};
  document.getElementById('view-jaarplanning').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="breadcrumb"><span onclick="showView('klassen')" style="cursor:pointer;color:#16A34A">Klassen</span> › Jaarplanning</div>
        <h1>${escHtml(klas.naam)}</h1>
      </div>
      <select id="klas-select" onchange="window._selectedKlas=this.value;renderJaarplanning()" style="padding:9px 14px;border:1.5px solid rgba(28,25,23,0.15);border-radius:10px;font-size:14px;background:#fff;color:#1C1917;font-weight:500">
        ${klassen.map(k=>`<option value="${k.id}" ${k.id===klas.id?'selected':''}>${escHtml(k.naam)}</option>`).join('')}
      </select>
    </div>
    ${readonly?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus</div>`:''}
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:20px;padding:14px 20px;flex-wrap:wrap">
        <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:#78716C;margin-bottom:2px">Vak</div><span class="badge badge-green">${escHtml(vak?.naam||'—')}</span></div>
        <div><div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#78716C;margin-bottom:2px">Niveau</div><span style="font-size:13px;font-weight:500">Leerjaar ${klas.leerjaar} · ${escHtml(klas.niveau)}</span></div>
        <div><div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#78716C;margin-bottom:2px">Uren/week</div><span style="font-size:13px">${klas.urenPerWeek||'?'} uur</span></div>
        <div><div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#78716C;margin-bottom:2px">Voortgang</div><span style="font-size:13px;font-weight:600;color:#16A34A">${afgevinktN}/${totaal} (${pct}%)</span></div>
        <div style="flex:1;min-width:100px"><div class="klas-progress"><div class="klas-progress-fill" style="width:${pct}%"></div></div></div>
      </div>
    </div>
    ${!heeftWeken?`<div class="card"><div class="empty-state"><h3>Geen weekstructuur</h3>${Auth.isAdmin()?`<button class="btn btn-primary" onclick="showView('schooljaren')">Schooljaar aanmaken</button>`:'<p>Vraag de beheerder.</p>'}</div></div>`:`
    ${[1,2,3,4].map(p=>{
      const pw=periodes[p]; if(!pw.length)return '';
      return `<div class="card">
        <div class="card-header"><div><h2>${pNamen[p]}</h2><div class="card-meta">${pw.filter(w=>!w.isVakantie).length} schoolweken</div></div></div>
        <table class="data-table">
          <thead><tr><th style="width:65px">Week</th><th style="width:110px">Datum</th><th style="width:160px">Thema / Markering</th><th>Activiteiten</th><th style="width:${Auth.isAdmin()||Auth.isManagement()?'120':'90'}px"></th></tr></thead>
          <tbody>${pw.map(w=>{
            const wOpd=opdrachten.filter(o=>{
              if(o.weeknummer===w.weeknummer&&o.schooljaar===klas.schooljaar)return true;
              if(o.weken)return weekInRange(o.weken,w.weeknummer);
              return false;
            });
            const isNu=w.weeknummer===cw;
            const alleKlaar=wOpd.length>0&&wOpd.every(o=>o.afgevinkt);
            const wt = getWeektypeInfo(w);
            const dagnotities = w.dagnotities || [];

            if(wt.geblokkeerd) return `<tr style="background:${wt.bg}">
              <td><span class="week-pill">${w.weeknummer}</span></td>
              <td style="font-size:12px;color:${wt.kleur}">${w.van}<br>${w.tot}</td>
              <td colspan="2">
                <span style="font-size:13px;font-weight:500;color:${wt.kleur}">${wt.icon} ${escHtml(w.vakantieNaam||wt.label)}</span>
                ${dagnotities.length?`<div style="margin-top:4px">${dagnotities.map(n=>renderDagnotitieTag(n)).join(' ')}</div>`:''}
              </td>
              <td>${Auth.isAdmin()||Auth.isManagement()?`<button class="btn btn-sm" onclick="openWeekBeheerModal('${w.id}','${w.schooljaar}',${w.weeknummer},'${escHtml(w.van)}','${escHtml(w.tot)}')">⚙ Beheer</button>`:''}
              </td>
            </tr>`;

            return `<tr class="${isNu?'planning-row-active':''}" style="${alleKlaar?'background:rgba(22,163,74,0.03)':''}${wt.bg&&!wt.geblokkeerd?`;background:${wt.bg}`:''}">
              <td>
                <span class="week-pill ${isNu?'current':''}">${w.weeknummer}</span>
                ${isNu?'<div style="font-size:9px;color:#16A34A;font-weight:700;margin-top:2px">NU</div>':''}
                ${wt.label&&!wt.geblokkeerd?`<div style="font-size:9px;color:${wt.kleur};font-weight:600;margin-top:2px">${wt.icon}</div>`:''}
              </td>
              <td style="font-size:12px;color:#78716C">${w.van}<br>${w.tot}</td>
              <td>
                ${wt.label&&!wt.geblokkeerd?`<div style="margin-bottom:5px"><span style="font-size:11px;font-weight:600;color:${wt.kleur};background:${wt.bg};padding:2px 7px;border-radius:10px">${wt.icon} ${escHtml(w.vakantieNaam||wt.label)}</span></div>`:''}
                ${!readonly?`<span class="week-thema-inline" data-weekid="${w.id}" onclick="editWeekThemaInline(this)" style="display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${w.thema?'transparent':'rgba(28,25,23,0.15)'};cursor:pointer;font-size:12px;color:${w.thema?'#1C1917':'#A8A29E'};min-height:28px">${escHtml(w.thema)||'<span style="opacity:.5">+ Thema</span>'}</span>`:`<span style="font-size:12px;color:#78716C">${escHtml(w.thema)||'—'}</span>`}
                ${dagnotities.length?`<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${dagnotities.map(n=>renderDagnotitieTag(n)).join('')}</div>`:''}
              </td>
              <td>${wOpd.length===0?`<span style="font-size:12px;color:#D3D1C7">—</span>`:wOpd.map(o=>renderActiviteitRij(o,readonly,w.weeknummer)).join('')}</td>
              <td style="vertical-align:top;padding-top:12px">
                <div style="display:flex;flex-direction:column;gap:4px">
                  ${!readonly?`<button class="btn btn-sm" onclick="openOpdrachtModal(null,'${klas.id}',${p},${w.weeknummer})">+ Activiteit</button>`:''}
                  ${Auth.isAdmin()||Auth.isManagement()?`<button class="btn btn-sm" onclick="openWeekBeheerModal('${w.id}','${w.schooljaar}',${w.weeknummer},'${escHtml(w.van)}','${escHtml(w.tot)}')">⚙ Beheer</button>`:''}
                </div>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
    }).join('')}`}
  `;
}

function renderActiviteitRij(o, readonly, weeknummer) {
  const afgevinkt=o.afgevinkt||o.afgevinkt===1;
  const initialen=o.afgevinktDoor||'';
  const datum=o.afgevinktOp?new Date(o.afgevinktOp).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}):'';
  const heeftOpmerking=o.opmerking&&o.opmerking.trim();
  const cw=getCurrentWeek(), weekVoorbij=weeknummer<cw;
  let bgKleur,borderKleur;
  if(afgevinkt&&heeftOpmerking){bgKleur='rgba(217,119,6,0.07)';borderKleur='rgba(217,119,6,0.3)';}
  else if(afgevinkt){bgKleur='rgba(22,163,74,0.07)';borderKleur='rgba(22,163,74,0.2)';}
  else if(weekVoorbij){bgKleur='rgba(220,38,38,0.05)';borderKleur='rgba(220,38,38,0.15)';}
  else{bgKleur='#F8F7F4';borderKleur='rgba(28,25,23,0.1)';}
  return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:7px;padding:8px 10px;border-radius:8px;background:${bgKleur};border:1px solid ${borderKleur}">
    ${!readonly?`<button onclick="doAfvinken('${o.id}')" style="width:22px;height:22px;border-radius:50%;border:2px solid ${afgevinkt?'#16A34A':'rgba(28,25,23,0.2)'};background:${afgevinkt?'#16A34A':'#fff'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;margin-top:1px">${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</button>`
    :`<div style="width:22px;height:22px;border-radius:50%;border:2px solid ${afgevinkt?'#16A34A':'rgba(28,25,23,0.2)'};background:${afgevinkt?'#16A34A':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${afgevinkt?'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</div>`}
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        <span class="badge ${typeKleur(o.type)}" style="font-size:10px;padding:1px 6px">${escHtml(o.type)}</span>
        <span style="font-size:12px;font-weight:500;${afgevinkt&&!heeftOpmerking?'text-decoration:line-through;color:#A8A29E':''}">${escHtml(o.naam)}</span>
        ${o.uren?`<span style="font-size:11px;color:#78716C">${o.uren}u</span>`:''}
        ${o.syllabuscodes?`<span style="font-size:10px;color:#A8A29E">${escHtml(o.syllabuscodes)}</span>`:''}
        ${o.theorieLink?`<a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank" style="font-size:11px">↗</a>`:''}
        ${!afgevinkt&&weekVoorbij?`<span style="font-size:10px;color:#DC2626;font-weight:600">● Niet afgevinkt</span>`:''}
      </div>
      ${afgevinkt&&initialen?`<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:11px;font-weight:700;font-family:monospace;background:#16A34A;color:#fff;padding:1px 5px;border-radius:4px">${escHtml(initialen)}</span><span style="font-size:11px;color:#78716C">${datum}</span></div>`:''}
      ${heeftOpmerking?`<div style="margin-top:4px;padding:4px 8px;background:#fff;border-left:2px solid #D97706;border-radius:0 4px 4px 0;font-size:12px;color:#44403C">💬 ${escHtml(o.opmerking)}${!readonly?`<button onclick="vinktOpmerkingAf('${o.id}')" style="margin-left:6px;font-size:11px;color:#16A34A;background:none;border:1px solid #16A34A;border-radius:4px;padding:1px 5px;cursor:pointer">✓ Opgelost</button>`:''}</div>`:''}
      ${!readonly?`<button onclick="openOpmerkingModal('${o.id}','${escHtml(o.naam)}')" style="margin-top:4px;font-size:11px;color:${heeftOpmerking?'#D97706':'#A8A29E'};background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">${heeftOpmerking?'✏️ Bewerken':'+ Opmerking'}</button>`:''}
    </div>
  </div>`;
}

async function doAfvinken(opdrachtId) {
  try { await API.afvinken(opdrachtId); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}

async function vinktOpmerkingAf(opdrachtId) {
  try { await API.setOpmerking(opdrachtId, null); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}

function openOpmerkingModal(opdrachtId, naam) {
  openModal(`
    <h2>Opmerking</h2>
    <p class="modal-sub">${escHtml(naam)}</p>
    <div class="form-field"><label>Opmerking / bijzonderheden</label>
      <textarea id="opmerking-tekst" placeholder="Bijv. Jan niet aanwezig..." style="min-height:100px"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveOpmerking('${opdrachtId}')">Opslaan</button>
    </div>
  `);
  API.getOpdrachten(window._selectedKlas).then(opds => {
    const o = opds.find(x=>x.id===opdrachtId);
    if (o?.opmerking) document.getElementById('opmerking-tekst').value = o.opmerking;
  });
}

async function saveOpmerking(opdrachtId) {
  const tekst = document.getElementById('opmerking-tekst').value.trim();
  try { await API.setOpmerking(opdrachtId, tekst || null); closeModalDirect(); renderJaarplanning(); }
  catch(e) { showError(e.message); }
}

function editWeekThemaInline(el) {
  const weekId = el.dataset.weekid;
  const huidig = el.querySelector('span[style*="opacity"]') ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type='text'; input.value=huidig;
  input.style.cssText='padding:4px 6px;border:1.5px solid #16A34A;border-radius:6px;font-size:12px;width:100%;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  async function opslaan() {
    const nieuw = input.value.trim();
    await API.updateWeekThema(weekId, nieuw);
    const span=document.createElement('span');
    span.className='week-thema-inline'; span.dataset.weekid=weekId;
    span.onclick=function(){editWeekThemaInline(this);};
    span.style.cssText=`display:block;padding:4px 6px;border-radius:6px;border:1px dashed ${nieuw?'transparent':'rgba(28,25,23,0.15)'};cursor:pointer;font-size:12px;color:${nieuw?'#1C1917':'#A8A29E'};min-height:28px`;
    span.innerHTML=nieuw?escHtml(nieuw):'<span style="opacity:.5">+ Thema</span>';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();opslaan();}if(e.key==='Escape')opslaan();});
}

async function openOpdrachtModal(opdrachtId=null, klasId=null, defaultPeriode=1, defaultWeek=null) {
  const klassen = await API.getKlassen();
  const selectedKlas = klasId||window._selectedKlas||(klassen[0]?.id);
  const klas = klassen.find(k=>k.id===selectedKlas);
  const weken = klas ? (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie) : [];
  let o = null;
  if (opdrachtId) { const opds = await API.getOpdrachten(selectedKlas); o = opds.find(x=>x.id===opdrachtId); }
  openModal(`
    <h2>${o?'Activiteit bewerken':'Activiteit toevoegen'}</h2>
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam *</label><input type="text" id="o-naam" value="${escHtml(o?.naam||'')}"></div>
      <div class="form-field"><label>Klas *</label><select id="o-klas" onchange="refreshWekenSelectAsync()">${klassen.map(k=>`<option value="${k.id}" ${k.id===selectedKlas?'selected':''}>${escHtml(k.naam)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Week *</label><select id="o-weeknummer"><option value="">— Selecteer week —</option>${weken.map(w=>`<option value="${w.weeknummer}" ${(o?.weeknummer===w.weeknummer)||defaultWeek===w.weeknummer?'selected':''}>Wk ${w.weeknummer} (${w.van})${w.thema?' · '+w.thema:''}</option>`).join('')}</select></div>
      <div class="form-field"><label>Type *</label><select id="o-type">${['Theorie','Praktijk','Toets','Opdracht','Groepsopdracht','Presentatie','Project','Overig'].map(t=>`<option value="${t}" ${o?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren</label><select id="o-uren"><option value="">—</option>${[0.5,1,1.5,2,2.5,3,4].map(u=>`<option value="${u}" ${o?.uren==u?'selected':''}>${u} uur</option>`).join('')}</select></div>
      <div class="form-field"><label>Periode</label><select id="o-periode">${[1,2,3,4].map(p=>`<option value="${p}" ${(o?.periode||defaultPeriode)==p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input type="text" id="o-syllabus" placeholder="PIE-1.1" value="${escHtml(o?.syllabuscodes||'')}"></div>
      <div class="form-field form-full"><label>Beschrijving</label><textarea id="o-beschrijving">${escHtml(o?.beschrijving||'')}</textarea></div>
      <div class="form-field form-full"><label>Link</label><input type="url" id="o-theorie" value="${escHtml(o?.theorieLink||'')}"></div>
      <div class="form-field form-full"><label>Toetsbestand</label><input type="text" id="o-toets" placeholder="bijv. toets_p1.pdf" value="${escHtml(o?.toetsBestand||'')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${o?`<button class="btn btn-danger" onclick="deleteOpdrachtFromModal('${o.id}')">Verwijderen</button>`:''}
      <button class="btn btn-primary" onclick="saveOpdracht('${opdrachtId||''}','${selectedKlas}')">Opslaan</button>
    </div>
  `);
}

async function refreshWekenSelectAsync() {
  const klasId = document.getElementById('o-klas')?.value;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k=>k.id===klasId);
  if (!klas) return;
  const weken = (await API.getWeken(klas.schooljaar)).filter(w=>!w.isVakantie);
  const sel = document.getElementById('o-weeknummer');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecteer week —</option>`+weken.map(w=>`<option value="${w.weeknummer}">Wk ${w.weeknummer} (${w.van})${w.thema?' · '+w.thema:''}</option>`).join('');
}

async function saveOpdracht(opdrachtId, defaultKlasId) {
  const naam=document.getElementById('o-naam').value.trim();
  const klasId=document.getElementById('o-klas').value||defaultKlasId;
  const weeknummer=parseInt(document.getElementById('o-weeknummer').value);
  const type=document.getElementById('o-type').value;
  const uren=document.getElementById('o-uren').value?parseFloat(document.getElementById('o-uren').value):null;
  const periode=parseInt(document.getElementById('o-periode').value);
  const syllabuscodes=document.getElementById('o-syllabus').value.trim();
  const beschrijving=document.getElementById('o-beschrijving').value.trim();
  const theorieLink=document.getElementById('o-theorie').value.trim();
  const toetsBestand=document.getElementById('o-toets').value.trim()||null;
  const klassen=await API.getKlassen();
  const klas=klassen.find(k=>k.id===klasId);
  if(!naam||!klasId||!weeknummer||!type){alert('Vul naam, klas, week en type in.');return;}
  const data={naam,klasId,periode,weeknummer,weken:String(weeknummer),schooljaar:klas?.schooljaar,type,uren,syllabuscodes,werkboekLink:'',beschrijving,theorieLink,toetsBestand};
  try {
    if(opdrachtId){await API.updateOpdracht(opdrachtId,data);}else{await API.addOpdracht(data);}
    window._selectedKlas=klasId; closeModalDirect(); renderJaarplanning();
  } catch(e){showError(e.message);}
}

async function deleteOpdrachtFromModal(id) {
  if(!confirm('Activiteit verwijderen?'))return;
  try{await API.deleteOpdracht(id);closeModalDirect();renderJaarplanning();}
  catch(e){showError(e.message);}
}

// ============================================================
// WEEKTYPE HELPERS
// ============================================================
function getWeektypeInfo(w) {
  const type = w.weektype || (w.isVakantie ? 'vakantie' : 'normaal');
  const types = {
    'vakantie':   { label:'Vakantie',    icon:'🏖',  bg:'#FFFBEB', kleur:'#B45309', geblokkeerd:true  },
    'examen':     { label:'Examenweek',  icon:'📝',  bg:'#FFF7F0', kleur:'#C2410C', geblokkeerd:false },
    'stage':      { label:'Stageweek',   icon:'🏢',  bg:'#F0F9FF', kleur:'#0369A1', geblokkeerd:false },
    'studie':     { label:'Studieweek',  icon:'📚',  bg:'#F5F3FF', kleur:'#7C3AED', geblokkeerd:false },
    'normaal':    { label:'',            icon:'',    bg:'',        kleur:'',         geblokkeerd:false },
  };
  return types[type] || types['normaal'];
}

function renderDagnotitieTag(n) {
  const kleuren = {
    'vrij':    { bg:'#FEF3C7', text:'#B45309', icon:'🏖' },
    'studie':  { bg:'#F5F3FF', text:'#7C3AED', icon:'📚' },
    'examen':  { bg:'#FFF7F0', text:'#C2410C', icon:'📝' },
    'notitie': { bg:'#EFF6FF', text:'#1D4ED8', icon:'💬' },
  };
  const k = kleuren[n.type] || kleuren['notitie'];
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:500;padding:2px 7px;border-radius:10px;background:${k.bg};color:${k.text}">${k.icon} ${escHtml(n.dag?n.dag+': ':'')}${escHtml(n.tekst)}</span>`;
}

// ============================================================
// WEEK BEHEER MODAL — admin & management
// ============================================================
function openWeekBeheerModal(weekId, schooljaar, weeknummer, van, tot) {
  // Haal huidige week data op
  API.getWeken(schooljaar).then(weken => {
    const w = weken.find(x => x.id === weekId);
    if (!w) return;
    const huidigType = w.weektype || (w.isVakantie ? 'vakantie' : 'normaal');
    const dagnotities = w.dagnotities || [];
    const dagen = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'];

    openModal(`
      <h2>Week ${weeknummer} beheren</h2>
      <p class="modal-sub">${escHtml(van)} – ${escHtml(tot)}</p>

      <div class="form-field">
        <label>Week markering</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
          ${[
            {v:'normaal',  icon:'📅', label:'Normaal'},
            {v:'vakantie', icon:'🏖', label:'Vakantie'},
            {v:'examen',   icon:'📝', label:'Examenweek'},
            {v:'stage',    icon:'🏢', label:'Stageweek'},
            {v:'studie',   icon:'📚', label:'Studieweek'},
          ].map(t=>`<label style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1.5px solid ${huidigType===t.v?'#16A34A':'rgba(28,25,23,0.12)'};border-radius:9px;cursor:pointer;background:${huidigType===t.v?'#F0FDF4':'#fff'};font-size:13px">
            <input type="radio" name="weektype" value="${t.v}" ${huidigType===t.v?'checked':''} style="accent-color:#16A34A">
            ${t.icon} ${t.label}
          </label>`).join('')}
        </div>
      </div>

      <div class="form-field" id="vaknaam-veld" style="${huidigType==='vakantie'||huidigType==='normaal'?'':'display:none'}">
        <label>Naam <span style="font-size:11px;color:#78716C">(bijv. "Herfstvakantie")</span></label>
        <input id="week-vaknaam" type="text" value="${escHtml(w.vakantieNaam||'')}" placeholder="Naam van de vakantie of markering">
      </div>

      <div class="form-field" style="margin-top:16px">
        <label>Dag-notities <span style="font-size:11px;color:#78716C">(zichtbaar als melding, blokkeert niets)</span></label>
        <div id="dagnotities-lijst" style="margin-top:8px">
          ${dagnotities.map((n,i) => renderDagnotitieRij(n, i)).join('')}
        </div>
        <button onclick="voegDagnotitieRijToe()" class="btn btn-sm" style="margin-top:8px;width:100%">+ Dag-notitie toevoegen</button>
      </div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModalDirect()">Annuleren</button>
        <button class="btn btn-primary" onclick="slaWeekBeheerOp('${weekId}','${schooljaar}')">Opslaan</button>
      </div>
    `);

    // Update vaknaam veld zichtbaarheid bij type wijziging
    document.querySelectorAll('input[name="weektype"]').forEach(r => {
      r.addEventListener('change', () => {
        const veld = document.getElementById('vaknaam-veld');
        if (veld) veld.style.display = r.value === 'vakantie' ? 'block' : 'none';
      });
    });
  });
}

function renderDagnotitieRij(n, idx) {
  const dagen = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'];
  const types = ['notitie','vrij','studie','examen'];
  return `<div class="dagnotitie-rij" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
    <select class="dn-dag" style="padding:7px 10px;border:1.5px solid rgba(28,25,23,0.12);border-radius:8px;font-size:13px;background:#fff;flex:0 0 110px">
      <option value="">Hele week</option>
      ${dagen.map(d=>`<option value="${d}" ${n.dag===d?'selected':''}>${d}</option>`).join('')}
    </select>
    <select class="dn-type" style="padding:7px 10px;border:1.5px solid rgba(28,25,23,0.12);border-radius:8px;font-size:13px;background:#fff;flex:0 0 100px">
      ${types.map(t=>`<option value="${t}" ${n.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
    </select>
    <input class="dn-tekst" type="text" value="${escHtml(n.tekst||'')}" placeholder="Omschrijving..." style="flex:1;padding:7px 10px;border:1.5px solid rgba(28,25,23,0.12);border-radius:8px;font-size:13px">
    <button onclick="this.closest('.dagnotitie-rij').remove()" style="width:28px;height:28px;border:none;background:none;color:#DC2626;cursor:pointer;font-size:18px;flex-shrink:0">×</button>
  </div>`;
}

function voegDagnotitieRijToe() {
  const lijst = document.getElementById('dagnotities-lijst');
  if (!lijst) return;
  const div = document.createElement('div');
  div.innerHTML = renderDagnotitieRij({dag:'', type:'notitie', tekst:''}, Date.now());
  lijst.appendChild(div.firstElementChild);
}

async function slaWeekBeheerOp(weekId, schooljaar) {
  const weektype = document.querySelector('input[name="weektype"]:checked')?.value || 'normaal';
  const vakantieNaam = document.getElementById('week-vaknaam')?.value?.trim() || null;

  // Verzamel dagnotities
  const dagnotities = [];
  document.querySelectorAll('.dagnotitie-rij').forEach(rij => {
    const tekst = rij.querySelector('.dn-tekst')?.value?.trim();
    if (tekst) {
      dagnotities.push({
        dag: rij.querySelector('.dn-dag')?.value || '',
        type: rij.querySelector('.dn-type')?.value || 'notitie',
        tekst,
      });
    }
  });

  try {
    await API.updateWeekType(weekId, weektype, weektype === 'vakantie' ? vakantieNaam : vakantieNaam || null);
    await API.updateDagnotities(weekId, dagnotities);
    closeModalDirect();
    renderJaarplanning();
  } catch(e) { showError(e.message); }
}
