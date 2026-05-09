// Eenmalig cleanup-script — verwijdert alle lesprofielen en bijbehorende data
// Gebruik: node cleanup-profielen.js
// Of om specifieke profielen te bewaren: pas de 'bewaar' array aan

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data', 'jaarplan.db'));

// ── Toon huidige profielen
const profielen = db.prepare('SELECT id, naam, niveau FROM lesprofielen ORDER BY naam').all();

if (!profielen.length) {
  console.log('Geen lesprofielen gevonden in de database.');
  process.exit(0);
}

console.log('\nHuidige lesprofielen:');
profielen.forEach((p, i) => {
  const lbCount = db.prepare('SELECT COUNT(*) as c FROM lesbrieven WHERE profielId=?').get(p.id).c;
  const opdCount = db.prepare('SELECT COUNT(*) as c FROM opdrachten WHERE profielId=?').get(p.id).c;
  console.log(`  [${i + 1}] ${p.naam}${p.niveau ? ' — ' + p.niveau : ''} (${lbCount} lesbrieven, ${opdCount} opdrachten gekoppeld)`);
});

// ── Verwijder ALLES dat niet meer bestaat in lesprofielen (dangling)
const danglingLb = db.prepare("DELETE FROM lesbrieven WHERE profielId NOT IN (SELECT id FROM lesprofielen)").run();
const danglingOpd = db.prepare("UPDATE opdrachten SET profielId=NULL WHERE profielId IS NOT NULL AND profielId NOT IN (SELECT id FROM lesprofielen)").run();

console.log(`\nOpgeschoond: ${danglingLb.changes} verweesde lesbrieven verwijderd, ${danglingOpd.changes} opdracht-koppelingen gewist.`);
console.log('\nOm een specifiek profiel te verwijderen, run:');
console.log('  node cleanup-profielen.js --verwijder "Naam van het profiel"');

// ── Verwijder profiel bij --verwijder argument
const idx = process.argv.indexOf('--verwijder');
if (idx !== -1) {
  const naam = process.argv[idx + 1];
  if (!naam) { console.log('Geef een profielnaam op.'); process.exit(1); }
  const profiel = profielen.find(p => p.naam.toLowerCase() === naam.toLowerCase());
  if (!profiel) { console.log(`Profiel "${naam}" niet gevonden.`); process.exit(1); }

  const lb = db.prepare('DELETE FROM lesbrieven WHERE profielId=?').run(profiel.id);
  const opd = db.prepare('UPDATE opdrachten SET profielId=NULL WHERE profielId=?').run(profiel.id);
  db.prepare('DELETE FROM lesprofielen WHERE id=?').run(profiel.id);

  console.log(`\nProfiel "${profiel.naam}" verwijderd:`);
  console.log(`  - ${lb.changes} lesbrieven verwijderd`);
  console.log(`  - ${opd.changes} opdracht-koppelingen gewist`);
}

db.close();
