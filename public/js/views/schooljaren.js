function renderSchooljaren() {
  if (!Auth.isAdmin()) {
    document.getElementById('view-schooljaren').innerHTML = `
      <div class="empty-state"><h3>Geen toegang</h3><p>Alleen beheerders kunnen schooljaren aanmaken.</p></div>
    `;
    return;
  }

  const schooljaren = DB.getSchooljaren();
  const beschikbaar = Schooljaar.beschikbareJaren();

  document.getElementById('view-schooljaren').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Schooljaren</h1>
      </div>
      <button class="btn btn-primary" onclick="openSchooljaarModal()">
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Schooljaar aanmaken
      </button>
    </div>

    <div class="alert alert-info" style="margin-bottom:20px">
      Wanneer je een schooljaar aanmaakt worden automatisch alle schoolweken gegenereerd op basis van de officiële Noord-Holland VMBO vakantieregeling. Docenten kunnen daarna per week opdrachten en een thema invullen.
    </div>

    ${schooljaren.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <h3>Nog geen schooljaren</h3>
          <p>Maak een schooljaar aan om de weekplanning te activeren.</p>
          <button class="btn btn-primary" onclick="openSchooljaarModal()">Eerste schooljaar aanmaken</button>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        ${schooljaren.map(sj => {
          const weken = DB.getWeken(sj.naam);
          const schoolweken = weken.filter(w => !w.isVakantie);
          const vakantieweken = weken.filter(w => w.isVakantie);
          const vakanties = [...new Set(vakantieweken.map(w => w.vakantieNaam))];
          return `
            <div class="card" style="margin-bottom:0">
              <div style="padding:20px 22px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
                  <div>
                    <div style="font-family:'DM Serif Display',serif;font-size:22px">${sj.naam}</div>
                    <div style="font-size:12px;color:var(--ink-muted);margin-top:2px">${weken.length} weken totaal</div>
                  </div>
                  <span class="badge badge-green">Actief</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
                  <div style="background:var(--cream);border-radius:var(--radius);padding:10px 12px;text-align:center">
                    <div style="font-size:20px;font-weight:600;color:var(--accent)">${schoolweken.length}</div>
                    <div style="font-size:11px;color:var(--ink-muted)">schoolweken</div>
                  </div>
                  <div style="background:var(--cream);border-radius:var(--radius);padding:10px 12px;text-align:center">
                    <div style="font-size:20px;font-weight:600;color:var(--amber)">${vakantieweken.length}</div>
                    <div style="font-size:11px;color:var(--ink-muted)">vakantieweken</div>
                  </div>
                </div>
                <div style="font-size:12px;color:var(--ink-muted);margin-bottom:14px">
                  ${vakanties.map(v => `<span class="badge badge-amber" style="margin-right:4px;margin-bottom:4px">${v}</span>`).join('')}
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm" style="flex:1" onclick="bekijkWekenOverzicht('${sj.naam}')">Weken bekijken</button>
                  <button class="icon-btn" onclick="deleteSchooljaar('${sj.naam}')" style="color:var(--red)" title="Verwijderen">
                    <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div id="weken-overzicht"></div>
    `}
  `;
}

function openSchooljaarModal() {
  const beschikbaar = Schooljaar.beschikbareJaren();
  const bestaand = DB.getSchooljaren().map(s => s.naam);
  const nieuw = beschikbaar.filter(j => !bestaand.includes(j));

  openModal(`
    <h2>Schooljaar aanmaken</h2>
    <p class="modal-sub">Kies een schooljaar. Alle schoolweken inclusief Noord-Holland VMBO vakanties worden automatisch gegenereerd.</p>

    <div class="form-field">
      <label>Schooljaar *</label>
      <select id="sj-jaar">
        <option value="">— Selecteer schooljaar —</option>
        ${beschikbaar.map(j => `
          <option value="${j}" ${bestaand.includes(j) ? 'disabled' : ''}>
            ${j} ${bestaand.includes(j) ? '(al aangemaakt)' : ''}
          </option>
        `).join('')}
      </select>
    </div>

    <div id="sj-preview" style="margin-top:16px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveSchooljaar()">
        Schooljaar + weken aanmaken
      </button>
    </div>
  `);

  // Preview bij selectie
  document.getElementById('sj-jaar').addEventListener('change', function() {
    const jaar = this.value;
    if (!jaar) { document.getElementById('sj-preview').innerHTML = ''; return; }
    const weken = Schooljaar.genereerWeken(jaar);
    const schoolweken = weken.filter(w => !w.isVakantie).length;
    const vakantieweken = weken.filter(w => w.isVakantie).length;
    const eersteWeek = weken[0];
    const laatste = weken[weken.length - 1];
    document.getElementById('sj-preview').innerHTML = `
      <div class="alert alert-success">
        <strong>Preview ${jaar}</strong><br>
        ${weken.length} weken totaal · ${schoolweken} schoolweken · ${vakantieweken} vakantieweken<br>
        Van week ${eersteWeek?.weeknummer} (${eersteWeek?.van}) tot week ${laatste?.weeknummer} (${laatste?.tot})
      </div>
    `;
  });
}

function saveSchooljaar() {
  const jaar = document.getElementById('sj-jaar').value;
  if (!jaar) { alert('Selecteer een schooljaar.'); return; }
  const result = DB.addSchooljaar(jaar);
  if (result.error) { alert(result.error); return; }
  closeModalDirect();
  renderSchooljaren();
}

function deleteSchooljaar(naam) {
  const klassen = DB.getKlassen().filter(k => k.schooljaar === naam);
  if (klassen.length > 0) {
    alert(`Kan niet verwijderen: ${klassen.length} klassen gebruiken dit schooljaar.`);
    return;
  }
  if (!confirm(`Schooljaar ${naam} en alle gegenereerde weken verwijderen?`)) return;
  DB.deleteSchooljaar(naam);
  renderSchooljaren();
}

function bekijkWekenOverzicht(schooljaar) {
  const weken = DB.getWeken(schooljaar);
  const el = document.getElementById('weken-overzicht');

  // Groepeer per periode (kwartaal)
  const periodes = { 1: [], 2: [], 3: [], 4: [] };
  weken.forEach(w => {
    const wn = w.weeknummer;
    // P1: wk 35-43, P2: wk 44-8, P3: wk 9-18, P4: wk 19-26
    let p = 1;
    if ((wn >= 44) || (wn <= 8)) p = 2;
    else if (wn >= 9 && wn <= 18) p = 3;
    else if (wn >= 19 && wn <= 26) p = 4;
    periodes[p].push(w);
  });

  const periodeNamen = {
    1: 'Periode 1 — september t/m november',
    2: 'Periode 2 — december t/m februari',
    3: 'Periode 3 — maart t/m mei',
    4: 'Periode 4 — juni t/m juli',
  };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Weekoverzicht ${schooljaar}</h2>
        <div class="card-meta">${weken.length} weken · klik op een thema om te bewerken</div>
      </div>
      ${[1,2,3,4].map(p => {
        const pw = periodes[p];
        if (!pw.length) return '';
        return `
          <div style="border-bottom:1px solid var(--border)">
            <div style="padding:12px 24px;background:var(--cream);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-muted)">
              ${periodeNamen[p]}
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:70px">Week</th>
                  <th style="width:140px">Datum</th>
                  <th>Thema / onderwerp</th>
                  <th style="width:140px">Status</th>
                </tr>
              </thead>
              <tbody>
                ${pw.map(w => `
                  <tr style="${w.isVakantie ? 'opacity:.55;background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(196,130,26,0.04) 4px,rgba(196,130,26,0.04) 8px)' : ''}">
                    <td><span class="week-pill ${w.weeknummer === getCurrentWeek() ? 'current' : ''}">${w.weeknummer}</span></td>
                    <td style="font-size:12px;color:var(--ink-muted)">${w.van} – ${w.tot}</td>
                    <td>
                      ${w.isVakantie
                        ? `<span class="badge badge-amber">${w.vakantieNaam}</span>`
                        : `<span
                            class="week-thema-cel"
                            data-weekid="${w.id}"
                            data-schooljaar="${schooljaar}"
                            onclick="editWeekThema(this)"
                            style="display:inline-block;min-width:200px;padding:4px 8px;border-radius:6px;border:1px dashed ${w.thema ? 'transparent' : 'var(--border-med)'};cursor:pointer;font-size:13px;color:${w.thema ? 'var(--ink)' : 'var(--ink-muted)'}"
                          >${w.thema || '+ Thema toevoegen'}</span>`
                      }
                    </td>
                    <td>
                      ${w.isVakantie
                        ? `<span style="font-size:12px;color:var(--amber)">Vakantie</span>`
                        : `<span style="font-size:12px;color:var(--ink-muted)">Schoolweek</span>`
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function editWeekThema(el) {
  const weekId = el.dataset.weekid;
  const schooljaar = el.dataset.schooljaar;
  const huidigThema = el.textContent.trim() === '+ Thema toevoegen' ? '' : el.textContent.trim();

  const input = document.createElement('input');
  input.type = 'text';
  input.value = huidigThema;
  input.style.cssText = 'padding:4px 8px;border:1.5px solid var(--accent);border-radius:6px;font-size:13px;font-family:DM Sans,sans-serif;min-width:200px;outline:none';

  el.replaceWith(input);
  input.focus();
  input.select();

  function opslaan() {
    const nieuwThema = input.value.trim();
    DB.updateWeekThema(schooljaar, weekId, nieuwThema);
    const span = document.createElement('span');
    span.className = 'week-thema-cel';
    span.dataset.weekid = weekId;
    span.dataset.schooljaar = schooljaar;
    span.onclick = function() { editWeekThema(this); };
    span.style.cssText = `display:inline-block;min-width:200px;padding:4px 8px;border-radius:6px;border:1px dashed ${nieuwThema ? 'transparent' : 'var(--border-med)'};cursor:pointer;font-size:13px;color:${nieuwThema ? 'var(--ink)' : 'var(--ink-muted)'}`;
    span.textContent = nieuwThema || '+ Thema toevoegen';
    input.replaceWith(span);
  }

  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); opslaan(); } if (e.key === 'Escape') { opslaan(); } });
}
