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

    // Strip x-rijen en ruis uit tekst
    const cleanRowText = rowText
      .replace(/\s*x\s*x\s*x\s*$/i, '')
      .replace(/\s*x\s*x\s*$/i, '')
      .replace(/\s*x\s*$/i, '')
      .replace(/\bx\b/gi, '')
      .trim();

    if (!cleanRowText || cleanRowText.length < 5) return;

    // Bouw omschrijving
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
// SAMENVOEGEN: meerdere activiteiten van hetzelfde type
// worden per week gecombineerd tot één activiteit.
// Resultaat: per week max 1 theorie + 1 praktijk.
// ============================================================
function samenvoegen(items, type, uren) {
  if (!items.length) return null;

  // Verzamel unieke omschrijvingen (kort, zonder bullets)
  const kernOmschrijvingen = items.map(item => {
    // Pak alleen het eerste deel vóór de eerste '·'
    return item.omschrijving.split(' · ')[0].trim();
  });

  // Verwijder duplicaten
  const uniek = [...new Set(kernOmschrijvingen)].filter(Boolean);

  // Korte samenvatting: eerste zin + aantal onderwerpen
  let omschrijving;
  if (uniek.length === 1) {
    omschrijving = uniek[0];
  } else if (uniek.length <= 3) {
    omschrijving = uniek.join('; ');
  } else {
    // Te veel om op te noemen: eerste twee + "en meer"
    omschrijving = uniek.slice(0, 2).join('; ') + ` (+${uniek.length - 2} onderwerpen)`;
  }

  // Syllabuscodes samenvoegen
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
// VERDELING OVER WEKEN — max 1 theorie + 1 praktijk per week
// ============================================================
function distributeActivities(activities, aantalWeken, urenTheorie, urenPraktijk) {
  const weken = Array.from({ length: aantalWeken }, (_, idx) => ({
    weekIndex: idx + 1,
    thema: '',
    activiteiten: []
  }));

  const theorie = activities.filter(a => a.type === 'Theorie');
  const praktijk = activities.filter(a => a.type !== 'Theorie');

  // Verdeel items evenredig over weken
  const theoriePerWeek = Math.ceil(theorie.length / aantalWeken);
  const praktijkPerWeek = Math.ceil(praktijk.length / aantalWeken);

  for (let w = 0; w < aantalWeken; w++) {
    // Pak de items voor deze week
    const tStart = w * theoriePerWeek;
    const tItems = theorie.slice(tStart, tStart + theoriePerWeek);

    const pStart = w * praktijkPerWeek;
    const pItems = praktijk.slice(pStart, pStart + praktijkPerWeek);

    // Samenvoegen tot één activiteit per type
    if (tItems.length > 0) {
      const samengevoegd = samenvoegen(tItems, 'Theorie', urenTheorie);
      if (samengevoegd) weken[w].activiteiten.push(samengevoegd);
    }
    if (pItems.length > 0) {
      const samengevoegd = samenvoegen(pItems, 'Praktijk', urenPraktijk);
      if (samengevoegd) weken[w].activiteiten.push(samengevoegd);
    }
  }

  // Thema instellen op de praktijk-activiteit (meest concreet)
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

  // AI verbetering van omschrijvingen en weekthema's
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
// AI VERBETERING — omschrijvingen en weekthema's via Claude API
// Stuurt de ruwe weken naar Claude die er nette, beknopte
// Nederlandse teksten van maakt zoals een docent ze schrijft.
// ============================================================
async function verbeterMetAI(weken, moduleNaam, niveau) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY niet ingesteld — AI verbetering overgeslagen');
    return weken;
  }

  // Bouw een compact overzicht van alle weken voor de AI
  const wekenSamenvatting = weken.map((w, i) => {
    const activiteiten = w.activiteiten.map(a =>
      `  - [${a.type}] ${a.omschrijving} (syllabus: ${a.syllabus})`
    ).join('
');
    return `Week ${i + 1}:
${activiteiten}`;
  }).join('

');

  const prompt = `Je bent een ervaren docent PIE (Produceren, Installeren & Energie) die lesplannen schrijft.

Ik geef je een ruwe lesplanning voor module "${moduleNaam}", niveau ${niveau}.
Verbeter voor elke week:
1. De OMSCHRIJVING van elke activiteit: kort, actiegericht, maximaal 1 zin, geschreven zoals een docent het zou opschrijven. Geen puntkomma's, geen haakjes met "onderwerpen", geen syllabusjargon.
2. Het THEMA van de week: 3-5 woorden die de kern van de week vangen (bijv. "CAD-tekenen en ontwerpen" of "Elektrische schakelingen aansluiten").

Geef je antwoord ALLEEN als JSON, exact dit formaat, geen uitleg eromheen:
{
  "weken": [
    {
      "weekIndex": 1,
      "thema": "kort weekthema hier",
      "activiteiten": [
        { "type": "Theorie", "omschrijving": "verbeterde omschrijving" },
        { "type": "Praktijk", "omschrijving": "verbeterde omschrijving" }
      ]
    }
  ]
}

Ruwe lesplanning:
${wekenSamenvatting}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.warn('AI verbetering mislukt:', response.status);
      return weken;
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // JSON extraheren (strip eventuele markdown backticks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('AI gaf geen geldig JSON terug');
      return weken;
    }

    const verbeterd = JSON.parse(jsonMatch[0]);

    // Verwerk de verbeterde teksten terug in de weken
    return weken.map(week => {
      const verbWeek = (verbeterd.weken || []).find(v => v.weekIndex === week.weekIndex);
      if (!verbWeek) return week;

      const verbeterdePActiviteiten = week.activiteiten.map(act => {
        const verbAct = (verbWeek.activiteiten || []).find(v =>
          v.type === act.type
        );
        if (!verbAct) return act;
        return { ...act, omschrijving: verbAct.omschrijving || act.omschrijving };
      });

      return {
        ...week,
        thema: verbWeek.thema || week.thema,
        activiteiten: verbeterdePActiviteiten
      };
    });

  } catch (e) {
    console.warn('AI verbetering fout:', e.message);
    return weken; // fallback op origineel bij fout
  }
}

module.exports = {
  analyseSyllabusPdf,
  generateLesprofielFromPdf
};
