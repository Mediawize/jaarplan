const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

function moduleTitleToCode(title) {
  const t = title.toLowerCase();
  if (t.includes('ontwerpen en maken')) return '1';
  if (t.includes('bewerken en verbinden')) return '2';
  if (t.includes('besturen en automatiseren')) return '3';
  if (t.includes('installeren en monteren')) return '4';
  return '';
}

function parseTasks(lines) {
  const tasks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^P\/PIE\/(\d+\.\d+)(?:\.\d+)?\b/i);
    if (!m) continue;
    const code = `P/PIE/${m[1]}`;
    if (tasks.find(t => t.code === code)) continue;

    let title = line.replace(/^P\/PIE\/\d+\.\d+(?:\.\d+)?\s*/i, '').trim();
    let j = i + 1;
    while (j < lines.length && lines[j] && !/^De kandidaat kan/i.test(lines[j]) && !/^De volgende professionele/i.test(lines[j]) && !/^UITWERKING/i.test(lines[j]) && !/^P\/PIE\//i.test(lines[j]) && !/^\d+\s+PROFIELMODULE/i.test(lines[j])) {
      if (title.length < 140) title += ` ${lines[j]}`;
      j++;
    }
    title = title.replace(/\s+/g, ' ').trim();
    tasks.push({ code, title, rows: [], detailItems: [] });
  }
  return tasks;
}

function parseModules(text) {
  const lines = splitLines(text);
  const modules = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\d+)\s+PROFIELMODULE\s+(.+)$/i);
    if (m) {
      current = {
        nummer: m[1],
        code: m[1],
        naam: m[2].trim(),
        title: `Profielmodule ${m[1]} ${m[2].trim()}`,
        startIndex: i,
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

function guessTaskLevelApplicability(taskCode, taskText) {
  const text = normalizeText(taskText).toLowerCase();

  // Basisheuristiek
  // 3 x -> alle niveaus
  // 1 x -> BB-only of BB-lijn
  // 2 x is in pdf lastig; daarom gebruiken we module- en contextregels.
  const totalTriples = (text.match(/x x x/g) || []).length;
  const totalDoubles = (text.match(/x x/g) || []).length;
  const totalSingles = (text.match(/(^|\n)x($|\n)/g) || []).length;

  let bb = false, kb = false, gl = false;
  if (totalTriples > 0) { bb = true; kb = true; gl = true; }

  const moduleCode = taskCode.split('/')[2]?.split('.')[0] || '';

  if (totalDoubles > 0) {
    if (moduleCode === '3') {
      // Binnen besturen/automatiseren komen veel KB/GL combinaties voor
      kb = true;
      gl = true;
    } else {
      // In overige modules is dubbel meestal BB/KB
      bb = true;
      kb = true;
    }
  }

  if (totalSingles > 0) bb = true;

  // Als nog niets gevonden is, zet alles open zodat de flow niet blokkeert.
  if (!bb && !kb && !gl) {
    bb = true; kb = true; gl = true;
  }

  return { BB: bb, KB: kb, GL: gl };
}

function splitDetailItems(task) {
  const lines = splitLines(task.text || '');
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sub = line.match(new RegExp(`^${task.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)\\s+(.+)$`, 'i'));
    if (sub) {
      if (current) items.push(current);
      current = {
        code: `${task.code}.${sub[1]}`,
        title: sub[2].trim(),
        body: []
      };
      continue;
    }
    if (/^P\/PIE\//i.test(line) && !line.startsWith(task.code + '.')) {
      break;
    }
    if (current) current.body.push(line);
  }
  if (current) items.push(current);
  return items;
}

function buildTaskTextMap(moduleText) {
  const map = {};
  const parts = moduleText.split(/(?=P\/PIE\/\d+\.\d+)/i);
  for (const part of parts) {
    const m = part.match(/^P\/PIE\/(\d+\.\d+)/i);
    if (!m) continue;
    const code = `P/PIE/${m[1]}`;
    if (!map[code]) map[code] = part;
  }
  return map;
}

function classifyItem(detailItem) {
  const text = `${detailItem.title} ${detailItem.body.join(' ')}`.toLowerCase();
  const praktijkHints = ['opbouwen', 'aansluiten', 'maken', 'uitvoeren', 'bedraden', 'monteren', 'testen', 'beproeven', 'aanleggen', 'bewerken', 'verbinden', 'instellen', 'meten', 'bedienen'];
  const theorieHints = ['omschrijven', 'uitleggen', 'benoemen', 'interpreteren', 'lezen', 'beschrijven', 'begrippen', 'eigenschappen', 'functie', 'werking', 'symbolen'];

  let praktijkScore = 0;
  let theorieScore = 0;
  praktijkHints.forEach(h => { if (text.includes(h)) praktijkScore += 2; });
  theorieHints.forEach(h => { if (text.includes(h)) theorieScore += 2; });

  if (praktijkScore >= theorieScore) return 'Praktijk';
  return 'Theorie';
}

function toActivity(detailItem, fallbackType) {
  const bulletLines = detailItem.body
    .filter(line => !/^In dit verband kan de kandidaat/i.test(line))
    .filter(line => !/^(BB|KB|GL)$/i.test(line))
    .filter(line => !/^x( x){0,2}$/i.test(line))
    .filter(line => !/^\d+\.$/.test(line))
    .slice(0, 8);

  const cleaned = bulletLines
    .map(line => line.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean);

  const omschrijving = [detailItem.title, ...cleaned.slice(0, 4)].join(' · ').replace(/\s+/g, ' ').trim();
  return {
    type: fallbackType || classifyItem(detailItem),
    uren: 1,
    omschrijving,
    syllabus: detailItem.code,
    link: '',
    bestand: null
  };
}

function distributeActivities(activities, aantalWeken, urenTheorie, urenPraktijk) {
  const weken = Array.from({ length: aantalWeken }, (_, idx) => ({
    weekIndex: idx + 1,
    thema: '',
    activiteiten: []
  }));

  const theorie = activities.filter(a => a.type === 'Theorie');
  const praktijk = activities.filter(a => a.type !== 'Theorie');

  theorie.forEach((item, idx) => {
    const weekIdx = idx % aantalWeken;
    item.uren = Math.max(1, Number(urenTheorie) || 1);
    weken[weekIdx].activiteiten.push(item);
  });

  praktijk.forEach((item, idx) => {
    const weekIdx = idx % aantalWeken;
    item.uren = Math.max(1, Number(urenPraktijk) || 1);
    weken[weekIdx].activiteiten.push(item);
  });

  weken.forEach(week => {
    const eerste = week.activiteiten[0];
    week.thema = eerste ? eerste.omschrijving.split(' · ')[0] : `Week ${week.weekIndex}`;
  });

  return weken;
}

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
      detailItems.push({ code: task.code, title: task.title, body: [] });
    }
  });

  if (!detailItems.length) {
    throw new Error('Er zijn geen onderdelen gevonden voor deze module en dit niveau');
  }

  const activities = detailItems.map(item => toActivity(item));
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
    beschrijving: `Automatisch gegenereerd uit syllabus, module ${module.code} ${module.naam}, niveau ${niveau}`,
    weken
  };
}

module.exports = {
  analyseSyllabusPdf,
  generateLesprofielFromPdf
};
