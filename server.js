const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db/database');
const { Schooljaar } = require('./db/schooljaar');

const app = express();
const PORT = process.env.PORT || 3001;

// ---- UPLOADS ----
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ---- MIDDLEWARE ----
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(session({
  secret: process.env.SESSION_SECRET || 'jaarplan-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

// ---- AUTH MIDDLEWARE ----
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Niet ingelogd' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.rol !== 'admin') return res.status(403).json({ error: 'Geen toegang' });
  next();
}
function requireCanEdit(req, res, next) {
  if (!req.session.user || (req.session.user.rol !== 'admin' && req.session.user.rol !== 'docent')) {
    return res.status(403).json({ error: 'Geen schrijfrechten' });
  }
  next();
}

// ---- AUTH ----
app.post('/api/login', (req, res) => {
  const { email, wachtwoord } = req.body;
  if (!email || !wachtwoord) return res.status(400).json({ error: 'Vul e-mail en wachtwoord in' });
  const user = db.verifyWachtwoord(email, wachtwoord);
  if (!user) return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  req.session.user = { id: user.id, naam: user.naam + ' ' + user.achternaam, rol: user.rol, email: user.email, vakken: user.vakken || [], initialen: user.initialen };
  res.json({ success: true, user: req.session.user });
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/session', (req, res) => res.json({ user: req.session.user || null }));

// ---- GEBRUIKERS ----
app.get('/api/gebruikers', requireAuth, (req, res) => res.json(db.getGebruikers().map(u => ({ ...u, wachtwoord: undefined }))));
app.post('/api/gebruikers', requireAdmin, (req, res) => { const r = db.addGebruiker(req.body); if (r?.error) return res.status(400).json(r); res.json({ ...r, wachtwoord: undefined }); });
app.put('/api/gebruikers/:id', requireAdmin, (req, res) => { db.updateGebruiker(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/gebruikers/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Kan jezelf niet verwijderen' });
  db.deleteGebruiker(req.params.id); res.json({ success: true });
});

// ---- VAKKEN ----
app.get('/api/vakken', requireAuth, (req, res) => res.json(db.getVakken()));
app.post('/api/vakken', requireAdmin, (req, res) => res.json(db.addVak(req.body)));
app.put('/api/vakken/:id', requireAdmin, (req, res) => { db.updateVak(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/vakken/:id', requireAdmin, (req, res) => { db.deleteVak(req.params.id); res.json({ success: true }); });

// ---- KLASSEN ----
app.get('/api/klassen', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json(db.getKlassen(u.rol === 'docent' ? u.id : null));
});
app.post('/api/klassen', requireCanEdit, (req, res) => res.json(db.addKlas(req.body)));
app.put('/api/klassen/:id', requireCanEdit, (req, res) => { db.updateKlas(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/klassen/:id', requireCanEdit, (req, res) => { db.deleteKlas(req.params.id); res.json({ success: true }); });

// ---- SCHOOLJAREN ----
app.get('/api/schooljaren', requireAuth, (req, res) => res.json(db.getSchooljaren()));
app.post('/api/schooljaren', requireAdmin, (req, res) => {
  const { naam } = req.body;
  if (!naam) return res.status(400).json({ error: 'Naam verplicht' });
  if (db.heeftSchooljaar(naam)) return res.status(400).json({ error: 'Schooljaar bestaat al' });
  const weken = Schooljaar.genereerWeken(naam);
  if (!weken.length) return res.status(400).json({ error: 'Geen vakantiedata voor dit schooljaar' });
  res.json(db.addSchooljaar(naam, weken));
});
app.delete('/api/schooljaren/:naam', requireAdmin, (req, res) => { db.deleteSchooljaar(req.params.naam); res.json({ success: true }); });

// ---- WEKEN ----
app.get('/api/weken/:schooljaar', requireAuth, (req, res) => res.json(db.getWeken(req.params.schooljaar)));
app.put('/api/weken/:weekId/thema', requireCanEdit, (req, res) => { db.updateWeekThema(req.params.weekId, req.body.thema || ''); res.json({ success: true }); });

// ---- OPDRACHTEN ----
app.get('/api/opdrachten', requireAuth, (req, res) => res.json(db.getOpdrachten(req.query.klasId || null)));
app.post('/api/opdrachten', requireCanEdit, (req, res) => res.json(db.addOpdracht(req.body)));
app.put('/api/opdrachten/:id', requireCanEdit, (req, res) => { db.updateOpdracht(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/opdrachten/:id', requireCanEdit, (req, res) => { db.deleteOpdracht(req.params.id); res.json({ success: true }); });

app.post('/api/opdrachten/:id/afvinken', requireCanEdit, (req, res) => {
  const o = db.getOpdracht(req.params.id);
  if (!o) return res.status(404).json({ error: 'Niet gevonden' });
  const user = req.session.user;
  if (user.rol !== 'admin') {
    const klas = db.getKlas(o.klasId);
    if (!klas || !user.vakken.includes(klas.vakId)) return res.status(403).json({ error: 'Niet gekoppeld aan dit vak' });
  }
  if (o.afgevinkt) {
    db.updateOpdracht(o.id, { afgevinkt: false, afgevinktDoor: null, afgevinktOp: null });
  } else {
    db.updateOpdracht(o.id, { afgevinkt: true, afgevinktDoor: user.initialen || user.naam.slice(0,3).toUpperCase(), afgevinktOp: new Date().toISOString() });
  }
  res.json(db.getOpdracht(o.id));
});

app.post('/api/opdrachten/:id/opmerking', requireCanEdit, (req, res) => {
  db.updateOpdracht(req.params.id, { opmerking: req.body.opmerking || null });
  res.json({ success: true });
});

// ---- LESPROFIELEN ----
app.get('/api/lesprofielen', requireAuth, (req, res) => {
  const u = req.session.user;
  let p = db.getLesprofielen();
  if (u.rol === 'docent') p = p.filter(lp => u.vakken.includes(lp.vakId) || lp.docentId === u.id);
  res.json(p);
});
app.post('/api/lesprofielen', requireCanEdit, (req, res) => res.json(db.addLesprofiel({ ...req.body, docentId: req.session.user.id })));
app.put('/api/lesprofielen/:id', requireCanEdit, (req, res) => { db.updateLesprofiel(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/lesprofielen/:id', requireCanEdit, (req, res) => { db.deleteLesprofiel(req.params.id); res.json({ success: true }); });

// ---- STATS ----
app.get('/api/stats', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json(db.getStats(u.rol === 'docent' ? u.id : null));
});

// ---- UPLOAD ----
app.post('/api/upload', requireCanEdit, upload.single('bestand'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
  res.json({ bestandsnaam: req.file.filename, origineel: req.file.originalname });
});

// ---- HEALTH ----
app.get('/health', (req, res) => res.json({ status: 'ok', db: 'sqlite' }));

// ---- START ----

app.listen(PORT, () => {
  console.log(`\nJaarPlan draait op http://localhost:${PORT}`);
  console.log(`Database: data/jaarplan.db\n`);
});
