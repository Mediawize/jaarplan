// ============================================================
// services/syllabusGenerator.js — PIE Syllabus Parser v3
// AANPAK: Rij-niveau parsing
//
// Elke genummerde rij (1., 2., 3.) in een sub-taak wordt een
// aparte activiteit. Het werkwoord bepaalt Theorie vs Praktijk.
// BB/KB/GL wordt gelezen van de x-rij direct NA de genummerde rij.
// ============================================================

const fs = require('fs');
const pdfParse = require('pdf-parse');

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
// Het werkwoord staat in PIE-syllabi vrijwel altijd achteraan.
// ============================================================
const PRAKTIJK_WERKWOORDEN = [
  'opbouwen', 'aansluiten', 'uitvoeren', 'maken', 'monteren', 'bedraden',
  'testen', 'beproeven', 'aanleggen', 'instellen', 'bedienen', 'zagen',
  'buigen', 'knippen', 'lassen', 'boren', 'draaien', 'aftekenen',
  'afkorten', 'vijlen', 'tappen', 'knellen', 'persen', 'richten',
  'samenstellen', 'afmonteren', 'aflassen', 'programmeren', 'invoeren',
  'realiseren', 'produceren', 'printen', 'snijden', 'afbramen',
  'kalibreren', 'bevestigen', 'inbedrijfstellen', 'doormeten', 'meten',
  'verbinden', 'controleren', 'vervormen', 'scheiden', 'ruimen',
  'inspannen', 'afstellen', 'gebruiken', 'inregelen', 'solderen',
  'stellen', 'opzetten', 'aanpassen', 'afwerken', 'assembleren',
];

const THEORIE_WERKWOORDEN = [
  'omschrijven', 'beschrijven', 'benoemen', 'noemen', 'lezen',
  'interpreteren', 'uitleggen', 'herkennen', 'bepalen', 'berekenen',
  'afleiden', 'beoordelen', 'evalueren', 'presenteren', 'rapporteren',
  'aangeven', 'opstellen', 'verklaren', 'analyseren', 'definiëren',
  'toelichten', 'formuleren', 'vergelijken', 'onderscheiden',
  'kiezen', 'motiveren', 'argumenteren', 'illustreren', 'weergeven',
  'invullen', 'raadplegen', 'zoeken', 'aflezen', 'vastleggen',
  'tekenen', 'schetsen', 'berekenen', 'calculeren',
];

function classifyByText(text) {
  const lower = text.toLowerCase();

  // Sterke context-hints gaan voor werkwoord-analyse
  if (/in een practicum/i.test(lower)) return 'Praktijk';
  if (/in een montageopdracht/i.test(lower)) return 'Praktijk';
  if (/in een proefopstelling/i.test(lower)) return 'Praktijk';
  if (/met behulp van.*machine/i.test(lower)) return 'Praktijk';
  if (/met gangbaar gereedschap/i.test(lower)) return 'Praktijk';
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

  // Fallback: zoek eerste echte P/PIE/ code
  const fallbackIdx = normalized.search(/^P\/PIE\/\d+\.\d+/im);
  if (fallbackIdx === -1) return normalized;
  const before = normalized.slice(0, fallbackIdx);
  const lastModule = before.lastIndexOf('\n1 PROFIELMODULE');
  return lastModule !== -1 ? normalized.slice(lastModule) : normalized.slice(fallbackIdx);
}

// ============================================================
// TAAKCODE NORMALISEREN — hernummerde codes
// ============================================================
function extractPrimaryTaskCode(line) {
  // "P/PIE/3.2 1.3" → P/PIE/1.3
  const twoCodesMatch = line.match(/P\/PIE\/\d+\.\d+\s+(\d+\.\d+)(?!\.\d)/i);
  if (twoCodesMatch) return `P/PIE/${twoCodesMatch[1]}`;

  // "P/PIE/1.31.2" → P/PIE/1.2
  const stickyMatch = line.match(/P\/PIE\/\d+\.\d+(\d+\.\d+)/i);
  if (stickyMatch) return `P/PIE/${stickyMatch[1]}`;

  // Normaal
  const normalMatch = line.match(/P\/PIE\/(\d+\.\d+)/i);
  if (normalMatch) return `P/PIE/${normalMatch[1]}`;

  return null;
}

function extractSubCode(line) {
  // Hernummerde sub-code: gebruik de tweede
  const twoMatch = line.match(/P\/PIE\/\d+\.\d+\.\d+\s+(\d+\.\d+\.\d+)/i);
  if (twoMatch) return `P/PIE/${twoMatch[1]}`;

  const normalMatch = line.match(/P\/PIE\/(\d+\.\d+\.\d+)/i);
  if (normalMatch) return `P/PIE/${normalMatch[1]}`;

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
    if (!/P\/PIE\//i.test(line)) continue;
    const code = extractPrimaryTaskCode(line);
    if (!code) continue;
    // Alleen hoofd-taken (P/PIE/1.1, niet P/PIE/1.1.1)
    if (/P\/PIE\/\d+\.\d+\.\d+/i.test(code)) continue;
    if (tasks.find(t => t.code === code)) continue;

    let title = line.replace(/P\/PIE\/[\d\.\s]+/gi, '').replace(/\s+/g, ' ').trim();
    let j = i + 1;
    while (
      j < lines.length && lines[j] &&
      !/^De kandidaat kan/i.test(lines[j]) &&
      !/^UITWERKING/i.test(lines[j]) &&
      !/P\/PIE\//i.test(lines[j]) &&
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
//
// Structuur per sub-taak in de syllabus (na pdf-parse):
//
//   P/PIE/1.1.1 sub-taak omschrijving
//   In dit verband kan de kandidaat:
//   1. de stappen benoemen                 ← genummerde rij
//   x x                                    ← niveau (BB + KB)
//   2. een schakeling opbouwen             ← genummerde rij
//   x x x                                  ← niveau (BB + KB + GL)
//   • onderdelen van de schakeling         ← bullet (hoort bij rij 2)
//   • de werking zichtbaar maken
//
// We pakken elke genummerde rij + bullets erna + de x-rij.
// Als een rij geen x-rij heeft (fallback): inclusief voor alle niveaus.
// ============================================================
function extractRowActivities(moduleText, niveau) {
  const lines = splitLines(moduleText);
  const activities = [];

  let currentSubCode = null;
  let pendingRow = null;    // { text, bullets }
  let inSubTask = false;

  function flushRow(levelStr) {
    if (!pendingRow) return;
    const rowText = pendingRow.text;
    const bullets = pendingRow.bullets;
    pendingRow = null;

    if (!rowText || rowText.length < 5) return;
    if (/^BB|^KB|^GL/i.test(rowText)) return;
    if (/^het gaat hier om/i.test(rowText)) return;

    // Niveau check
    let includeForNiveau = true;
    if (levelStr) {
      const level = xRowToLevel(levelStr);
      includeForNiveau = !!level[niveau];
    }
    if (!includeForNiveau) return;

    // Bouw omschrijving
    const parts = [rowText, ...bullets.slice(0, 3)];
    const omschrijving = parts.join(' · ').replace(/\s+/g, ' ').trim().slice(0, 200);
    const type = classifyByText(rowText + ' ' + bullets.join(' '));

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

    // Sub-taak header (P/PIE/1.1.1)
    if (/P\/PIE\/\d+\.\d+\.\d+/i.test(line) || /P\/PIE\/\d+\.\d+\s+\d+\.\d+\.\d+/i.test(line)) {
      flushRow(null);
      currentSubCode = extractSubCode(line);
      inSubTask = true;
      continue;
    }

    // Hoofd-taak reset
    if (/^P\/PIE\/\d+\.\d+(?!\.\d)/i.test(line)) {
      flushRow(null);
      currentSubCode = extractPrimaryTaskCode(line);
      inSubTask = false;
      continue;
    }

    // Module reset
    if (/^\d+\s+PROFIELMODULE/i.test(line)) {
      flushRow(null);
      inSubTask = false;
      continue;
    }

    // Ruis overslaan
    if (/^In dit verband kan de kandidaat/i.test(line)) continue;
    if (/^De kandidaat kan/i.test(line)) continue;
    if (/^De volgende professionele/i.test(line)) continue;
    if (/^UITWERKING/i.test(line)) { flushRow(null); continue; }
    if (/^BB\s*KB\s*GL/i.test(line)) continue;
    if (/^Taak:/i.test(line)) continue;
    if (/^Voor het uitvoeren/i.test(line)) continue;
    if (/^P\/PIE\/\d+\.\d+\s*$/i.test(line)) continue; // lege taakreferentie

    // X-rij: koppel aan de openstaande rij
    if (isXRow(line)) {
      flushRow(line);
      continue;
    }

    // Genummerde rij (1., 2., 3.)
    const numberedMatch = line.match(/^(\d{1,2})\.\s+(.+)$/);
    if (numberedMatch) {
      flushRow(null); // vorige rij zonder x-rij
      pendingRow = { text: numberedMatch[2].trim(), bullets: [] };
      continue;
    }

    // Bullet bij openstaande rij
    if (pendingRow) {
      if (/^[•\-\*]/.test(line) || (line.length < 120 && /^[a-z]/i.test(line) && !isXRow(line))) {
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleaned.length > 2) pendingRow.bullets.push(cleaned);
      }
    }
  }

  // Laatste openstaande rij
  flushRow(null);

  return activities;
}

// ============================================================
// VERDELING OVER WEKEN — GEMIXT
// ============================================================
function distributeActivities(activities, aantalWeken, urenTheorie, urenPraktijk) {
  const weken = Array.from({ length: aantalWeken }, (_, idx) => ({
    weekIndex: idx + 1,
    thema: '',
    activiteiten: []
  }));

  const theorie = activities
    .filter(a => a.type === 'Theorie')
    .map(a => ({ ...a, uren: Math.max(1, Number(urenTheorie) || 1) }));

  const praktijk = activities
    .filter(a => a.type !== 'Theorie')
    .map(a => ({ ...a, uren: Math.max(1, Number(urenPraktijk) || 1) }));

  const theoriePerWeek = Math.ceil(theorie.length / aantalWeken);
  const praktijkPerWeek = Math.ceil(praktijk.length / aantalWeken);

  let tIdx = 0;
  let pIdx = 0;

  for (let w = 0; w < aantalWeken; w++) {
    for (let t = 0; t < theoriePerWeek && tIdx < theorie.length; t++, tIdx++) {
      weken[w].activiteiten.push(theorie[tIdx]);
    }
    for (let p = 0; p < praktijkPerWeek && pIdx < praktijk.length; p++, pIdx++) {
      weken[w].activiteiten.push(praktijk[pIdx]);
    }
  }

  while (tIdx < theorie.length) { weken[tIdx % aantalWeken].activiteiten.push(theorie[tIdx++]); }
  while (pIdx < praktijk.length) { weken[pIdx % aantalWeken].activiteiten.push(praktijk[pIdx++]); }

  weken.forEach(week => {
    const eerste = week.activiteiten[0];
    week.thema = eerste
      ? eerste.omschrijving.split(' · ')[0].slice(0, 60)
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

  // Rij-niveau activiteiten extraheren
  const activities = extractRowActivities(module.text, niveau);

  if (!activities.length) {
    throw new Error('Er zijn geen activiteiten gevonden voor deze module en dit niveau');
  }

  const theorieCount = activities.filter(a => a.type === 'Theorie').length;
  const praktijkCount = activities.filter(a => a.type === 'Praktijk').length;

  const weken = distributeActivities(
    activities,
    Math.max(1, Number(options.aantalWeken) || 1),
    Math.max(1, Number(options.urenTheorie) || 1),
    Math.max(1, Number(options.urenPraktijk) || 1)
  );

  const naam = options.naam || `${module.naam} ${niveau}`;
  const urenPerWeek = (Number(options.urenTheorie) || 0) + (Number(options.urenPraktijk) || 0);

  return {
    naam,
    niveau,
    module: { code: module.code, naam: module.naam },
    selectie: module.tasks.map(t => ({ code: t.code, title: t.title })),
    aantalWeken: weken.length,
    urenPerWeek,
    beschrijving: `Automatisch gegenereerd — module ${module.code} ${module.naam}, niveau ${niveau}. ${theorieCount} theorie en ${praktijkCount} praktijk activiteiten.`,
    weken
  };
}

module.exports = {
  analyseSyllabusPdf,
  generateLesprofielFromPdf
};
