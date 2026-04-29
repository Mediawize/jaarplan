// ============================================================
// public/js/views/lesbrieven.js
// Lesbrief: één scrollbare weergave met secties
// ============================================================

const _lb = {
  id: null,
  profielId: null,
  weekIdx: null,
  actIdx: null,
  activiteitInfo: null,
  data: null,
  opgeslagen: true,
};

// ============================================================
// ENTRY POINT
// ============================================================
async function openLesbrief(profielId, weekIdx, actIdx, activiteitInfo) {
  _lb.profielId = profielId;
  _lb.weekIdx = weekIdx;
  _lb.actIdx = actIdx;
  _lb.activiteitInfo = activiteitInfo || {};
  _lb.opgeslagen = true;

  try {
    const res = await fetch(`/api/lesbrieven?profielId=${profielId}&weekIdx=${weekIdx}&actIdx=${actIdx}`, { credentials: 'same-origin' });
    const lijst = await res.json();
    if (lijst && lijst.length > 0) {
      _lb.data = lijst[0];
      _lb.id = lijst[0].id;
    } else {
      _lb.id = null;
      _lb.data = lbLeeg();
    }
  } catch {
    _lb.id = null;
    _lb.data = lbLeeg();
  }

  renderLb();
}

function lbLeeg() {
  return {
    voorbereiding: '',
    benodigdheden: [],
    lesverloop: [],
    stappenplan: [],
    aandachtspunten: [],
    differentiatie: { snel: '', langzaam: '' },
    opmerkingen: '',
  };
}

// ============================================================
// RENDER
// ============================================================
function renderLb() {
  const info = _lb.activiteitInfo || {};
  const ro = !Auth.canEdit();
  const d = _lb.data;

  const bens = d.benodigdheden && d.benodigdheden.length ? d.benodigdheden : [''];
  const fases = d.lesverloop && d.lesverloop.length ? d.lesverloop :
    [{ fase: 'Introductie', minuten: 10, beschrijving: '' },
     { fase: 'Instructie', minuten: 20, beschrijving: '' },
     { fase: 'Verwerking', minuten: 30, beschrijving: '' },
     { fase: 'Afsluiting', minuten: 5, beschrijving: '' }];
  const stappen = d.stappenplan && d.stappenplan.length ? d.stappenplan : [{ stap: 1, instructie: '' }];
  const punten = d.aandachtspunten && d.aandachtspunten.length ? d.aandachtspunten : [''];
  const diff = d.differentiatie || { snel: '', langzaam: '' };
  const totaal = fases.reduce((t, f) => t + (parseInt(f.minuten) || 0), 0);

  openModal(`
    <div style="margin:-4px -4px 0">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:2px solid var(--border);margin-bottom:18px">
        <div>
          <h2 style="margin:0 0 4px;font-size:18px">Lesbrief</h2>
          <div style="font-size:13px;color:var(--ink-muted)">
            ${info.type ? `<span style="background:var(--accent-dim);color:var(--accent);border-radius:4px;padding:1px 7px;font-size:12px;font-weight:600;margin-right:6px">${escHtml(info.type)}</span>` : ''}
            ${escHtml(info.omschrijving || info.naam || '')}
            ${info.uren ? `<span style="color:var(--ink-muted)"> · ${info.uren} uur</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${!ro ? `<button class="btn btn-sm" onclick="lbGenereerAI()" id="lb-ai-btn">✨ AI invullen</button>` : ''}
          ${_lb.id ? `<button class="btn btn-sm" onclick="lbDownload()" title="Download als Word-bestand">⬇ Download</button>` : ''}
          ${!ro ? `<button class="btn btn-sm btn-primary" onclick="lbOpslaan()" id="lb-opslaan-btn">Opslaan</button>` : ''}
          <button class="btn btn-sm" onclick="closeModalDirect()">Sluiten</button>
        </div>
      </div>

      <div id="lb-ai-status" style="font-size:13px;margin-bottom:10px"></div>

      <!-- Scrollbaar inhoud -->
      <div style="overflow-y:auto;max-height:62vh;padding-right:4px">

        <!-- 1. Voorbereiding -->
        <div class="lb-sectie">
          <div class="lb-sectie-kop" style="background:#EEF7FF;border-left-color:#3B82F6">
            <span style="color:#1D4ED8">📋 Voorbereiding</span>
          </div>
          <textarea id="lb-voorbereiding" rows="3" ${ro ? 'readonly' : ''}
            placeholder="Wat moet de docent regelen vóór de les?"
            class="lb-textarea">${escHtml(d.voorbereiding || '')}</textarea>

          <div style="margin-top:10px">
            <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Benodigdheden</div>
            <div id="lb-benodigdheden-lijst">
              ${bens.map((b, i) => `
                <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center">
                  <span style="font-size:12px;color:var(--ink-muted);min-width:18px;text-align:right">${i + 1}.</span>
                  <input id="lb-ben-${i}" value="${escHtml(b)}" ${ro ? 'readonly' : ''}
                    placeholder="Benodigdheid..." class="lb-input">
                  ${!ro ? `<button onclick="lbVerwijderBen(${i})" class="lb-del-btn">✕</button>` : ''}
                </div>`).join('')}
            </div>
            ${!ro ? `<button class="btn btn-sm" onclick="lbVoegBenToe()" style="margin-top:2px">+ Toevoegen</button>` : ''}
          </div>
        </div>

        <!-- 2. Lesverloop -->
        <div class="lb-sectie">
          <div class="lb-sectie-kop" style="background:#F0FDF4;border-left-color:#22C55E">
            <span style="color:#15803D">⏱ Lesverloop</span>
            <span style="margin-left:auto;font-size:12px;font-weight:400;color:var(--ink-muted)">
              ${totaal} min totaal
              ${info.uren ? ` · ${Math.round(info.uren * 60)} min beschikbaar` : ''}
            </span>
          </div>
          <div id="lb-lesverloop-lijst">
            ${fases.map((f, i) => `
              <div class="lb-fase-rij">
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
                  <input id="lb-lv-fase-${i}" value="${escHtml(f.fase || '')}" ${ro ? 'readonly' : ''}
                    placeholder="Fase" class="lb-input" style="flex:1;min-width:80px;font-weight:600">
                  <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                    <input id="lb-lv-min-${i}" type="number" min="1" max="240" value="${f.minuten || 10}" ${ro ? 'readonly' : ''}
                      class="lb-input" style="width:54px;text-align:center">
                    <span style="font-size:12px;color:var(--ink-muted)">min</span>
                  </div>
                  ${!ro ? `<button onclick="lbVerwijderFase(${i})" class="lb-del-btn">✕</button>` : ''}
                </div>
                <textarea id="lb-lv-beschr-${i}" rows="2" ${ro ? 'readonly' : ''}
                  placeholder="Wat doet de docent..."
                  class="lb-textarea" style="font-size:12px">${escHtml(f.beschrijving || '')}</textarea>
              </div>`).join('')}
          </div>
          ${!ro ? `<button class="btn btn-sm" onclick="lbVoegFaseToe()" style="margin-top:4px">+ Fase toevoegen</button>` : ''}
        </div>

        <!-- 3. Stappenplan -->
        <div class="lb-sectie">
          <div class="lb-sectie-kop" style="background:#FFF7ED;border-left-color:#F97316">
            <span style="color:#C2410C">📝 Stappenplan</span>
          </div>
          <div id="lb-stappenplan-lijst">
            ${stappen.map((s, i) => `
              <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">
                <div style="min-width:26px;height:26px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;flex-shrink:0">${i + 1}</div>
                <textarea id="lb-sp-${i}" rows="2" ${ro ? 'readonly' : ''}
                  placeholder="Instructie voor de docent..."
                  class="lb-textarea" style="flex:1">${escHtml(s.instructie || '')}</textarea>
                ${!ro ? `<button onclick="lbVerwijderStap(${i})" class="lb-del-btn" style="margin-top:2px">✕</button>` : ''}
              </div>`).join('')}
          </div>
          ${!ro ? `<button class="btn btn-sm" onclick="lbVoegStapToe()">+ Stap toevoegen</button>` : ''}
        </div>

        <!-- 4. Aandachtspunten -->
        <div class="lb-sectie">
          <div class="lb-sectie-kop" style="background:#FFF7ED;border-left-color:#F59E0B">
            <span style="color:#92400E">⚠ Aandachtspunten</span>
          </div>
          <div id="lb-aandacht-lijst">
            ${punten.map((p, i) => `
              <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
                <input id="lb-ap-${i}" value="${escHtml(p)}" ${ro ? 'readonly' : ''}
                  placeholder="Veiligheidstip, aandachtspunt..."
                  class="lb-input" style="flex:1">
                ${!ro ? `<button onclick="lbVerwijderAP(${i})" class="lb-del-btn">✕</button>` : ''}
              </div>`).join('')}
          </div>
          ${!ro ? `<button class="btn btn-sm" onclick="lbVoegAPToe()">+ Aandachtspunt toevoegen</button>` : ''}
        </div>

        <!-- 5. Differentiatie -->
        <div class="lb-sectie">
          <div class="lb-sectie-kop" style="background:#F5F3FF;border-left-color:#8B5CF6">
            <span style="color:#6D28D9">⭐ Differentiatie</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:12px;font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:5px">
                <span style="background:#DEF7EC;color:#065F46;border-radius:4px;padding:1px 6px;font-size:11px">Snel klaar</span>
              </div>
              <textarea id="lb-diff-snel" rows="3" ${ro ? 'readonly' : ''}
                placeholder="Verdiepingsopdracht, andere leerling helpen..."
                class="lb-textarea">${escHtml(diff.snel || '')}</textarea>
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:5px">
                <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:1px 6px;font-size:11px">Extra tijd</span>
              </div>
              <textarea id="lb-diff-langzaam" rows="3" ${ro ? 'readonly' : ''}
                placeholder="Minder opdrachten, extra uitleg..."
                class="lb-textarea">${escHtml(diff.langzaam || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- 6. Opmerkingen -->
        <div class="lb-sectie" style="margin-bottom:0">
          <div class="lb-sectie-kop" style="background:#F9FAFB;border-left-color:#9CA3AF">
            <span style="color:#374151">💬 Opmerkingen</span>
          </div>
          <textarea id="lb-opmerkingen" rows="3" ${ro ? 'readonly' : ''}
            placeholder="Vrije notities, ervaringen, aanpassingen voor volgende keer..."
            class="lb-textarea">${escHtml(d.opmerkingen || '')}</textarea>
        </div>

      </div><!-- /scroll -->

      <div id="lb-opslaan-status" style="font-size:13px;margin-top:8px;text-align:right"></div>
    </div>
  `);

  setTimeout(() => {
    const box = document.querySelector('#modal-overlay .modal-box');
    if (box) box.style.maxWidth = '800px';

    // Injecteer stijlen als ze er nog niet zijn
    if (!document.getElementById('lb-stijlen')) {
      const s = document.createElement('style');
      s.id = 'lb-stijlen';
      s.textContent = `
        .lb-sectie { margin-bottom:16px; }
        .lb-sectie-kop {
          display:flex;align-items:center;gap:8px;
          padding:7px 10px;border-radius:6px 6px 0 0;
          border-left:4px solid;font-size:13px;font-weight:600;margin-bottom:8px;
        }
        .lb-textarea {
          width:100%;padding:8px 10px;border:1.5px solid var(--border);
          border-radius:var(--radius-sm);font-size:13px;resize:vertical;
          font-family:inherit;box-sizing:border-box;
        }
        .lb-textarea:focus { outline:none;border-color:var(--accent); }
        .lb-input {
          padding:6px 9px;border:1.5px solid var(--border);
          border-radius:var(--radius-sm);font-size:13px;font-family:inherit;
          box-sizing:border-box;width:100%;
        }
        .lb-input:focus { outline:none;border-color:var(--accent); }
        .lb-del-btn { color:var(--red);border:none;background:none;cursor:pointer;font-size:14px;padding:3px;flex-shrink:0; }
        .lb-fase-rij { border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:6px;background:#FAFAFA; }
      `;
      document.head.appendChild(s);
    }
  }, 0);
}

// ============================================================
// DATA LEZEN UIT DOM
// ============================================================
function lbLeesData() {
  const d = _lb.data;

  d.voorbereiding = document.getElementById('lb-voorbereiding')?.value || '';

  const bens = [];
  let i = 0;
  while (document.getElementById(`lb-ben-${i}`)) {
    const v = document.getElementById(`lb-ben-${i}`).value.trim();
    if (v) bens.push(v);
    i++;
  }
  d.benodigdheden = bens;

  const fases = [];
  i = 0;
  while (document.getElementById(`lb-lv-fase-${i}`)) {
    fases.push({
      fase: document.getElementById(`lb-lv-fase-${i}`).value.trim(),
      minuten: parseInt(document.getElementById(`lb-lv-min-${i}`)?.value) || 0,
      beschrijving: document.getElementById(`lb-lv-beschr-${i}`)?.value.trim() || '',
    });
    i++;
  }
  d.lesverloop = fases;

  const stappen = [];
  i = 0;
  while (document.getElementById(`lb-sp-${i}`)) {
    const v = document.getElementById(`lb-sp-${i}`).value.trim();
    if (v) stappen.push({ stap: i + 1, instructie: v });
    i++;
  }
  d.stappenplan = stappen;

  const punten = [];
  i = 0;
  while (document.getElementById(`lb-ap-${i}`)) {
    const v = document.getElementById(`lb-ap-${i}`).value.trim();
    if (v) punten.push(v);
    i++;
  }
  d.aandachtspunten = punten;

  d.differentiatie = {
    snel: document.getElementById('lb-diff-snel')?.value.trim() || '',
    langzaam: document.getElementById('lb-diff-langzaam')?.value.trim() || '',
  };

  d.opmerkingen = document.getElementById('lb-opmerkingen')?.value || '';
}

// ============================================================
// RIJEN TOEVOEGEN / VERWIJDEREN
// ============================================================
function lbVoegBenToe() {
  lbLeesData();
  _lb.data.benodigdheden.push('');
  renderLb();
}
function lbVerwijderBen(i) {
  lbLeesData();
  _lb.data.benodigdheden.splice(i, 1);
  if (!_lb.data.benodigdheden.length) _lb.data.benodigdheden = [''];
  renderLb();
}
function lbVoegFaseToe() {
  lbLeesData();
  _lb.data.lesverloop.push({ fase: 'Nieuwe fase', minuten: 10, beschrijving: '' });
  renderLb();
}
function lbVerwijderFase(i) {
  lbLeesData();
  _lb.data.lesverloop.splice(i, 1);
  renderLb();
}
function lbVoegStapToe() {
  lbLeesData();
  _lb.data.stappenplan.push({ stap: _lb.data.stappenplan.length + 1, instructie: '' });
  renderLb();
}
function lbVerwijderStap(i) {
  lbLeesData();
  _lb.data.stappenplan.splice(i, 1);
  renderLb();
}
function lbVoegAPToe() {
  lbLeesData();
  _lb.data.aandachtspunten.push('');
  renderLb();
}
function lbVerwijderAP(i) {
  lbLeesData();
  _lb.data.aandachtspunten.splice(i, 1);
  if (!_lb.data.aandachtspunten.length) _lb.data.aandachtspunten = [''];
  renderLb();
}

// ============================================================
// OPSLAAN
// ============================================================
async function lbOpslaan() {
  lbLeesData();
  const statusEl = document.getElementById('lb-opslaan-status');
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber)">⏳ Opslaan...</span>`;

  const info = _lb.activiteitInfo || {};
  const payload = {
    profielId: _lb.profielId,
    weekIdx: _lb.weekIdx,
    actIdx: _lb.actIdx,
    activiteitNaam: info.omschrijving || info.naam || '',
    activiteitType: info.type || '',
    activiteitUren: info.uren || 1,
    ..._lb.data,
  };

  try {
    let res;
    if (_lb.id) {
      res = await fetch(`/api/lesbrieven/${_lb.id}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/lesbrieven', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) {
        _lb.id = data.id;
        // Download knop zichtbaar maken
        const dlBtn = document.getElementById('lb-dl-btn');
        if (!dlBtn) {
          const opslaanBtn = document.getElementById('lb-opslaan-btn');
          if (opslaanBtn) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.id = 'lb-dl-btn';
            btn.title = 'Download als Word-bestand';
            btn.textContent = '⬇ Download';
            btn.onclick = lbDownload;
            opslaanBtn.parentNode.insertBefore(btn, opslaanBtn);
          }
        }
      }
    }
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ Opgeslagen</span>`;
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 2000);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
}

// ============================================================
// DOWNLOAD
// ============================================================
function lbDownload() {
  if (!_lb.id) return;
  window.open(`/api/lesbrieven/${_lb.id}/download`, '_blank');
}

// ============================================================
// AI INVULLEN
// ============================================================
async function lbGenereerAI() {
  const statusEl = document.getElementById('lb-ai-status');
  const btn = document.getElementById('lb-ai-btn');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber)">✨ AI vult lesbrief in... (20-40 sec)</span>`;

  const info = _lb.activiteitInfo || {};
  try {
    const res = await fetch('/api/lesbrieven/genereer', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activiteitNaam: info.omschrijving || info.naam || '',
        activiteitType: info.type || '',
        activiteitUren: info.uren || 1,
        profielNaam: info.profielNaam || '',
        weekThema: info.weekThema || '',
        syllabuscodes: info.syllabus || '',
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    _lb.data = { ..._lb.data, ...data.data };
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ AI heeft de lesbrief ingevuld. Controleer en sla op.</span>`;
    renderLb();
  } catch (e) {
    const isQuota = e.message.includes('AI_QUOTA') || e.message.includes('quota');
    if (statusEl) statusEl.innerHTML = isQuota
      ? `<span style="color:var(--amber)">AI quota bereikt. Vul de lesbrief handmatig in.</span>`
      : `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}
