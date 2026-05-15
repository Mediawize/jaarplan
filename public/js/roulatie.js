const _schoolWekenVolgorde = [
  ...Array.from({length: 18}, (_, i) => i + 35),
  ...Array.from({length: 28}, (_, i) => i + 1)
];

function isRoulatieWeekActief(klas, weeknummer) {
  if (!klas.roulatie) return true;

  const blokken = klas.roulatieBlokken;
  if (blokken && blokken.length > 0) {
    return blokken.some(b => {
      const startIdx = _schoolWekenVolgorde.indexOf(b.startWeek);
      if (startIdx === -1) return false;
      return _schoolWekenVolgorde.slice(startIdx, startIdx + b.aantalWeken).includes(weeknummer);
    });
  }

  // Backwards compat: oud roulatieStart/roulatieBlok (eindweek) model
  const start = klas.roulatieStart;
  const eind = klas.roulatieBlok;
  if (!start || !eind) return true;
  const startIdx = _schoolWekenVolgorde.indexOf(start);
  const eindIdx  = _schoolWekenVolgorde.indexOf(eind);
  const weekIdx  = _schoolWekenVolgorde.indexOf(weeknummer);
  if (weekIdx === -1) return false;
  return weekIdx >= startIdx && weekIdx <= eindIdx;
}

function getRoulatieLabel(klas) {
  if (!klas.roulatie) return null;
  const blokken = klas.roulatieBlokken;
  if (blokken && blokken.length > 0) {
    return `${blokken.length} roulatie${blokken.length !== 1 ? 's' : ''}`;
  }
  return `Week ${klas.roulatieStart} – ${klas.roulatieBlok}`;
}
