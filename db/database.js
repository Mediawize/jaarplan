// ============================================================
// db/database.js — SQLite database setup en queries
// ============================================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = new Database(path.join(dbDir, 'jaarplan.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// SCHEMA
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS gebruikers (
    id TEXT PRIMARY KEY,
    naam TEXT NOT NULL,
    achternaam TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    wachtwoord TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'docent',
    initialen TEXT,
    vakken TEXT DEFAULT '[]',
    aangemaakt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vakken (
    id TEXT PRIMARY KEY,
    naam TEXT NOT NULL,
    volledig TEXT,
    kleur TEXT DEFAULT '#2D5A3D',
    aangemaakt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS klassen (
    id TEXT PRIMARY KEY,
    naam TEXT NOT NULL,
    leerjaar INTEGER DEFAULT 1,
    niveau TEXT,
    vakId TEXT,
    docentId TEXT,
    schooljaar TEXT,
    aantalWeken INTEGER DEFAULT 38,
    urenPerWeek INTEGER DEFAULT 3,
    aangemaakt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vakId) REFERENCES vakken(id),
    FOREIGN KEY (docentId) REFERENCES gebruikers(id)
  );

  CREATE TABLE IF NOT EXISTS schooljaren (
    id TEXT PRIMARY KEY,
    naam TEXT UNIQUE NOT NULL,
    aangemaakt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weken (
    id TEXT PRIMARY KEY,
    schooljaar TEXT NOT NULL,
    weeknummer INTEGER NOT NULL,
    van TEXT,
    tot TEXT,
    vanISO TEXT,
    totISO TEXT,
    isVakantie INTEGER DEFAULT 0,
    vakantieNaam TEXT,
    thema TEXT DEFAULT '',
    UNIQUE(schooljaar, weeknummer)
  );

  CREATE TABLE IF NOT EXISTS opdrachten (
    id TEXT PRIMARY KEY,
    klasId TEXT NOT NULL,
    naam TEXT NOT NULL,
    beschrijving TEXT,
    syllabuscodes TEXT,
    weken TEXT,
    weeknummer INTEGER,
    schooljaar TEXT,
    type TEXT DEFAULT 'Opdracht',
    uren REAL,
    werkboekLink TEXT,
    theorieLink TEXT,
    toetsBestand TEXT,
    periode INTEGER DEFAULT 1,
    afgevinkt INTEGER DEFAULT 0,
    afgevinktDoor TEXT,
    afgevinktOp TEXT,
    opmerking TEXT,
    profielId TEXT,
    aangemaakt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (klasId) REFERENCES klassen(id)
  );

  CREATE TABLE IF NOT EXISTS lesprofielen (
    id TEXT PRIMARY KEY,
    naam TEXT NOT NULL,
    vakId TEXT NOT NULL,
    docentId TEXT NOT NULL,
    aantalWeken INTEGER DEFAULT 4,
    urenPerWeek INTEGER DEFAULT 3,
    beschrijving TEXT,
    weken TEXT DEFAULT '[]',
    aangemaakt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vakId) REFERENCES vakken(id),
    FOREIGN KEY (docentId) REFERENCES gebruikers(id)
  );
`);

// ============================================================
// MIGRATIES — voeg kolommen toe als ze nog niet bestaan
// ============================================================
function migreer() {
  const weekCols = db.prepare("PRAGMA table_info(weken)").all().map(c => c.name);
  const klasCols = db.prepare("PRAGMA table_info(klassen)").all().map(c => c.name);
  const userCols = db.prepare("PRAGMA table_info(gebruikers)").all().map(c => c.name);

  if (!weekCols.includes('weektype')) {
    db.exec("ALTER TABLE weken ADD COLUMN weektype TEXT DEFAULT 'normaal'");
    db.exec("UPDATE weken SET weektype = 'vakantie' WHERE isVakantie = 1");
    console.log('Migratie: weektype kolom toegevoegd aan weken');
  }
  if (!weekCols.includes('dagnotities')) {
    db.exec("ALTER TABLE weken ADD COLUMN dagnotities TEXT DEFAULT '[]'");
    console.log('Migratie: dagnotities kolom toegevoegd aan weken');
  }
  if (!klasCols.includes('docenten')) {
    db.exec("ALTER TABLE klassen ADD COLUMN docenten TEXT DEFAULT '[]'");
    db.exec("UPDATE klassen SET docenten = json_array(docentId) WHERE docentId IS NOT NULL AND docentId != ''");
    console.log('Migratie: docenten kolom toegevoegd aan klassen');
  }
  if (!userCols.includes('hoofdklassen')) {
    db.exec("ALTER TABLE gebruikers ADD COLUMN hoofdklassen TEXT DEFAULT '[]'");
    console.log('Migratie: hoofdklassen kolom toegevoegd aan gebruikers');
  }
}

migreer();

// ============================================================
// HELPERS
// ============================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function parseJSON(val, fallback = []) {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

// ============================================================
// SEED DATA (alleen als DB leeg is)
// ============================================================
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM gebruikers').get().c;
  if (count > 0) return;

  console.log('Database seeden met startdata...');

  const users = [
    { id: 'u1', naam: 'Tom', achternaam: 'Nieuweboer', email: 't.nieuweboer@atlascollege.nl', wachtwoord: bcrypt.hashSync('admin123', 10), rol: 'admin', initialen: 'TNB', vakken: '[]', hoofdklassen: '[]' },
    { id: 'u2', naam: 'Jan', achternaam: 'Jansen', email: 'docent@school.nl', wachtwoord: bcrypt.hashSync('docent123', 10), rol: 'docent', initialen: 'JJA', vakken: '["v1","v2"]', hoofdklassen: '[]' },
    { id: 'u3', naam: 'Fatima', achternaam: 'El Amrani', email: 'felam@school.nl', wachtwoord: bcrypt.hashSync('docent123', 10), rol: 'docent', initialen: 'FEA', vakken: '["v1"]', hoofdklassen: '[]' },
    { id: 'u4', naam: 'Management', achternaam: 'Viewer', email: 'management@school.nl', wachtwoord: bcrypt.hashSync('mgmt123', 10), rol: 'management', initialen: 'MGT', vakken: '[]', hoofdklassen: '[]' },
  ];

  const vakken = [
    { id: 'v1', naam: 'PIE', volledig: 'Produceren, Installeren & Energie', kleur: '#2D5A3D' },
    { id: 'v2', naam: 'M&O', volledig: 'Management & Organisatie', kleur: '#1A4A7A' },
    { id: 'v3', naam: 'Economie', volledig: 'Economie', kleur: '#C4821A' },
  ];

  const klassen = [
    { id: 'k1', naam: '3 HAVO A', leerjaar: 3, niveau: 'HAVO', vakId: 'v1', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38, urenPerWeek: 3 },
    { id: 'k2', naam: '3 HAVO B', leerjaar: 3, niveau: 'HAVO', vakId: 'v1', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38, urenPerWeek: 3 },
    { id: 'k3', naam: '4 VWO A', leerjaar: 4, niveau: 'VWO', vakId: 'v1', docentId: 'u3', schooljaar: '2025-2026', aantalWeken: 38, urenPerWeek: 4 },
    { id: 'k4', naam: '5 HAVO A', leerjaar: 5, niveau: 'HAVO', vakId: 'v2', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38, urenPerWeek: 2 },
  ];

  const insUser = db.prepare('INSERT INTO gebruikers (id,naam,achternaam,email,wachtwoord,rol,initialen,vakken,hoofdklassen) VALUES (?,?,?,?,?,?,?,?,?)');
  const insVak = db.prepare('INSERT INTO vakken (id,naam,volledig,kleur) VALUES (?,?,?,?)');
  const insKlas = db.prepare('INSERT INTO klassen (id,naam,leerjaar,niveau,vakId,docentId,schooljaar,aantalWeken,urenPerWeek,docenten) VALUES (?,?,?,?,?,?,?,?,?,?)');

  users.forEach(u => insUser.run(u.id, u.naam, u.achternaam, u.email, u.wachtwoord, u.rol, u.initialen, u.vakken, u.hoofdklassen));
  vakken.forEach(v => insVak.run(v.id, v.naam, v.volledig, v.kleur));
  klassen.forEach(k => insKlas.run(k.id, k.naam, k.leerjaar, k.niveau, k.vakId, k.docentId, k.schooljaar, k.aantalWeken, k.urenPerWeek, JSON.stringify([k.docentId])));

  console.log('Seed klaar!');
}

// ============================================================
// PREPARED STATEMENTS
// ============================================================
const Q = {
  // GEBRUIKERS
  getGebruikers: db.prepare('SELECT * FROM gebruikers ORDER BY naam'),
  getGebruiker: db.prepare('SELECT * FROM gebruikers WHERE id = ?'),
  getGebruikerByEmail: db.prepare('SELECT * FROM gebruikers WHERE LOWER(email) = LOWER(?)'),
  insGebruiker: db.prepare('INSERT INTO gebruikers (id,naam,achternaam,email,wachtwoord,rol,initialen,vakken,hoofdklassen) VALUES (?,?,?,?,?,?,?,?,?)'),
  updGebruiker: db.prepare('UPDATE gebruikers SET naam=?,achternaam=?,email=?,rol=?,initialen=?,vakken=?,hoofdklassen=? WHERE id=?'),
  updGebruikerMetWW: db.prepare('UPDATE gebruikers SET naam=?,achternaam=?,email=?,wachtwoord=?,rol=?,initialen=?,vakken=?,hoofdklassen=? WHERE id=?'),
  delGebruiker: db.prepare('DELETE FROM gebruikers WHERE id=?'),

  // VAKKEN
  getVakken: db.prepare('SELECT * FROM vakken ORDER BY naam'),
  getVak: db.prepare('SELECT * FROM vakken WHERE id=?'),
  insVak: db.prepare('INSERT INTO vakken (id,naam,volledig,kleur) VALUES (?,?,?,?)'),
  updVak: db.prepare('UPDATE vakken SET naam=?,volledig=? WHERE id=?'),
  delVak: db.prepare('DELETE FROM vakken WHERE id=?'),

  // KLASSEN
  getKlassen: db.prepare('SELECT * FROM klassen ORDER BY naam'),
  getKlas: db.prepare('SELECT * FROM klassen WHERE id=?'),
  insKlas: db.prepare('INSERT INTO klassen (id,naam,leerjaar,niveau,vakId,docentId,schooljaar,aantalWeken,urenPerWeek,docenten) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  updKlas: db.prepare('UPDATE klassen SET naam=?,leerjaar=?,niveau=?,vakId=?,docentId=?,schooljaar=?,urenPerWeek=?,docenten=? WHERE id=?'),
  delKlas: db.prepare('DELETE FROM klassen WHERE id=?'),

  // SCHOOLJAREN
  getSchooljaren: db.prepare('SELECT * FROM schooljaren ORDER BY naam'),
  getSchooljaar: db.prepare('SELECT * FROM schooljaren WHERE naam=?'),
  insSchooljaar: db.prepare('INSERT INTO schooljaren (id,naam) VALUES (?,?)'),
  delSchooljaar: db.prepare('DELETE FROM schooljaren WHERE naam=?'),

  // WEKEN
  getWeken: db.prepare('SELECT * FROM weken WHERE schooljaar=? ORDER BY weeknummer'),
  getWeek: db.prepare('SELECT * FROM weken WHERE id=?'),
  insWeek: db.prepare('INSERT OR IGNORE INTO weken (id,schooljaar,weeknummer,van,tot,vanISO,totISO,isVakantie,vakantieNaam,thema) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  updWeekThema: db.prepare('UPDATE weken SET thema=? WHERE id=?'),
  updWeekType: db.prepare('UPDATE weken SET weektype=?, isVakantie=?, vakantieNaam=? WHERE id=?'),
  updWeekDagnotities: db.prepare('UPDATE weken SET dagnotities=? WHERE id=?'),
  delWekenVoorSchooljaar: db.prepare('DELETE FROM weken WHERE schooljaar=?'),

  // OPDRACHTEN
  getOpdrachten: db.prepare('SELECT * FROM opdrachten ORDER BY weeknummer'),
  getOpdrachtenByKlas: db.prepare('SELECT * FROM opdrachten WHERE klasId=? ORDER BY weeknummer'),
  getOpdracht: db.prepare('SELECT * FROM opdrachten WHERE id=?'),
  insOpdracht: db.prepare('INSERT INTO opdrachten (id,klasId,naam,beschrijving,syllabuscodes,weken,weeknummer,schooljaar,type,uren,werkboekLink,theorieLink,toetsBestand,periode,profielId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  updOpdracht: db.prepare('UPDATE opdrachten SET naam=?,beschrijving=?,syllabuscodes=?,weken=?,weeknummer=?,type=?,uren=?,werkboekLink=?,theorieLink=?,toetsBestand=?,periode=?,afgevinkt=?,afgevinktDoor=?,afgevinktOp=?,opmerking=? WHERE id=?'),
  delOpdracht: db.prepare('DELETE FROM opdrachten WHERE id=?'),
  delOpdrachtenByKlas: db.prepare('DELETE FROM opdrachten WHERE klasId=?'),

  // LESPROFIELEN
  getLesprofielen: db.prepare('SELECT * FROM lesprofielen ORDER BY naam'),
  getLesprofiel: db.prepare('SELECT * FROM lesprofielen WHERE id=?'),
  insLesprofiel: db.prepare('INSERT INTO lesprofielen (id,naam,vakId,docentId,aantalWeken,urenPerWeek,beschrijving,weken) VALUES (?,?,?,?,?,?,?,?)'),
  updLesprofiel: db.prepare('UPDATE lesprofielen SET naam=?,vakId=?,docentId=?,aantalWeken=?,urenPerWeek=?,beschrijving=?,weken=? WHERE id=?'),
  delLesprofiel: db.prepare('DELETE FROM lesprofielen WHERE id=?'),
};

// ============================================================
// DB API
// ============================================================
module.exports = {
  genId,
  seedIfEmpty,

  // --- GEBRUIKERS ---
  getGebruikers() {
    return Q.getGebruikers.all().map(u => ({ ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen) }));
  },
  getGebruiker(id) {
    const u = Q.getGebruiker.get(id);
    return u ? { ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen) } : null;
  },
  getGebruikerByEmail(email) {
    const u = Q.getGebruikerByEmail.get(email);
    return u ? { ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen) } : null;
  },
  addGebruiker({ naam, achternaam, email, wachtwoord, rol, initialen, vakken = [], hoofdklassen = [] }) {
    if (Q.getGebruikerByEmail.get(email)) return { error: 'E-mail bestaat al' };
    const id = genId();
    const hash = bcrypt.hashSync(wachtwoord, 10);
    Q.insGebruiker.run(id, naam, achternaam, email, hash, rol, initialen || null, JSON.stringify(vakken), JSON.stringify(hoofdklassen));
    return this.getGebruiker(id);
  },
  updateGebruiker(id, data) {
    if (data.wachtwoord) {
      Q.updGebruikerMetWW.run(data.naam, data.achternaam, data.email, bcrypt.hashSync(data.wachtwoord, 10), data.rol, data.initialen || null, JSON.stringify(data.vakken || []), JSON.stringify(data.hoofdklassen || []), id);
    } else {
      Q.updGebruiker.run(data.naam, data.achternaam, data.email, data.rol, data.initialen || null, JSON.stringify(data.vakken || []), JSON.stringify(data.hoofdklassen || []), id);
    }
  },
  deleteGebruiker(id) { Q.delGebruiker.run(id); },
  verifyWachtwoord(email, wachtwoord) {
    const u = this.getGebruikerByEmail(email);
    if (!u) return null;
    if (!bcrypt.compareSync(wachtwoord, u.wachtwoord)) return null;
    return u;
  },

  // --- VAKKEN ---
  getVakken() { return Q.getVakken.all(); },
  getVak(id) { return Q.getVak.get(id) || null; },
  addVak({ naam, volledig, kleur = '#2D5A3D' }) {
    const id = genId();
    Q.insVak.run(id, naam, volledig, kleur);
    return Q.getVak.get(id);
  },
  updateVak(id, { naam, volledig }) { Q.updVak.run(naam, volledig, id); },
  deleteVak(id) { Q.delVak.run(id); },

  // --- KLASSEN ---
  getKlassen(docentId = null) {
    const alle = Q.getKlassen.all().map(k => ({ ...k, docenten: parseJSON(k.docenten) }));
    if (!docentId) return alle;
    return alle.filter(k => k.docentId === docentId || (k.docenten || []).includes(docentId));
  },
  getKlas(id) {
    const k = Q.getKlas.get(id);
    return k ? { ...k, docenten: parseJSON(k.docenten) } : null;
  },
  addKlas(d) {
    const id = genId();
    const docenten = d.docenten || (d.docentId ? [d.docentId] : []);
    Q.insKlas.run(id, d.naam, d.leerjaar, d.niveau, d.vakId, d.docentId || null, d.schooljaar, d.aantalWeken || 38, d.urenPerWeek || 3, JSON.stringify(docenten));
    return this.getKlas(id);
  },
  updateKlas(id, d) {
    const docenten = d.docenten || (d.docentId ? [d.docentId] : []);
    Q.updKlas.run(d.naam, d.leerjaar, d.niveau, d.vakId, d.docentId || null, d.schooljaar, d.urenPerWeek || 3, JSON.stringify(docenten), id);
  },
  deleteKlas(id) { Q.delOpdrachtenByKlas.run(id); Q.delKlas.run(id); },

  // --- SCHOOLJAREN ---
  getSchooljaren() { return Q.getSchooljaren.all(); },
  heeftSchooljaar(naam) { return !!Q.getSchooljaar.get(naam); },
  addSchooljaar(naam, weken) {
    const id = genId();
    Q.insSchooljaar.run(id, naam);
    const insW = db.transaction((wks) => {
      wks.forEach(w => Q.insWeek.run(w.id, w.schooljaar, w.weeknummer, w.van, w.tot, w.vanISO, w.totISO, w.isVakantie ? 1 : 0, w.vakantieNaam || null, w.thema || ''));
    });
    insW(weken);
    return { id, naam };
  },
  deleteSchooljaar(naam) { Q.delWekenVoorSchooljaar.run(naam); Q.delSchooljaar.run(naam); },

  // --- WEKEN ---
  getWeken(schooljaar) {
    return Q.getWeken.all(schooljaar).map(w => ({
      ...w,
      isVakantie: !!w.isVakantie,
      weektype: w.weektype || 'normaal',
      dagnotities: parseJSON(w.dagnotities),
    }));
  },
  updateWeekThema(weekId, thema) { Q.updWeekThema.run(thema, weekId); },
  updateWeekType(weekId, weektype, vakantieNaam) {
    const isVakantie = weektype === 'vakantie' ? 1 : 0;
    Q.updWeekType.run(weektype, isVakantie, vakantieNaam || null, weekId);
  },
  updateDagnotities(weekId, dagnotities) {
    Q.updWeekDagnotities.run(JSON.stringify(dagnotities || []), weekId);
  },

  // --- OPDRACHTEN ---
  getOpdrachten(klasId = null) {
    return klasId ? Q.getOpdrachtenByKlas.all(klasId) : Q.getOpdrachten.all();
  },
  getOpdracht(id) { return Q.getOpdracht.get(id) || null; },
  addOpdracht(d) {
    const id = genId();
    Q.insOpdracht.run(id, d.klasId, d.naam, d.beschrijving || null, d.syllabuscodes || null, d.weken || null, d.weeknummer || null, d.schooljaar || null, d.type || 'Opdracht', d.uren || null, d.werkboekLink || null, d.theorieLink || null, d.toetsBestand || null, d.periode || 1, d.profielId || null);
    return Q.getOpdracht.get(id);
  },
  updateOpdracht(id, d) {
    const bestaand = Q.getOpdracht.get(id);
    if (!bestaand) return;
    Q.updOpdracht.run(
      d.naam ?? bestaand.naam,
      d.beschrijving ?? bestaand.beschrijving,
      d.syllabuscodes ?? bestaand.syllabuscodes,
      d.weken ?? bestaand.weken,
      d.weeknummer ?? bestaand.weeknummer,
      d.type ?? bestaand.type,
      d.uren ?? bestaand.uren,
      d.werkboekLink ?? bestaand.werkboekLink,
      d.theorieLink ?? bestaand.theorieLink,
      d.toetsBestand ?? bestaand.toetsBestand,
      d.periode ?? bestaand.periode,
      d.afgevinkt !== undefined ? (d.afgevinkt ? 1 : 0) : bestaand.afgevinkt,
      d.afgevinktDoor ?? bestaand.afgevinktDoor,
      d.afgevinktOp ?? bestaand.afgevinktOp,
      d.opmerking ?? bestaand.opmerking,
      id
    );
  },
  deleteOpdracht(id) { Q.delOpdracht.run(id); },

  // --- LESPROFIELEN ---
  getLesprofielen() {
    return Q.getLesprofielen.all().map(p => ({ ...p, weken: parseJSON(p.weken) }));
  },
  getLesprofiel(id) {
    const p = Q.getLesprofiel.get(id);
    return p ? { ...p, weken: parseJSON(p.weken) } : null;
  },
  addLesprofiel(d) {
    const id = genId();
    Q.insLesprofiel.run(id, d.naam, d.vakId, d.docentId, d.aantalWeken, d.urenPerWeek, d.beschrijving || null, JSON.stringify(d.weken || []));
    return this.getLesprofiel(id);
  },
  updateLesprofiel(id, d) {
    const p = this.getLesprofiel(id);
    if (!p) return;
    Q.updLesprofiel.run(d.naam ?? p.naam, d.vakId ?? p.vakId, d.docentId ?? p.docentId, d.aantalWeken ?? p.aantalWeken, d.urenPerWeek ?? p.urenPerWeek, d.beschrijving ?? p.beschrijving, JSON.stringify(d.weken ?? p.weken), id);
  },
  deleteLesprofiel(id) { Q.delLesprofiel.run(id); },

  // --- STATS ---
  getStats(docentId = null) {
    const klassen = this.getKlassen(docentId);
    const klasIds = klassen.map(k => k.id);
    const alleOpd = this.getOpdrachten();
    const opdrachten = alleOpd.filter(o => klasIds.includes(o.klasId));
    return {
      aantalKlassen: klassen.length,
      aantalOpdrachten: opdrachten.length,
      aantalToetsen: opdrachten.filter(o => o.toetsBestand).length,
      aantalVakken: [...new Set(klassen.map(k => k.vakId))].length,
      aantalSchooljaren: this.getSchooljaren().length,
      aantalLesprofielen: this.getLesprofielen().length,
    };
  }
};
