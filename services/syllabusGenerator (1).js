// ============================================================
// services/syllabusGenerator.js — VMBO Syllabus Parser v4
// Ondersteunt PIE, BWI en andere VMBO profielvakken
// AANPAK: Rij-niveau parsing
//
// Elke genummerde rij (1., 2., 3.) in een sub-taak wordt een
// aparte activiteit. Het werkwoord bepaalt Theorie vs Praktijk.
// BB/KB/GL wordt gelezen van de x-rij direct NA de genummerde rij.
// ============================================================

const fs = require('fs');
const pdfParse = require('pdf-parse');
const { chatJson } = require('./aiClient');

// ============================================================
// TEKST NORMALISATIE
// ============================================================
function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function splitLines(text) {
  return normalizeText(text)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

// ============================================================
// NIVEAU HELPERS
// ============================================================
function isXRow(line) {
  return /^x(\s+x){0,2}$/i.test(line.trim());
}

function xRowToLevel(line) {
  const count = (line.trim().match(/\bx\b/gi) || []).length;
  return { BB: count >= 1, KB: count >= 2, GL: count >= 3 };
}

// ============================================================
// WERKWOORD-GEBASEERDE CLASSIFICATIE
// Het werkwoord staat in VMBO-syllabi vrijwel altijd achteraan.
// ============================================================
const PRAKTIJK_WERKWOORDEN = [
  'maken', 'bouwen', 'monteren', 'installeren', 'meten', 'testen',
  'controleren', 'vervaardigen', 'assembleren', 'solderen', 'lassen',
  'verbinden', 'aansluiten', 'plaatsen', 'bevestigen', 'instellen',
  'afstellen', 'repareren', 'onderhouden', 'demonteren', 'uitvoeren',
  'toepassen', 'construeren', 'bewerken', 'verwerken', 'opbouwen',
  'aanleggen', 'tekenen', 'schetsen', 'opmeten', 'afmeten',
  'zagen', 'boren', 'frezen', 'draaien', 'slijpen', 'schaven',
  'stellen', 'afwerken', 'reinigen', 'coaten', 'schilderen'
];

const THEORIE_WERKWOORDEN = [
  'beschrijven', 'uitleggen', 'benoemen', 'herkennen', 'noemen',
  'omschrijven', 'verklaren', 'analyseren', 'beoordelen', 'vergelijken',
  'onderscheiden', 'berekenenen', 'berekenen', 'schatten', 'voorspellen',
  'plannen', 'ontwerpen', 'specificeren', 'selecteren', 'kiezen',
  'adviseren', 'rapporteren', 'presenteren', 'documenteren', 'registreren',
  'interpreteren', 'lezen', 'begrijpen', 'weten', 'kennen'
];

function classifyByText(text) {
  const lower = text.toLowerCase();

  // Directe domein-hints
  if (/veiligheidsregels|bhv|arbo|persoonlijke bescherming/i.test(lower)) return 'Theorie';
  if (/schema|tekening|berekening|formule|wet van/i.test(lower)) return 'Theorie';
  if (/proefopstelling|werkstuk|product|model|prototype/i.test(lower)) return 'Praktijk';
  if (/met (?:de |het )?(?:juiste )?(?:hand)?gereedschap|met gangbaar gereedschap/i.test(lower)) return 'Praktijk';
  if (/onder toezicht in bedrijf/i.test(lower)) return 'Praktijk';
  if (/volgens gestelde kwaliteitseisen/i.test(lower)) return 'Praktijk';

  let praktijkScore = 0;
  let theorieScore = 0;

  PRAKTIJK_WERKWOORDEN.forEach(w => { if (lower.includes(w)) praktijkScore += 2; });
  THEORIE_WERKWOORDEN.forEach(w => { if (lower.includes(w)) theorieScore += 2; });

  // Laatste werkwoord in de zin telt zwaarst
  const woorden = lower.replace(/[.,;:]/g, '').split(/\s+/);
  for (let i = woorden.length - 1; i >= 0; i--) {
    if (PRAKTIJK_WERKWOORDEN.includes(woorden[i])) { praktijkScore += 5; break; }
    if (THEORIE_WERKWOORDEN.includes(woorden[i])) { theorieScore += 5; break; }
  }

  if (praktijkScore > theorieScore) return 'Praktijk';
  if (theorieScore > praktijkScore) return 'Theorie';
  return 'Theorie'; // Bij gelijkspel: theorie als default
}

// ============================================================
// INHOUDSOPGAVE OVERSLAAN
// ============================================================
function extractModuleSection(text) {
  const normalized = normalizeText(text);
  // "PROFIELMODULEN" staat maar één keer als sectieheader
  const idx = normalized.search(/^PROFIELMODULEN\s*$/im);
  if (idx !== -1) return normalized.slice(idx);

  // Fallback: zoek eerste echte P/[A-Z]+/ code
  const fallbackIdx = normalized.search(/^P\/[A-Z]+\/\d+\.\d+/im);
  if (fallbackIdx === -1) return normalized;
  const before = normalized.slice(0, fallbackIdx);
  const lastModule = before.lastIndexOf('\n1 PROFIELMODULE');
  return lastModule !== -1 ? normalized.slice(lastModule) : normalized.slice(fallbackIdx);
}

// ============================================================
// TAAKCODE NORMALISEREN — hernummerde codes
// ============================================================
function extractPrimaryTaskCode(line) {
  // "P/[A-Z]+/3.2 1.3" → P/[A-Z]+/1.3
  const twoCodesMatch = line.match(/P\/[A-Z]+\/\d+\.\d+\s+(\d+\.\d+)(?!\.\d)/i);
  if (twoCodesMatch) return `P/[A-Z]+/${twoCodesMatch[1]}`;

  // "P/[A-Z]+/1.31.2" → P/[A-Z]+/1.2
  const stickyMatch = line.match(/P\/[A-Z]+\/\d+\.\d+(\d+\.\d+)/i);
  if (stickyMatch) return `P/[A-Z]+/${stickyMatch[1]}`;

  // Normaal
  const normalMatch = line.match(/P\/[A-Z]+\/(\d+\.\d+)/i);
  if (normalMatch) return `P/[A-Z]+/${normalMatch[1]}`;

  return null;
}

function extractSubCode(line) {
  // Hernummerde sub-code: gebruik de tweede
  const twoMatch = line.match(/P\/[A-Z]+\/\d+\.\d+\.\d+\s+(\d+\.\d+\.\d+)/i);
  if (twoMatch) return `P/[A-Z]+/${twoMatch[1]}`;

  const normalMatch = line.match(/P\/[A-Z]+\/(\d+\.\d+\.\d+)/i);
  if (normalMatch) return `P/[A-Z]+/${normalMatch[1]}`;

  return extractPrimaryTaskCode(line);
}

// ============================================================
// MODULE PARSING
// ============================================================
function parseModules(text) {
  const moduleSection = extractModuleSection(text);
  const lines = splitLines(moduleSection);
  const modules = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\d+)\s+PROFIELMODULE\s+(.+)$/i);
    if (m) {
      if (modules.find(mod => mod.code === m[1])) continue; // skip duplicaat
      current = { code: m[1], naam: m[2].trim(), lines: [] };
      modules.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  return modules.map(module => {
    const taskText = module.lines.join('\n');
    const tasks = parseTasks(module.lines);
    return {
      code: module.code,
      naam: module.naam,
      taskCount: tasks.length,
      tasks,
      text: taskText
    };
  });
}

function parseTasks(lines) {
  const tasks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/P\/[A-Z]+\//i.test(line)) continue;
    const code = extractPrimaryTaskCode(line);
    if (!code) continue;
    // Alleen hoofd-taken (P/[A-Z]+/1.1, niet P/[A-Z]+/1.1.1)
    if (/P\/[A-Z]+\/\d+\.\d+\.\d+/i.test(code)) continue;
    if (tasks.find(t => t.code === code)) continue;

    let title = line.replace(/P\/[A-Z]+\/[\d\.\s]+/gi, '').replace(/\s+/g, ' ').trim();
    let j = i + 1;
    while (
      j < lines.length && lines[j] &&
      !/^De kandidaat kan/i.test(lines[j]) &&
      !/^UITWERKING/i.test(lines[j]) &&
      !/P\/[A-Z]+\//i.test(lines[j]) &&
      !/^\d+\s+PROFIELMODULE/i.test(lines[j]) &&
      !isXRow(lines[j])
    ) {
      if (title.length < 160) title += ` ${lines[j]}`;
      j++;
    }
    title = title.replace(/\s+/g, ' ').trim();
    if (title.length < 3) continue;
    tasks.push({ code, title });
  }
  return tasks;
}

// ============================================================
// KERN: ROW-LEVEL ACTIVITEITEN EXTRAHEREN
// ============================================================
function extractRowActivities(moduleText, niveau) {
  const lines = splitLines(moduleText);
  const activities = [];

  let currentSubCode = null;
  let pendingRow = null;
  let inSubTask = false;

  function flushRow(levelStr) {
    if (!pendingRow) return;
    const rowText = pendingRow.text;
    const bullets = pendingRow.bullets;
    pendingRow = null;

    if (!rowText || rowText.length < 5) return;
    if (/^BB|^KB|^GL/i.test(rowText)) return;
    if (/^het gaat hier om/i.test(rowText)) return;

    let includeForNiveau = true;
    if (levelStr) {
      const level = xRowToLevel(levelStr);
      includeForNiveau = !level[niveau];
    }
    if (!includeForNiveau) return;

    const cleanRowText = rowText
      .replace(/\s*x\s*x\s*x\s*$/i, '')
      .replace(/\s*x\s*x\s*$/i, '')
      .replace(/\s*x\s*$/i, '')
      .replace(/\bx\b/gi, '')
      .trim();

    if (!cleanRowText || cleanRowText.length < 5) return;

    const parts = [cleanRowText, ...bullets.slice(0, 3)];
    const omschrijving = parts.join(' · ').replace(/\s+/g, ' ').trim().slice(0, 200);
    const type = classifyByText(cleanRowText + ' ' + bullets.join(' '));

    activities.push({
      type,
      uren: 1,
      omschrijving,
      syllabus: currentSubCode || '',
      link: '',
      bestand: null
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/P\/[A-Z]+\/\d+\.\d+\.\d+/i.test(line) || /P\/[A-Z]+\/\d+\.\d+\s+\d+\.\d+\.\d+/i.test(line)) {
      flushRow(null);
      currentSubCode = extractSubCode(line);
      inSubTask = true;
      continue;
    }

    if (/^P\/[A-Z]+\/\d+\.\d+(?!\.\d)/i.test(line)) {
      flushRow(null);
      currentSubCode = extractPrimaryTaskCode(line);
      inSubTask = false;
      continue;
    }

    if (/^\d+\s+PROFIELMODULE/i.test(line)) {
      flushRow(null);
      inSubTask = false;
      continue;
    }

    if (/^In dit verband kan de kandidaat/i.test(line)) continue;
    if (/^De kandidaat kan/i.test(line)) continue;
    if (/^De volgende professionele/i.test(line)) continue;
    if (/^UITWERKING/i.test(line)) { flushRow(null); continue; }
    if (/^BB\s*KB\s*GL/i.test(line)) continue;
    if (/^Taak:/i.test(line)) continue;
    if (/^Voor het uitvoeren/i.test(line)) continue;
    if (/^P\/[A-Z]+\/\d+\.\d+\s*$/i.test(line)) continue;

    if (isXRow(line)) {
      flushRow(line);
      continue;
    }

    const numberedMatch = line.match(/^(\d{1,2})\.\s+(.+)$/);
    if (numberedMatch) {
      flushRow(null);
      pendingRow = { text: numberedMatch[2].trim(), bullets: [] };
      continue;
    }

    if (pendingRow) {
      if (/^[•\-\*]/.test(line) || (line.length < 120 && /^[a-z]/i.test(line) && !isXRow(line))) {
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleaned.length > 2) pendingRow.bullets.push(cleaned);
      }
    }
  }

  flushRow(null);
  return activities;
}

// ============================================================
// SAMENVOEGEN: meerdere activiteiten per week → max 1 theorie + 1 praktijk
// ============================================================
function samenvoegen(items, type, uren) {
  if (!items.length) return null;

  const kernOmschrijvingen = items.map(item => {
    return item.omschrijving.split(' · ')[0].trim();
  });

  const uniek = [...new Set(kernOmschrijvingen)].filter(Boolean);

  let omschrijving;
  if (uniek.length === 1) {
    omschrijving = uniek[0];
  } else if (uniek.length <= 3) {
    omschrijving = uniek.join('; ');
  } else {
    omschrijving = uniek.slice(0, 2).join('; ') + ` (+${uniek.length - 2} onderwerpen)`;
  }

  const codes = [...new Set(items.map(i => i.syllabus).filter(Boolean))];

  return {
    type,
    uren: Math.max(1, Number(uren) || 1),
    omschrijving: omschrijving.slice(0, 200),
    syllabus: codes.join(', '),
    link: '',
    bestand: null
  };
}

// ============================================================
// VERDELING OVER WEKEN
// ============================================================
function distributeActivities(activities, aantalWeken, urenTheorie, urenPraktijk) {
  const weken = Array.from({ length: aantalWeken }, (_, idx) => ({
    weekIndex: idx + 1,
    thema: '',
    activiteiten: []
  }));

  const theorie = activities.filter(a => a.type === 'Theorie');
  const praktijk = activities.filter(a => a.type !== 'Theorie');

  const theoriePerWeek = Math.ceil(theorie.length / aantalWeken);
  const praktijkPerWeek = Math.ceil(praktijk.length / aantalWeken);

  for (let w = 0; w < aantalWeken; w++) {
    const tStart = w * theoriePerWeek;
    const tItems = theorie.slice(tStart, tStart + theoriePerWeek);

    const pStart = w * praktijkPerWeek;
    const pItems = praktijk.slice(pStart, pStart + praktijkPerWeek);

    if (tItems.length > 0) {
      const samengevoegd = samenvoegen(tItems, 'Theorie', urenTheorie);
      if (samengevoegd) weken[w].activiteiten.push(samengevoegd);
    }
    if (pItems.length > 0) {
      const samengevoegd = samenvoegen(pItems, 'Praktijk', urenPraktijk);
      if (samengevoegd) weken[w].activiteiten.push(samengevoegd);
    }
  }

  weken.forEach(week => {
    const praktijkAct = week.activiteiten.find(a => a.type === 'Praktijk');
    const theorieAct = week.activiteiten.find(a => a.type === 'Theorie');
    const eerste = praktijkAct || theorieAct;
    week.thema = eerste
      ? eerste.omschrijving.split(';')[0].split(' · ')[0].trim().slice(0, 60)
      : `Week ${week.weekIndex}`;
  });

  return weken;
}

// ============================================================
// PUBLIEKE API
// ============================================================
async function readPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdfParse(dataBuffer);
  return normalizeText(result.text);
}

async function analyseSyllabusPdf(filePath) {
  const text = await readPdf(filePath);
  const modules = parseModules(text).map(m => ({
    code: m.code,
    naam: m.naam,
    taskCount: m.tasks.length,
    taken: m.tasks.map(t => ({ code: t.code, title: t.title }))
  }));
  return { modules, sourceText: text };
}

async function generateLesprofielFromPdf(filePath, options) {
  const text = await readPdf(filePath);
  const modules = parseModules(text);
  const module = modules.find(m => m.code === String(options.moduleCode));
  if (!module) throw new Error('Gekozen profielmodule niet gevonden in de syllabus');

  const niveau = String(options.niveau || 'BB').toUpperCase();

  const activities = extractRowActivities(module.text, niveau);

  if (!activities.length) {
    throw new Error('Er zijn geen activiteiten gevonden voor deze module en dit niveau');
  }

  const weken = distributeActivities(
    activities,
    Math.max(1, Number(options.aantalWeken) || 1),
    Math.max(1, Number(options.urenTheorie) || 1),
    Math.max(1, Number(options.urenPraktijk) || 1)
  );

  const naam = options.naam || `${module.naam} ${niveau}`;
  const urenPerWeek = (Number(options.urenTheorie) || 0) + (Number(options.urenPraktijk) || 0);

  const verbeterdeWeken = await verbeterMetAI(weken, module.naam, niveau);

  return {
    naam,
    niveau,
    module: { code: module.code, naam: module.naam },
    selectie: module.tasks.map(t => ({ code: t.code, title: t.title })),
    aantalWeken: verbeterdeWeken.length,
    urenPerWeek,
    beschrijving: `Automatisch gegenereerd — module ${module.code} ${module.naam}, niveau ${niveau}.`,
    weken: verbeterdeWeken
  };
}

// ============================================================
// AI VERBETERING — omschrijvingen en weekthema's
// Generiek voor alle VMBO profielvakken (PIE, BWI, etc.)
// ============================================================
async function verbeterMetAI(weken, moduleNaam, niveau) {
  // ← GEWIJZIGD: controleert nu op ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY niet ingesteld — AI verbetering werkt niet');
    return weken;
  }

  const wekenSamenvatting = weken.map((w, i) => {
    const activiteiten = w.activiteiten.map(a =>
      `  - [${a.type}] ${a.omschrijving} (syllabus: ${a.syllabus})`
    ).join('\n');
    return 'Week ' + (i + 1) + ':\n' + activiteiten;
  }).join('\n\n');

  const prompt = `Je bent een ervaren MBO/VMBO docent die lesplannen schrijft voor de module "${moduleNaam}", niveau ${niveau}.

Ik geef je een ruwe lesplanning. Verbeter voor elke week:
1. De OMSCHRIJVING van elke activiteit: kort, actiegericht, maximaal 1 zin, geschreven zoals een docent het zou opschrijven. Geen puntkomma's, geen haakjes met "onderwerpen", geen syllabusjargon. Begin met een werkwoord.
2. Het THEMA van de week: 3-5 woorden die de kern van de week vangen (bijv. "Elektrische schakelingen aansluiten" of "Tekenen en meten").

Geef je antwoord ALLEEN als JSON, exact dit formaat, geen uitleg eromheen:
{
  "weken": [
    {
      "weekIndex": 1,
      "thema": "kort weekthema hier",
      "activiteiten": [
        { "type": "Theorie", "omschrijving": "Verbeterde omschrijving hier." },
        { "type": "Praktijk", "omschrijving": "Verbeterde omschrijving hier." }
      ]
    }
  ]
}

Ruwe lesplanning:
${wekenSamenvatting}`;

  try {
    const verbeterd = await chatJson({
      system: 'Je schrijft kort, helder en praktisch Nederlands voor MBO/VMBO docenten. Geef altijd alleen geldig JSON terug, geen uitleg erbuiten.',
      user: prompt,
      // ← GEWIJZIGD: gebruikt nu ANTHROPIC_MODEL env var
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      maxTokens: 3500,
      temperature: 0.2
    });

    return weken.map(week => {
      const verbWeek = (verbeterd.weken || []).find(v => v.weekIndex === week.weekIndex);
      if (!verbWeek) return week;

      const verbeterdeActiviteiten = week.activiteiten.map(act => {
        const verbAct = (verbWeek.activiteiten || []).find(v => v.type === act.type);
        if (!verbAct) return act;
        return { ...act, omschrijving: verbAct.omschrijving || act.omschrijving };
      });

      return {
        ...week,
        thema: verbWeek.thema || week.thema,
        activiteiten: verbeterdeActiviteiten
      };
    });

  } catch (e) {
    console.warn('AI verbetering fout:', e.message);
    return weken;
  }
}

module.exports = {
  analyseSyllabusPdf,
  generateLesprofielFromPdf
};
