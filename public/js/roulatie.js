// ============================================================
// roulatie.js — gedeelde hulpfuncties voor roulatieklassen
// Wordt geladen voor alle views
// ============================================================

/**
 * Berekent of een weeknummer actief is voor een roulatieklas
 * @param {object} klas - klasobject met roulatie velden
 * @param {number} weeknummer - het weeknummer om te controleren
 * @param {number} totaalWeken - totaal weken in het schooljaar (standaard 38)
 * @returns {boolean}
 */
function isRoulatieWeekActief(klas, weeknummer) {
  if (!klas.roulatie) return true; // Geen roulatie = altijd actief
  const blok = klas.roulatieBlok || 5;
  const start = klas.roulatieStart || 1;
  const totaal = 38;

  // Zet weeknummers om naar een lineaire index (week 35 = 0, week 36 = 1, etc.)
  // Schooljaar loopt van week 35 t/m week 28 (volgende jaar)
  function weekNaarIndex(wn) {
    if (wn >= 35) return wn - 35;
    return wn + (52 - 35) + 1; // weken 1-28 komen na week 52
  }

  const startIdx = weekNaarIndex(start);
  const weekIdx = weekNaarIndex(weeknummer);

  // Verschil in weken (rekening houdend met wrap-around)
  let diff = weekIdx - startIdx;
  if (diff < 0) diff += 53; // wrap around

  // Actief in blokken van 'blok' weken, elke 2*blok weken herhaald
  const positieInCyclus = diff % (blok * 2);
  return positieInCyclus < blok;
}

/**
 * Geeft alle actieve weeknummers voor een roulatieklas in een schooljaar
 */
function getRoulatieActieveWeken(klas, alleWeken) {
  if (!klas.roulatie) return alleWeken.map(w => w.weeknummer);
  return alleWeken
    .filter(w => !w.isVakantie && isRoulatieWeekActief(klas, w.weeknummer))
    .map(w => w.weeknummer);
}

/**
 * Geeft een leesbare omschrijving van het roulatieschema
 */
function getRoulatieLabel(klas) {
  if (!klas.roulatie) return null;
  return `${klas.roulatieBlok || 5} weken aan / ${klas.roulatieBlok || 5} weken af`;
}
