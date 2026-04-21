// ============================================================
// roulatie.js — hulpfuncties voor roulatieweken (van/tot model)
// roulatieStart = eerste lesweek
// roulatieBlok  = laatste lesweek (hergebruikt veld)
// ============================================================

/**
 * Schoolweken in volgorde: 35, 36, ..., 52, 1, 2, ..., 28
 */
const _schoolWekenVolgorde = [
  ...Array.from({length: 18}, (_, i) => i + 35),
  ...Array.from({length: 28}, (_, i) => i + 1)
];

/**
 * Is weeknummer actief voor een roulatieklas?
 * @param {object} klas
 * @param {number} weeknummer
 * @returns {boolean}
 */
function isRoulatieWeekActief(klas, weeknummer) {
  if (!klas.roulatie) return true;

  const start = klas.roulatieStart;
  const eind = klas.roulatieBlok; // roulatieBlok = eindweek

  if (!start || !eind) return true;

  const startIdx = _schoolWekenVolgorde.indexOf(start);
  const eindIdx  = _schoolWekenVolgorde.indexOf(eind);
  const weekIdx  = _schoolWekenVolgorde.indexOf(weeknummer);

  if (weekIdx === -1) return false;
  return weekIdx >= startIdx && weekIdx <= eindIdx;
}

/**
 * Geeft leesbare omschrijving van het roulatieschema
 */
function getRoulatieLabel(klas) {
  if (!klas.roulatie) return null;
  return `Week ${klas.roulatieStart} – ${klas.roulatieBlok}`;
}
