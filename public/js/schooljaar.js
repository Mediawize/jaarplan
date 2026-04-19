// ============================================================
// SCHOOLJAAR.JS — Automatische weekgeneratie voor Noord-Holland VMBO
// ============================================================

const Schooljaar = {

  // Vakanties Noord-Holland regio (regio Noord) per schooljaar
  // Bron: Rijksoverheid schoolvakanties + Noord-Holland specifiek
  vakanties: {
    '2024-2025': [
      { naam: 'Herfstvakantie',   van: '2024-10-19', tot: '2024-10-27' },
      { naam: 'Kerstvakantie',    van: '2024-12-21', tot: '2025-01-05' },
      { naam: 'Voorjaarsvakantie',van: '2025-02-22', tot: '2025-03-02' },
      { naam: 'Paasvakantie',     van: '2025-04-18', tot: '2025-04-21' },
      { naam: 'Meivakantie',      van: '2025-04-26', tot: '2025-05-11' },
      { naam: 'Zomervakantie',    van: '2025-07-12', tot: '2025-08-24' },
    ],
    '2025-2026': [
      { naam: 'Herfstvakantie',   van: '2025-10-18', tot: '2025-10-26' },
      { naam: 'Kerstvakantie',    van: '2025-12-20', tot: '2026-01-04' },
      { naam: 'Voorjaarsvakantie',van: '2026-02-21', tot: '2026-03-01' },
      { naam: 'Paasvakantie',     van: '2026-04-03', tot: '2026-04-06' },
      { naam: 'Meivakantie',      van: '2026-04-25', tot: '2026-05-10' },
      { naam: 'Zomervakantie',    van: '2026-07-11', tot: '2026-08-23' },
    ],
    '2026-2027': [
      { naam: 'Herfstvakantie',   van: '2026-10-17', tot: '2026-10-25' },
      { naam: 'Kerstvakantie',    van: '2026-12-19', tot: '2027-01-03' },
      { naam: 'Voorjaarsvakantie',van: '2027-02-20', tot: '2027-02-28' },
      { naam: 'Paasvakantie',     van: '2027-04-02', tot: '2027-04-05' },
      { naam: 'Meivakantie',      van: '2027-05-01', tot: '2027-05-16' },
      { naam: 'Zomervakantie',    van: '2027-07-10', tot: '2027-08-22' },
    ],
  },

  // Genereer alle schoolweken voor een gegeven schooljaar
  // Schooljaar start week 35/36 (augustus) en eindigt week 26/27 (juli)
  genereerWeken(schooljaarStr) {
    const vakanties = this.vakanties[schooljaarStr];
    if (!vakanties) return [];

    // Parse jaar uit string '2025-2026' → startjaar 2025
    const startJaar = parseInt(schooljaarStr.split('-')[0]);

    // Startdatum: eerste maandag van week 35 van startjaar
    const start = this._eersteSchooldag(startJaar);
    // Einddatum: laatste vrijdag voor zomervakantie volgend jaar
    const zomer = vakanties.find(v => v.naam === 'Zomervakantie');
    const eind = zomer ? new Date(zomer.van) : new Date(startJaar + 1, 6, 15);

    const weken = [];
    let huidigeDatum = new Date(start);

    while (huidigeDatum < eind) {
      const maandag = new Date(huidigeDatum);
      const vrijdag = new Date(huidigeDatum);
      vrijdag.setDate(vrijdag.getDate() + 4);

      const weeknr = this._weekNummer(maandag);
      const vakantie = this._isVakantieweek(maandag, vrijdag, vakanties);

      weken.push({
        id: `week-${schooljaarStr}-${weeknr}-${maandag.getFullYear()}`,
        weeknummer: weeknr,
        van: this._formatDatum(maandag),
        tot: this._formatDatum(vrijdag),
        vanISO: maandag.toISOString().split('T')[0],
        totISO: vrijdag.toISOString().split('T')[0],
        isVakantie: !!vakantie,
        vakantieNaam: vakantie || null,
        thema: '',
        schooljaar: schooljaarStr,
      });

      // Volgende week
      huidigeDatum.setDate(huidigeDatum.getDate() + 7);
    }

    return weken;
  },

  // Eerste schoolmaandag van het schooljaar (week 35 of 36)
  _eersteSchooldag(jaar) {
    // Zoek de maandag van week 35
    const jan1 = new Date(jaar, 0, 1);
    const week35 = new Date(jan1);
    // Bereken maandag van week 35
    const dag1 = jan1.getDay() || 7;
    week35.setDate(jan1.getDate() + (1 - dag1) + (35 - 1) * 7);
    // Zorg dat we op maandag zitten
    const dow = week35.getDay() || 7;
    if (dow !== 1) week35.setDate(week35.getDate() - (dow - 1));
    return week35;
  },

  _weekNummer(datum) {
    const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  _isVakantieweek(maandag, vrijdag, vakanties) {
    for (const v of vakanties) {
      const van = new Date(v.van);
      const tot = new Date(v.tot);
      // Overlap: week begint vóór einde vakantie EN week eindigt ná begin vakantie
      if (maandag <= tot && vrijdag >= van) return v.naam;
    }
    return null;
  },

  _formatDatum(datum) {
    return datum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  },

  beschikbareJaren() {
    return Object.keys(this.vakanties);
  }
};
