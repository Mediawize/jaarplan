async function renderRooster() {
  showLoading('rooster');
  try {
    const [klassen, gebruikers] = await Promise.all([API.getKlassen(), API.getGebruikers()]);
    const userId = Auth.currentUser?.id;
    const rooster = await API.getRooster(userId);
    const dagen = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'];

    document.getElementById('view-rooster').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mijn rooster</h1>
          <div class="breadcrumb">Geef aan welke klas je op welke dag hebt — het dashboard past zich automatisch aan</div>
        </div>
        <button class="btn btn-primary" onclick="roosterOpslaan()">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Opslaan
        </button>
      </div>

      <div class="alert alert-info" style="margin-bottom:20px">
        Vink per klas aan op welke dag je lesgeeft. Het dashboard toont dan elke dag automatisch alleen de klassen en activiteiten van die dag.
      </div>

      <div class="card">
        <div style="overflow-x:auto">
          <table class="rooster-table">
            <thead>
              <tr>
                <th style="width:180px">Klas</th>
                ${dagen.map(dag => `<th class="center">${dag}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${klassen.length === 0
                ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--ink-muted)">Geen klassen gevonden.</td></tr>`
                : klassen.map((k) => {
                    const klasRooster = rooster[k.id] || [];
                    return `<tr>
                      <td>
                        <div class="rooster-klas-naam">${escHtml(k.naam)}</div>
                        <div class="rooster-klas-sub">${escHtml(k.niveau)} · Leerjaar ${k.leerjaar}</div>
                      </td>
                      ${dagen.map(dag => `
                        <td class="center">
                          <label style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer">
                            <input type="checkbox"
                              id="rooster-${k.id}-${dag}"
                              data-klas="${k.id}"
                              data-dag="${dag}"
                              ${klasRooster.includes(dag) ? 'checked' : ''}
                              onchange="roosterCheckChange(this)"
                              style="width:20px;height:20px;cursor:pointer;accent-color:var(--accent)">
                          </label>
                        </td>
                      `).join('')}
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        ${klassen.length > 0 ? `
        <div class="rooster-snel-balk">
          <span style="font-size:12px;color:var(--ink-muted);font-weight:500">Snel selecteren:</span>
          ${dagen.map(dag => `
            <button onclick="selecteerDag('${dag}')" class="btn btn-sm">Alle ${dag}</button>
          `).join('')}
          <button onclick="selecteerAlles()" class="btn btn-sm">Alles aan</button>
          <button onclick="deselecteerAlles()" class="btn btn-sm">Alles uit</button>
        </div>` : ''}
      </div>

      <!-- Preview van vandaag -->
      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <div><h2>Preview — vandaag</h2><div class="card-meta">Klassen die vandaag in je dashboard verschijnen</div></div>
        </div>
        <div id="rooster-preview" style="padding:16px 20px">
          ${renderRoosterPreview(klassen, rooster)}
        </div>
      </div>
    `;
  } catch(e) { showError('Fout bij laden rooster: ' + e.message); }
}

function renderRoosterPreview(klassen, rooster) {
  const vandaag = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'][new Date().getDay()];
  const klassenVandaag = klassen.filter(k => (rooster[k.id]||[]).includes(vandaag));

  if (klassenVandaag.length === 0) {
    return `<p style="color:var(--ink-3);font-size:13px">Geen klassen ingepland voor vandaag (${vandaag}). Vink klassen aan hierboven.</p>`;
  }

  return `<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${klassenVandaag.map(k => `
      <div class="rooster-preview-chip">
        <span class="rooster-preview-naam">${escHtml(k.naam)}</span>
        <span class="rooster-preview-sub">${escHtml(k.niveau)}</span>
      </div>
    `).join('')}
  </div>`;
}

function roosterCheckChange(checkbox) {
  // Update live preview
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
    const dagen = [];
    ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'].forEach(dag => {
      const cb = document.getElementById(`rooster-${k.id}-${dag}`);
      if (cb && cb.checked) dagen.push(dag);
    });
    if (dagen.length > 0) rooster[k.id] = dagen;
  });
  return rooster;
}

function selecteerDag(dag) {
  document.querySelectorAll(`input[data-dag="${dag}"]`).forEach(cb => { cb.checked = true; });
  updateRoosterPreview();
}

function selecteerAlles() {
  document.querySelectorAll('input[data-klas]').forEach(cb => { cb.checked = true; });
  updateRoosterPreview();
}

function deselecteerAlles() {
  document.querySelectorAll('input[data-klas]').forEach(cb => { cb.checked = false; });
  updateRoosterPreview();
}

async function roosterOpslaan() {
  try {
    const klassen = await API.getKlassen();
    const rooster = haalHuidigRoosterOp(klassen);
    await API.saveRooster(Auth.currentUser.id, rooster);
    // Toon succesmelding
    const btn = document.querySelector('[onclick="roosterOpslaan()"]');
    if (btn) {
      const origineel = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Opgeslagen!';
      btn.style.background = '#15803D';
      setTimeout(() => { btn.innerHTML = origineel; btn.style.background = ''; }, 2000);
    }
  } catch(e) { showError('Fout bij opslaan: ' + e.message); }
}
