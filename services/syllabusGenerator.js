// ============================================================
// services/syllabusGenerator.js — PIE Syllabus Parser
// VERBETERINGEN v2:
//  1. Inhoudsopgave overgeslagen (fix dubbele modules)
//  2. Hernummerde taakcodes correct geparsed (P/PIE/3.2 1.3 etc.)
//  3. BB/KB/GL detectie per rij ipv globaal tellen
//  4. Sub-items parser robuuster voor dubbele codes
//  5. Theorie+praktijk gemixt per week ipv apart
//  6. PIE-specifieke classificatie-hints uitgebreid
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
// FIX 1: Inhoudsopgave overslaan
// Zoek "PROFIELMODULEN" als sectiestart — staat maar één keer
// in de echte inhoud, niet in de inhoudsopgave.
// ============================================================
function extractModuleSection(text) {
  const normalized = normalizeText(text);
  // Zoek de echte profielmodulen sectie (na kern/inleiding)
  const idx = normalized.search(/^PROFIELMODULEN\s*$/im);
  if (idx === -1) {
    // Fallback: zoek op de eerste echte P/PIE/ taakcode
    const fallbackIdx = normalized.search(/^P\/PIE\/\d+\.\d+/im);
    if (fallbackIdx === -1) return normalized;
    // Ga terug naar de dichtstbijzijnde PROFIELMODULE header
    const before = normalized.slice(0, fallbackIdx);
    const lastModule = before.lastIndexOf('\n1 PROFIELMODULE');
    return lastModule !== -1 ? normalized.slice(lastModule) : normalized.slice(fallbackIdx);
  }
  return normalized.slice(idx);
}

// ============================================================
// FIX 2: Hernummerde taakcodes normaliseren
// "P/PIE/3.2 1.3" → gebruik de TWEEDE (nieuwe) code
// "P/PIE/1.31.2"  → split op overgang cijfer.cijfer
// ============================================================
function extractPrimaryTaskCode(line) {
  // Patroon: twee codes naast elkaar zoals "P/PIE/3.2 1.3" of "P/PIE/1.2 2.2"
  // De nieuwe code staat als tweede — gebruik die
  const twoCodesMatch = line.match(/P\/PIE\/\d+\.\d+\s+((?:\d+\.)?\d+\.\d+)/i);
  if (twoCodesMatch) {
    const secondPart = twoCodesMatch[1];
    // Als het een volledige code is zoals "2.2", maak er P/PIE/2.2 van
    if (/^\d+\.\d+$/.test(secondPart)) {
      return `P/PIE/${secondPart}`;
    }
  }

  // Patroon: samengeplakte codes zoals "P/PIE/1.31.2" (was 1.3, is nu 1.2)
  // Dit zijn artefacten van wijzigingen in de syllabus — pak de laatste code
  const stickyMatch = line.match(/P\/PIE\/(\d+\.\d+)(\d+\.\d+)/i);
  if (stickyMatch) {
    return `P/PIE/${stickyMatch[2]}`;
  }

  // Normaal patroon
  const normalMatch = line.match(/P\/PIE\/(\d+\.\d+)/i);
  if (normalMatch) {
    return `P/PIE/${normalMatch[1]}`;
  }

  return null;
}

// ============================================================
// FIX 3: BB/KB/GL detectie per rij
// In de PDF staan x-markeringen op de regel DIRECT NA de taakomschrijving.
// We koppelen elke x-rij aan de voorgaande taakregelrij.
// ============================================================
function detectLevelFromXRow(xLine) {
  // Een x-rij ziet eruit als: "x x x", "x x", "x", of combinaties
  // Na pdf-parse staan ze als losse tokens op een regel
  const tokens = xLine.trim().split(/\s+/);
  const xCount = tokens.filter(t => t.toLowerCase() === 'x').length;
  // Kolom 1=BB, 2=KB, 3=GL (volgorde in de tabel)
  return {
    BB: xCount >= 1,
    KB: xCount >= 2,
    GL: xCount >= 3,
  };
}

function isXRow(line) {
  // Een rij met alleen x'en en spaties, of "x x", "x x x", "x"
  return /^x(\s+x){0,2}$/i.test(line.trim());
}

// ============================================================
// MODULE PARSING
// ============================================================
function parseModules(text) {
  // FIX 1: Sla inhoudsopgave over
  const moduleSection = extractModuleSection(text);
  const lines = splitLines(moduleSection);
  const modules = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match alleen "1 PROFIELMODULE ..." — niet "1.1 PROFIELMODULE"
    const m = line.match(/^(\d+)\s+PROFIELMODULE\s+(.+)$/i);
    if (m) {
      // FIX 1: Als deze module al bestaat (duplicaat uit inhoudsopgave), skip
      if (modules.find(mod => mod.code === m[1])) continue;

      current = {
        nummer: m[1],
        code: m[1],
        naam: m[2].trim(),
        title: `Profielmodule ${m[1]} ${m[2].trim()}`,
        lines: []
      };
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
      title: module.title,
      taskCount: tasks.length,
      tasks,
      text: taskText
    };
  });
}

// ============================================================
// TAAK PARSING — met FIX 2 (hernummerde codes)
// ============================================================
function parseTasks(lines) {
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Controleer of de regel een P/PIE/ code bevat
    if (!/P\/PIE\//i.test(line)) continue;

    // FIX 2: Gebruik de genormaliseerde primaire code
    const code = extractPrimaryTaskCode(line);
    if (!code) continue;

    // Sla sub-taken (P/PIE/1.1.1) over op taakniveau
    if (/P\/PIE\/\d+\.\d+\.\d+/i.test(line) && !/P\/PIE\/\d+\.\d+\s/i.test(line)) continue;

    // Vermijd duplicaten
    if (tasks.find(t => t.code === code)) continue;

    // Lees de taaktitel — stop bij bekende grenzen
    let title = line
      .replace(/P\/PIE\/[\d\.\s]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Pak eventuele vervolgtitelregels
    let j = i + 1;
    while (
      j < lines.length &&
      lines[j] &&
      !/^De kandidaat kan/i.test(lines[j]) &&
      !/^De volgende professionele/i.test(lines[j]) &&
      !/^UITWERKING/i.test(lines[j]) &&
      !/P\/PIE\//i.test(lines[j]) &&
      !/^\d+\s+PROFIELMODULE/i.test(lines[j]) &&
      !isXRow(lines[j])
    ) {
      if (title.length < 160) title += ` ${lines[j]}`;
      j++;
    }

    title = title.replace(/\s+/g, ' ').trim();
    if (!title || title.length < 3) continue;

    tasks.push({ code, title, rows: [], detailItems: [] });
  }

  return tasks;
}

// ============================================================
// FIX 4: Sub-items parser robuuster voor hernummerde codes
// ============================================================
function splitDetailItems(task) {
  const lines = splitLines(task.text || '');
  const items = [];
  let current = null;

  // Genereer mogelijke sub-item patronen voor deze taak
  // bijv. voor P/PIE/1.1 matchen we ook P/PIE/1.1.1, P/PIE/1.1.2 etc.
  const baseCode = task.code; // bijv. "P/PIE/1.1"
  const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match sub-items: P/PIE/1.1.1, P/PIE/1.1.2 etc.
    // FIX 4: ook hernummerde codes matchen zoals "P/PIE/3.2.1 1.3.1"
    const subMatch =
      line.match(new RegExp(`^${escapedBase}\\.(\\d+)\\s+(.+)$`, 'i')) ||
      line.match(/^P\/PIE\/\d+\.\d+\.\d+\s+\d+\.\d+\.\d+\s+(.+)$/i) ||
      line.match(/^P\/PIE\/(\d+\.\d+)\.(\d+)\s+(.+)$/i);

    if (subMatch) {
      if (current) items.push(current);

      let subCode, subTitle;
      if (subMatch[3] && /P\/PIE\/\d+\.\d+\.\d+\s+\d+\.\d+\.\d+/.test(line)) {
        // Hernummerde sub-item: gebruik de omschrijving
        subCode = `${baseCode}.${items.length + 1}`;
        subTitle = subMatch[1].trim();
      } else if (subMatch[2] && subMatch[3]) {
        // P/PIE/1.1.2 formaat via derde match
        subCode = `${baseCode}.${subMatch[2]}`;
        subTitle = subMatch[3].trim();
      } else {
        subCode = `${baseCode}.${subMatch[1]}`;
        subTitle = (subMatch[2] || subMatch[3] || '').trim();
      }

      current = { code: subCode, title: subTitle, body: [], levelLines: [] };
      continue;
    }

    // Stop als we een nieuwe hoofd-taak tegenkomen
    if (/^P\/PIE\/\d+\.\d+(?!\.\d)/i.test(line) && !line.includes(baseCode)) {
      break;
    }

    if (current) {
      if (isXRow(line)) {
        current.levelLines.push(line);
      } else {
        current.body.push(line);
      }
    }
  }

  if (current) items.push(current);
  return items;
}

// ============================================================
// FIX 3: BB/KB/GL applicability per sub-item
// ============================================================
function getItemLevelApplicability(item) {
  // Kijk naar de x-rijen die bij dit item horen
  if (item.levelLines && item.levelLines.length > 0) {
    // Neem de meest voorkomende/maximale x-count
    let maxX = 0;
    item.levelLines.forEach(row => {
      const count = (row.match(/\bx\b/gi) || []).length;
      if (count > maxX) maxX = count;
    });
    return { BB: maxX >= 1, KB: maxX >= 2, GL: maxX >= 3 };
  }
  // Fallback: alles open
  return { BB: true, KB: true, GL: true };
}

function guessTaskLevelApplicability(taskCode, taskText) {
  const lines = splitLines(taskText);
  let maxX = 0;

  for (const line of lines) {
    if (isXRow(line)) {
      const count = (line.match(/\bx\b/gi) || []).length;
      if (count > maxX) maxX = count;
    }
  }

  if (maxX === 0) {
    // Geen x-rijen gevonden — fallback op heuristiek met moduleCode
    const moduleCode = taskCode.split('/')[2]?.split('.')[0] || '';
    const text = normalizeText(taskText).toLowerCase();
    const hasTriple = /x x x/i.test(text);
    const hasDouble = /x x/i.test(text);

    if (hasTriple) return { BB: true, KB: true, GL: true };
    if (hasDouble) {
      return moduleCode === '3'
        ? { BB: false, KB: true, GL: true }
        : { BB: true, KB: true, GL: false };
    }
    return { BB: true, KB: true, GL: true };
  }

  return { BB: maxX >= 1, KB: maxX >= 2, GL: maxX >= 3 };
}

// ============================================================
// FIX 5: PIE-specifieke classificatie
// ============================================================
function classifyItem(detailItem) {
  const text = `${detailItem.title} ${detailItem.body.join(' ')}`.toLowerCase();

  // PIE-specifieke praktijkwoorden (uitvoerend, hands-on)
  const praktijkHints = [
    'opbouwen', 'aansluiten', 'maken', 'uitvoeren', 'bedraden', 'monteren',
    'testen', 'beproeven', 'aanleggen', 'bewerken', 'verbinden', 'instellen',
    'meten', 'bedienen', 'zagen', 'buigen', 'knippen', 'lassen', 'boren',
    'draaien', 'aftekenen', 'afkorten', 'vijlen', 'tappen', 'knellen',
    'persen', 'richten', 'samenstellen', 'afmonteren', 'aflassen',
    'programmeren', 'invoeren', 'realiseren', 'produceren', 'printen',
    'snijden', 'verbinden', 'aansluiten', 'afbramen', 'kalibreren',
    'bevestigen', 'inbedrijfstellen', 'controleren', 'doormeten',
  ];

  // PIE-specifieke theoriewoorden (kennisoverdracht, begrijpen)
  const theorieHints = [
    'omschrijven', 'uitleggen', 'benoemen', 'interpreteren', 'lezen',
    'beschrijven', 'begrippen', 'eigenschappen', 'functie', 'werking',
    'symbolen', 'noemen', 'verklaren', 'analyseren', 'bepalen',
    'herkennen', 'toelichten', 'definiëren', 'aangeven', 'opstellen',
    'berekenen', 'afleiden', 'beoordelen', 'evalueren', 'presenteren',
    'documentatie', 'schema lezen', 'tekening lezen', 'rapporteren',
  ];

  let praktijkScore = 0;
  let theorieScore = 0;

  praktijkHints.forEach(h => { if (text.includes(h)) praktijkScore += 2; });
  theorieHints.forEach(h => { if (text.includes(h)) theorieScore += 2; });

  // Extra gewicht voor duidelijke PIE-praktijkzinnen
  if (/in een practicum/i.test(text)) praktijkScore += 4;
  if (/in een montageopdracht/i.test(text)) praktijkScore += 4;
  if (/met behulp van.*machine/i.test(text)) praktijkScore += 3;
  if (/in een proefopstelling/i.test(text)) praktijkScore += 3;

  // Extra gewicht voor theorie
  if (/in dit verband kan de kandidaat/i.test(text)) theorieScore += 1;
  if (/het gaat hier om/i.test(text) && !/uitvoeren/i.test(text)) theorieScore += 1;

  if (praktijkScore > theorieScore) return 'Praktijk';
  if (theorieScore > praktijkScore) return 'Theorie';

  // Bij gelijkspel: kijk naar de taakcode
  // Module 1 (ontwerpen) en 3 (besturen) zijn vaker theorie
  // Module 2 (bewerken) en 4 (installeren) zijn vaker praktijk
  const moduleNr = detailItem.code?.split('/')?.[2]?.split('.')?.[0];
  if (moduleNr === '2' || moduleNr === '4') return 'Praktijk';
  return 'Theorie';
}

// ============================================================
// ACTIVITEIT AANMAKEN
// ============================================================
function toActivity(detailItem) {
  const bulletLines = detailItem.body
    .filter(line => !/^In dit verband kan de kandidaat/i.test(line))
    .filter(line => !/^(BB|KB|GL)$/i.test(line))
    .filter(line => !isXRow(line))
    .filter(line => !/^\d+\.$/.test(line))
    .filter(line => !/^De volgende professionele/i.test(line))
    .filter(line => !/^UITWERKING/i.test(line))
    .slice(0, 6);

  const cleaned = bulletLines
    .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
    .filter(line => line.length > 3);

  const omschrijving = [detailItem.title, ...cleaned.slice(0, 3)]
    .join(' · ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type: classifyItem(detailItem),
    uren: 1,
    omschrijving,
    syllabus: detailItem.code,
    link: '',
    bestand: null
  };
}

// ============================================================
// FIX 6: Theorie+praktijk GEMIXT per week
// Niet meer: alle theorie in eerste helft, alle praktijk in tweede helft.
// Nu: elke week krijgt een mix van theorie en praktijk.
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

  // Interleave theorie en praktijk zodat elke week een mix heeft
  // Strategie: verdeel per week op basis van de verhouding theorie/praktijk
  const totaal = theorie.length + praktijk.length;
  const theoriePerWeek = Math.max(1, Math.ceil(theorie.length / aantalWeken));
  const praktijkPerWeek = Math.max(1, Math.ceil(praktijk.length / aantalWeken));

  let tIdx = 0;
  let pIdx = 0;

  for (let w = 0; w < aantalWeken; w++) {
    // Voeg theorie toe voor deze week
    for (let t = 0; t < theoriePerWeek && tIdx < theorie.length; t++, tIdx++) {
      weken[w].activiteiten.push(theorie[tIdx]);
    }
    // Voeg praktijk toe voor deze week
    for (let p = 0; p < praktijkPerWeek && pIdx < praktijk.length; p++, pIdx++) {
      weken[w].activiteiten.push(praktijk[pIdx]);
    }
  }

  // Resterende activiteiten verdelen over de laatste weken
  while (tIdx < theorie.length) {
    weken[(tIdx) % aantalWeken].activiteiten.push(theorie[tIdx]);
    tIdx++;
  }
  while (pIdx < praktijk.length) {
    weken[(pIdx) % aantalWeken].activiteiten.push(praktijk[pIdx]);
    pIdx++;
  }

  // Thema instellen op basis van de eerste activiteit van de week
  weken.forEach(week => {
    const eerste = week.activiteiten[0];
    week.thema = eerste
      ? eerste.omschrijving.split(' · ')[0].slice(0, 60)
      : `Week ${week.weekIndex}`;
  });

  return weken;
}

// ============================================================
// BUILD TASK TEXT MAP — ook voor hernummerde codes
// ============================================================
function buildTaskTextMap(moduleText) {
  const map = {};
  // Split op elk P/PIE/ patroon (inclusief hernummerde)
  const parts = moduleText.split(/(?=P\/PIE\/[\d\.]+)/i);

  for (const part of parts) {
    const code = extractPrimaryTaskCode(part.split('\n')[0] || '');
    if (!code) continue;
    if (!map[code]) map[code] = part;
  }

  return map;
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
  // FIX 1: gebruik extractModuleSection zodat inhoudsopgave overgeslagen wordt
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

  const taskTextMap = buildTaskTextMap(module.text);
  const niveau = String(options.niveau || 'BB').toUpperCase();

  const selectedTasks = module.tasks.filter(task => {
    const applicability = guessTaskLevelApplicability(task.code, taskTextMap[task.code] || task.title);
    return !!applicability[niveau];
  });

  const detailItems = [];
  selectedTasks.forEach(task => {
    const textBlock = taskTextMap[task.code] || '';
    const enrichedTask = { ...task, text: textBlock };
    const items = splitDetailItems(enrichedTask);
    if (items.length) {
      detailItems.push(...items);
    } else {
      // Fallback: maak één activiteit van de taak zelf
      detailItems.push({ code: task.code, title: task.title, body: [], levelLines: [] });
    }
  });

  if (!detailItems.length) {
    throw new Error('Er zijn geen onderdelen gevonden voor deze module en dit niveau');
  }

  // FIX 3: filter op niveau per item
  const levelFilteredItems = detailItems.filter(item => {
    const applicability = getItemLevelApplicability(item);
    return !!applicability[niveau];
  });

  const itemsToUse = levelFilteredItems.length > 0 ? levelFilteredItems : detailItems;
  const activities = itemsToUse.map(item => toActivity(item));

  // FIX 6: gemixt distribueren
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
    selectie: selectedTasks.map(t => ({ code: t.code, title: t.title })),
    aantalWeken: weken.length,
    urenPerWeek,
    beschrijving: `Automatisch gegenereerd uit syllabus, module ${module.code} — ${module.naam}, niveau ${niveau}`,
    weken
  };
}

module.exports = {
  analyseSyllabusPdf,
  generateLesprofielFromPdf
};
