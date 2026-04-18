const DB = {
  // ---------- SEED DATA ----------
  seed() {
    if (localStorage.getItem('jp_seeded')) return;

    const users = [
      { id: 'u1', naam: 'Tom', achternaam: 'Nieuweboer', email: 't.nieuweboer@atlascollege.nl', wachtwoord: 'admin123', rol: 'admin', vakken: [] },
      { id: 'u2', naam: 'Jan', achternaam: 'Jansen', email: 'docent@school.nl', wachtwoord: 'docent123', rol: 'docent', vakken: ['v1','v2'] },
      { id: 'u3', naam: 'Fatima', achternaam: 'El Amrani', email: 'felam@school.nl', wachtwoord: 'docent123', rol: 'docent', vakken: ['v1'] },
      { id: 'u4', naam: 'Management', achternaam: 'Viewer', email: 'management@school.nl', wachtwoord: 'mgmt123', rol: 'management', vakken: [] },
    ];

    const vakken = [
      { id: 'v1', naam: 'PIE', volledig: 'Produceren, Installeren & Energie', kleur: '#2D5A3D' },
      { id: 'v2', naam: 'M&O', volledig: 'Management & Organisatie', kleur: '#1A4A7A' },
      { id: 'v3', naam: 'Economie', volledig: 'Economie', kleur: '#C4821A' },
    ];

    const klassen = [
      { id: 'k1', naam: '3 HAVO A', leerjaar: 3, niveau: 'HAVO', vakId: 'v1', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38 },
      { id: 'k2', naam: '3 HAVO B', leerjaar: 3, niveau: 'HAVO', vakId: 'v1', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38 },
      { id: 'k3', naam: '4 VWO A', leerjaar: 4, niveau: 'VWO', vakId: 'v1', docentId: 'u3', schooljaar: '2025-2026', aantalWeken: 38 },
      { id: 'k4', naam: '5 HAVO A', leerjaar: 5, niveau: 'HAVO', vakId: 'v2', docentId: 'u2', schooljaar: '2025-2026', aantalWeken: 38 },
    ];

    const opdrachten = [
      { id: 'o1', klasId: 'k1', naam: 'Introductie PIE & oriëntatie', beschrijving: 'Kennismaking met het vak en beroepsoriëntatie', syllabuscodes: 'PIE-1.1', weken: '36-37', type: 'Theorie', werkboekLink: 'H1 p.4–12', theorieLink: 'https://example.com/theorie/1', toetsBestand: null, periode: 1, actief: false },
      { id: 'o2', klasId: 'k1', naam: 'Ondernemersplan opstellen', beschrijving: 'Individuele opdracht: schrijf een basisondernemersplan', syllabuscodes: 'PIE-1.2, PIE-1.3', weken: '38-39', type: 'Opdracht', werkboekLink: 'H2 opdracht 3', theorieLink: 'https://example.com/canvas', toetsBestand: null, periode: 1, actief: false },
      { id: 'o3', klasId: 'k1', naam: 'Toets periode 1', beschrijving: 'Schriftelijke toets, 60 minuten', syllabuscodes: 'PIE-1.1, PIE-1.2, PIE-1.3', weken: '40', type: 'Toets', werkboekLink: '', theorieLink: '', toetsBestand: 'toets_p1_2025.pdf', periode: 1, actief: false },
      { id: 'o4', klasId: 'k1', naam: 'Businessmodel Canvas', beschrijving: 'Groepsopdracht: ontwikkel een volledig businessmodel', syllabuscodes: 'PIE-2.1', weken: '47-49', type: 'Groepsopdracht', werkboekLink: 'H3 p.20–28', theorieLink: 'https://example.com/bmc', toetsBestand: null, periode: 2, actief: false },
      { id: 'o5', klasId: 'k1', naam: 'Marktonderzoek uitvoeren', beschrijving: 'Voer een eenvoudig marktonderzoek uit voor je product', syllabuscodes: 'PIE-2.2', weken: '50-51', type: 'Opdracht', werkboekLink: 'H3 p.29–36', theorieLink: '', toetsBestand: null, periode: 2, actief: true },
      { id: 'o6', klasId: 'k2', naam: 'Introductie PIE & oriëntatie', beschrijving: 'Kennismaking met het vak', syllabuscodes: 'PIE-1.1', weken: '36-37', type: 'Theorie', werkboekLink: 'H1 p.4–12', theorieLink: '', toetsBestand: null, periode: 1, actief: false },
      { id: 'o7', klasId: 'k3', naam: 'Introductie PIE gevorderd', beschrijving: 'Verdieping in PIE voor VWO niveau', syllabuscodes: 'PIE-1.1, PIE-1.2', weken: '36-38', type: 'Theorie', werkboekLink: 'H1–H2', theorieLink: '', toetsBestand: null, periode: 1, actief: false },
    ];

    this.set('gebruikers', users);
    this.set('vakken', vakken);
    this.set('klassen', klassen);
    this.set('opdrachten', opdrachten);
    localStorage.setItem('jp_seeded', '1');
  },

  // ---------- CRUD HELPERS ----------
  get(key) {
    try { return JSON.parse(localStorage.getItem('jp_' + key) || '[]'); }
    catch { return []; }
  },

  set(key, data) {
    localStorage.setItem('jp_' + key, JSON.stringify(data));
  },

  genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  // ---------- GEBRUIKERS ----------
  getGebruikers() { return this.get('gebruikers'); },

  getGebruiker(id) { return this.getGebruikers().find(u => u.id === id) || null; },

  addGebruiker(data) {
    const users = this.getGebruikers();
    if (users.find(u => u.email === data.email)) return { error: 'E-mail bestaat al' };
    const user = { ...data, id: this.genId() };
    users.push(user);
    this.set('gebruikers', users);
    return user;
  },

  updateGebruiker(id, data) {
    const users = this.getGebruikers().map(u => u.id === id ? { ...u, ...data } : u);
    this.set('gebruikers', users);
  },

  deleteGebruiker(id) {
    this.set('gebruikers', this.getGebruikers().filter(u => u.id !== id));
  },

  // ---------- VAKKEN ----------
  getVakken() { return this.get('vakken'); },

  getVak(id) { return this.getVakken().find(v => v.id === id) || null; },

  addVak(data) {
    const vakken = this.getVakken();
    const vak = { ...data, id: this.genId() };
    vakken.push(vak);
    this.set('vakken', vakken);
    return vak;
  },

  deleteVak(id) {
    this.set('vakken', this.getVakken().filter(v => v.id !== id));
  },

  // ---------- KLASSEN ----------
  getKlassen(docentId = null, vakId = null) {
    let k = this.get('klassen');
    if (docentId) k = k.filter(x => x.docentId === docentId);
    if (vakId) k = k.filter(x => x.vakId === vakId);
    return k;
  },

  getKlas(id) { return this.getKlassen().find(k => k.id === id) || null; },

  addKlas(data) {
    const klassen = this.getKlassen();
    const klas = { ...data, id: this.genId() };
    klassen.push(klas);
    this.set('klassen', klassen);
    return klas;
  },

  updateKlas(id, data) {
    const klassen = this.getKlassen().map(k => k.id === id ? { ...k, ...data } : k);
    this.set('klassen', klassen);
  },

  deleteKlas(id) {
    this.set('klassen', this.getKlassen().filter(k => k.id !== id));
    this.set('opdrachten', this.getOpdrachten().filter(o => o.klasId !== id));
  },

  // ---------- OPDRACHTEN ----------
  getOpdrachten(klasId = null) {
    let o = this.get('opdrachten');
    if (klasId) o = o.filter(x => x.klasId === klasId);
    return o;
  },

  getOpdracht(id) { return this.getOpdrachten().find(o => o.id === id) || null; },

  addOpdracht(data) {
    const list = this.getOpdrachten();
    const item = { ...data, id: this.genId() };
    list.push(item);
    this.set('opdrachten', list);
    return item;
  },

  updateOpdracht(id, data) {
    const list = this.getOpdrachten().map(o => o.id === id ? { ...o, ...data } : o);
    this.set('opdrachten', list);
  },

  deleteOpdracht(id) {
    this.set('opdrachten', this.getOpdrachten().filter(o => o.id !== id));
  },

  // ---------- STATS ----------
  getStats(docentId = null) {
    const klassen = docentId ? this.getKlassen(docentId) : this.getKlassen();
    const klasIds = klassen.map(k => k.id);
    const opdrachten = this.getOpdrachten().filter(o => klasIds.includes(o.klasId));
    const toetsen = opdrachten.filter(o => o.toetsBestand);
    return {
      aantalKlassen: klassen.length,
      aantalOpdrachten: opdrachten.length,
      aantalToetsen: toetsen.length,
      aantalVakken: [...new Set(klassen.map(k => k.vakId))].length,
    };
  }
};

// Init on load
DB.seed();
