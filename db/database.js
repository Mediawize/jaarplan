// ============================================================
// db/database.js — SQLite database setup en queries
// NIEUW: lesbrieven tabel toegevoegd
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
db.pragma('wal_autocheckpoint = 100');
db.pragma('busy_timeout = 5000');

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
    niveau TEXT DEFAULT '',
    beschrijving TEXT,
    weken TEXT DEFAULT '[]',
    aangemaakt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vakId) REFERENCES vakken(id),
    FOREIGN KEY (docentId) REFERENCES gebruikers(id)
  );

  CREATE TABLE IF NOT EXISTS lesbrieven (
    id TEXT PRIMARY KEY,
    profielId TEXT NOT NULL,
    weekIdx INTEGER NOT NULL,
    actIdx INTEGER NOT NULL,
    voorbereiding TEXT DEFAULT '',
    benodigdheden TEXT DEFAULT '[]',
    lesverloop TEXT DEFAULT '[]',
    stappenplan TEXT DEFAULT '[]',
    aandachtspunten TEXT DEFAULT '[]',
    differentiatie TEXT DEFAULT '{}',
    opmerkingen TEXT DEFAULT '',
    bijgewerkt TEXT DEFAULT (datetime('now')),
    UNIQUE(profielId, weekIdx, actIdx)
  );

  CREATE TABLE IF NOT EXISTS taken (
    id TEXT PRIMARY KEY,
    naam TEXT NOT NULL,
    beschrijving TEXT,
    deadline TEXT,
    opgepakt TEXT DEFAULT '[]',
    afgerond INTEGER DEFAULT 0,
    afgerondDoor TEXT,
    afgerondOp TEXT,
    aangemaaktDoor TEXT,
    aangemaakt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS roosters (
    userId TEXT PRIMARY KEY,
    rooster TEXT DEFAULT '{}',
    bijgewerkt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS school_instellingen (
    sleutel TEXT PRIMARY KEY,
    waarde   TEXT
  );
`);

// ============================================================
// MIGRATIES
// ============================================================
function migreer() {
  const weekCols = db.prepare("PRAGMA table_info(weken)").all().map(c => c.name);
  const klasCols = db.prepare("PRAGMA table_info(klassen)").all().map(c => c.name);
  const userCols = db.prepare("PRAGMA table_info(gebruikers)").all().map(c => c.name);
  const profCols = db.prepare("PRAGMA table_info(lesprofielen)").all().map(c => c.name);

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
  if (!profCols.includes('niveau')) {
    db.exec("ALTER TABLE lesprofielen ADD COLUMN niveau TEXT DEFAULT ''");
    console.log('Migratie: niveau kolom toegevoegd aan lesprofielen');
  }
  if (!klasCols.includes('roulatie')) {
    db.exec("ALTER TABLE klassen ADD COLUMN roulatie INTEGER DEFAULT 0");
    console.log('Migratie: roulatie kolom toegevoegd aan klassen');
  }
  if (!klasCols.includes('roulatieBlok')) {
    db.exec("ALTER TABLE klassen ADD COLUMN roulatieBlok INTEGER DEFAULT 5");
    console.log('Migratie: roulatieBlok kolom toegevoegd aan klassen');
  }
  if (!klasCols.includes('roulatieStart')) {
    db.exec("ALTER TABLE klassen ADD COLUMN roulatieStart INTEGER DEFAULT 35");
    console.log('Migratie: roulatieStart kolom toegevoegd aan klassen');
  }
  db.exec("UPDATE klassen SET niveau = '' WHERE niveau IS NULL");
  db.exec("UPDATE lesprofielen SET niveau = '' WHERE niveau IS NULL");

  if (!userCols.includes('mustChangePassword')) {
    db.exec("ALTER TABLE gebruikers ADD COLUMN mustChangePassword INTEGER DEFAULT 0");
    console.log('Migratie: mustChangePassword kolom toegevoegd aan gebruikers');
  }
  if (!userCols.includes('resetToken')) {
    db.exec("ALTER TABLE gebruikers ADD COLUMN resetToken TEXT");
    console.log('Migratie: resetToken kolom toegevoegd aan gebruikers');
  }
  if (!userCols.includes('resetTokenExpiry')) {
    db.exec("ALTER TABLE gebruikers ADD COLUMN resetTokenExpiry TEXT");
    console.log('Migratie: resetTokenExpiry kolom toegevoegd aan gebruikers');
  }

  const instellingenTabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='school_instellingen'").get();
  if (!instellingenTabel) {
    db.exec(`CREATE TABLE school_instellingen (sleutel TEXT PRIMARY KEY, waarde TEXT)`);
    console.log('Migratie: school_instellingen tabel aangemaakt');
  }

  // NIEUW: lesbrieven tabel
  const lesbriefTabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lesbrieven'").get();
  if (!lesbriefTabel) {
    db.exec(`CREATE TABLE lesbrieven (
      id TEXT PRIMARY KEY,
      profielId TEXT NOT NULL,
      weekIdx INTEGER NOT NULL,
      actIdx INTEGER NOT NULL,
      voorbereiding TEXT DEFAULT '',
      benodigdheden TEXT DEFAULT '[]',
      lesverloop TEXT DEFAULT '[]',
      stappenplan TEXT DEFAULT '[]',
      aandachtspunten TEXT DEFAULT '[]',
      differentiatie TEXT DEFAULT '{}',
      opmerkingen TEXT DEFAULT '',
      bijgewerkt TEXT DEFAULT (datetime('now')),
      UNIQUE(profielId, weekIdx, actIdx)
    )`);
    console.log('Migratie: lesbrieven tabel aangemaakt');
  }

  // Activiteit-kolommen toevoegen als ze ontbreken
  const lbKolommen = db.prepare("PRAGMA table_info(lesbrieven)").all().map(k => k.name);
  if (!lbKolommen.includes('activiteitNaam')) {
    db.exec("ALTER TABLE lesbrieven ADD COLUMN activiteitNaam TEXT DEFAULT ''");
    db.exec("ALTER TABLE lesbrieven ADD COLUMN activiteitType TEXT DEFAULT ''");
    db.exec("ALTER TABLE lesbrieven ADD COLUMN activiteitUren REAL DEFAULT 1");
    console.log('Migratie: activiteitNaam/Type/Uren kolommen toegevoegd aan lesbrieven');
  }
}

migreer();

// ============================================================
// HELPERS
// ============================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

function parseJSON(val, fallback = []) {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

// ============================================================
// SEED DATA
// ============================================================
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM gebruikers').get().c;
  if (count > 0) return;
  console.log('Database seeden: eerste beheerder aanmaken...');
  const adminWachtwoord = process.env.ADMIN_INIT_PASSWORD || 'WijzigDitNu!';
  const id = genId();
  db.prepare('INSERT INTO gebruikers (id,naam,achternaam,email,wachtwoord,rol,initialen,vakken,hoofdklassen,mustChangePassword) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, 'Beheerder', '', process.env.ADMIN_EMAIL || 'admin@school.nl', bcrypt.hashSync(adminWachtwoord, 10), 'admin', 'ADM', '[]', '[]', 1);
  console.log('\n========================================');
  console.log('Eerste beheerder aangemaakt:');
  console.log('  E-mail:     ' + (process.env.ADMIN_EMAIL || 'admin@school.nl'));
  console.log('  Wachtwoord: ' + adminWachtwoord);
  console.log('  Wijzig dit wachtwoord direct na eerste login!');
  console.log('========================================\n');
}

// ============================================================
// PREPARED STATEMENTS
// ============================================================
const Q = {
  getGebruikers: db.prepare('SELECT * FROM gebruikers ORDER BY naam'),
  getGebruiker: db.prepare('SELECT * FROM gebruikers WHERE id = ?'),
  getGebruikerByEmail: db.prepare('SELECT * FROM gebruikers WHERE LOWER(email) = LOWER(?)'),
  getGebruikerByResetToken: db.prepare('SELECT * FROM gebruikers WHERE resetToken = ?'),
  insGebruiker: db.prepare('INSERT INTO gebruikers (id,naam,achternaam,email,wachtwoord,rol,initialen,vakken,hoofdklassen,mustChangePassword) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  updGebruiker: db.prepare('UPDATE gebruikers SET naam=?,achternaam=?,email=?,rol=?,initialen=?,vakken=?,hoofdklassen=? WHERE id=?'),
  updGebruikerMetWW: db.prepare('UPDATE gebruikers SET naam=?,achternaam=?,email=?,wachtwoord=?,rol=?,initialen=?,vakken=?,hoofdklassen=?,mustChangePassword=? WHERE id=?'),
  updWachtwoord: db.prepare('UPDATE gebruikers SET wachtwoord=?,mustChangePassword=0,resetToken=NULL,resetTokenExpiry=NULL WHERE id=?'),
  updResetToken: db.prepare('UPDATE gebruikers SET resetToken=?,resetTokenExpiry=? WHERE id=?'),
  delGebruiker: db.prepare('DELETE FROM gebruikers WHERE id=?'),

  getVakken: db.prepare('SELECT * FROM vakken ORDER BY naam'),
  getVak: db.prepare('SELECT * FROM vakken WHERE id=?'),
  insVak: db.prepare('INSERT INTO vakken (id,naam,volledig,kleur) VALUES (?,?,?,?)'),
  updVak: db.prepare('UPDATE vakken SET naam=?,volledig=? WHERE id=?'),
  delVak: db.prepare('DELETE FROM vakken WHERE id=?'),

  getKlassen: db.prepare('SELECT * FROM klassen ORDER BY naam'),
  getKlas: db.prepare('SELECT * FROM klassen WHERE id=?'),
  insKlas: db.prepare('INSERT INTO klassen (id,naam,leerjaar,niveau,vakId,docentId,schooljaar,aantalWeken,urenPerWeek,docenten,roulatie,roulatieBlok,roulatieStart) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  updKlas: db.prepare('UPDATE klassen SET naam=?,leerjaar=?,niveau=?,vakId=?,docentId=?,schooljaar=?,urenPerWeek=?,docenten=?,roulatie=?,roulatieBlok=?,roulatieStart=? WHERE id=?'),
  delKlas: db.prepare('DELETE FROM klassen WHERE id=?'),

  getSchooljaren: db.prepare('SELECT * FROM schooljaren ORDER BY naam'),
  getSchooljaar: db.prepare('SELECT * FROM schooljaren WHERE naam=?'),
  insSchooljaar: db.prepare('INSERT INTO schooljaren (id,naam) VALUES (?,?)'),
  delSchooljaar: db.prepare('DELETE FROM schooljaren WHERE naam=?'),

  getWeken: db.prepare('SELECT * FROM weken WHERE schooljaar=? ORDER BY weeknummer'),
  insWeek: db.prepare('INSERT OR IGNORE INTO weken (id,schooljaar,weeknummer,van,tot,vanISO,totISO,isVakantie,vakantieNaam,thema) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  updWeekThema: db.prepare('UPDATE weken SET thema=? WHERE id=?'),
  updWeekType: db.prepare('UPDATE weken SET weektype=?, isVakantie=?, vakantieNaam=? WHERE id=?'),
  updWeekDagnotities: db.prepare('UPDATE weken SET dagnotities=? WHERE id=?'),
  delWekenVoorSchooljaar: db.prepare('DELETE FROM weken WHERE schooljaar=?'),

  getOpdrachten: db.prepare('SELECT * FROM opdrachten ORDER BY weeknummer'),
  getOpdrachtenByKlas: db.prepare('SELECT * FROM opdrachten WHERE klasId=? ORDER BY weeknummer'),
  getOpdracht: db.prepare('SELECT * FROM opdrachten WHERE id=?'),
  insOpdracht: db.prepare('INSERT INTO opdrachten (id,klasId,naam,beschrijving,syllabuscodes,weken,weeknummer,schooljaar,type,uren,werkboekLink,theorieLink,toetsBestand,periode,profielId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  updOpdracht: db.prepare('UPDATE opdrachten SET naam=?,beschrijving=?,syllabuscodes=?,weken=?,weeknummer=?,type=?,uren=?,werkboekLink=?,theorieLink=?,toetsBestand=?,periode=?,afgevinkt=?,afgevinktDoor=?,afgevinktOp=?,opmerking=? WHERE id=?'),
  delOpdracht: db.prepare('DELETE FROM opdrachten WHERE id=?'),
  delOpdrachtenByKlas: db.prepare('DELETE FROM opdrachten WHERE klasId=?'),

  getLesprofielen: db.prepare('SELECT * FROM lesprofielen ORDER BY naam'),
  getLesprofiel: db.prepare('SELECT * FROM lesprofielen WHERE id=?'),
  insLesprofiel: db.prepare('INSERT INTO lesprofielen (id,naam,vakId,docentId,aantalWeken,urenPerWeek,niveau,beschrijving,weken) VALUES (?,?,?,?,?,?,?,?,?)'),
  updLesprofiel: db.prepare('UPDATE lesprofielen SET naam=?,vakId=?,docentId=?,aantalWeken=?,urenPerWeek=?,niveau=?,beschrijving=?,weken=? WHERE id=?'),
  delLesprofiel: db.prepare('DELETE FROM lesprofielen WHERE id=?'),

  // Lesbrieven
  getLesbrievenByProfiel: db.prepare('SELECT * FROM lesbrieven WHERE profielId=?'),
  getLesbrief: db.prepare('SELECT * FROM lesbrieven WHERE id=?'),
  getLesbrievBySleutel: db.prepare('SELECT * FROM lesbrieven WHERE profielId=? AND weekIdx=? AND actIdx=?'),
  insLesbrief: db.prepare('INSERT INTO lesbrieven (id,profielId,weekIdx,actIdx,activiteitNaam,activiteitType,activiteitUren,voorbereiding,benodigdheden,lesverloop,stappenplan,aandachtspunten,differentiatie,opmerkingen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  updLesbrief: db.prepare("UPDATE lesbrieven SET activiteitNaam=?,activiteitType=?,activiteitUren=?,voorbereiding=?,benodigdheden=?,lesverloop=?,stappenplan=?,aandachtspunten=?,differentiatie=?,opmerkingen=?,bijgewerkt=datetime('now') WHERE id=?"),
  delLesbrief: db.prepare('DELETE FROM lesbrieven WHERE id=?'),

  getTaken: db.prepare('SELECT * FROM taken ORDER BY afgerond ASC, aangemaakt DESC'),
  getTaak: db.prepare('SELECT * FROM taken WHERE id=?'),
  insTaak: db.prepare('INSERT INTO taken (id,naam,beschrijving,deadline,aangemaaktDoor) VALUES (?,?,?,?,?)'),
  updTaak: db.prepare('UPDATE taken SET naam=?,beschrijving=?,deadline=? WHERE id=?'),
  updTaakOpgepakt: db.prepare('UPDATE taken SET opgepakt=? WHERE id=?'),
  updTaakAfgerond: db.prepare('UPDATE taken SET afgerond=?,afgerondDoor=?,afgerondOp=? WHERE id=?'),
  delTaak: db.prepare('DELETE FROM taken WHERE id=?'),

  getRooster: db.prepare('SELECT rooster FROM roosters WHERE userId=?'),
  insRooster: db.prepare('INSERT INTO roosters (userId,rooster) VALUES (?,?)'),
  updRooster: db.prepare("UPDATE roosters SET rooster=?,bijgewerkt=datetime('now') WHERE userId=?"),

  getInstelling: db.prepare('SELECT waarde FROM school_instellingen WHERE sleutel = ?'),
  setInstelling: db.prepare('INSERT OR REPLACE INTO school_instellingen (sleutel, waarde) VALUES (?, ?)'),
};

// ============================================================
// DB API
// ============================================================
module.exports = {
  db,
  genId,
  genToken,
  seedIfEmpty,

  getGebruikers() {
    return Q.getGebruikers.all().map(u => ({
      ...u,
      vakken: parseJSON(u.vakken),
      hoofdklassen: parseJSON(u.hoofdklassen),
      mustChangePassword: !!u.mustChangePassword,
    }));
  },
  getGebruiker(id) {
    const u = Q.getGebruiker.get(id);
    return u ? { ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen), mustChangePassword: !!u.mustChangePassword } : null;
  },
  getGebruikerByEmail(email) {
    const u = Q.getGebruikerByEmail.get(email);
    return u ? { ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen), mustChangePassword: !!u.mustChangePassword } : null;
  },
  getGebruikerByResetToken(token) {
    const u = Q.getGebruikerByResetToken.get(token);
    return u ? { ...u, vakken: parseJSON(u.vakken), hoofdklassen: parseJSON(u.hoofdklassen) } : null;
  },
  addGebruiker({ naam, achternaam, email, wachtwoord, rol, initialen, vakken = [], hoofdklassen = [], mustChangePassword = true }) {
    if (Q.getGebruikerByEmail.get(email)) return { error: 'E-mail bestaat al' };
    const id = genId();
    const hash = bcrypt.hashSync(wachtwoord, 10);
    Q.insGebruiker.run(id, naam, achternaam, email, hash, rol, initialen || null, JSON.stringify(vakken), JSON.stringify(hoofdklassen), mustChangePassword ? 1 : 0);
    return this.getGebruiker(id);
  },
  updateGebruiker(id, d) {
    const u = this.getGebruiker(id);
    if (!u) return;
    if (d.wachtwoord) {
      const hash = bcrypt.hashSync(d.wachtwoord, 10);
      Q.updGebruikerMetWW.run(d.naam ?? u.naam, d.achternaam ?? u.achternaam, d.email ?? u.email, hash, d.rol ?? u.rol, d.initialen ?? u.initialen, JSON.stringify(d.vakken ?? u.vakken), JSON.stringify(d.hoofdklassen ?? u.hoofdklassen), d.mustChangePassword !== undefined ? (d.mustChangePassword ? 1 : 0) : (u.mustChangePassword ? 1 : 0), id);
    } else {
      Q.updGebruiker.run(d.naam ?? u.naam, d.achternaam ?? u.achternaam, d.email ?? u.email, d.rol ?? u.rol, d.initialen ?? u.initialen, JSON.stringify(d.vakken ?? u.vakken), JSON.stringify(d.hoofdklassen ?? u.hoofdklassen), id);
    }
  },
  updateWachtwoord(id, wachtwoord) { Q.updWachtwoord.run(bcrypt.hashSync(wachtwoord, 10), id); },
  setResetToken(id, token, expiry) { Q.updResetToken.run(token, expiry, id); },
  deleteGebruiker(id) { Q.delGebruiker.run(id); },
  checkWachtwoord(hash, plain) { return bcrypt.compareSync(plain, hash); },

  getVakken() { return Q.getVakken.all(); },
  getVak(id) { return Q.getVak.get(id) || null; },
  addVak(d) { const id = genId(); Q.insVak.run(id, d.naam, d.volledig || null, d.kleur || '#2D5A3D'); return Q.getVak.get(id); },
  updateVak(id, d) { const v = Q.getVak.get(id); if (!v) return; Q.updVak.run(d.naam ?? v.naam, d.volledig ?? v.volledig, id); },
  deleteVak(id) { Q.delVak.run(id); },

  getKlas(id) { const k = Q.getKlas.get(id); return k ? { ...k, docenten: parseJSON(k.docenten), niveau: k.niveau || '' } : null; },
  addKlas(d) {
    const id = genId();
    Q.insKlas.run(id, d.naam, d.leerjaar || 1, d.niveau || '', d.vakId || null, d.docentId || null, d.schooljaar || null, d.aantalWeken || 38, d.urenPerWeek || 3, JSON.stringify(d.docenten || []), d.roulatie ? 1 : 0, d.roulatieBlok || 5, d.roulatieStart || 35);
    return this.getKlas(id);
  },
  updateKlas(id, d) {
    const k = this.getKlas(id);
    if (!k) return;
    Q.updKlas.run(d.naam ?? k.naam, d.leerjaar ?? k.leerjaar, d.niveau ?? k.niveau ?? '', d.vakId ?? k.vakId, d.docentId ?? k.docentId, d.schooljaar ?? k.schooljaar, d.urenPerWeek ?? k.urenPerWeek, JSON.stringify(d.docenten ?? k.docenten), d.roulatie !== undefined ? (d.roulatie ? 1 : 0) : k.roulatie, d.roulatieBlok ?? k.roulatieBlok, d.roulatieStart ?? k.roulatieStart, id);
  },
  deleteKlas(id) { Q.delKlas.run(id); },

  getSchooljaren() { return Q.getSchooljaren.all(); },
  heeftSchooljaar(naam) { return !!Q.getSchooljaar.get(naam); },
  addSchooljaar(naam) { const id = genId(); Q.insSchooljaar.run(id, naam); return Q.getSchooljaar.get(naam); },
  deleteSchooljaar(naam) { Q.delSchooljaar.run(naam); },

  getWeken(schooljaar) {
    return Q.getWeken.all(schooljaar).map(w => ({ ...w, isVakantie: !!w.isVakantie, weektype: w.weektype || 'normaal', dagnotities: parseJSON(w.dagnotities) }));
  },
  addWeek(d) {
    Q.insWeek.run(d.id || genId(), d.schooljaar, d.weeknummer, d.van || null, d.tot || null, d.vanISO || null, d.totISO || null, d.isVakantie ? 1 : 0, d.vakantieNaam || null, d.thema || '');
  },
  updateWeekThema(weekId, thema) { Q.updWeekThema.run(thema, weekId); },
  updateWeekType(weekId, weektype, vakantieNaam) { Q.updWeekType.run(weektype, weektype === 'vakantie' ? 1 : 0, vakantieNaam || null, weekId); },
  updateDagnotities(weekId, dagnotities) { Q.updWeekDagnotities.run(JSON.stringify(dagnotities || []), weekId); },
  deleteWekenVoorSchooljaar(schooljaar) { Q.delWekenVoorSchooljaar.run(schooljaar); },

  getOpdrachten(klasId = null) { return klasId ? Q.getOpdrachtenByKlas.all(klasId) : Q.getOpdrachten.all(); },
  getOpdracht(id) { return Q.getOpdracht.get(id) || null; },
  addOpdracht(d) {
    const id = genId();
    Q.insOpdracht.run(id, d.klasId, d.naam, d.beschrijving || null, d.syllabuscodes || null, d.weken || null, d.weeknummer || null, d.schooljaar || null, d.type || 'Opdracht', d.uren || null, d.werkboekLink || null, d.theorieLink || null, d.toetsBestand || null, d.periode || 1, d.profielId || null);
    return Q.getOpdracht.get(id);
  },
  updateOpdracht(id, d) {
    const bestaand = Q.getOpdracht.get(id);
    if (!bestaand) return;
    Q.updOpdracht.run(d.naam ?? bestaand.naam, d.beschrijving ?? bestaand.beschrijving, d.syllabuscodes ?? bestaand.syllabuscodes, d.weken ?? bestaand.weken, d.weeknummer ?? bestaand.weeknummer, d.type ?? bestaand.type, d.uren ?? bestaand.uren, d.werkboekLink ?? bestaand.werkboekLink, d.theorieLink ?? bestaand.theorieLink, d.toetsBestand ?? bestaand.toetsBestand, d.periode ?? bestaand.periode, d.afgevinkt !== undefined ? (d.afgevinkt ? 1 : 0) : bestaand.afgevinkt, d.afgevinktDoor ?? bestaand.afgevinktDoor, d.afgevinktOp ?? bestaand.afgevinktOp, d.opmerking ?? bestaand.opmerking, id);
  },
  deleteOpdracht(id) { Q.delOpdracht.run(id); },
  deleteOpdrachtenByKlas(klasId) { Q.delOpdrachtenByKlas.run(klasId); },

  getLesprofielen() { return Q.getLesprofielen.all().map(p => ({ ...p, weken: parseJSON(p.weken), niveau: p.niveau || '' })); },
  getLesprofiel(id) { const p = Q.getLesprofiel.get(id); return p ? { ...p, weken: parseJSON(p.weken), niveau: p.niveau || '' } : null; },
  addLesprofiel(d) {
    const id = genId();
    Q.insLesprofiel.run(id, d.naam, d.vakId, d.docentId, d.aantalWeken, d.urenPerWeek, d.niveau || '', d.beschrijving || null, JSON.stringify(d.weken || []));
    return this.getLesprofiel(id);
  },
  updateLesprofiel(id, d) {
    const p = this.getLesprofiel(id);
    if (!p) return;
    Q.updLesprofiel.run(d.naam ?? p.naam, d.vakId ?? p.vakId, d.docentId ?? p.docentId, d.aantalWeken ?? p.aantalWeken, d.urenPerWeek ?? p.urenPerWeek, d.niveau ?? p.niveau ?? '', d.beschrijving ?? p.beschrijving, JSON.stringify(d.weken ?? p.weken), id);
  },
  deleteLesprofiel(id) { Q.delLesprofiel.run(id); },

  // ============================================================
  // LESBRIEVEN
  // ============================================================
  _parseLesbrief(lb) {
    return {
      ...lb,
      benodigdheden: parseJSON(lb.benodigdheden, []),
      lesverloop: parseJSON(lb.lesverloop, []),
      stappenplan: parseJSON(lb.stappenplan, []),
      aandachtspunten: parseJSON(lb.aandachtspunten, []),
      differentiatie: parseJSON(lb.differentiatie, {}),
    };
  },
  getLesbrieven(profielId, weekIdx, actIdx) {
    if (profielId && weekIdx != null && actIdx != null) {
      const lb = Q.getLesbrievBySleutel.get(profielId, weekIdx, actIdx);
      return lb ? [this._parseLesbrief(lb)] : [];
    }
    return Q.getLesbrievenByProfiel.all(profielId || '').map(lb => this._parseLesbrief(lb));
  },
  getLesbrief(id) {
    const lb = Q.getLesbrief.get(id);
    return lb ? this._parseLesbrief(lb) : null;
  },
  addLesbrief(d) {
    const id = genId();
    Q.insLesbrief.run(
      id, d.profielId, d.weekIdx, d.actIdx,
      d.activiteitNaam || '', d.activiteitType || '', d.activiteitUren || 1,
      d.voorbereiding || '',
      JSON.stringify(d.benodigdheden || []),
      JSON.stringify(d.lesverloop || []),
      JSON.stringify(d.stappenplan || []),
      JSON.stringify(d.aandachtspunten || []),
      JSON.stringify(d.differentiatie || {}),
      d.opmerkingen || ''
    );
    return this.getLesbrief(id);
  },
  updateLesbrief(id, d) {
    const lb = this.getLesbrief(id);
    if (!lb) return;
    Q.updLesbrief.run(
      d.activiteitNaam ?? lb.activiteitNaam ?? '',
      d.activiteitType ?? lb.activiteitType ?? '',
      d.activiteitUren ?? lb.activiteitUren ?? 1,
      d.voorbereiding ?? lb.voorbereiding,
      JSON.stringify(d.benodigdheden ?? lb.benodigdheden),
      JSON.stringify(d.lesverloop ?? lb.lesverloop),
      JSON.stringify(d.stappenplan ?? lb.stappenplan),
      JSON.stringify(d.aandachtspunten ?? lb.aandachtspunten),
      JSON.stringify(d.differentiatie ?? lb.differentiatie),
      d.opmerkingen ?? lb.opmerkingen,
      id
    );
  },
  deleteLesbrief(id) { Q.delLesbrief.run(id); },

  getTaken() { return Q.getTaken.all().map(t => ({ ...t, opgepakt: parseJSON(t.opgepakt), afgerond: !!t.afgerond })); },
  getTaak(id) { const t = Q.getTaak.get(id); return t ? { ...t, opgepakt: parseJSON(t.opgepakt), afgerond: !!t.afgerond } : null; },
  addTaak(d) {
    const id = genId();
    Q.insTaak.run(id, d.naam, d.beschrijving || null, d.deadline || null, d.aangemaaktDoor || null);
    return this.getTaak(id);
  },
  updateTaak(id, d) { const t = this.getTaak(id); if (!t) return; Q.updTaak.run(d.naam ?? t.naam, d.beschrijving ?? t.beschrijving, d.deadline ?? t.deadline, id); },
  updateTaakOpgepakt(id, opgepakt) { Q.updTaakOpgepakt.run(JSON.stringify(opgepakt), id); },
  updateTaakAfgerond(id, afgerond, userId) { Q.updTaakAfgerond.run(afgerond ? 1 : 0, afgerond ? userId : null, afgerond ? new Date().toISOString() : null, id); },
  deleteTaak(id) { Q.delTaak.run(id); },

  getRooster(userId) { const r = Q.getRooster.get(userId); return r ? parseJSON(r.rooster, {}) : {}; },
  saveRooster(userId, rooster) {
    const bestaand = Q.getRooster.get(userId);
    if (bestaand) { Q.updRooster.run(JSON.stringify(rooster), userId); } else { Q.insRooster.run(userId, JSON.stringify(rooster)); }
  },

  getStats() {
    return {
      aantalKlassen: db.prepare('SELECT COUNT(*) as c FROM klassen').get().c,
      aantalOpdrachten: db.prepare('SELECT COUNT(*) as c FROM opdrachten').get().c,
      aantalToetsen: db.prepare("SELECT COUNT(*) as c FROM opdrachten WHERE toetsBestand IS NOT NULL AND toetsBestand != ''").get().c,
      aantalVakken: db.prepare('SELECT COUNT(*) as c FROM vakken').get().c,
      aantalGebruikers: db.prepare('SELECT COUNT(*) as c FROM gebruikers').get().c,
    };
  },

  getInstelling(sleutel) {
    const row = Q.getInstelling.get(sleutel);
    return row ? row.waarde : null;
  },
  setInstelling(sleutel, waarde) {
    Q.setInstelling.run(sleutel, waarde);
  },

  // ============================================================
  // ALIASSEN — server.js gebruikt deze namen
  // ============================================================

  // Login: controleer email + wachtwoord, geef user terug of null
  verifyWachtwoord(email, wachtwoord) {
    const u = this.getGebruikerByEmail(email);
    if (!u) return null;
    if (!bcrypt.compareSync(wachtwoord, u.wachtwoord)) return null;
    return u;
  },

  // Wachtwoord wijzigen (alias voor updateWachtwoord)
  wijzigWachtwoord(id, wachtwoord) {
    this.updateWachtwoord(id, wachtwoord);
  },

  // Reset token opslaan met 1 uur expiry
  slaResetTokenOp(id, token) {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    this.setResetToken(id, token, expiry);
  },

  // Reset token verifiëren + expiry controleren
  verifieerResetToken(token) {
    const u = this.getGebruikerByResetToken(token);
    if (!u) return null;
    if (u.resetTokenExpiry && new Date(u.resetTokenExpiry) < new Date()) return null;
    return u;
  },

  // getKlassen met optionele vakken-filter (voor docenten)
  getKlassen(vakken = null) {
    const alle = Q.getKlassen.all().map(k => ({ ...k, docenten: parseJSON(k.docenten), niveau: k.niveau || '' }));
    if (!vakken || !vakken.length) return alle;
    return alle.filter(k => vakken.includes(k.vakId));
  },
};
