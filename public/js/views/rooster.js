async function renderRooster() {
  showLoading('rooster');
  try {
    const klassen = await API.getKlassen();
    const userId = Auth.currentUser?.id;
    const rooster = normaliseerRooster(await API.getRooster(userId));
    const dagen = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'];

    document.getElementById('view-rooster').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mijn rooster</h1>
          <div class="breadcrumb">Vink per klas en dag de lesuren aan waarop je deze klas hebt.</div>
        </div>
        <button class="btn btn-primary" onclick="roosterOpslaan()">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Opslaan
        </button>
      </div>

      <div class="alert alert-info" style="margin-bottom:20px">
        Schooldag: 8 lesuren van 45 minuten vanaf 08:30. Pauzes worden automatisch aangepast voor leerjaar 1/2 en 3/4.
      </div>

      <div class="card rooster-legenda-card">
        <div class="rooster-schema-grid">
          ${renderRoosterSchema('Leerjaar 1 en 2', roosterTijdenVoorLeerjaar(1))}
          ${renderRoosterSchema('Leerjaar 3 en 4', roosterTijdenVoorLeerjaar(3))}
        </div>
      </div>

      <div class="card">
        <div style="overflow-x:auto">
          <table class="rooster-table rooster-table-uren">
            <thead>
              <tr>
                <th style="width:190px">Klas</th>
                ${dagen.map(dag => `<th class="center">${dag}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${klassen.length === 0
                ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--ink-muted)">Geen klassen gevonden.</td></tr>`
                : klassen.map((k) => {
                    return `<tr>
                      <td>
                        <div class="rooster-klas-naam">${escHtml(k.naam)}</div>
                        <div class="rooster-klas-sub">${escHtml(k.niveau || '')} · Leerjaar ${escHtml(String(k.leerjaar || ''))}</div>
                      </td>
                      ${dagen.map(dag => renderRoosterDagCel(k, dag, rooster)).join('')}
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        ${klassen.length > 0 ? `
        <div class="rooster-snel-balk">
          <span style="font-size:12px;color:var(--ink-muted);font-weight:500">Snel:</span>
          ${dagen.map(dag => `<button onclick="selecteerDag('${dag}')" class="btn btn-sm">${dag} alles aan</button>`).join('')}
          <button onclick="deselecteerAlles()" class="btn btn-sm">Alles uit</button>
        </div>` : ''}
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <div><h2>Preview vandaag</h2><div class="card-meta">Klassen en lesuren die vandaag in je dashboard verschijnen</div></div>
        </div>
        <div id="rooster-preview" style="padding:16px 20px">
          ${renderRoosterPreview(klassen, rooster)}
        </div>
      </div>
    `;
  } catch(e) { showError('Fout bij laden rooster: ' + e.message); }
}

function roosterTijdenVoorLeerjaar(leerjaar) {
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

function roosterPauzesVoorLeerjaar(leerjaar) {
  const lj = parseInt(leerjaar, 10);
  const onderbouw = lj === 1 || lj === 2;
  return onderbouw
    ? [['10:00','10:20'], ['11:50','12:15'], ['14:30','14:45']]
    : [['10:00','10:20'], ['12:35','13:00'], ['14:30','14:45']];
}

function renderRoosterSchema(titel, tijden) {
  return `<div class="rooster-schema">
    <strong>${escHtml(titel)}</strong>
    <div>${Object.entries(tijden).map(([uur, t]) => `<span>${uur}. ${t[0]}-${t[1]}</span>`).join('')}</div>
  </div>`;
}

function normaliseerRooster(rooster) {
  const output = {};
  Object.entries(rooster || {}).forEach(([klasId, waarde]) => {
    output[klasId] = {};
    if (Array.isArray(waarde)) {
      waarde.forEach(dag => { output[klasId][dag] = [1]; });
    } else if (waarde && typeof waarde === 'object') {
      Object.entries(waarde).forEach(([dag, uren]) => {
        output[klasId][dag] = Array.isArray(uren) ? uren.map(Number).filter(Boolean) : [];
      });
    }
  });
  return output;
}

function renderRoosterDagCel(klas, dag, rooster) {
  const gekozen = ((rooster[klas.id] || {})[dag] || []).map(Number);
  const tijden = roosterTijdenVoorLeerjaar(klas.leerjaar);
  return `<td class="center rooster-uur-cel">
    <div class="rooster-uur-grid">
      ${Object.keys(tijden).map(uur => `
        <label class="rooster-uur-pill ${gekozen.includes(Number(uur)) ? 'is-checked' : ''}" title="Lesuur ${uur}: ${tijden[uur][0]}-${tijden[uur][1]}">
          <input type="checkbox"
            data-klas="${escHtml(klas.id)}"
            data-dag="${escHtml(dag)}"
            data-uur="${uur}"
            ${gekozen.includes(Number(uur)) ? 'checked' : ''}
            onchange="roosterCheckChange(this)">
          <span>${uur}</span>
        </label>`).join('')}
    </div>
  </td>`;
}

function renderRoosterPreview(klassen, rooster) {
  const vandaag = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'][new Date().getDay()];
  const items = klassen
    .map(k => ({ klas: k, uren: (((rooster[k.id] || {})[vandaag]) || []).map(Number).sort((a,b)=>a-b) }))
    .filter(x => x.uren.length);

  if (!items.length) {
    return `<p style="color:var(--ink-3);font-size:13px">Geen klassen ingepland voor vandaag (${vandaag}). Vink hierboven lesuren aan.</p>`;
  }

  return `<div class="rooster-preview-list">
    ${items.map(({ klas, uren }) => {
      const tijden = roosterTijdenVoorLeerjaar(klas.leerjaar);
      const start = tijden[uren[0]]?.[0] || '';
      const eind = tijden[uren[uren.length - 1]]?.[1] || '';
      return `<div class="rooster-preview-chip">
        <span class="rooster-preview-naam">${escHtml(klas.naam)}</span>
        <span class="rooster-preview-sub">uur ${uren.join(', ')} · ${start}-${eind}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function roosterCheckChange(checkbox) {
  const label = checkbox.closest('.rooster-uur-pill');
  if (label) label.classList.toggle('is-checked', checkbox.checked);
  updateRoosterPreview();
}

async function updateRoosterPreview() {
  try {
    const klassen = await API.getKlassen();
    const rooster = haalHuidigRoosterOp(klassen);
    document.getElementById('rooster-preview').innerHTML = renderRoosterPreview(klassen, rooster);
  } catch(e) {}
}

function haalHuidigRoosterOp(klassen) {
  const rooster = {};
  klassen.forEach(k => {
    const perDag = {};
    ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'].forEach(dag => {
      const uren = [...document.querySelectorAll(`input[data-klas="${CSS.escape(k.id)}"][data-dag="${dag}"]:checked`)]
        .map(cb => Number(cb.dataset.uur))
        .sort((a, b) => a - b);
      if (uren.length) perDag[dag] = uren;
    });
    if (Object.keys(perDag).length) rooster[k.id] = perDag;
  });
  return rooster;
}

function selecteerDag(dag) {
  document.querySelectorAll(`input[data-dag="${dag}"]`).forEach(cb => {
    cb.checked = true;
    const label = cb.closest('.rooster-uur-pill');
    if (label) label.classList.add('is-checked');
  });
  updateRoosterPreview();
}

function deselecteerAlles() {
  document.querySelectorAll('input[data-klas][data-uur]').forEach(cb => {
    cb.checked = false;
    const label = cb.closest('.rooster-uur-pill');
    if (label) label.classList.remove('is-checked');
  });
  updateRoosterPreview();
}

async function roosterOpslaan() {
  try {
    const klassen = await API.getKlassen();
    const rooster = haalHuidigRoosterOp(klassen);
    await API.saveRooster(Auth.currentUser.id, rooster);
    const btn = document.querySelector('[onclick="roosterOpslaan()"]');
    if (btn) {
      const origineel = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Opgeslagen!';
      btn.style.background = '#15803D';
      setTimeout(() => { btn.innerHTML = origineel; btn.style.background = ''; }, 2000);
    }
  } catch(e) { showError('Fout bij opslaan: ' + e.message); }
}
