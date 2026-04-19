function renderToetsen() {
  const readonly = !Auth.canEdit();
  const klassen = Auth.getZichtbareKlassen();
  const klasIds = klassen.map(k => k.id);
  const alleOpdrachten = DB.getOpdrachten().filter(o => klasIds.includes(o.klasId));
  const metToets = alleOpdrachten.filter(o => o.toetsBestand);
  const metTheorie = alleOpdrachten.filter(o => o.theorieLink);

  document.getElementById('view-toetsen').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Toetsen & Materialen</h1>
      </div>
      ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal()">+ Materiaal koppelen</button>` : ''}
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <h2>Toetsen (${metToets.length})</h2>
          <div class="card-meta">Alle gekoppelde toetsbestanden</div>
        </div>
      </div>
      ${metToets.length === 0 ? `
        <div class="empty-state">
          <h3>Geen toetsen</h3>
          <p>Koppel een toetsbestand bij een opdracht in de jaarplanning.</p>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Bestand</th>
              <th>Opdracht</th>
              <th>Klas</th>
              <th>Week</th>
              <th>Syllabuscodes</th>
              ${!readonly ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${metToets.sort((a,b) => parseInt(a.weken||0)-parseInt(b.weken||0)).map(o => {
              const klas = DB.getKlas(o.klasId);
              return `<tr>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:8px">
                    <span style="font-size:20px">📄</span>
                    <span style="font-weight:500">${escHtml(o.toetsBestand)}</span>
                  </span>
                </td>
                <td>${escHtml(o.naam)}</td>
                <td>${escHtml(klas?.naam||'—')}</td>
                <td><span class="week-pill">Wk ${o.weken}</span></td>
                <td style="font-size:12px;color:var(--ink-muted)">${escHtml(o.syllabuscodes)||'—'}</td>
                ${!readonly ? `<td>
                  <button class="btn btn-sm" onclick="window._selectedKlas='${o.klasId}'; openOpdrachtModal('${o.id}','${o.klasId}')">Bewerk</button>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <h2>Theorie & links (${metTheorie.length})</h2>
          <div class="card-meta">Alle gekoppelde theorie-links</div>
        </div>
      </div>
      ${metTheorie.length === 0 ? `
        <div class="empty-state">
          <h3>Geen theorie-links</h3>
          <p>Voeg theorie-links toe bij opdrachten in de jaarplanning.</p>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Opdracht</th>
              <th>Klas</th>
              <th>Week</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            ${metTheorie.sort((a,b) => parseInt(a.weken||0)-parseInt(b.weken||0)).map(o => {
              const klas = DB.getKlas(o.klasId);
              return `<tr>
                <td style="font-weight:500">${escHtml(o.naam)}</td>
                <td>${escHtml(klas?.naam||'—')}</td>
                <td><span class="week-pill">Wk ${o.weken}</span></td>
                <td><a href="${escHtml(o.theorieLink)}" class="text-link" target="_blank">${escHtml(o.theorieLink.length>50 ? o.theorieLink.slice(0,50)+'…' : o.theorieLink)}</a></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>

    ${!readonly ? `
    <div class="card">
      <div class="card-header"><h2>Bestand uploaden</h2></div>
      <div style="padding:24px">
        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
          <div class="upload-icon">↑</div>
          <div style="font-weight:500;margin-bottom:4px">Sleep een bestand hierheen of klik om te bladeren</div>
          <div style="font-size:12px">PDF, Word of PowerPoint — max 25 MB</div>
        </div>
        <input type="file" id="file-input" accept=".pdf,.doc,.docx,.ppt,.pptx" style="display:none" onchange="uploadBestand(this)">
        <div id="upload-result" style="margin-top:12px;font-size:13px;color:var(--ink-muted)"></div>
        <div style="font-size:12px;color:var(--ink-muted);margin-top:8px">
          Na het uploaden koppelt u het bestandsnaam aan een opdracht via de jaarplanning.
        </div>
      </div>
    </div>` : ''}
  `;
}

async function uploadBestand(input) {
  const file = input.files[0];
  if (!file) return;

  const result = document.getElementById('upload-result');
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bestand wordt geüpload...</span>`;

  const formData = new FormData();
  formData.append('bestand', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.bestandsnaam) {
      result.innerHTML = `
        <span style="color:var(--accent)">✓ Geüpload als: <strong>${escHtml(data.bestandsnaam)}</strong></span><br>
        <span style="font-size:11px;color:var(--ink-muted)">Kopieer deze bestandsnaam en plak die in het veld "Toetsbestand" bij een opdracht.</span>
      `;
    } else {
      result.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(data.error||'Onbekende fout')}</span>`;
    }
  } catch (e) {
    result.innerHTML = `<span style="color:var(--red)">Upload mislukt. Controleer de server.</span>`;
  }
}
