async function renderKlassen() {
  showLoading('klassen');
  try {
    const [klassen, vakken, gebruikers, alleOpd] = await Promise.all([API.getKlassen(), API.getVakken(), API.getGebruikers(), API.getOpdrachten()]);
    const readonly = !Auth.canEdit();
    const cw = getCurrentWeek();

    document.getElementById('view-klassen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Klassen</h1></div>
        ${Auth.isAdmin()?`<button class="btn btn-primary" onclick="openKlasModal()">+ Klas toevoegen</button>`:''}
      </div>
      ${readonly?`<div class="readonly-notice"><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Leesmodus</div>`:''}
      ${klassen.length===0
        ? `<div class="empty-state"><h3>Geen klassen</h3>${Auth.isAdmin()?`<button class="btn btn-primary" onclick="openKlasModal()">Eerste klas aanmaken</button>`:''}</div>`
        : `<div class="klas-grid">
          ${klassen.map(k => {
            const vak = vakken.find(v=>v.id===k.vakId);
            const klasDocenten = (k.docenten||[]).map(id => gebruikers.find(u=>u.id===id)).filter(Boolean);
            const opd = alleOpd.filter(o=>o.klasId===k.id);
            const afg = opd.filter(o => o.afgevinkt).length;
            const progress = opd.length?Math.round((afg/opd.length)*100):0;
            return `<div class="klas-card">
              <div class="klas-card-top">
                <div style="flex:1;min-width:0">
                  <div class="klas-naam">
                    ${escHtml(k.naam)}
                    ${k.roulatie?`<span style="font-size:10px;font-weight:600;padding:2px 6px;background:var(--amber-dim);color:var(--amber-text);border-radius:10px;margin-left:4px">wk ${k.roulatieStart}–${k.roulatieBlok}</span>`:''}
                  </div>
                  <div class="klas-meta-row">
                    Leerjaar ${k.leerjaar||'?'} · ${escHtml(k.niveau)} · ${escHtml(vak?.naam||'—')}
                    ${k.urenPerWeek?` · ${k.urenPerWeek}u/week`:''}
                  </div>
                  ${klasDocenten.length > 0 ? `
                  <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">
                    ${klasDocenten.map(d => `
                      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:20px;font-size:11px;font-weight:500">
                        <span style="width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:monospace">${escHtml(getInitialen(d))}</span>
                        ${escHtml(d.naam)} ${escHtml(d.achternaam)}
                      </span>`).join('')}
                  </div>` : ''}
                </div>
                ${!readonly?`<div style="display:flex;gap:6px;flex-shrink:0">
                  <button class="icon-btn" onclick="openKlasModal('${k.id}')"><svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                  <button class="icon-btn" onclick="deleteKlas('${k.id}')" style="color:var(--red)"><svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                </div>`:''}
              </div>
              <div style="margin-bottom:10px">
                <span class="badge badge-green">${escHtml(vak?.naam||'—')}</span>
                <span style="font-size:11px;color:var(--ink-3);margin-left:6px">${escHtml(k.schooljaar||'')}</span>
              </div>
              <div class="klas-progress"><div class="klas-progress-fill" style="width:${progress}%"></div></div>
              <div class="klas-progress-label"><span>${opd.length} opdrachten</span><span>${progress}%</span></div>
              <button class="btn btn-sm" style="margin-top:12px;width:100%" onclick="window._selectedKlas='${k.id}';showView('jaarplanning')">Planning openen →</button>
            </div>`;
          }).join('')}
        </div>`
      }
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openKlasModal(id = null) {
  const [vakken, gebruikers, schooljaren] = await Promise.all([API.getVakken(), API.getGebruikers(), API.getSchooljaren()]);
  const k = id ? (await API.getKlassen()).find(x=>x.id===id) : null;
  const docenten = gebruikers.filter(u=>u.rol==='docent'||u.rol==='admin');
  const geselecteerdeDocenten = k?.docenten || (k?.docentId ? [k.docentId] : []);

  const weekOpties = [];
  for (let w = 35; w <= 52; w++) weekOpties.push(w);
  for (let w = 1; w <= 28; w++) weekOpties.push(w);

  openModal(`
    <h2>${k ? 'Klas bewerken' : 'Nieuwe klas aanmaken'}</h2>
    <p class="modal-sub">Vul de gegevens van de klas in.</p>

    <div class="form-grid">
      <div class="form-field"><label>Klasnaam *</label>
        <input id="klas-naam" placeholder="bijv. 3 HAVO A" value="${escHtml(k?.naam||'')}">
      </div>
      <div class="form-field"><label>Schooljaar *</label>
        <select id="klas-schooljaar">
          ${schooljaren.map(sj=>`<option value="${sj.naam}" ${k?.schooljaar===sj.naam?'selected':''}>${sj.naam}</option>`).join('')}
          ${!schooljaren.length?`<option value="2025-2026">2025-2026</option>`:''}
        </select>
      </div>
      <div class="form-field"><label>Leerjaar *</label>
        <select id="klas-leerjaar">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${(k?.leerjaar||3)==n?'selected':''}>Leerjaar ${n}</option>`).join('')}</select>
      </div>
      <div class="form-field"><label>Niveau *</label>
        <select id="klas-niveau">${['VMBO-B','VMBO-K','VMBO-GT','HAVO','VWO'].map(n=>`<option value="${n}" ${k?.niveau===n?'selected':''}>${n}</option>`).join('')}</select>
      </div>
      <div class="form-field"><label>Vak *</label>
        <select id="klas-vak">${vakken.map(v=>`<option value="${v.id}" ${k?.vakId===v.id?'selected':''}>${escHtml(v.naam)} — ${escHtml(v.volledig||'')}</option>`).join('')}</select>
      </div>
      <div class="form-field"><label>Uren per week</label>
        <select id="klas-uren">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${(k?.urenPerWeek||3)===n?'selected':''}>${n} uur per week</option>`).join('')}</select>
      </div>
    </div>

    <!-- ── Docenten ── -->
    <div style="margin-top:20px">
      <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px">
        Docenten
        <span style="font-weight:400;color:var(--ink-3)"> — selecteer alle betrokken docenten</span>
      </div>
      <div id="docenten-picker" style="display:flex;flex-direction:column;gap:2px;max-height:220px;overflow-y:auto;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:6px">
        ${docenten.length === 0
          ? `<div style="padding:12px;color:var(--ink-3);font-size:13px">Geen docenten beschikbaar</div>`
          : docenten.map(d => {
              const aan = geselecteerdeDocenten.includes(d.id);
              return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);cursor:pointer;background:${aan?'var(--accent-dim)':'transparent'};transition:background .1s" id="docent-label-${d.id}">
                <input type="checkbox" value="${d.id}" ${aan?'checked':''} onchange="updateDocentLabel('${d.id}',this.checked)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
                <span style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:monospace;flex-shrink:0">${escHtml(getInitialen(d))}</span>
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:500">${escHtml(d.naam)} ${escHtml(d.achternaam)}</div>
                  <div style="font-size:11px;color:var(--ink-3)">${escHtml(d.email)} · ${getRolLabel(d.rol)}</div>
                </div>
              </label>`;
            }).join('')
        }
      </div>
      <div id="docenten-selected-count" style="font-size:12px;color:var(--ink-3);margin-top:6px">
        ${geselecteerdeDocenten.length} docent${geselecteerdeDocenten.length!==1?'en':''} geselecteerd
      </div>
    </div>

    <!-- ── Roulatie ── -->
    <div style="margin-top:20px;padding:16px;background:var(--surface-2);border-radius:var(--radius);border:1.5px solid var(--border)">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="klas-roulatie" ${k?.roulatie?'checked':''} onchange="toggleRoulatieOpties()" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--ink)">Roulatieklas</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:1px">Deze klas heeft maar een deel van het jaar les — geef de actieve periode op</div>
        </div>
      </label>

      <div id="roulatie-opties" style="display:${k?.roulatie?'block':'none'};margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="form-grid">
          <div class="form-field">
            <label>Eerste lesweek</label>
            <select id="klas-roulatie-start" onchange="updateRoulatiePreview()">
              ${weekOpties.map(w=>`<option value="${w}" ${(k?.roulatieStart||35)===w?'selected':''}>Week ${w}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Laatste lesweek</label>
            <select id="klas-roulatie-eind" onchange="updateRoulatiePreview()">
              ${weekOpties.map(w=>`<option value="${w}" ${(k?.roulatieBlok||39)===w?'selected':''}>Week ${w}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="roulatie-preview" style="margin-top:8px;font-size:12px;color:var(--ink-3);padding:8px 10px;background:#fff;border-radius:var(--radius-sm);border:1px solid var(--border)"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveKlas('${id||''}')">Opslaan</button>
    </div>
  `);

  if (k?.roulatie) updateRoulatiePreview();
}

function updateDocentLabel(id, geselecteerd) {
  const label = document.getElementById(`docent-label-${id}`);
  if (label) label.style.background = geselecteerd ? 'var(--accent-dim)' : 'transparent';
  const checked = document.querySelectorAll('#docenten-picker input[type=checkbox]:checked');
  const count = checked.length;
  const el = document.getElementById('docenten-selected-count');
  if (el) el.textContent = `${count} docent${count!==1?'en':''} geselecteerd`;
}

function toggleRoulatieOpties() {
  const aan = document.getElementById('klas-roulatie')?.checked;
  const opties = document.getElementById('roulatie-opties');
  if (opties) opties.style.display = aan ? 'block' : 'none';
  if (aan) updateRoulatiePreview();
}

function updateRoulatiePreview() {
  const start = parseInt(document.getElementById('klas-roulatie-start')?.value || 35);
  const eind = parseInt(document.getElementById('klas-roulatie-eind')?.value || 39);
  const preview = document.getElementById('roulatie-preview');
  if (!preview) return;

  const schoolWeken = [...Array.from({length:18},(_,i)=>i+35), ...Array.from({length:28},(_,i)=>i+1)];
  const startIdx = schoolWeken.indexOf(start);
  const eindIdx = schoolWeken.indexOf(eind);

  if (startIdx === -1 || eindIdx === -1 || eindIdx < startIdx) {
    preview.innerHTML = `<span style="color:var(--red)">⚠ Eindweek moet na startweek liggen</span>`;
    return;
  }

  const aantalWeken = eindIdx - startIdx + 1;
  preview.innerHTML = `<span style="color:var(--accent-text);font-weight:500">✓ Actief van week ${start} t/m week ${eind}</span> &nbsp;·&nbsp; ${aantalWeken} lesweken`;
}

async function saveKlas(id) {
  const naam = document.getElementById('klas-naam').value.trim();
  const schooljaar = document.getElementById('klas-schooljaar').value;
  const vakId = document.getElementById('klas-vak').value;
  if (!naam || !schooljaar || !vakId) { alert('Vul alle verplichte velden in.'); return; }

  const checkboxes = document.querySelectorAll('#docenten-picker input[type=checkbox]:checked');
  const docenten = Array.from(checkboxes).map(cb => cb.value);
  const roulatie = document.getElementById('klas-roulatie')?.checked || false;

  const data = {
    naam, schooljaar,
    leerjaar: parseInt(document.getElementById('klas-leerjaar').value),
    niveau: document.getElementById('klas-niveau').value,
    vakId,
    docentId: docenten[0] || null,
    urenPerWeek: parseInt(document.getElementById('klas-uren').value),
    docenten,
    roulatie,
    roulatieStart: roulatie ? parseInt(document.getElementById('klas-roulatie-start').value) : null,
    roulatieBlok: roulatie ? parseInt(document.getElementById('klas-roulatie-eind').value) : null,
  };

  try {
    if (id) { await API.updateKlas(id, data); } else { await API.addKlas(data); }
    Cache.invalidate('klassen');
    closeModalDirect();
    renderKlassen();
  } catch(e) { showError(e.message); }
}

async function deleteKlas(id) {
  if (!confirm('Klas verwijderen? Dit verwijdert ook alle gekoppelde opdrachten.')) return;
  try { await API.deleteKlas(id); Cache.invalidateAll(); renderKlassen(); }
  catch(e) { showError(e.message); }
}
