// ============================================================
// public/js/ai-wizard.js — Universele AI Wizard Engine
//
// Gebruik:
//   AIWizard.open(config)
//
// Config structuur:
//   {
//     type: 'lesprofiel',          // sleutel voor voorkeurenopslag
//     titel: 'Nieuw Lesprofiel',
//     beginContext: { ... },       // optionele startdata
//     stappen: [
//       {
//         id: 'basisinfo',
//         titel: 'Basisinformatie',
//         beschrijving: '...',      // optioneel
//         systeemPrompt: '...',
//         userPrompt: (ctx) => '...', // functie of string
//         velden: [
//           { id: 'naam', label: 'Naam', type: 'text', verplicht: true, placeholder: '...' },
//           { id: 'beschrijving', label: 'Omschrijving', type: 'textarea' },
//           { id: 'niveau', label: 'Niveau', type: 'select', opties: ['VMBO-BB', 'HAVO', 'VWO'] },
//           { id: 'weken', label: 'Aantal weken', type: 'number', min: 1, max: 52 },
//         ]
//       }
//     ],
//     onVoltooid: (ctx) => { /* volledig context-object */ }
//   }
// ============================================================

const AIWizard = (() => {
  let _config = null;
  let _stapIdx = 0;
  let _context = {};
  let _isLoading = false;
  let _lastSuggestie = null;

  // ── Publiek: open de wizard
  function open(config) {
    _config = config;
    _stapIdx = 0;
    _context = { ...(config.beginContext || {}) };
    _lastSuggestie = null;
    _isLoading = false;
    _renderModal();
    _genereerSuggestie();
  }

  // ── Render de volledige wizard modal
  function _renderModal() {
    const stap = _config.stappen[_stapIdx];
    const totaal = _config.stappen.length;
    const pct = Math.round((_stapIdx / totaal) * 100);

    const contextSummaryHtml = _bouwContextSummary();
    const veldenHtml = _bouwVeldenHtml(stap);
    const isLaatste = _stapIdx === totaal - 1;

    const html = `
      <div class="aiw-progress-bar">
        <div class="aiw-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="aiw-meta-row">
        <span class="aiw-type-label">${escHtml(_config.titel)}</span>
        <span class="aiw-stap-label">Stap ${_stapIdx + 1} van ${totaal}</span>
      </div>
      <h2 class="aiw-stap-titel">${escHtml(stap.titel)}</h2>
      ${stap.beschrijving ? `<p class="modal-sub" style="margin-top:-8px">${escHtml(stap.beschrijving)}</p>` : ''}

      ${contextSummaryHtml ? `<div class="aiw-context-summary">${contextSummaryHtml}</div>` : ''}

      <div class="aiw-ai-badge aiw-ai-loading" id="aiw-ai-badge">
        <span class="aiw-ai-dot aiw-dot-puls" id="aiw-ai-dot"></span>
        <span id="aiw-ai-label">AI-suggestie wordt geladen...</span>
      </div>

      <div class="aiw-velden" id="aiw-velden">
        ${veldenHtml}
      </div>

      <div class="modal-actions">
        <button class="btn" onclick="AIWizard._annuleer()">Annuleren</button>
        ${_stapIdx > 0 ? `<button class="btn" onclick="AIWizard._vorige()">&#8592; Vorige</button>` : ''}
        <button class="btn" id="aiw-btn-advies" onclick="AIWizard._nieuwAdvies()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Nieuw advies
        </button>
        <button class="btn btn-primary" id="aiw-btn-volgende" onclick="AIWizard._volgende()">
          ${isLaatste ? 'Voltooien &#10003;' : 'Volgende &#8594;'}
        </button>
      </div>
    `;

    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'block';
    overlay.innerHTML = `
      <div class="modal-overlay-inner" onclick="AIWizard._buitenklik(event)">
        <div class="modal-box aiw-modal-box">
          ${html}
        </div>
      </div>
    `;
  }

  function _bouwContextSummary() {
    if (_stapIdx === 0) return '';
    const pills = _config.stappen.slice(0, _stapIdx).map(s => {
      const relevante = s.velden
        .filter(v => _context[v.id] !== undefined && String(_context[v.id]).trim() !== '')
        .map(v => `<strong>${escHtml(v.label)}:</strong> ${escHtml(String(_context[v.id]))}`)
        .join(' &middot; ');
      if (!relevante) return '';
      return `<div class="aiw-ctx-stap"><span class="aiw-ctx-staptitel">${escHtml(s.titel)}</span> &mdash; ${relevante}</div>`;
    }).filter(Boolean);
    return pills.join('');
  }

  function _bouwVeldenHtml(stap) {
    return stap.velden.map(veld => {
      const val = _context[veld.id] !== undefined ? _context[veld.id] : (veld.standaard !== undefined ? veld.standaard : '');
      const req = veld.verplicht ? 'required' : '';
      let input = '';

      if (veld.type === 'textarea') {
        input = `<textarea id="aiw-veld-${veld.id}" class="aiw-input" rows="${veld.rows || 3}" placeholder="${escAttr(veld.placeholder || '')}" ${req}>${escHtml(String(val))}</textarea>`;
      } else if (veld.type === 'select') {
        const opties = (veld.opties || []).map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return `<option value="${escAttr(String(v))}" ${String(v) === String(val) ? 'selected' : ''}>${escHtml(l)}</option>`;
        }).join('');
        input = `<select id="aiw-veld-${veld.id}" class="aiw-input" ${req}><option value="">&#8212; Kies &#8212;</option>${opties}</select>`;
      } else if (veld.type === 'number') {
        input = `<input type="number" id="aiw-veld-${veld.id}" class="aiw-input" value="${escAttr(String(val))}" placeholder="${escAttr(veld.placeholder || '')}" ${veld.min !== undefined ? `min="${veld.min}"` : ''} ${veld.max !== undefined ? `max="${veld.max}"` : ''} ${req}>`;
      } else {
        input = `<input type="text" id="aiw-veld-${veld.id}" class="aiw-input" value="${escAttr(String(val))}" placeholder="${escAttr(veld.placeholder || '')}" ${req}>`;
      }

      return `
        <div class="form-field">
          <label for="aiw-veld-${veld.id}">${escHtml(veld.label)}${veld.verplicht ? ' <span style="color:var(--red)">*</span>' : ''}</label>
          ${input}
          ${veld.hint ? `<div style="font-size:11px;color:var(--ink-4);margin-top:3px">${escHtml(veld.hint)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // ── Genereer AI-suggestie voor huidige stap
  async function _genereerSuggestie() {
    if (_isLoading) return;
    const stap = _config.stappen[_stapIdx];
    _isLoading = true;
    _setAiBadge('loading');

    try {
      const userPrompt = typeof stap.userPrompt === 'function' ? stap.userPrompt(_context) : (stap.userPrompt || '');

      const res = await fetch('/api/ai/wizard-stap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: _config.type,
          stapId: stap.id,
          systeemPrompt: stap.systeemPrompt || '',
          userPrompt,
          context: _context,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      _lastSuggestie = data.suggestie;
      _vulVeldenIn(stap, data.suggestie);
      _setAiBadge('ok');
    } catch (e) {
      console.warn('AI wizard fout:', e.message);
      _lastSuggestie = null;
      _setAiBadge('fout');
    } finally {
      _isLoading = false;
    }
  }

  function _vulVeldenIn(stap, suggestie) {
    if (!suggestie) return;
    stap.velden.forEach(veld => {
      const el = document.getElementById(`aiw-veld-${veld.id}`);
      if (!el) return;
      const val = suggestie[veld.id];
      if (val === undefined || val === null) return;
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (el.tagName === 'SELECT') {
        const match = Array.from(el.options).find(o => o.value === strVal);
        if (match) el.value = match.value;
      } else {
        el.value = strVal;
      }
    });
  }

  function _setAiBadge(status) {
    const badge = document.getElementById('aiw-ai-badge');
    const dot = document.getElementById('aiw-ai-dot');
    const label = document.getElementById('aiw-ai-label');
    if (!badge) return;

    badge.className = 'aiw-ai-badge aiw-ai-' + status;
    if (status === 'loading') {
      dot.className = 'aiw-ai-dot aiw-dot-puls';
      label.textContent = 'AI-suggestie wordt geladen…';
    } else if (status === 'ok') {
      dot.className = 'aiw-ai-dot aiw-dot-ok';
      label.textContent = 'AI-suggestie klaar — pas aan naar wens';
    } else {
      dot.className = 'aiw-ai-dot aiw-dot-fout';
      label.textContent = 'AI kon geen suggestie genereren — vul handmatig in';
    }
  }

  // ── Lees huidige veldwaarden
  function _leesVelden() {
    const stap = _config.stappen[_stapIdx];
    const vals = {};
    stap.velden.forEach(veld => {
      const el = document.getElementById(`aiw-veld-${veld.id}`);
      if (!el) return;
      vals[veld.id] = veld.type === 'number' ? (el.value !== '' ? Number(el.value) : '') : el.value;
    });
    return vals;
  }

  // ── Valideer verplichte velden
  function _valideer() {
    const stap = _config.stappen[_stapIdx];
    for (const veld of stap.velden) {
      if (!veld.verplicht) continue;
      const el = document.getElementById(`aiw-veld-${veld.id}`);
      if (!el || !String(el.value).trim()) {
        if (el) { el.focus(); el.style.borderColor = 'var(--red)'; setTimeout(() => { el.style.borderColor = ''; }, 1500); }
        return false;
      }
    }
    return true;
  }

  // ── Sla voorkeur op (fire-and-forget)
  function _slaVoorkeurOp(stap, invoer, resultaat) {
    fetch('/api/ai/wizard-voorkeur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type: _config.type, stapId: stap.id, invoer, resultaat }),
    }).catch(() => {});
  }

  // ── Publiek: nieuw advies opvragen
  function _nieuwAdvies() {
    if (_isLoading) return;
    const stap = _config.stappen[_stapIdx];
    stap.velden.forEach(veld => {
      const el = document.getElementById(`aiw-veld-${veld.id}`);
      if (el) el.value = '';
    });
    _lastSuggestie = null;
    _genereerSuggestie();
  }

  // ── Publiek: ga naar volgende stap
  function _volgende() {
    if (_isLoading) return;
    if (!_valideer()) {
      const box = document.querySelector('.aiw-modal-box');
      if (box) { box.classList.add('aiw-shake'); setTimeout(() => box.classList.remove('aiw-shake'), 400); }
      return;
    }

    const stap = _config.stappen[_stapIdx];
    const vals = _leesVelden();
    const invoerSnapshot = { ..._context };
    Object.assign(_context, vals);

    if (_lastSuggestie) {
      _slaVoorkeurOp(stap, invoerSnapshot, vals);
    }

    if (_stapIdx < _config.stappen.length - 1) {
      _stapIdx++;
      _lastSuggestie = null;
      _renderModal();
      _genereerSuggestie();
    } else {
      _sluit();
      if (_config.onVoltooid) _config.onVoltooid({ ..._context });
    }
  }

  // ── Publiek: terug naar vorige stap
  function _vorige() {
    if (_stapIdx > 0) {
      _stapIdx--;
      _lastSuggestie = null;
      _renderModal();
      _setAiBadge('ok');
    }
  }

  // ── Publiek: annuleer
  function _annuleer() {
    if (!confirm('Wizard annuleren? De ingevulde gegevens gaan verloren.')) return;
    _sluit();
  }

  function _sluit() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
    _config = null;
    _context = {};
    _stapIdx = 0;
    _isLoading = false;
    _lastSuggestie = null;
  }

  // ── Publiek: klik buiten modal sluit
  function _buitenklik(e) {
    if (e.target === e.currentTarget) _annuleer();
  }

  // ── Hulpfuncties HTML-escaping
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { open, _volgende, _vorige, _annuleer, _nieuwAdvies, _buitenklik };
})();
