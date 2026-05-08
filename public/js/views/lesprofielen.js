// ============================================================
// lesprofielen.js — Lesprofielen beheer + koppelen aan planning
// NIEUW: Lesbrief knop toegevoegd per activiteit
// ============================================================

const syllabusWizardState = {
  uploadToken: '',
  modules: []
};

function lpNormalizeNiveau(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  if (['BB', 'B', 'VMBOB', 'VMBOb'.toUpperCase(), 'BASIS', 'BASISBEROEPS'].includes(raw)) return 'BB';
  if (['KB', 'K', 'VMBOK', 'KADER', 'KADERBEROEPS'].includes(raw)) return 'KB';
  if (['GL', 'GT', 'TL', 'VMBOGT', 'VMBOGL', 'VMBOTL', 'GEMENGD', 'THEORETISCH'].includes(raw)) return 'GL';
  if (raw.includes('HAVO')) return 'HAVO';
  if (raw.includes('VWO')) return 'VWO';
  return raw;
}

function lpVakCode(vak) {
  const raw = String(vak?.naam || vak?.code || vak?.volledig || 'PIE').trim().toUpperCase();
  const match = raw.match(/[A-Z]{2,5}/);
  return match ? match[0] : 'PIE';
}

function lpFormatSyllabusCode(value, vak) {
  if (!value) return '';
  const code = lpVakCode(vak);
  return String(value)
    .replace(/P\/\[A-Z\]\+\//gi, `P/${code}/`)
    .replace(/P\/[A-Z]{2,5}\//gi, `P/${code}/`);
}

function lpKlasPastBijProfiel(klas, profiel) {
  if (!klas || !profiel) return false;
  if (String(klas.vakId || '') !== String(profiel.vakId || '')) return false;
  const profielNiveau = lpNormalizeNiveau(profiel.niveau);
  if (!profielNiveau) return true;
  return lpNormalizeNiveau(klas.niveau) === profielNiveau;
}

// ============================================================
// Nieuwe lesprofiel-wizard
// Start altijd leeg en slaat pas op na bevestiging.
// ============================================================
let lesprofielWizardState = null;

function resetLesprofielWizard() {
  lesprofielWizardState = {
    step: 1,
    preview: null,
    warning: '',
    upload: null,
    data: {
      naam: '', vakId: '', niveau: '', aantalWeken: 8, verhouding: '1:1', beschrijving: '',
      syllabusUploadToken: '', syllabusBestand: '', syllabusModules: [], syllabusModuleCode: '', syllabusPreview: '',
      aiWeekthemas: true, aiActiviteiten: true, aiBronnen: false, aiDifferentiatie: false, aiOpmerkingen: false,
      lesModuleId: '', feedback: ''
    }
  };
}

async function openLesprofielWizard(vakId = null) { resetLesprofielWizard(); if (vakId) lesprofielWizardState.data.vakId = vakId; await renderLesprofielWizard(); }
function closeLesprofielWizard() { resetLesprofielWizard(); closeModalDirect(); }

function leesLesprofielWizardStap1() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  lesprofielWizardState.data.lesModuleId = document.getElementById('lpw-lesmodule')?.value || '';
  const startOpmerkingen = document.getElementById('lpw-ai-opmerkingen-start');
  if (startOpmerkingen) lesprofielWizardState.data.aiOpmerkingen = !!startOpmerkingen.checked;
}

function leesLesprofielWizardStap2() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  const d = lesprofielWizardState.data;
  d.naam = document.getElementById('lpw-naam')?.value?.trim() || '';
  d.vakId = document.getElementById('lpw-vak')?.value || '';
  d.niveau = document.getElementById('lpw-niveau')?.value || '';
  d.aantalWeken = Number(document.getElementById('lpw-weken')?.value || 0);
  d.verhouding = document.getElementById('lpw-verhouding')?.value || '1:1';
  d.beschrijving = document.getElementById('lpw-beschrijving')?.value?.trim() || '';
  d.syllabusModuleCode = document.getElementById('lpw-syllabus-module')?.value || d.syllabusModuleCode || '';
}

function leesLesprofielWizardStap3() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  const d = lesprofielWizardState.data;
  d.aiWeekthemas = !!document.getElementById('lpw-ai-weekthemas')?.checked;
  d.aiActiviteiten = !!document.getElementById('lpw-ai-activiteiten')?.checked;
  d.aiBronnen = !!document.getElementById('lpw-ai-bronnen')?.checked;
  d.aiDifferentiatie = !!document.getElementById('lpw-ai-differentiatie')?.checked;
  d.aiOpmerkingen = !!document.getElementById('lpw-ai-opmerkingen')?.checked;
}

async function renderLesprofielWizard() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  const [vakken, alleModules] = await Promise.all([API.getVakken(), API.getLesModules()]);
  const d = lesprofielWizardState.data;
  const step = lesprofielWizardState.step;
  const progress = Math.round((step / 4) * 100);

  // Filter modules op vak (als vakId al bekend is)
  const modules = d.vakId
    ? alleModules.filter(m => String(m.vakId) === String(d.vakId))
    : alleModules;

  const geselecteerdeModule = modules.find(m => String(m.id) === String(d.lesModuleId));

  const moduleSelectorHtml = modules.length
    ? `<select id="lpw-lesmodule" onchange="lesprofielWizardState.data.lesModuleId=this.value;renderLesprofielWizard()" style="width:100%">
        <option value="">— Geen les module koppelen —</option>
        ${modules.map(m => {
          const stappen = m.stappen || [];
          const isLegacy = stappen.length > 0 && typeof stappen[0] === 'string';
          const stapLabel = isLegacy ? stappen.length + ' stappen' : stappen.length + ' hoofdstappen';
          const label = (m.niveau ? m.niveau + ' · ' : '') + escHtml(m.naam) + ' (' + stapLabel + ')';
          return '<option value="' + m.id + '" ' + (String(d.lesModuleId) === String(m.id) ? 'selected' : '') + '>' + label + '</option>';
        }).join('')}
      </select>`
    : `<div style="color:var(--ink-muted);font-size:13px;padding:10px 0">Nog geen les modules aangemaakt. Ga naar <strong>Les Modules</strong> in het admin-menu om modules toe te voegen.</div>`;

  const _modStappen = geselecteerdeModule?.stappen || [];
  const _modLegacy = _modStappen.length > 0 && typeof _modStappen[0] === 'string';
  const _modStappenLijst = _modLegacy
    ? _modStappen.map(s => '<li>' + escHtml(s) + '</li>').join('')
    : _modStappen.map(s => `<li><strong>${escHtml(s.naam)}</strong>${s.lessen?.length ? ': ' + s.lessen.map(l => escHtml(l)).join(', ') : ''}</li>`).join('');
  const gekoppeldeStappenHtml = geselecteerdeModule && _modStappen.length
    ? `<div style="margin-top:12px;background:#f0fdf4;border:1px solid var(--accent);border-radius:8px;padding:10px 14px">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;color:var(--accent)">${_modStappen.length} ${_modLegacy ? 'theoriestappen' : 'hoofdstappen'} uit deze module:</div>
        <ol style="margin:0;padding-left:18px;font-size:13px;color:var(--ink)">${_modStappenLijst}</ol>
      </div>` : '';

  const stap1 = `
    <div class="alert alert-info" style="margin-bottom:16px"><strong>Optioneel:</strong> koppel een les module om de theoriestappen mee te nemen in de AI-generatie. Je kunt dit ook overslaan en zelf een onderwerp invullen.</div>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Les module koppelen</label>
        ${moduleSelectorHtml}
        <small style="color:var(--ink-muted)">Alleen modules${d.vakId ? ' van het gekozen vak' : ''} worden getoond.</small>
      </div>
      ${gekoppeldeStappenHtml}

      <div class="form-field form-full">
        <label>Syllabus uploaden (PDF of Word) <span style="font-weight:400;color:var(--ink-muted)">— alternatief voor les module</span></label>
        <input id="lpw-syllabus-upload" type="file" accept="application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange="analyseerLesprofielWizardUpload(this)">
        <small style="color:var(--ink-muted)">${d.syllabusBestand ? 'Geanalyseerd: ' + escHtml(d.syllabusBestand) : 'Ondersteund: .pdf en .docx'}</small>
      </div>
      <div id="lpw-syllabus-status" class="form-field form-full" style="${d.syllabusBestand || d.syllabusModules?.length ? '' : 'display:none'}">
        ${d.syllabusModules?.length ? '<div class="alert alert-success">' + d.syllabusModules.length + ' profielmodules gevonden. Kies in de volgende stap welke module je wilt gebruiken.</div>' : ''}
      </div>

      <label class="form-field form-full" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">
        <input id="lpw-ai-opmerkingen-start" type="checkbox" ${d.aiOpmerkingen ? 'checked' : ''} onchange="lesprofielWizardState.data.aiOpmerkingen=this.checked" style="width:auto;margin-top:3px">
        <span><strong>AI opmerkingen/aandachtspunten laten toevoegen</strong><br><small style="color:var(--ink-muted)">AI verwerkt korte docentopmerkingen, zoals voorbereiding, veiligheid, benodigdheden of aandachtspunten.</small></span>
      </label>
    </div>`;

  const stap2 = `
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam lesprofiel *</label><input id="lpw-naam" value="${escHtml(d.naam)}" placeholder="bijv. Elektronisch dobbelspel havo 2"></div>
      <div class="form-field"><label>Vak *</label><select id="lpw-vak"><option value="">Kies vak</option>${vakken.map(v => `<option value="${v.id}" ${String(d.vakId) === String(v.id) ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Niveau</label><select id="lpw-niveau">${['', 'BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => `<option value="${n}" ${d.niveau === n ? 'selected' : ''}>${n || 'Alle niveaus'}</option>`).join('')}</select></div>
      <div class="form-field"><label>Aantal weken *</label><input id="lpw-weken" type="number" min="1" max="40" value="${escHtml(d.aantalWeken)}"></div>
      <div class="form-field"><label>Verhouding theorie:praktijk *</label>
        <select id="lpw-verhouding">
          ${[['1:1','1:1 — gelijk'],['1:2','1:2 — meer praktijk'],['1:3','1:3'],['1:4','1:4 — overwegend praktijk'],['2:3','2:3'],['3:2','3:2 — meer theorie'],['1:0','Alleen theorie'],['0:1','Alleen praktijk']].map(([v,l]) => `<option value="${v}" ${(d.verhouding||'1:1')===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      ${d.syllabusModules?.length ? `<div class="form-field form-full"><label>Module uit syllabus</label><select id="lpw-syllabus-module"><option value="">Gebruik hele syllabus / geen specifieke module</option>${d.syllabusModules.map(m => `<option value="${escHtml(m.code)}" ${d.syllabusModuleCode === m.code ? 'selected' : ''}>Module ${escHtml(m.code)} ${escHtml(m.naam || '')} (${escHtml(m.taskCount || 0)} onderdelen)</option>`).join('')}</select></div>` : ''}
      <div class="form-field form-full">
        <label>Beschrijving / onderwerp *</label>
        <textarea id="lpw-beschrijving" rows="5" placeholder="Beschrijf kort wat leerlingen moeten leren en maken.">${escHtml(d.beschrijving)}</textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-sm" onclick="genereerLesprofielBeschrijvingAI()">✨ AI beschrijving maken</button>
          <small id="lpw-beschrijving-ai-status" style="color:var(--ink-muted)">Vul bij voorkeur eerst naam, vak en niveau in.</small>
        </div>
      </div>
    </div>`;

  const aiOptiesData = [
    ["lpw-ai-weekthemas",    "aiWeekthemas",    "Weekthema’s",                    "AI maakt per week een duidelijke titel of thema. Dit is de basis."],
    ["lpw-ai-activiteiten",  "aiActiviteiten",  "Activiteiten per week",          "AI vult theorie, praktijk, toetsmomenten en presentaties per week in."],
    ["lpw-ai-bronnen",       "aiBronnen",       "Bronnen en materialen",          "AI noemt suggesties voor bronnen, werkbladen, video’s of practicum-materiaal."],
    ["lpw-ai-differentiatie","aiDifferentiatie","Differentiatie",                 "AI voegt steun en verdieping toe voor verschillende niveaus."],
    ["lpw-ai-opmerkingen",   "aiOpmerkingen",   "Opmerkingen en aandachtspunten", "AI verwerkt docentopmerkingen zoals voorbereiding, veiligheid of benodigdheden."]
  ];
  const aiOptiesHtml = aiOptiesData.map(function(item) {
    var id = item[0], key = item[1], title = item[2], sub = item[3];
    var selected = d[key];
    var border = selected ? "var(--accent)" : "var(--border)";
    var bg = selected ? "#f0fdf4" : "#fff";
    var checked = selected ? "checked" : "";
    return "<label style=\"display:flex;gap:12px;align-items:flex-start;cursor:pointer;border:2px solid " + border + ";border-radius:10px;padding:12px 14px;background:" + bg + ";transition:border-color .15s,background .15s\">"
      + "<input id=\"" + id + "\" type=\"checkbox\" " + checked + " style=\"width:18px;height:18px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:var(--accent)\" "
      + "onchange=\"var l=this.closest(‘label’);l.style.borderColor=this.checked?’var(--accent)’:’var(--border)’;l.style.background=this.checked?’#f0fdf4’:’#fff’\">"
      + "<span><strong style=\"font-size:14px\">" + escHtml(title) + "</strong><br>"
      + "<small style=\"color:var(--ink-muted);font-size:12px\">" + escHtml(sub) + "</small></span>"
      + "</label>";
  }).join("");

  const stap3 = "<p style=\"font-size:14px;color:var(--ink-muted);margin:0 0 14px\">Vink aan wat de AI moet genereren. <strong>Je kunt meerdere opties tegelijk aanvinken.</strong> Elke optie voegt iets toe aan het lesprofiel.</p>"
    + "<div style=\"display:flex;flex-direction:column;gap:8px\">" + aiOptiesHtml + "</div>";

  const preview = lesprofielWizardState.preview;
  const stap4 = preview ? `
    ${lesprofielWizardState.warning ? `<div class="alert" style="background:var(--amber-light);color:var(--amber);margin-bottom:12px">${escHtml(lesprofielWizardState.warning)}</div>` : ''}
    <div class="alert alert-success" style="margin-bottom:16px">Voorbeeld is gemaakt. Kies <strong>Opslaan</strong> om het lesprofiel echt aan te maken.</div>
    <div class="card" style="margin-bottom:12px;padding:16px"><h3 style="margin-top:0">${escHtml(preview.naam)}</h3><div style="font-size:13px;color:var(--ink-muted);margin-bottom:8px">${escHtml(preview.niveau || 'Alle niveaus')} · ${preview.aantalWeken} weken · ${preview.urenPerWeek} uur/week</div><div style="font-size:13px">${escHtml(preview.beschrijving || '')}</div></div>
    <div style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:12px;background:#fff;margin-bottom:16px">
      ${(preview.weken || []).map((w, i) => `<div style="padding:12px 14px;border-bottom:1px solid var(--border)"><strong>Week ${i + 1}: ${escHtml(w.thema || '')}</strong><ul style="margin:8px 0 0 18px;padding:0;font-size:13px">${(w.activiteiten || []).map(a => `<li><strong>${escHtml(a.type || 'Activiteit')}</strong> · ${escHtml(a.uren || '')} uur · ${escHtml(a.omschrijving || '')}${a.syllabus ? ` <span style="color:var(--ink-muted)">(${escHtml(a.syllabus)})</span>` : ''}</li>`).join('')}</ul></div>`).join('')}
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:#fafafa">
      <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Niet tevreden? Geef een opmerking en genereer opnieuw</label>
      <textarea id="lpw-feedback" rows="3" style="width:100%;resize:vertical;font-size:13px" placeholder="Bijv: maak week 3 meer praktijkgericht, voeg een toetsweek toe aan het einde, gebruik minder theorie-uren...">${escHtml(d.feedback || '')}</textarea>
      <button class="btn btn-sm" style="margin-top:8px" onclick="hergeneerLesprofielWizard()">↻ Opnieuw genereren met opmerking</button>
    </div>` : `<div class="alert alert-info">Klik op <strong>Voorbeeld genereren</strong>. Er wordt nog niets opgeslagen.</div>`;

  const body = step === 1 ? stap1 : step === 2 ? stap2 : step === 3 ? stap3 : stap4;
  const backBtn = step > 1 ? '<button class="btn" onclick="vorigeLesprofielWizardStap()">Terug</button>' : '';
  const nextBtn = step < 3 ? '<button class="btn btn-primary" onclick="volgendeLesprofielWizardStap()">Volgende</button>' : '';
  const generateBtn = step === 3 ? '<button class="btn btn-primary" onclick="genereerLesprofielWizardPreview()">Voorbeeld genereren</button>' : '';
  const saveBtn = step === 4 && preview ? '<button class="btn btn-primary" onclick="slaLesprofielWizardOp()">Opslaan</button>' : '';
  const closeText = step === 4 && preview ? 'Afsluiten zonder opslaan' : 'Sluiten';

  openModal(`<h2>Nieuw lesprofiel maken</h2><p class="modal-sub">Wizard voor een nieuw lesprofiel. De wizard start altijd leeg en slaat pas op na jouw keuze.</p><div style="height:8px;background:#E7E1D7;border-radius:999px;margin-bottom:18px;overflow:hidden"><div style="height:100%;width:${progress}%;background:var(--accent);border-radius:999px"></div></div><div style="font-size:12px;color:var(--ink-muted);margin-bottom:12px">Stap ${step} van 4</div>${body}<div class="modal-actions"><button class="btn" onclick="closeLesprofielWizard()">${closeText}</button>${backBtn}${nextBtn}${generateBtn}${saveBtn}</div>`);
}

async function genereerLesprofielBeschrijvingAI() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  leesLesprofielWizardStap2();
  const d = lesprofielWizardState.data;
  const status = document.getElementById('lpw-beschrijving-ai-status');
  const textarea = document.getElementById('lpw-beschrijving');
  const vakSelect = document.getElementById('lpw-vak');
  const vakNaam = vakSelect?.selectedOptions?.[0]?.textContent?.trim() || '';

  if (!d.naam && !d.niveau && !vakNaam) {
    if (status) status.textContent = 'Vul eerst minimaal naam, vak of niveau in.';
    return;
  }

  if (status) status.textContent = '⏳ AI maakt beschrijving...';

  const ctx = {
    naam: d.naam,
    vak: vakNaam,
    niveau: d.niveau,
    aantalWeken: d.aantalWeken,
    verhouding: d.verhouding,
    huidigeBeschrijving: d.beschrijving,
    syllabusModuleCode: d.syllabusModuleCode,
    syllabusPreview: d.syllabusPreview ? String(d.syllabusPreview).slice(0, 2500) : ''
  };

  try {
    const res = await fetch('/api/ai/wizard-stap', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lesprofiel-beschrijving',
        stapId: 'beschrijving-onderwerp',
        systeemPrompt: 'Je helpt een docent met het formuleren van een korte, concrete beschrijving voor een lesprofiel. Geef alleen geldig JSON terug met: beschrijving. Maximaal 5 zinnen. Praktisch, helder en geschikt voor voortgezet onderwijs.',
        userPrompt: `Maak of verbeter de beschrijving/het onderwerp voor dit lesprofiel. Geef alleen JSON terug.\n\n${JSON.stringify(ctx, null, 2)}`,
        context: ctx
      })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    const sug = json.suggestie || {};
    const beschrijving = String(sug.beschrijving || sug.tekst || sug.omschrijving || '').trim();
    if (!beschrijving) throw new Error('AI gaf geen beschrijving terug.');
    if (textarea) textarea.value = beschrijving;
    d.beschrijving = beschrijving;
    if (status) status.textContent = '✓ AI-beschrijving ingevuld';
  } catch (e) {
    if (status) status.textContent = 'AI kon geen beschrijving maken.';
    console.warn('AI beschrijving lesprofiel fout:', e.message);
  }
}

async function analyseerLesprofielWizardUpload(input) {
  if (!lesprofielWizardState) resetLesprofielWizard();
  const d = lesprofielWizardState.data;
  const status = document.getElementById('lpw-syllabus-status');
  const file = input?.files?.[0];
  if (!file) return;
  d.syllabusUploadToken = '';
  d.syllabusBestand = '';
  d.syllabusModules = [];
  d.syllabusModuleCode = '';
  d.syllabusPreview = '';
  if (status) {
    status.style.display = 'block';
    status.innerHTML = '<div class="alert alert-info">Syllabus wordt geanalyseerd...</div>';
  }
  try {
    const data = await API.analyseSyllabus(file);
    d.syllabusUploadToken = data.uploadToken || '';
    d.syllabusBestand = data.bestand || file.name || '';
    d.syllabusModules = data.modules || [];
    d.syllabusPreview = data.preview || '';
    if (status) status.innerHTML = `<div class="alert alert-success">${d.syllabusModules.length} profielmodules gevonden. Klik op Volgende om verder te gaan.</div>`;
  } catch (e) {
    if (status) status.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red);border:1px solid rgba(176,58,46,0.2)">${escHtml(e.message)}</div>`;
  }
}

async function analyseerLesprofielAfbeelding(input) {
  if (!lesprofielWizardState) resetLesprofielWizard();
  const file = input?.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById('lpw-afbeelding-status');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--ink-muted);font-size:13px">AI leest de afbeelding...</span>';
  try {
    const fd = new FormData();
    fd.append('bestand', file);
    const res = await fetch('/api/analyse-afbeelding-lesprofiel', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fout bij analyseren');
    lesprofielWizardState.data.afbeeldingStappen = data.stappen || [];
    await renderLesprofielWizard();
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);font-size:13px">Fout: ' + escHtml(e.message) + '</span>';
  }
}

async function volgendeLesprofielWizardStap() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  if (lesprofielWizardState.step === 1) {
    leesLesprofielWizardStap1();
    lesprofielWizardState.step = 2;
    await renderLesprofielWizard();
    return;
  }
  if (lesprofielWizardState.step === 2) {
    leesLesprofielWizardStap2();
    const d = lesprofielWizardState.data;
    if (!d.naam || !d.vakId || !d.beschrijving) { alert('Vul naam, vak en beschrijving in.'); return; }
    if (!d.aantalWeken || d.aantalWeken < 1 || d.aantalWeken > 40) { alert('Aantal weken moet tussen 1 en 40 zijn.'); return; }
    if (!d.urenPerWeek || d.urenPerWeek < 1) { alert('Uren per week is verplicht.'); return; }
    lesprofielWizardState.step = 3;
    await renderLesprofielWizard();
  }
}

async function vorigeLesprofielWizardStap() {
  if (!lesprofielWizardState) resetLesprofielWizard();
  if (lesprofielWizardState.step === 2) leesLesprofielWizardStap2();
  if (lesprofielWizardState.step === 3) leesLesprofielWizardStap3();
  lesprofielWizardState.step = Math.max(1, lesprofielWizardState.step - 1);
  await renderLesprofielWizard();
}

async function genereerLesprofielWizardPreview() {
  leesLesprofielWizardStap3();
  lesprofielWizardState.data.feedback = '';
  await _voerGeneratieUit();
}

async function hergeneerLesprofielWizard() {
  lesprofielWizardState.data.feedback = document.getElementById('lpw-feedback')?.value?.trim() || '';
  await _voerGeneratieUit();
}

async function _voerGeneratieUit() {
  const loadingId = 'lpw-loading';
  const acties = document.querySelector('.modal-actions');
  if (acties) acties.insertAdjacentHTML('beforebegin', `<div id="${loadingId}" class="alert alert-info" style="margin-top:12px">⏳ Lesprofiel wordt gegenereerd, even geduld...</div>`);
  try {
    const res = await API.genereerLesprofielWizard(lesprofielWizardState.data);
    lesprofielWizardState.preview = res.profiel;
    lesprofielWizardState.warning = res.warning || '';
    lesprofielWizardState.step = 4;
    await renderLesprofielWizard();
  } catch (e) {
    const el = document.getElementById(loadingId);
    if (el) el.outerHTML = `<div class="alert" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin-top:12px">
      <strong>Genereren mislukt:</strong> ${escHtml(e.message)}<br>
      <small style="opacity:.8">Controleer je internetverbinding of probeer het opnieuw. Je kunt ook teruggaan en de instellingen aanpassen.</small><br>
      <button class="btn btn-sm" style="margin-top:8px" onclick="hergeneerLesprofielWizard()">↻ Opnieuw proberen</button>
    </div>`;
  }
}

async function slaLesprofielWizardOp() {
  const p = lesprofielWizardState?.preview;
  if (!p) return;
  try {
    const r = await API.addLesprofiel({ naam: p.naam, vakId: p.vakId, niveau: p.niveau || '', aantalWeken: p.aantalWeken, verhouding: p.verhouding || '1:1', beschrijving: p.beschrijving || '', weken: p.weken || [] });
    Cache.invalidateAll();
    closeLesprofielWizard();
    await renderLesprofielen();
    openProfielDetail(r.id);
  } catch (e) { showError(e.message); }
}


function openSyllabusWizard() {
  syllabusWizardState.uploadToken = '';
  syllabusWizardState.modules = [];
  openModal(`
    <h2>Lesprofiel uit syllabus</h2>
    <p class="modal-sub">Upload een syllabus PDF, kies daarna de profielmodule, het niveau en de verdeling over weken.</p>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Syllabus PDF *</label>
        <input type="file" id="syllabus-pdf-input" accept="application/pdf">
      </div>
      <div class="form-field form-full">
        <button class="btn" onclick="analyseerSyllabusUpload()">PDF analyseren</button>
      </div>
      <div id="syllabus-analyse-result" class="form-field form-full" style="display:none"></div>
      <div class="form-field">
        <label>Module *</label>
        <select id="syllabus-module-select" disabled><option value="">Analyseer eerst de syllabus</option></select>
      </div>
      <div class="form-field">
        <label>Niveau *</label>
        <select id="syllabus-niveau-select">
          <option value="BB">vmbo-b / BB</option>
          <option value="KB">vmbo-k / KB</option>
          <option value="GL">vmbo-gl / GL</option>
        </select>
      </div>
      <div class="form-field">
        <label>Aantal weken *</label>
        <input id="syllabus-aantal-weken" type="number" min="1" value="7">
      </div>
      <div class="form-field">
        <label>Uur theorie per week *</label>
        <input id="syllabus-uren-theorie" type="number" min="1" value="2">
      </div>
      <div class="form-field">
        <label>Uur praktijk per week *</label>
        <input id="syllabus-uren-praktijk" type="number" min="1" value="4">
      </div>
      <div class="form-field">
        <label>Naam lesprofiel</label>
        <input id="syllabus-profiel-naam" placeholder="bijv. Installeren en monteren BB periode 1">
      </div>
      <div class="form-field form-full">
        <label>Vak *</label>
        <select id="syllabus-vak-select"></select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
      <button class="btn btn-primary" onclick="genereerLesprofielUitSyllabusWizard()">Genereer lesprofiel</button>
    </div>
  `);
  vulSyllabusVakSelect();
}

async function vulSyllabusVakSelect() {
  const vakken = await API.getVakken();
  const sel = document.getElementById('syllabus-vak-select');
  if (!sel) return;
  sel.innerHTML = vakken.map(v => `<option value="${v.id}">${escHtml(v.naam)}</option>`).join('');
}

async function analyseerSyllabusUpload() {
  const input = document.getElementById('syllabus-pdf-input');
  const result = document.getElementById('syllabus-analyse-result');
  const moduleSel = document.getElementById('syllabus-module-select');
  if (!input?.files?.[0]) { alert('Kies eerst een syllabus PDF.'); return; }
  result.style.display = 'block';
  result.innerHTML = `<div class="alert alert-info">Syllabus wordt geanalyseerd...</div>`;
  try {
    const data = await API.analyseSyllabus(input.files[0]);
    syllabusWizardState.uploadToken = data.uploadToken;
    syllabusWizardState.modules = data.modules || [];
    moduleSel.disabled = false;
    moduleSel.innerHTML = `<option value="">Kies een module</option>` + syllabusWizardState.modules.map(m => `<option value="${m.code}">Module ${m.code} ${escHtml(m.naam)} (${m.taskCount} onderdelen)</option>`).join('');
    result.innerHTML = `<div class="alert alert-success">${syllabusWizardState.modules.length} profielmodules gevonden. Kies nu de module, het niveau en de wekenverdeling.</div>`;
  } catch (e) {
    result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red);border:1px solid rgba(176,58,46,0.2)">${escHtml(e.message)}</div>`;
  }
}

async function genereerLesprofielUitSyllabusWizard() {
  const moduleCode = document.getElementById('syllabus-module-select')?.value;
  const niveau = document.getElementById('syllabus-niveau-select')?.value;
  const aantalWeken = Number(document.getElementById('syllabus-aantal-weken')?.value || 0);
  const urenTheorie = Number(document.getElementById('syllabus-uren-theorie')?.value || 0);
  const urenPraktijk = Number(document.getElementById('syllabus-uren-praktijk')?.value || 0);
  const naam = document.getElementById('syllabus-profiel-naam')?.value?.trim();
  const vakId = document.getElementById('syllabus-vak-select')?.value;

  if (!syllabusWizardState.uploadToken) { alert('Analyseer eerst de syllabus.'); return; }
  if (!moduleCode || !niveau || !aantalWeken || !urenTheorie || !urenPraktijk || !vakId) {
    alert('Vul alle velden in.');
    return;
  }

  try {
    const res = await API.genereerLesprofielUitSyllabus({
      uploadToken: syllabusWizardState.uploadToken,
      moduleCode, niveau, aantalWeken, urenTheorie, urenPraktijk, naam, vakId
    });
    Cache.invalidateAll();
    await renderLesprofielen();
    const verder = confirm(`Lesprofiel "${res.profiel.naam}" is aangemaakt. Nog een module maken?`);
    if (verder) { openSyllabusWizard(); } else { closeModalDirect(); }
  } catch (e) { alert(e.message); }
}

function openImportModal() {
  openModal(`
    <h2>Lesprofiel importeren</h2>
    <p class="modal-sub">Upload een ingevuld Word bestand (.docx) om automatisch een lesprofiel aan te maken.</p>
    <div class="alert alert-info" style="margin-bottom:16px">
      <strong>Stap 1:</strong> Download de template via "⬇ Template downloaden"<br>
      <strong>Stap 2:</strong> Laat ChatGPT of Claude hem invullen, of doe het zelf<br>
      <strong>Stap 3:</strong> Upload het ingevulde bestand hier
    </div>
    <div class="upload-zone" onclick="document.getElementById('import-input').click()" id="import-zone">
      <div class="upload-icon">↑</div>
      <div style="font-weight:500;margin-bottom:4px">Klik om een ingevuld .docx bestand te kiezen</div>
      <div style="font-size:12px">Alleen .docx bestanden</div>
    </div>
    <input type="file" id="import-input" accept=".docx" style="display:none" onchange="doImportLesprofiel(this)">
    <div id="import-result" style="margin-top:12px;font-size:13px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Sluiten</button>
    </div>
  `);
}

async function doImportLesprofiel(input) {
  const file = input.files[0];
  if (!file) return;
  const result = document.getElementById('import-result');
  const zone = document.getElementById('import-zone');
  zone.style.borderColor = 'var(--accent)';
  result.innerHTML = `<span style="color:var(--amber)">⏳ Bestand wordt verwerkt...</span>`;
  const formData = new FormData();
  formData.append('bestand', file);
  try {
    const res = await fetch('/api/import-lesprofiel', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      result.innerHTML = `<div class="alert alert-success">✓ ${escHtml(data.info)}</div>`;
      setTimeout(() => { closeModalDirect(); renderLesprofielen(); }, 1500);
    } else {
      result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red)">✗ ${escHtml(data.error)}</div>`;
    }
  } catch(e) {
    result.innerHTML = `<div class="alert" style="background:var(--red-light);color:var(--red)">✗ Upload mislukt: ${escHtml(e.message)}</div>`;
  }
}

async function renderLesprofielen() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesprofielen').innerHTML = `<div class="empty-state"><h3>Geen toegang</h3></div>`;
    return;
  }
  showLoading('lesprofielen');
  try {
    const [profielen, vakken] = await Promise.all([API.getLesprofielen(), API.getVakken()]);
    const perVak = {};
    profielen.forEach(p => { if (!perVak[p.vakId]) perVak[p.vakId] = []; perVak[p.vakId].push(p); });

    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1>Lesprofielen</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm btn-primary" onclick="openLesprofielWizard()">+ Nieuw lesprofiel</button>
        </div>
      </div>
      <div class="alert alert-info" style="margin-bottom:20px">
        Een lesprofiel is een blok van meerdere weken met activiteiten per week. Koppel het aan een startweek in de jaarplanning om het automatisch in te vullen.
      </div>
      ${profielen.length === 0
        ? `<div class="card"><div class="empty-state"><h3>Nog geen lesprofielen</h3><button class="btn btn-primary" onclick="openLesprofielWizard()">Eerste lesprofiel aanmaken</button></div></div>`
        : vakken.map(vak => {
            const vp = perVak[vak.id] || [];
            if (!vp.length) return '';
            return `<div class="card" style="margin-bottom:20px">
              <div class="card-header">
                <div><h2>${escHtml(vak.naam)} — ${escHtml(vak.volledig)}</h2><div class="card-meta">${vp.length} profiel${vp.length !== 1 ? 'en' : ''}</div></div>
                <button class="btn btn-sm btn-primary" onclick="openLesprofielWizard('${vak.id}')">+ Profiel voor ${escHtml(vak.naam)}</button>
              </div>
              ${(() => {
                const niveauVolgorde = ['BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'];
                const perNiveau = {};
                vp.forEach(p => {
                  const n = p.niveau || '__geen__';
                  if (!perNiveau[n]) perNiveau[n] = [];
                  perNiveau[n].push(p);
                });
                // Alle bekende niveaus eerst, daarna onbekende, dan lege
                const overige = Object.keys(perNiveau).filter(n => !niveauVolgorde.includes(n) && n !== '__geen__');
                const niveaus = [
                  ...niveauVolgorde.filter(n => perNiveau[n]),
                  ...overige,
                  ...(perNiveau['__geen__'] ? ['__geen__'] : [])
                ];
                return niveaus.map(niveau => {
                  const profielen = perNiveau[niveau];
                  const niveauLabel = niveau === '__geen__' ? 'Overig' : niveau;
                  const niveauKleur = { BB: 'var(--amber)', KB: 'var(--blue)', GL: 'var(--accent)', TL: '#9333EA', Havo: '#0891B2', VWO: '#DC2626' }[niveau] || 'var(--ink-3)';
                  return `
                    <div style="padding:12px 20px 0">
                      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${niveauKleur};background:${niveauKleur}18;padding:3px 10px;border-radius:20px">${niveauLabel}</span>
                        <span style="font-size:12px;color:var(--ink-3)">${profielen.length} profiel${profielen.length !== 1 ? 'en' : ''}</span>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px">
                        ${profielen.map(p => {
                          const aantalActs = (p.weken || []).reduce((t, w) => t + (w.activiteiten?.length || 0), 0);
                          return `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;cursor:pointer;transition:box-shadow .15s" onclick="openProfielDetail('${p.id}')" onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='none'">
                            <div style="margin-bottom:8px">
                              <div style="font-weight:600;font-size:14px">${escHtml(p.naam)}</div>
                            </div>
                            <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">${p.aantalWeken} weken · ${aantalActs} activiteiten · ${p.urenPerWeek} uur/week</div>
                            <div style="display:flex;gap:6px;flex-wrap:wrap">
                              ${(p.weken || []).slice(0, 4).map((w, i) => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--cream);border:1px solid var(--border);color:var(--ink-muted)">W${i+1}: ${(w.activiteiten || []).map(a => a.type[0]).join('+') || '—'}</span>`).join('')}
                              ${p.aantalWeken > 4 ? `<span style="font-size:10px;color:var(--ink-muted)">+${p.aantalWeken - 4}</span>` : ''}
                            </div>
                            <div style="display:flex;gap:6px;margin-top:12px">
                              <button class="btn btn-sm btn-primary" style="flex:1" onclick="event.stopPropagation();openKoppelModal('${p.id}')">Koppelen aan planning →</button>
                              <button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="event.stopPropagation();verwijderProfiel('${p.id}')" title="Lesprofiel verwijderen">🗑</button>
                            </div>
                          </div>`;
                        }).join('')}
                      </div>
                    </div>`;
                }).join('<div style="border-top:1px solid var(--border);margin:0 20px"></div>');
              })()}
            </div>`;
          }).join('')
      }
    `;
  } catch(e) { showError('Fout: ' + e.message); }
}

async function openProfielModal(vakId = null, profielId = null) {
  const [vakken, profielen] = await Promise.all([API.getVakken(), API.getLesprofielen()]);
  const p = profielId ? profielen.find(x => x.id === profielId) : null;
  openModal(`
    <h2>${profielId ? 'Lesprofiel bewerken' : 'Nieuw lesprofiel'}</h2>
    <div class="form-grid">
      <div class="form-field form-full"><label>Naam *</label><input id="profiel-naam" value="${escHtml(p?.naam || '')}" placeholder="bijv. Constructief Bouwkunde GL periode 1"></div>
      <div class="form-field"><label>Vak *</label><select id="profiel-vak">
        ${vakken.map(v => `<option value="${v.id}" ${(vakId === v.id || p?.vakId === v.id) ? 'selected' : ''}>${escHtml(v.naam)}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Niveau</label><select id="profiel-niveau">
        ${['', 'BB', 'KB', 'GL', 'TL', 'Havo', 'VWO'].map(n => `<option value="${n}" ${(p?.niveau || '') === n ? 'selected' : ''}>${n || 'Alle niveaus'}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Aantal weken *</label><input id="profiel-weken" type="number" min="1" max="40" value="${p?.aantalWeken || 8}"></div>
      <div class="form-field"><label>Uren per week *</label><input id="profiel-uren" type="number" min="1" value="${p?.urenPerWeek || 3}"></div>
      <div class="form-field form-full"><label>Beschrijving</label><input id="profiel-beschrijving" value="${escHtml(p?.beschrijving || '')}" placeholder="Korte omschrijving"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaProfielOp('${profielId || ''}')">Opslaan</button>
    </div>
  `);
}

async function slaProfielOp(profielId) {
  const naam = document.getElementById('profiel-naam').value.trim();
  const vakId = document.getElementById('profiel-vak').value;
  const niveau = document.getElementById('profiel-niveau').value;
  const aantalWeken = parseInt(document.getElementById('profiel-weken').value);
  const urenPerWeek = parseInt(document.getElementById('profiel-uren').value);
  const beschrijving = document.getElementById('profiel-beschrijving').value.trim();
  if (!naam) { alert('Naam is verplicht.'); return; }
  if (!aantalWeken || aantalWeken < 1 || aantalWeken > 40) { alert('Aantal weken moet tussen 1 en 40 zijn.'); return; }

  let weken;
  if (profielId) {
    const bestaand = (await API.getLesprofielen()).find(x => x.id === profielId);
    weken = Array.from({ length: aantalWeken }, (_, i) => bestaand?.weken?.[i] || { weekIndex: i + 1, thema: '', activiteiten: [] });
  } else {
    weken = Array.from({ length: aantalWeken }, (_, i) => ({ weekIndex: i + 1, thema: '', activiteiten: [] }));
  }

  try {
    let id = profielId;
    if (profielId) { await API.updateLesprofiel(profielId, { naam, vakId, niveau, aantalWeken, urenPerWeek, beschrijving, weken }); }
    else { const r = await API.addLesprofiel({ naam, vakId, niveau, aantalWeken, urenPerWeek, beschrijving, weken }); id = r.id; }
    closeModalDirect();
    openProfielDetail(id);
  } catch(e) { showError(e.message); }
}

async function openProfielDetail(profielId) {
  if (typeof closeSidebar === 'function') closeSidebar();
  document.getElementById('profiel-detail-overlay')?.remove();
  const [profielen, vakken, klassen, alleOpd] = await Promise.all([
    API.getLesprofielen(), API.getVakken(), API.getKlassen(), API.getOpdrachten()
  ]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  window._lpVakken = vakken;
  const vak = vakken.find(v => v.id === p.vakId);

  const gekoppeldeKlasIds = [...new Set(alleOpd.filter(o => o.profielId === profielId).map(o => o.klasId))];
  const gekoppeldeKlassen = gekoppeldeKlasIds.map(id => klassen.find(k => k.id === id)).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.id = 'profiel-detail-overlay';
  const isMobiel = window.innerWidth <= 768;
  overlay.style.cssText = `position:fixed;top:${isMobiel ? '56px' : '0'};left:${isMobiel ? '0' : 'var(--sidebar-w,256px)'};right:0;bottom:0;background:#F8F7F4;z-index:400;overflow-y:auto;padding:${isMobiel ? '16px' : '32px'}`;

  const gekoppeldHTML = gekoppeldeKlassen.length === 0
    ? `<div style="padding:16px 20px;font-size:13px;color:var(--ink-muted)">
         Dit profiel is nog niet aan een klas gekoppeld.
         <button class="btn btn-sm btn-primary" style="margin-left:12px" onclick="openKoppelModal('${p.id}')">Nu koppelen →</button>
       </div>`
    : `<div style="padding:8px 20px 16px">
         ${gekoppeldeKlassen.map(k => {
           const aantalOpd = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id).length;
           const afgevinkt = alleOpd.filter(o => o.profielId === profielId && o.klasId === k.id && o.afgevinkt).length;
           const pct = aantalOpd ? Math.round(afgevinkt / aantalOpd * 100) : 0;
           return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
             <div style="flex:1"><strong>${escHtml(k.naam)}</strong> <span style="font-size:12px;color:var(--ink-muted)">${k.schooljaar}</span></div>
             <div style="font-size:12px;color:var(--ink-muted)">${afgevinkt}/${aantalOpd} afgevinkt (${pct}%)</div>
             <button class="btn btn-sm" style="color:var(--red)" onclick="ontkoppelKlasVanProfiel('${profielId}','${k.id}','${escHtml(k.naam)}')">Ontkoppelen</button>
           </div>`;
         }).join('')}
         <button class="btn btn-sm btn-primary" style="margin-top:12px" onclick="openKoppelModal('${p.id}')">+ Koppelen aan andere klas</button>
       </div>`;

  overlay.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="document.getElementById('profiel-detail-overlay').remove();renderLesprofielen()">← Terug</button>
        <h1 style="margin:0;flex:1">${escHtml(p.naam)}</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="openProfielModal('${p.vakId}','${p.id}')">Bewerken</button>
          <button class="btn btn-sm" onclick="openKoppelModal('${p.id}')">Koppelen aan planning</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <h2>Gekoppelde klassen</h2>
            <div class="card-meta">${escHtml(vak?.naam || '')} · ${p.aantalWeken} weken · ${p.urenPerWeek} uur/week${p.niveau ? ' · ' + p.niveau : ''}</div>
          </div>
          <div style="font-size:12px;color:var(--ink-muted)">${gekoppeldeKlassen.length ? gekoppeldeKlassen.length + ' gekoppeld' : 'Nog niet gekoppeld'}</div>
        </div>
        ${gekoppeldHTML}
      </div>

      ${(p.weken || []).map((w, wi) => `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <h3 style="margin:0;font-size:15px">Week ${wi + 1}</h3>
              <div id="thema-display-${p.id}-${wi}" style="font-size:13px;color:var(--ink-muted);margin-top:2px;cursor:pointer" onclick="editProfielWeekThema('${p.id}',${wi},this)">${w.thema ? escHtml(w.thema) : '<span style="opacity:.5">+ Thema toevoegen</span>'}</div>
            </div>
            <button class="btn btn-sm" onclick="openActiviteitModal('${p.id}',${wi})">+ Activiteit</button>
          </div>
          <div id="activiteiten-week-${p.id}-${wi}">
            ${renderActiviteitenHTML(p, wi)}
          </div>
          ${(!w.activiteiten || !w.activiteiten.length) ? `<div style="padding:12px 20px;font-size:13px;color:var(--ink-muted)">Nog geen activiteiten. Klik op "+ Activiteit".</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(overlay);
}

async function ontkoppelKlasVanProfiel(profielId, klasId, klasNaam) {
  if (!confirm(`Lesprofiel ontkoppelen van "${klasNaam}"?\n\nAlle opdrachten die vanuit dit profiel zijn aangemaakt worden verwijderd.`)) return;
  try {
    const opdrachten = await API.getOpdrachten(klasId);
    const teVerwijderen = opdrachten.filter(o => o.profielId === profielId);
    for (const o of teVerwijderen) { await API.deleteOpdracht(o.id); }
    Cache.invalidateAll();
    document.getElementById('profiel-detail-overlay')?.remove();
    openProfielDetail(profielId);
  } catch(e) { showError(e.message); }
}

function editProfielWeekThema(profielId, weekIdx, el) {
  const huidig = el.textContent.trim().startsWith('+') ? '' : el.textContent.trim();
  const input = document.createElement('input');
  input.type = 'text'; input.value = huidig;
  input.style.cssText = 'padding:4px 8px;border:1.5px solid var(--accent);border-radius:6px;font-size:13px;font-family:inherit;min-width:200px;outline:none';
  el.replaceWith(input); input.focus(); input.select();
  async function opslaan() {
    const nieuw = input.value.trim();
    await updateProfielWeekThemaAsync(profielId, weekIdx, nieuw);
    const span = document.createElement('div');
    span.id = `thema-display-${profielId}-${weekIdx}`;
    span.style.cssText = 'font-size:13px;color:var(--ink-muted);margin-top:2px;cursor:pointer';
    span.onclick = function() { editProfielWeekThema(profielId, weekIdx, this); };
    span.innerHTML = nieuw ? escHtml(nieuw) : '<span style="opacity:.5">+ Thema toevoegen</span>';
    input.replaceWith(span);
  }
  input.addEventListener('blur', opslaan);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); opslaan(); } if (e.key === 'Escape') opslaan(); });
}

// ── Renderactiviteiten met Lesbrief knop ──────────────────────
function renderActiviteitenHTML(p, weekIdx) {
  const w = p.weken[weekIdx];
  if (!w?.activiteiten?.length) return '';
  const kleuren = { 'Theorie': 'badge-blue', 'Praktijk': 'badge-green', 'Toets': 'badge-amber', 'Presentatie': 'badge-gray', 'Overig': 'badge-gray' };
  // Sla activiteitsinfo op in globale map voor veilig gebruik in onclick
  if (!window._lpActInfo) window._lpActInfo = {};
  (w.activiteiten || []).forEach((a, ai) => {
    window._lpActInfo[`${p.id}_${weekIdx}_${ai}`] = {
      type: a.type || '',
      omschrijving: a.omschrijving || '',
      uren: a.uren || 1,
      syllabus: a.syllabus || '',
      profielNaam: p.naam || '',
      weekThema: (w.thema || ''),
      niveau: p.niveau || '',
      vak: (window._lpVakken || []).find(v => v.id === p.vakId)?.naam || '',
    };
  });
  return `<table class="data-table">
    <thead><tr><th>Type</th><th>Uren</th><th>Omschrijving</th><th>Syllabus</th><th>Link / bestand</th><th style="width:140px"></th></tr></thead>
    <tbody>
      ${w.activiteiten.map((a, ai) => `<tr>
        <td><span class="badge ${kleuren[a.type] || 'badge-gray'}">${escHtml(a.type)}</span></td>
        <td style="font-size:13px;font-weight:500">${a.uren} uur</td>
        <td style="font-size:13px">${escHtml(a.omschrijving || '—')}</td>
        <td style="font-size:12px;color:#78716C">${escHtml(a.syllabus || '—')}</td>
        <td>
          ${a.link ? `<a href="${escHtml(a.link)}" class="text-link" target="_blank">${escHtml(a.link.length > 35 ? a.link.slice(0, 35) + '…' : a.link)}</a>` : ''}
          ${a.bestand ? `<a href="/uploads/${encodeURIComponent(a.bestand)}" download="${escHtml(a.bestand)}" class="badge badge-amber" style="font-size:11px;text-decoration:none">📄 ${escHtml(a.bestand)}</a>` : ''}
          ${!a.link && !a.bestand ? '<span style="color:#A8A29E">—</span>' : ''}
        </td>
        <td>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" style="font-size:11px;padding:3px 7px;white-space:nowrap"
              onclick="openLesbrief('${p.id}',${weekIdx},${ai},_lpActInfo['${p.id}_${weekIdx}_${ai}'])">
              📋 Lesbrief
            </button>
            <button class="icon-btn" onclick="verwijderActiviteit('${p.id}',${weekIdx},${ai})" style="color:#DC2626" title="Verwijderen">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button class="icon-btn" onclick="bewerkActiviteit('${p.id}',${weekIdx},${ai})" title="Bewerken">
              <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function bewerkActiviteit(profielId, weekIdx, actIdx) {
  API.getLesprofielen().then(profielen => {
    const p = profielen.find(x => x.id === profielId);
    if (!p) return;
    const a = p.weken[weekIdx].activiteiten[actIdx];
    openModal(`
      <h2>Activiteit bewerken</h2>
      <div class="form-grid">
        <div class="form-field"><label>Type *</label><select id="act-type">
          ${['Theorie', 'Praktijk', 'Toets', 'Presentatie', 'Overig'].map(t => `<option value="${t}" ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select></div>
        <div class="form-field"><label>Uren *</label><select id="act-uren">
          ${[1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8].map(u => `<option value="${u}" ${a.uren == u ? 'selected' : ''}>${u} uur</option>`).join('')}
        </select></div>
        <div class="form-field form-full"><label>Omschrijving</label><textarea id="act-omschrijving" rows="3" style="resize:vertical">${escHtml(a.omschrijving || '')}</textarea></div>
        <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..." value="${escHtml(a.link || '')}"></div>
        <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1" value="${escHtml(a.syllabus || '')}"></div>
        <div class="form-field form-full"><label>Toets bestandsnaam</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf" value="${escHtml(a.bestand || '')}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModalDirect()">Annuleren</button>
        <button class="btn btn-primary" onclick="slaActiviteitBewerkingOp('${profielId}',${weekIdx},${actIdx})">Opslaan</button>
      </div>
    `);
  });
}

async function slaActiviteitBewerkingOp(profielId, weekIdx, actIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].activiteiten[actIdx] = { type, uren, omschrijving, link, syllabus, bestand: bestand || null };
  await API.updateLesprofiel(profielId, { weken: p.weken });
  closeModalDirect();
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container && bijgewerkt) container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
}

async function updateProfielWeekThemaAsync(profielId, weekIdx, thema) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].thema = thema;
  await API.updateLesprofiel(profielId, { weken: p.weken });
}

function openActiviteitModal(profielId, weekIdx) {
  openModal(`
    <h2>Activiteit toevoegen</h2>
    <div class="form-grid">
      <div class="form-field"><label>Type *</label><select id="act-type">
        <option>Theorie</option><option>Praktijk</option><option>Toets</option><option>Presentatie</option><option>Overig</option>
      </select></div>
      <div class="form-field"><label>Uren *</label><select id="act-uren">
        ${[0.5, 1, 1.5, 2, 2.5, 3, 4].map(u => `<option value="${u}" ${u === 1 ? 'selected' : ''}>${u} uur</option>`).join('')}
      </select></div>
      <div class="form-field form-full"><label>Omschrijving</label><textarea id="act-omschrijving" rows="3" style="resize:vertical" placeholder="bijv. Uitleg businessmodel canvas"></textarea></div>
      <div class="form-field form-full"><label>Link</label><input id="act-link" type="url" placeholder="https://..."></div>
      <div class="form-field form-full"><label>Syllabuscodes</label><input id="act-syllabus" placeholder="bijv. PIE-1.1"></div>
      <div class="form-field form-full"><label>Toets bestandsnaam</label><input id="act-bestand" placeholder="bijv. toets_p1.pdf"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaActiviteitOp('${profielId}',${weekIdx})">Toevoegen</button>
    </div>
  `);
}

async function slaActiviteitOp(profielId, weekIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  p.weken[weekIdx].activiteiten = p.weken[weekIdx].activiteiten || [];
  p.weken[weekIdx].activiteiten.push({ type, uren, omschrijving, link, syllabus, bestand: bestand || null });
  await API.updateLesprofiel(profielId, { weken: p.weken });
  closeModalDirect();
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  if (container && bijgewerkt) {
    container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
    const empty = container.nextElementSibling;
    if (empty && empty.textContent.includes('Nog geen')) empty.style.display = 'none';
  }
}

async function verwijderActiviteit(profielId, weekIdx, actIdx) {
  if (!confirm('Activiteit verwijderen?')) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  p.weken[weekIdx].activiteiten.splice(actIdx, 1);
  await API.updateLesprofiel(profielId, { weken: p.weken });
  const bijgewerkt = (await API.getLesprofielen()).find(x => x.id === profielId);
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container && bijgewerkt) container.innerHTML = renderActiviteitenHTML(bijgewerkt, weekIdx);
}

async function verwijderProfiel(id) {
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === id);
  if (!confirm(`Lesprofiel "${p?.naam}" verwijderen?`)) return;
  try { await API.deleteLesprofiel(id); renderLesprofielen(); }
  catch(e) { showError(e.message); }
}

async function openKoppelModal(profielId) {
  const [profielen, klassen, vakken] = await Promise.all([API.getLesprofielen(), API.getKlassen(), API.getVakken()]);
  const p = profielen.find(x => x.id === profielId);
  if (!p) return;
  const vak = vakken.find(v => v.id === p.vakId);
  const relevante = klassen.filter(k => lpKlasPastBijProfiel(k, p));
  const alleOpd = await API.getOpdrachten();
  const alGekoppeld = alleOpd.filter(o => o.profielId === profielId);
  const gekoppeldeKlassen = [...new Set(alGekoppeld.map(o => o.klasId))];
  const gekoppeldeKlasNamen = gekoppeldeKlassen.map(id => klassen.find(k => k.id === id)?.naam).filter(Boolean);

  const verhouding = p.verhouding || '1:1';
  openModal(`
    <h2>Profiel koppelen aan planning</h2>
    <p class="modal-sub">Koppel "<strong>${escHtml(p.naam)}</strong>" (${p.aantalWeken} weken) aan een startweek.</p>
    ${gekoppeldeKlasNamen.length > 0
      ? `<div class="alert alert-info" style="margin-bottom:16px">
           ⚠️ Dit profiel is al gekoppeld aan: <strong>${escHtml(gekoppeldeKlasNamen.join(', '))}</strong><br>
           <span style="font-size:12px">Bij opnieuw koppelen worden de oude opdrachten eerst verwijderd en opnieuw aangemaakt.</span>
         </div>` : ''}
    <div class="form-grid">
      <div class="form-field"><label>Klas *</label><select id="koppel-klas" onchange="laadKoppelWeken('${p.id}')">
        ${relevante.length === 0
          ? `<option value="">Geen klassen met vak ${escHtml(vak?.naam)}${p.niveau ? ' en niveau ' + escHtml(p.niveau) : ''}</option>`
          : relevante.map(k => `<option value="${k.id}">${escHtml(k.naam)} — ${escHtml(k.schooljaar)}</option>`).join('')}
      </select></div>
      <div class="form-field"><label>Startweek *</label><select id="koppel-startweek"><option value="">— Selecteer klas eerst —</option></select></div>
      <div class="form-field"><label>Uren per week *</label>
        <input id="koppel-uren" type="number" min="1" max="20" value="4" oninput="koppelBerekenUrenPreview('${escHtml(verhouding)}')">
      </div>
      <div class="form-field" style="align-self:flex-end;padding-bottom:2px">
        <div id="koppel-uren-preview" style="font-size:12px;color:var(--ink-muted)"></div>
        <div style="font-size:11px;color:var(--ink-muted);margin-top:2px">Verhouding: ${escHtml(verhouding)} theorie:praktijk</div>
      </div>
    </div>
    <label style="display:flex;gap:10px;align-items:center;margin-top:8px;cursor:pointer;font-size:13px">
      <input type="checkbox" id="koppel-split" onchange="koppelToggleSplit('${profielId}',${p.aantalWeken})">
      <span>Splitsen in twee periodes</span>
    </label>
    <div id="koppel-split-sectie" style="display:none;margin-top:10px">
      <div class="form-grid">
        <div class="form-field"><label>Split na week</label>
          <select id="koppel-splitpunt" onchange="laadKoppelWeken('${p.id}')">
            ${Array.from({length: p.aantalWeken - 1}, (_, i) => `<option value="${i+1}">Na week ${i+1} (periode 2 start bij week ${i+2})</option>`).join('')}
          </select>
        </div>
        <div class="form-field"><label>Startweek periode 2 *</label>
          <select id="koppel-startweek2"><option value="">— Selecteer klas + startweek 1 eerst —</option></select>
        </div>
      </div>
      <div id="koppel-preview2" style="margin-top:6px"></div>
    </div>
    <div id="koppel-preview" style="margin-top:12px"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="slaKoppelingOp('${profielId}')">Koppelen → planning invullen</button>
    </div>
  `);
  setTimeout(() => laadKoppelWeken(profielId), 100);
}

function koppelBerekenUrenPreview(verhouding) {
  const uren = Number(document.getElementById('koppel-uren')?.value || 0);
  const el = document.getElementById('koppel-uren-preview');
  if (!el || !uren) return;
  const [t, p] = (verhouding || '1:1').split(':').map(Number);
  if (t + p === 0) return;
  const uT = Math.round(uren * t / (t + p)) || (t > 0 ? uren : 0);
  const uP = uren - uT;
  el.textContent = `→ ${uT}u theorie + ${uP}u praktijk`;
}

function koppelToggleSplit(profielId, aantalWeken) {
  const sectie = document.getElementById('koppel-split-sectie');
  if (sectie) sectie.style.display = document.getElementById('koppel-split')?.checked ? 'block' : 'none';
  laadKoppelWeken(profielId);
}

async function laadKoppelWeken(profielId) {
  const klasId = document.getElementById('koppel-klas')?.value;
  if (!klasId) return;
  const klassen = await API.getKlassen();
  const klas = klassen.find(k => k.id === klasId);
  if (!klas) return;
  const weken = (await API.getWeken(klas.schooljaar)).filter(w => !w.isVakantie);
  const sel = document.getElementById('koppel-startweek');
  if (!sel) return;
  const profielen = await API.getLesprofielen();
  const p = profielen.find(x => x.id === profielId);
  const weekOpties = `<option value="">— Selecteer startweek —</option>` + weken.map(w => `<option value="${w.weeknummer}">Wk ${w.weeknummer} · ${w.van} – ${w.tot}${w.thema ? ' · ' + w.thema : ''}</option>`).join('');
  sel.innerHTML = weekOpties;

  const isSplit = document.getElementById('koppel-split')?.checked;
  const sel2 = document.getElementById('koppel-startweek2');
  if (sel2) sel2.innerHTML = weekOpties.replace('— Selecteer startweek —', '— Startweek periode 2 —');

  const updatePreview = () => {
    const sw = parseInt(sel.value);
    if (!sw || !p) return;
    const splitPunt = isSplit ? parseInt(document.getElementById('koppel-splitpunt')?.value || 0) : p.aantalWeken;
    const aantalP1 = isSplit ? splitPunt : p.aantalWeken;
    const schoolWekenP1 = weken.filter(w => Number(w.weeknummer) >= sw).slice(0, aantalP1);
    const preview1 = `Periode 1: week ${schoolWekenP1[0]?.weeknummer || sw} t/m ${schoolWekenP1[schoolWekenP1.length - 1]?.weeknummer || '?'} (${aantalP1} profielweken)`;
    document.getElementById('koppel-preview').innerHTML = `<div class="alert alert-success">${preview1}</div>`;

    if (isSplit && sel2) {
      const sw2 = parseInt(sel2.value);
      if (sw2) {
        const aantalP2 = p.aantalWeken - splitPunt;
        const schoolWekenP2 = weken.filter(w => Number(w.weeknummer) >= sw2).slice(0, aantalP2);
        document.getElementById('koppel-preview2').innerHTML = `<div class="alert alert-success">Periode 2: week ${schoolWekenP2[0]?.weeknummer || sw2} t/m ${schoolWekenP2[schoolWekenP2.length - 1]?.weeknummer || '?'} (${aantalP2} profielweken)</div>`;
      }
    }
  };

  sel.onchange = updatePreview;
  if (sel2) sel2.onchange = updatePreview;
  document.getElementById('koppel-splitpunt')?.addEventListener('change', updatePreview);
  koppelBerekenUrenPreview(p?.verhouding || '1:1');
}

async function slaKoppelingOp(profielId) {
  const klasId = document.getElementById('koppel-klas').value;
  const startweek = parseInt(document.getElementById('koppel-startweek').value);
  const urenPerWeek = Number(document.getElementById('koppel-uren')?.value || 4);
  if (!klasId || !startweek) { alert('Selecteer een klas en startweek.'); return; }

  const isSplit = document.getElementById('koppel-split')?.checked;
  const splitPunt = isSplit ? parseInt(document.getElementById('koppel-splitpunt')?.value || 0) : 0;
  const startweek2 = isSplit ? parseInt(document.getElementById('koppel-startweek2')?.value || 0) : 0;
  if (isSplit && (!splitPunt || !startweek2)) { alert('Selecteer splitpunt en startweek voor periode 2.'); return; }

  const [profielen, klassen, vakken] = await Promise.all([API.getLesprofielen(), API.getKlassen(), API.getVakken()]);
  const p = profielen.find(x => x.id === profielId);
  const klas = klassen.find(k => k.id === klasId);
  const vak = vakken.find(v => v.id === klas?.vakId) || null;

  // Bereken uren per activiteitstype op basis van verhouding
  const [tDeel, pDeel] = (p.verhouding || '1:1').split(':').map(Number);
  const totaalDelen = (tDeel || 0) + (pDeel || 0);
  const urenTheorie = totaalDelen > 0 ? (Math.round(urenPerWeek * (tDeel || 0) / totaalDelen) || (tDeel > 0 ? urenPerWeek : 0)) : urenPerWeek;
  const urenPraktijk = urenPerWeek - urenTheorie || (pDeel > 0 ? 1 : 0);

  const bestaandeOpd = await API.getOpdrachten(klasId);
  const teVerwijderen = bestaandeOpd.filter(o => o.profielId === profielId);
  for (const o of teVerwijderen) { await API.deleteOpdracht(o.id); }

  const alleWeken = (await API.getWeken(klas.schooljaar)).filter(w => !w.isVakantie);

  const maakOpdrachten = async (profielWekenRange, schoolStartWeek) => {
    const startIdx = alleWeken.findIndex(w => Number(w.weeknummer) === schoolStartWeek);
    const schoolWeken = alleWeken.slice(startIdx, startIdx + profielWekenRange.length);
    for (let i = 0; i < schoolWeken.length; i++) {
      const sw = schoolWeken[i];
      const pw = p.weken[profielWekenRange[i]];
      if (!pw) continue;
      for (const act of (pw.activiteiten || [])) {
        const urenAct = act.type === 'Praktijk' ? urenPraktijk : urenTheorie;
        await API.addOpdracht({
          naam: act.omschrijving || `${act.type} — ${p.naam}`,
          klasId,
          periode: getPeriodeVoorWeekLP(Number(sw.weeknummer)),
          weeknummer: Number(sw.weeknummer),
          weken: String(sw.weeknummer),
          schooljaar: klas.schooljaar,
          type: act.type,
          uren: urenAct,
          syllabuscodes: lpFormatSyllabusCode(act.syllabus || '', vak),
          werkboekLink: '',
          beschrijving: pw.thema
            ? `${pw.thema} — Uit lesprofiel: ${p.naam} (week ${profielWekenRange[i] + 1} van ${p.aantalWeken})`
            : `Uit lesprofiel: ${p.naam} (week ${profielWekenRange[i] + 1} van ${p.aantalWeken})`,
          theorieLink: act.link || '',
          toetsBestand: act.bestand || null,
          profielId: p.id,
        });
      }
    }
  };

  if (isSplit) {
    const indicesP1 = Array.from({length: splitPunt}, (_, i) => i);
    const indicesP2 = Array.from({length: p.aantalWeken - splitPunt}, (_, i) => splitPunt + i);
    await maakOpdrachten(indicesP1, startweek);
    await maakOpdrachten(indicesP2, startweek2);
  } else {
    const indices = Array.from({length: p.aantalWeken}, (_, i) => i);
    await maakOpdrachten(indices, startweek);
  }

  Cache.invalidateAll();
  closeModalDirect();
  document.getElementById('profiel-detail-overlay')?.remove();
  window._selectedKlas = klasId;
  showView('jaarplanning');
}

function getPeriodeVoorWeekLP(wn) {
  if (wn >= 35 && wn <= 43) return 1;
  if ((wn >= 44 && wn <= 52) || (wn >= 1 && wn <= 8)) return 2;
  if (wn >= 9 && wn <= 18) return 3;
  return 4;
}
