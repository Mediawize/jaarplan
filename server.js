// ============================================================
// server.js — JaarPlan API server
// ============================================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./db/database');
const { Schooljaar } = require('./db/schooljaar');
const { analyseSyllabusPdf, generateLesprofielFromPdf, analyseSyllabusText, generateLesprofielFromText } = require('./services/syllabusGenerator');
const { chatJson } = require('./services/aiClient');
let chromium; // lazy-loaded voor duidelijkere foutafhandeling

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WAARSCHUWING: SESSION_SECRET niet ingesteld in .env!');
}
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  WAARSCHUWING: RESEND_API_KEY niet ingesteld — wachtwoord reset e-mails werken niet.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  WAARSCHUWING: ANTHROPIC_API_KEY niet ingesteld — AI generatoren werken niet.');
}

// ---- RESEND e-mail helper ----
async function stuurResetMail(email, naam, token, baseUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY niet ingesteld, e-mail niet verstuurd naar', email);
    return false;
  }
  const resetUrl = `${baseUrl}/reset-wachtwoord?token=${token}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'JaarPlan <noreply@jaarplan.nl>',
      to: email,
      subject: 'Wachtwoord opnieuw instellen — JaarPlan',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="font-size:22px;font-weight:700;margin-bottom:8px">JaarPlan</div>
          <p style="font-size:15px;color:#44403C">Hallo ${naam},</p>
          <p style="font-size:14px;color:#44403C;line-height:1.6">
            Er is een verzoek ontvangen om je wachtwoord opnieuw in te stellen.
            Klik op de knop hieronder om een nieuw wachtwoord te kiezen.
            Deze link is <strong>1 uur geldig</strong>.
          </p>
          <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#16A34A;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            Wachtwoord instellen
          </a>
          <p style="font-size:12px;color:#78716C">
            Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.<br>
            Link werkt niet? Kopieer: ${resetUrl}
          </p>
        </div>
      `,
    }),
  });
  return res.ok;
}

// ---- RATE LIMITERS ----
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Te veel inlogpogingen. Probeer het over 15 minuten opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Te veel reset-verzoeken. Probeer het later opnieuw.' },
});

// ---- UPLOAD ----
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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Bestand of inhoud is te groot. Verklein afbeeldingen of upload minder grote bestanden.' });
  }
  return next(err);
});

// ---- ROUTES ----
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/reset-wachtwoord', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
const sessionDb = require('better-sqlite3')(path.join(__dirname, 'db', 'sessions.db'));
app.use(session({
  store: new BetterSqlite3Store({ client: sessionDb, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
  secret: process.env.SESSION_SECRET || 'jaarplan-fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

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

// ---- SYLLABUS UPLOAD HELPERS ----
function pickUploadedFile(req) {
  if (req.file) return req.file;
  if (req.files?.bestand?.[0]) return req.files.bestand[0];
  if (req.files?.file?.[0]) return req.files.file[0];
  return null;
}

const syllabusUpload = upload.fields([
  { name: 'bestand', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

const syllabusUploadTokens = new Map();

function createUploadToken() {
  return `syllabus_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupSyllabusUploadToken(token) {
  const item = syllabusUploadTokens.get(token);
  if (item?.filePath && fs.existsSync(item.filePath)) {
    try { fs.unlinkSync(item.filePath); } catch (_) {}
  }
  syllabusUploadTokens.delete(token);
}

setInterval(() => {
  const nu = Date.now();
  for (const [token, info] of syllabusUploadTokens.entries()) {
    if (nu - info.createdAt > 30 * 60 * 1000) {
      cleanupSyllabusUploadToken(token);
    }
  }
}, 10 * 60 * 1000);

// ============================================================
// AUTH
// ============================================================
app.post('/api/login', loginLimiter, (req, res) => {
  const { email, wachtwoord } = req.body;
  if (!email || !wachtwoord) return res.status(400).json({ error: 'Vul e-mail en wachtwoord in' });
  const user = db.verifyWachtwoord(email, wachtwoord);
  if (!user) return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
  req.session.user = {
    id: user.id,
    naam: user.naam + ' ' + user.achternaam,
    rol: user.rol,
    email: user.email,
    vakken: user.vakken || [],
    initialen: user.initialen,
    hoofdklassen: user.hoofdklassen || [],
    mustChangePassword: !!user.mustChangePassword,
  };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const u = db.getGebruiker(req.session.user.id);
  if (u) {
    req.session.user.hoofdklassen = u.hoofdklassen || [];
    req.session.user.vakken = u.vakken || [];
    req.session.user.initialen = u.initialen;
    req.session.user.mustChangePassword = !!u.mustChangePassword;
  }
  res.json({ user: req.session.user || null });
});

app.post('/api/auth/wijzig-wachtwoord', requireAuth, (req, res) => {
  const { huidigWachtwoord, nieuwWachtwoord } = req.body;
  if (!nieuwWachtwoord || nieuwWachtwoord.length < 8) {
    return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens zijn.' });
  }
  const user = db.getGebruiker(req.session.user.id);
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  if (!user.mustChangePassword) {
    const bcryptjs = require('bcryptjs');
    if (!huidigWachtwoord || !bcryptjs.compareSync(huidigWachtwoord, user.wachtwoord)) {
      return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });
    }
  }
  db.wijzigWachtwoord(req.session.user.id, nieuwWachtwoord);
  req.session.user.mustChangePassword = false;
  res.json({ success: true });
});

app.post('/api/auth/wachtwoord-vergeten', resetLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mailadres verplicht' });
  const user = db.getGebruikerByEmail(email);
  if (!user) return res.json({ success: true });
  const token = db.genToken();
  db.slaResetTokenOp(user.id, token);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  await stuurResetMail(user.email, user.naam, token, baseUrl);
  res.json({ success: true });
});

app.post('/api/auth/reset-wachtwoord', resetLimiter, (req, res) => {
  const { token, nieuwWachtwoord } = req.body;
  if (!token || !nieuwWachtwoord) return res.status(400).json({ error: 'Token en wachtwoord verplicht' });
  if (nieuwWachtwoord.length < 8) return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens zijn.' });
  const user = db.verifieerResetToken(token);
  if (!user) return res.status(400).json({ error: 'Ongeldige of verlopen link. Vraag een nieuwe aan.' });
  db.wijzigWachtwoord(user.id, nieuwWachtwoord);
  res.json({ success: true });
});

app.get('/api/auth/check-reset-token/:token', (req, res) => {
  const user = db.verifieerResetToken(req.params.token);
  if (!user) return res.status(400).json({ geldig: false });
  res.json({ geldig: true, naam: user.naam });
});

// ============================================================
// GEBRUIKERS
// ============================================================
app.get('/api/gebruikers', requireAuth, (req, res) => {
  res.json(db.getGebruikers().map(u => ({ ...u, wachtwoord: undefined, resetToken: undefined })));
});
app.post('/api/gebruikers', requireAdmin, (req, res) => {
  const r = db.addGebruiker({ ...req.body, mustChangePassword: true });
  if (r?.error) return res.status(400).json(r);
  res.json({ ...r, wachtwoord: undefined, tijdelijkWachtwoord: req.body.wachtwoord });
});
app.put('/api/gebruikers/:id', requireAdmin, (req, res) => {
  db.updateGebruiker(req.params.id, req.body);
  res.json({ success: true });
});
app.delete('/api/gebruikers/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Kan jezelf niet verwijderen' });
  db.deleteGebruiker(req.params.id);
  res.json({ success: true });
});
app.put('/api/gebruikers/:id/hoofdklassen', requireAuth, (req, res) => {
  const u = req.session.user;
  if (u.id !== req.params.id && u.rol !== 'admin') return res.status(403).json({ error: 'Geen toegang' });
  const gebruiker = db.getGebruiker(req.params.id);
  if (!gebruiker) return res.status(404).json({ error: 'Niet gevonden' });
  db.updateGebruiker(req.params.id, { ...gebruiker, hoofdklassen: req.body.hoofdklassen || [] });
  if (u.id === req.params.id) req.session.user.hoofdklassen = req.body.hoofdklassen || [];
  res.json({ success: true });
});

// ============================================================
// VAKKEN
// ============================================================
app.get('/api/vakken', requireAuth, (req, res) => res.json(db.getVakken()));
app.post('/api/vakken', requireAdmin, (req, res) => res.json(db.addVak(req.body)));
app.put('/api/vakken/:id', requireAdmin, (req, res) => { db.updateVak(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/vakken/:id', requireAdmin, (req, res) => { db.deleteVak(req.params.id); res.json({ success: true }); });

// ============================================================
// KLASSEN
// ============================================================
app.get('/api/klassen', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json(db.getKlassen(u.rol === 'docent' ? u.id : null));
});
app.post('/api/klassen', requireAdmin, (req, res) => res.json(db.addKlas(req.body)));
app.put('/api/klassen/:id', requireCanEdit, (req, res) => { db.updateKlas(req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/klassen/:id', requireCanEdit, (req, res) => { db.deleteKlas(req.params.id); res.json({ success: true }); });

// ============================================================
// SCHOOLJAREN
// ============================================================
app.get('/api/schooljaren', requireAuth, (req, res) => res.json(db.getSchooljaren()));
app.post('/api/schooljaren', requireAdmin, (req, res) => {
  const { naam } = req.body;
  if (!naam) return res.status(400).json({ error: 'Naam verplicht' });
  if (db.heeftSchooljaar(naam)) return res.status(400).json({ error: 'Schooljaar bestaat al' });
  const weken = Schooljaar.genereerWeken(naam);
  if (!weken.length) return res.status(400).json({ error: 'Geen vakantiedata voor dit schooljaar' });
  res.json(db.addSchooljaar(naam, weken));
});
app.delete('/api/schooljaren/:naam', requireAdmin, (req, res) => {
  db.deleteSchooljaar(decodeURIComponent(req.params.naam));
  res.json({ success: true });
});

// ============================================================
// WEKEN
// ============================================================
app.get('/api/weken/:schooljaar', requireAuth, (req, res) => {
  res.json(db.getWeken(decodeURIComponent(req.params.schooljaar)));
});
app.put('/api/weken/:weekId/thema', requireCanEdit, (req, res) => {
  db.updateWeekThema(req.params.weekId, req.body.thema || '');
  res.json({ success: true });
});
app.put('/api/weken/:weekId/type', requireAuth, (req, res) => {
  db.updateWeekType(req.params.weekId, req.body.weektype || 'normaal', req.body.vakantieNaam || null);
  res.json({ success: true });
});
app.put('/api/weken/:weekId/dagnotities', requireAuth, (req, res) => {
  db.updateDagnotities(req.params.weekId, req.body.dagnotities || []);
  res.json({ success: true });
});

// ============================================================
// OPDRACHTEN
// ============================================================
app.get('/api/opdrachten', requireAuth, (req, res) => {
  res.json(db.getOpdrachten(req.query.klasId || null));
});
app.post('/api/opdrachten', requireCanEdit, (req, res) => res.json(db.addOpdracht(req.body)));
app.put('/api/opdrachten/:id', requireCanEdit, (req, res) => {
  db.updateOpdracht(req.params.id, req.body);
  res.json({ success: true });
});
app.delete('/api/opdrachten/:id', requireCanEdit, (req, res) => {
  db.deleteOpdracht(req.params.id);
  res.json({ success: true });
});
app.post('/api/opdrachten/:id/afvinken', requireCanEdit, (req, res) => {
  const o = db.getOpdracht(req.params.id);
  if (!o) return res.status(404).json({ error: 'Niet gevonden' });
  const user = req.session.user;
  if (user.rol !== 'admin') {
    const klas = db.getKlas(o.klasId);
    const vakken = user.vakken || [];
    if (!klas || !vakken.includes(klas.vakId)) {
      return res.status(403).json({ error: 'Niet gekoppeld aan dit vak' });
    }
  }
  if (o.afgevinkt) {
    db.updateOpdracht(o.id, { afgevinkt: false, afgevinktDoor: null, afgevinktOp: null });
  } else {
    db.updateOpdracht(o.id, {
      afgevinkt: true,
      afgevinktDoor: user.initialen || user.naam.slice(0, 3).toUpperCase(),
      afgevinktOp: new Date().toISOString()
    });
  }
  res.json(db.getOpdracht(o.id));
});
app.post('/api/opdrachten/:id/opmerking', requireCanEdit, (req, res) => {
  db.updateOpdracht(req.params.id, { opmerking: req.body.opmerking || null });
  res.json({ success: true });
});

// ============================================================
// LESPROFIELEN
// ============================================================
app.get('/api/lesprofielen', requireAuth, (req, res) => {
  const u = req.session.user;
  const vakken = u.rol === 'docent' ? (u.vakken || []) : null;
  res.json(db.getLesprofielen(vakken));
});
app.post('/api/lesprofielen', requireCanEdit, (req, res) => {
  const r = db.addLesprofiel({ ...req.body, docentId: req.session.user.id });
  res.json(r);
});
app.put('/api/lesprofielen/:id', requireCanEdit, (req, res) => {
  db.updateLesprofiel(req.params.id, req.body);
  res.json({ success: true });
});
app.delete('/api/lesprofielen/:id', requireCanEdit, (req, res) => {
  db.deleteLesprofiel(req.params.id);
  res.json({ success: true });
});

// ============================================================
// TAKEN
// ============================================================
app.get('/api/taken', requireAuth, (req, res) => res.json(db.getTaken()));
app.post('/api/taken', requireCanEdit, (req, res) => {
  res.json(db.addTaak({ ...req.body, aangemaaktDoor: req.session.user.id }));
});
app.put('/api/taken/:id', requireCanEdit, (req, res) => {
  db.updateTaak(req.params.id, req.body);
  res.json({ success: true });
});
app.delete('/api/taken/:id', requireCanEdit, (req, res) => {
  db.deleteTaak(req.params.id);
  res.json({ success: true });
});
app.post('/api/taken/:id/oppakken', requireAuth, (req, res) => {
  const taak = db.getTaak(req.params.id);
  if (!taak) return res.status(404).json({ error: 'niet gevonden' });
  const opgepakt = taak.opgepakt || [];
  const userId = req.session.user.id;
  const idx = opgepakt.indexOf(userId);
  if (idx === -1) { opgepakt.push(userId); } else { opgepakt.splice(idx, 1); }
  db.updateTaakOpgepakt(req.params.id, opgepakt);
  res.json({ ok: true, opgepakt });
});
app.post('/api/taken/:id/afvinken', requireAuth, (req, res) => {
  const taak = db.getTaak(req.params.id);
  if (!taak) return res.status(404).json({ error: 'niet gevonden' });
  db.updateTaakAfgerond(req.params.id, !taak.afgerond, req.session.user.id);
  res.json({ ok: true, afgerond: !taak.afgerond });
});

// ============================================================
// ROOSTER
// ============================================================
app.get('/api/rooster/:userId', requireAuth, (req, res) => {
  try { res.json(db.getRooster(req.params.userId)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/rooster/:userId', requireAuth, (req, res) => {
  if (req.session.user.id !== req.params.userId && req.session.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  try { db.saveRooster(req.params.userId, req.body || {}); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// STATS
// ============================================================
app.get('/api/stats', requireAuth, (req, res) => {
  res.json(db.getStats());
});

// ============================================================
// UPLOAD
// ============================================================
app.post('/api/upload', requireCanEdit, upload.single('bestand'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
  res.json({ bestandsnaam: req.file.filename, origineel: req.file.originalname });
});

app.get('/api/lesprofiel-template', (req, res) => {
  const templatePath = path.join(__dirname, 'public', 'lesprofiel_template.docx');
  if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template niet gevonden' });
  res.download(templatePath, 'lesprofiel_template.docx');
});

app.post('/api/import-lesprofiel', requireCanEdit, upload.single('bestand'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: req.file.path });
    const tekst = result.value;
    const regels = tekst.split('\n').map(r => r.trim()).filter(r => r);
    function vindWaarde(sleutels) {
      for (const sleutel of sleutels) {
        const regel = regels.find(r => r.toLowerCase().startsWith(sleutel.toLowerCase()));
        if (regel) { const val = regel.split(':').slice(1).join(':').trim(); if (val && !val.startsWith('[')) return val; }
      }
      return null;
    }
    const naam = vindWaarde(['naam lesprofiel', 'naam:']);
    const vaknaamRaw = vindWaarde(['vaknaam', 'vak:']);
    const aantalWeken = parseInt(vindWaarde(['aantal weken'])) || 4;
    const urenPerWeek = parseInt(vindWaarde(['uren per week'])) || 3;
    const beschrijving = vindWaarde(['beschrijving']);
    if (!naam) return res.status(400).json({ error: 'Naam lesprofiel niet gevonden.' });
    if (!vaknaamRaw) return res.status(400).json({ error: 'Vaknaam niet gevonden in bestand.' });
    const vakken = db.getVakken();
    const vak = vakken.find(v => v.naam.toLowerCase() === vaknaamRaw.toLowerCase() || (v.volledig && v.volledig.toLowerCase().includes(vaknaamRaw.toLowerCase())) || vaknaamRaw.toLowerCase().includes(v.naam.toLowerCase()));
    if (!vak) return res.status(400).json({ error: `Vak "${vaknaamRaw}" niet gevonden.` });
    const types = ['Theorie', 'Praktijk', 'Toets', 'Presentatie', 'Overig'];
    const weken = [];
    let huidigeWeek = null;
    for (const regel of regels) {
      const weekMatch = regel.match(/^week\s+(\d+)/i);
      if (weekMatch) {
        if (huidigeWeek) weken.push(huidigeWeek);
        huidigeWeek = { weekIndex: parseInt(weekMatch[1]), thema: '', activiteiten: [] };
        const themaMatch = regel.match(/^week\s+\d+\s*[-–]\s*(.+)/i);
        if (themaMatch) huidigeWeek.thema = themaMatch[1].trim();
        continue;
      }
      if (!huidigeWeek) continue;
      if (regel.toLowerCase().startsWith('thema:')) { const val = regel.split(':').slice(1).join(':').trim(); if (val && !val.startsWith('[')) huidigeWeek.thema = val; continue; }
      if (regel.includes('|') || regel.includes('\t')) {
        const delen = regel.split(/[|\t]/).map(d => d.trim()).filter(d => d);
        if (delen.length >= 2) { const type = types.find(t => t.toLowerCase() === delen[0].toLowerCase()); if (type) { huidigeWeek.activiteiten.push({ type, omschrijving: delen[1] || '', syllabus: delen[2] || '', uren: parseFloat(delen[3]) || 1, link: '', bestand: null }); continue; } }
      }
      const typeColon = types.find(t => regel.toLowerCase().startsWith(t.toLowerCase() + ':'));
      if (typeColon) { const omschrijving = regel.split(':').slice(1).join(':').trim(); huidigeWeek.activiteiten.push({ type: typeColon, omschrijving: omschrijving && !omschrijving.startsWith('[') ? omschrijving : '', syllabus: '', uren: 1, link: '', bestand: null }); continue; }
      const losType = types.find(t => regel.toLowerCase() === t.toLowerCase());
      if (losType) huidigeWeek.activiteiten.push({ type: losType, omschrijving: '', syllabus: '', uren: 1, link: '', bestand: null });
    }
    if (huidigeWeek) weken.push(huidigeWeek);
    const wekenArray = Array.from({ length: aantalWeken }, (_, i) => weken.find(w => w.weekIndex === i + 1) || { weekIndex: i + 1, thema: '', activiteiten: [] });
    const profiel = db.addLesprofiel({ naam, vakId: vak.id, docentId: req.session.user.id, aantalWeken, urenPerWeek, beschrijving: beschrijving || '', weken: wekenArray });
    fs.unlinkSync(req.file.path);
    res.json({ success: true, profiel, info: `Profiel "${naam}" aangemaakt met ${wekenArray.length} weken en ${wekenArray.reduce((t, w) => t + w.activiteiten.length, 0)} activiteiten.` });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Fout bij verwerken: ' + e.message });
  }
});

// ============================================================
// SYLLABUS ANALYSE + GENEREER LESPROFIEL
// ============================================================
app.get('/api/analyse-syllabus', requireCanEdit, (req, res) => {
  return res.json({
    success: true,
    message: 'Endpoint actief. Gebruik POST met een PDF-bestand om de syllabus te analyseren.'
  });
});

app.post('/api/analyse-syllabus', requireCanEdit, syllabusUpload, async (req, res) => {
  const file = pickUploadedFile(req);
  try {
    if (!file) {
      return res.status(400).json({ error: 'Geen bestand ontvangen. Kies eerst een syllabus PDF of Word-bestand.' });
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx' && ext !== '.doc') {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Alleen PDF- en Word-bestanden (.pdf, .docx) worden ondersteund.' });
    }

    let analysed;
    if (ext === '.pdf') {
      analysed = await analyseSyllabusPdf(file.path);
    } else {
      const mammoth = require('mammoth');
      const { value: text } = await mammoth.extractRawText({ path: file.path });
      analysed = await analyseSyllabusText(text);
    }

    const uploadToken = createUploadToken();
    syllabusUploadTokens.set(uploadToken, {
      filePath: file.path,
      sourceText: analysed.sourceText || '',
      isDocx: ext !== '.pdf',
      originalname: file.originalname,
      createdAt: Date.now()
    });
    return res.json({
      success: true,
      uploadToken,
      bestand: file.originalname,
      modules: analysed.modules,
      preview: (analysed.sourceText || '').slice(0, 1500)
    });
  } catch (e) {
    console.error('Fout bij /api/analyse-syllabus:', e);
    try { if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    return res.status(500).json({ error: 'Fout bij analyseren van syllabus', details: e.message });
  }
});

app.post('/api/genereer-lesprofiel-uit-syllabus', requireCanEdit, async (req, res) => {
  const { uploadToken, moduleCode, niveau, aantalWeken, urenTheorie, urenPraktijk, naam, vakId } = req.body || {};
  try {
    if (!uploadToken || !moduleCode || !niveau || !aantalWeken || !urenTheorie || !urenPraktijk || !vakId) {
      return res.status(400).json({ error: 'Niet alle verplichte velden zijn ingevuld.' });
    }
    const uploadInfo = syllabusUploadTokens.get(uploadToken);
    if (!uploadInfo || !uploadInfo.filePath || !fs.existsSync(uploadInfo.filePath)) {
      cleanupSyllabusUploadToken(uploadToken);
      return res.status(400).json({ error: 'De geüploade syllabus is niet meer beschikbaar. Analyseer de PDF opnieuw.' });
    }
    const vak = db.getVakken().find(v => v.id === vakId);
    if (!vak) {
      return res.status(404).json({ error: 'Vak niet gevonden.' });
    }
    const opties = {
      moduleCode: String(moduleCode),
      niveau: String(niveau).toUpperCase(),
      aantalWeken: Number(aantalWeken),
      urenTheorie: Number(urenTheorie),
      urenPraktijk: Number(urenPraktijk),
      naam,
      vakId,
      vakCode: vak.naam,
      vakNaam: vak.volledig || vak.naam
    };
    const gegenereerd = uploadInfo.isDocx
      ? await generateLesprofielFromText(uploadInfo.sourceText, opties)
      : await generateLesprofielFromPdf(uploadInfo.filePath, opties);
    const profiel = db.addLesprofiel({
      naam: gegenereerd.naam,
      vakId: vak.id,
      docentId: req.session.user.id,
      aantalWeken: gegenereerd.aantalWeken,
      urenPerWeek: gegenereerd.urenPerWeek,
      beschrijving: gegenereerd.beschrijving || '',
      niveau: gegenereerd.niveau || '',
      weken: gegenereerd.weken || []
    });
    cleanupSyllabusUploadToken(uploadToken);
    return res.json({
      success: true,
      profiel,
      meta: { module: gegenereerd.module, selectie: gegenereerd.selectie || [] }
    });
  } catch (e) {
    console.error('Fout bij /api/genereer-lesprofiel-uit-syllabus:', e);
    if (uploadToken) cleanupSyllabusUploadToken(uploadToken);
    return res.status(500).json({ error: 'Fout bij genereren van lesprofiel uit syllabus', details: e.message });
  }
});

// ============================================================
// LESPROFIEL WIZARD — genereer preview (slaat NIET op in DB)
// Gebruikt syllabus-token als aanwezig, anders pure AI-generatie
// ============================================================
app.post('/api/genereer-lesprofiel-wizard', requireCanEdit, async (req, res) => {
  const {
    naam, vakId, niveau, aantalWeken, urenPerWeek, beschrijving,
    syllabusUploadToken, syllabusModuleCode,
    aiWeekthemas, aiActiviteiten
  } = req.body || {};

  try {
    const vak = db.getVakken().find(v => v.id === vakId);
    const vakNaam = vak ? (vak.volledig || vak.naam) : (naam || 'Techniek');
    const niv = String(niveau || 'BB').toUpperCase();
    const weken = Math.max(1, Number(aantalWeken) || 8);
    const uren = Math.max(1, Number(urenPerWeek) || 3);

    // ── Pad 1: syllabus-gebaseerd ──────────────────────────────
    if (syllabusUploadToken && syllabusModuleCode) {
      const uploadInfo = syllabusUploadTokens.get(syllabusUploadToken);
      if (uploadInfo) {
        const opties = {
          moduleCode: String(syllabusModuleCode),
          niveau: niv,
          aantalWeken: weken,
          urenTheorie: Math.ceil(uren / 2),
          urenPraktijk: Math.floor(uren / 2) || 1,
          naam: naam || undefined,
          vakId,
          vakCode: vak?.naam || '',
          vakNaam
        };
        try {
          const gegenereerd = uploadInfo.isDocx
            ? await generateLesprofielFromText(uploadInfo.sourceText, opties)
            : await generateLesprofielFromPdf(uploadInfo.filePath, opties);

          return res.json({
            success: true,
            profiel: {
              naam: naam || gegenereerd.naam,
              vakId,
              niveau: niv,
              aantalWeken: gegenereerd.aantalWeken,
              urenPerWeek: gegenereerd.urenPerWeek,
              beschrijving: beschrijving || gegenereerd.beschrijving || '',
              weken: gegenereerd.weken || []
            },
            warning: null
          });
        } catch (syllabusErr) {
          // Syllabus leverde niets op — doorvallen naar AI-generatie met waarschuwing
          console.warn('Syllabus generatie mislukt, val terug op AI:', syllabusErr.message);
        }
      }
    }

    // ── Pad 2: AI-generatie op basis van metadata ──────────────
    // (ook als Pad 1 niets opleverde)
    const syllabusNietGebruikt = !!(syllabusUploadToken && syllabusModuleCode);
    const urenTheorie = Math.ceil(uren / 2);
    const urenPraktijk = Math.floor(uren / 2) || 1;

    const prompt = `Je bent een ervaren VMBO/MBO docent die lesplannen opstelt.
Maak een lesprofiel voor: "${naam || vakNaam}", vak "${vakNaam}", niveau ${niv}, ${weken} weken, ${uren} uur/week (${urenTheorie} uur theorie + ${urenPraktijk} uur praktijk).
${beschrijving ? `Onderwerp/context: ${beschrijving}` : ''}

Geef ALLEEN geldige JSON terug in dit formaat:
{
  "weken": [
    {
      "weekIndex": 1,
      "thema": "kort weekthema (3-5 woorden)",
      "activiteiten": [
        { "type": "Theorie", "uren": ${urenTheorie}, "omschrijving": "Concrete omschrijving. Begin met werkwoord.", "syllabus": "", "link": "", "bestand": null },
        { "type": "Praktijk", "uren": ${urenPraktijk}, "omschrijving": "Concrete omschrijving. Begin met werkwoord.", "syllabus": "", "link": "", "bestand": null }
      ]
    }
  ]
}

Regels:
- Genereer precies ${weken} weken
- Elke week heeft 1 Theorie- en 1 Praktijk-activiteit
- Omschrijvingen zijn kort (1 zin), actiegericht en vakspecifiek
- Weekthema's zijn oplopend qua complexiteit
- Schrijf in aanspreekvorm voor de docent`;

    let aiData;
    let warning = syllabusNietGebruikt
      ? 'De geselecteerde module leverde geen activiteiten op in het document. Het lesprofiel is gegenereerd door AI op basis van naam en niveau.'
      : null;
    try {
      aiData = await chatJson({
        system: 'Je schrijft kort, helder en praktisch Nederlands voor VMBO/MBO docenten. Geef altijd alleen geldig JSON terug.',
        user: prompt,
        maxTokens: 3500,
        temperature: 0.3
      });
    } catch (aiErr) {
      const msg = aiErr.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('ANTHROPIC_API_KEY')) {
        warning = 'AI niet beschikbaar — lege weekplanning aangemaakt. Vul zelf de weken in.';
        aiData = { weken: Array.from({ length: weken }, (_, i) => ({ weekIndex: i + 1, thema: `Week ${i + 1}`, activiteiten: [{ type: 'Theorie', uren: urenTheorie, omschrijving: '', syllabus: '', link: '', bestand: null }, { type: 'Praktijk', uren: urenPraktijk, omschrijving: '', syllabus: '', link: '', bestand: null }] })) };
      } else throw aiErr;
    }

    return res.json({
      success: true,
      profiel: {
        naam: naam || vakNaam,
        vakId,
        niveau: niv,
        aantalWeken: (aiData.weken || []).length || weken,
        urenPerWeek: uren,
        beschrijving: beschrijving || '',
        weken: aiData.weken || []
      },
      warning
    });
  } catch (e) {
    console.error('Fout bij /api/genereer-lesprofiel-wizard:', e);
    return res.status(500).json({ error: 'Fout bij genereren van lesprofiel: ' + e.message });
  }
});

// ============================================================
// SCHOOL INSTELLINGEN — logo + naam opslaan / ophalen
// ============================================================
app.get('/api/instellingen', requireAuth, (req, res) => {
  const schoolnaam  = db.getInstelling('schoolnaam')  || '';
  const logoBestand = db.getInstelling('logoBestand') || null;
  res.json({ schoolnaam, logoBestand });
});

// ── AI Wizard endpoints ────────────────────────────────────
app.post('/api/ai/wizard-stap', requireAuth, async (req, res) => {
  try {
    const { type, stapId, systeemPrompt, userPrompt, context } = req.body;
    if (!type || !stapId) return res.status(400).json({ error: 'type en stapId zijn verplicht' });

    const voorkeuren = db.getAiVoorkeuren(type, stapId);
    let fewShotText = '';
    if (voorkeuren.length > 0) {
      fewShotText = '\n\nEERDERE KEUZES VAN DEZE DOCENT (leer hiervan en pas stijl aan):\n';
      voorkeuren.forEach(v => {
        try {
          fewShotText += `Context: ${v.invoer || '{}'}\nGekozen resultaat: ${v.resultaat || '{}'}\n\n`;
        } catch (_) {}
      });
    }

    const data = await chatJson({
      system: (systeemPrompt || '') + fewShotText,
      user: userPrompt || JSON.stringify(context || {}),
      maxTokens: 1200,
      temperature: 0.3,
    });

    res.json({ suggestie: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/wizard-voorkeur', requireAuth, (req, res) => {
  try {
    const { type, stapId, invoer, resultaat } = req.body;
    if (!type || !stapId) return res.status(400).json({ error: 'type en stapId zijn verplicht' });
    db.addAiVoorkeur({
      type,
      stapId,
      invoer: typeof invoer === 'string' ? invoer : JSON.stringify(invoer || {}),
      resultaat: typeof resultaat === 'string' ? resultaat : JSON.stringify(resultaat || {}),
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Analyseer toets uit bestand → JSON structuur (geen .docx)
app.post('/api/analyse-toets', requireCanEdit, upload.single('bestand'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
  try {
    const { vak, niveau, hoofdstuk, documentSoort, aantalVragen } = req.body;
    const nVragen = parseInt(aantalVragen) || 10;
    const inhoud = await extractTekstUitBestand(req.file.path, req.file.originalname);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const inhoudSchoon = inhoud.split('\n')
      .filter(r => !/^[\s\-_=─━═▬*~|•]{3,}$/.test(r.trim()))
      .join('\n');

    const data = await chatJson({
      system: 'Je analyseert lesmateriaal en extraheert de structuur voor een toets in officiële VMBO/HAVO-examenstijl. Geef altijd alleen geldig JSON terug.',
      user: `Analyseer het lesmateriaal en maak de JSON-structuur voor een toets. Geef ALLEEN geldige JSON terug.

JSON-formaat:
{
  "documentSoort": "${documentSoort || 'Toets'}",
  "vak": "${vak || 'Aardrijkskunde'}",
  "niveauLabel": "${niveau || 'VMBO-GL en TL'}",
  "hoofdstuk": "${hoofdstuk || ''}",
  "jaar": "${new Date().getFullYear()}",
  "tijdvak": "tijdvak 1",
  "datum": "",
  "tijd": "13.30 - 15.30 uur",
  "code": "",
  "aantalPaginas": "",
  "secties": [
    {
      "titel": "Thema naam",
      "bronnen": [
        {
          "nummer": 1,
          "ondertitel": "Korte omschrijving",
          "tekst": "Brontekst. Gebruik \\n voor nieuwe regels."
        }
      ],
      "vragen": [
        {
          "type": "open",
          "punten": 2,
          "context": "Lees bron 1.",
          "vraag": "Vraagstelling...",
          "antwoordRegels": 3
        },
        {
          "type": "meerkeuze",
          "punten": 1,
          "context": "Bekijk bron 1.",
          "vraag": "Welke uitspraak is juist?",
          "opties": [
            {"letter": "A", "tekst": "Optie A"},
            {"letter": "B", "tekst": "Optie B"},
            {"letter": "C", "tekst": "Optie C"},
            {"letter": "D", "tekst": "Optie D"}
          ]
        }
      ]
    }
  ]
}

Regels:
- Maak ca. ${nVragen} vragen uit het lesmateriaal
- Haal bronnen direct uit de tekst, verander ze niet
- Mix open en meerkeuze vragen (50/50)
- Als er geen bronnen zijn, gebruik "bronnen": []
- Punten per vraag: 1-6 afhankelijk van complexiteit

Tekst:
${String(inhoudSchoon).slice(0, 18000)}`,
      maxTokens: 3500,
      temperature: 0.2,
    });

    data.documentSoort = data.documentSoort || documentSoort || 'Toets';
    data.vak = data.vak || vak || '';
    data.niveauLabel = data.niveauLabel || niveau || 'VMBO-GL en TL';
    data.hoofdstuk = data.hoofdstuk || hoofdstuk || '';
    // Ensure figuurBase64/figuurType fields exist on each bron
    (data.secties || []).forEach(s => {
      (s.bronnen || []).forEach(b => { b.figuurBase64 = null; b.figuurType = null; });
    });

    res.json({ success: true, data });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    console.error('Analyse toets fout:', e);
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('insufficient');
    res.status(500).json({ error: isQuota ? 'AI_QUOTA' : 'Fout bij analyseren: ' + msg });
  }
});

app.post('/api/admin/cleanup-profielen', requireAdmin, (req, res) => {
  const raw = db.db;
  const lbR = raw.prepare("DELETE FROM lesbrieven WHERE profielId NOT IN (SELECT id FROM lesprofielen)").run();
  const opdR = raw.prepare("UPDATE opdrachten SET profielId=NULL WHERE profielId IS NOT NULL AND profielId NOT IN (SELECT id FROM lesprofielen)").run();
  res.json({ success: true, message: `${lbR.changes} lesbrieven verwijderd, ${opdR.changes} opdracht-koppelingen gewist.` });
});

app.post('/api/instellingen/schoolnaam', requireAdmin, (req, res) => {
  const { schoolnaam } = req.body;
  if (!schoolnaam) return res.status(400).json({ error: 'Schoolnaam verplicht' });
  db.setInstelling('schoolnaam', schoolnaam.trim());
  res.json({ success: true });
});

app.post('/api/instellingen/logo', requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
  if (!allowed.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Alleen PNG, JPG of SVG toegestaan' });
  }
  const oud = db.getInstelling('logoBestand');
  if (oud) {
    const oudPad = path.join(uploadDir, oud);
    if (fs.existsSync(oudPad)) { try { fs.unlinkSync(oudPad); } catch (_) {} }
  }
  db.setInstelling('logoBestand', req.file.filename);
  res.json({ success: true, logoBestand: req.file.filename });
});

// ============================================================
// HELPER: tekst extractie uit Word/PDF/TXT
// ============================================================
async function extractTekstUitBestand(filePath, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.value || result.text || '';
  }
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

// ============================================================
// HELPER: bouw docx in examen-stijl (bronnen, pijltjes, meerkeuze)
// Gebaseerd op VMBO CSE examenopmaak
// ============================================================
async function bouwToetsExamenStijl({ schoolnaam, logoBestand, data }) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
    Table, TableRow, TableCell, WidthType, ShadingType,
    PageNumber, TabStopType, TabStopPosition, PageBreak
  } = require('docx');

  const ZWART  = '000000';
  const GRIJS  = '6B6560';
  const RAND   = '888888';
  const WIT    = 'FFFFFF';
  const LGRIJS = 'F2F2F2';

  // ── Logo laden
  let logoImageRun = null;
  if (logoBestand) {
    const logoPad = path.join(uploadDir, logoBestand);
    if (fs.existsSync(logoPad)) {
      const logoBuffer = fs.readFileSync(logoPad);
      const ext = path.extname(logoBestand).toLowerCase().replace('.', '');
      try {
        logoImageRun = new ImageRun({ data: logoBuffer, transformation: { width: 70, height: 35 },
          type: { png:'png', jpg:'jpg', jpeg:'jpg', svg:'svg' }[ext] || 'png' });
      } catch (_) {}
    }
  }

  // ── Header: schoolnaam links, toetsinfo rechts
  const headerKinderen = [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ZWART, space: 4 } },
    children: logoImageRun
      ? [logoImageRun,
         new TextRun({ text: '\t' + (schoolnaam || ''), font: 'Arial', size: 18, color: GRIJS })]
      : [new TextRun({ text: schoolnaam || '', font: 'Arial', size: 20, bold: true }),
         new TextRun({ text: '\t' + (data.vak || ''), font: 'Arial', size: 18, color: GRIJS })]
  })];

  // ── Footer: codenummer links, paginanummer rechts
  const footerKinderen = [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: RAND, space: 4 } },
    children: [
      new TextRun({ text: data.code || '', font: 'Arial', size: 16, color: GRIJS }),
      new TextRun({ text: '\t', font: 'Arial', size: 16 }),
      new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: GRIJS }),
      new TextRun({ text: ' / ' + (data.aantalPaginas || '?'), font: 'Arial', size: 16, color: GRIJS }),
    ]
  })];

  const k = []; // document-kinderen

  // ══════════════════════════════════════════════════════════
  // TITELPAGINA (examen-stijl: rechts uitlijnen)
  // ══════════════════════════════════════════════════════════
  // Documentsoort (Toets / Tentamen / Examen) rechts boven
  if (data.documentSoort || data.niveauLabel) {
    k.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: data.documentSoort || 'Toets', font: 'Arial', size: 28, bold: true })]
    }));
  }
  // Niveau (bijv. VMBO-GL en TL) rechts, kleiner
  if (data.niveauLabel) {
    k.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 20 },
      children: [new TextRun({ text: data.niveauLabel, font: 'Arial', size: 22 })]
    }));
  }
  k.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: data.jaar || new Date().getFullYear().toString(), font: 'Arial', size: 72, bold: true })]
  }));

  // Vak-balk (zwarte achtergrondkleur)
  const randGeen = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  k.push(new Table({
    width: { size: 9580, type: WidthType.DXA },
    columnWidths: [9580],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: randGeen, bottom: randGeen, left: randGeen, right: randGeen },
      shading: { fill: ZWART, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      width: { size: 9580, type: WidthType.DXA },
      children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: (data.vak || 'Toets').toUpperCase(), font: 'Arial', size: 28, bold: true, color: WIT })]
      })]
    })]})],
  }));

  k.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [] }));

  if (data.hoofdstuk) {
    k.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: data.hoofdstuk, font: 'Arial', size: 22, italics: true })]
    }));
  }

  // Tijdvak / datum info
  if (data.tijdvak) {
    k.push(new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: data.tijdvak, font: 'Arial', size: 22 })]
    }));
  }
  if (data.datum) {
    k.push(new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: data.datum, font: 'Arial', size: 22 })]
    }));
  }
  if (data.tijd) {
    k.push(new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: data.tijd, font: 'Arial', size: 22 })]
    }));
  }

  // Toetsinfo
  k.push(new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: `Dit examen bestaat uit ${data.aantalVragen || '?'} vragen.`, font: 'Arial', size: 22 })]
  }));
  k.push(new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: `Voor dit examen zijn maximaal ${data.maxPunten || '?'} punten te behalen.`, font: 'Arial', size: 22 })]
  }));
  k.push(new Paragraph({
    spacing: { before: 0, after: 400 },
    children: [new TextRun({ text: 'Voor elk vraagnummer staat hoeveel punten met een goed antwoord behaald kunnen worden.', font: 'Arial', size: 22 })]
  }));

  // Naam / Klas / Datum invulvelden
  k.push(new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({ text: 'Naam: ', font: 'Arial', size: 22, bold: true }),
      new TextRun({ text: '_________________________________     ', font: 'Arial', size: 22 }),
      new TextRun({ text: 'Klas: ', font: 'Arial', size: 22, bold: true }),
      new TextRun({ text: '_____________', font: 'Arial', size: 22 }),
    ]
  }));

  // Instructie voor meerkeuze en open vragen
  k.push(new Paragraph({ spacing: { before: 400, after: 0 }, children: [] }));

  k.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'Meerkeuzevragen', font: 'Arial', size: 22, bold: true })]
  }));
  k.push(new Paragraph({
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: 'Schrijf alleen de hoofdletter van het goede antwoord op.', font: 'Arial', size: 22 })]
  }));

  k.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'Open vragen', font: 'Arial', size: 22, bold: true })]
  }));
  k.push(new Paragraph({
    spacing: { before: 0, after: 400 },
    children: [new TextRun({ text: 'Geef niet meer antwoorden (redenen, voorbeelden e.d.) dan er worden gevraagd.', font: 'Arial', size: 22 })]
  }));

  // ══════════════════════════════════════════════════════════
  // SECTIES (thema's met vragen)
  // ══════════════════════════════════════════════════════════
  let vraagTeller = 1;

  for (const sectie of (data.secties || [])) {

    // Sectietitel (thema) — horizontale lijn + vette titel
    if (sectie.titel) {
      k.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 480, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RAND, space: 6 } },
        children: [new TextRun({ text: sectie.titel, font: 'Arial', size: 26, bold: true })]
      }));
    }

    // Bronnen
    for (const bron of (sectie.bronnen || [])) {

      // Bronlabel
      k.push(new Paragraph({
        spacing: { before: 280, after: 60 },
        children: [
          new TextRun({ text: `bron ${bron.nummer}`, font: 'Arial', size: 22, bold: true }),
        ]
      }));
      if (bron.ondertitel) {
        k.push(new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: bron.ondertitel, font: 'Arial', size: 22 })]
        }));
      }

      // Brontekst (ingekaderd) — ruime padding en lucht
      if (bron.tekst) {
        const regels = bron.tekst.split('\n').filter(r => r.trim());
        const bronRand = { style: BorderStyle.SINGLE, size: 6, color: '999999' };
        const randNone = { style: BorderStyle.NONE, size: 0, color: 'auto' };
        for (const [ri, regel] of regels.entries()) {
          k.push(new Paragraph({
            spacing: { before: ri === 0 ? 60 : 0, after: ri === regels.length - 1 ? 60 : 0 },
            indent: { left: 200, right: 200 },
            border: {
              top:    ri === 0 ? bronRand : randNone,
              bottom: ri === regels.length - 1 ? bronRand : randNone,
              left:   bronRand,
              right:  bronRand,
            },
            children: [new TextRun({ text: regel, font: 'Arial', size: 22 })]
          }));
        }
        k.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }));
      }

      // Figuur (afbeelding) bij bron
      if (bron.figuurBase64) {
        try {
          const b64data = bron.figuurBase64.replace(/^data:[^;]+;base64,/, '');
          const imgBuf = Buffer.from(b64data, 'base64');
          const ext = (bron.figuurType || 'image/png').replace('image/', '');
          const typeMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'png' };
          k.push(new Paragraph({
            spacing: { before: 80, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: imgBuf, transformation: { width: 380, height: 280 }, type: typeMap[ext] || 'png' })]
          }));
        } catch (_) {}
      }
    }

    // Vragen
    for (const vraag of (sectie.vragen || [])) {
      const vnr = vraagTeller++;
      const punten = vraag.punten || 1;

      // Kleine spacer als eerste alinea zodat er bij paginabreuk ruimte boven de vraag is
      k.push(new Paragraph({ keepNext: true, spacing: { before: 0, after: 200 }, children: [] }));

      if (vraag.type === 'meerkeuze') {
        k.push(new Paragraph({
          keepNext: true,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: `${punten}p   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: `${vnr}   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: vraag.context || '', font: 'Arial', size: 22 }),
          ]
        }));
        if (vraag.vraag) {
          k.push(new Paragraph({
            keepNext: true,
            spacing: { before: 0, after: 100 },
            indent: { left: 720 },
            children: [new TextRun({ text: vraag.vraag, font: 'Arial', size: 22 })]
          }));
        }
        if (vraag.opties?.length) {
          k.push(new Paragraph({ keepNext: true, spacing: { before: 60, after: 0 }, children: [] }));
          for (const [oi, opt] of vraag.opties.entries()) {
            const isLaatste = oi === vraag.opties.length - 1;
            k.push(new Paragraph({
              keepNext: !isLaatste,
              spacing: { before: 60, after: 60 },
              indent: { left: 720 },
              children: [
                new TextRun({ text: (opt.letter || '') + '   ', font: 'Arial', size: 22, bold: true }),
                new TextRun({ text: opt.tekst || '', font: 'Arial', size: 22 }),
              ]
            }));
          }
        }
        k.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }));

      } else {
        k.push(new Paragraph({
          keepNext: true,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: `${punten}p   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: `${vnr}   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: vraag.context || '', font: 'Arial', size: 22 }),
          ]
        }));
        if (vraag.vraag) {
          const vraagRegels = vraag.vraag.split('\n').filter(r => r.trim());
          for (const [ri, regel] of vraagRegels.entries()) {
            const isDoeHetZo = regel.toLowerCase().startsWith('doe het zo') || regel.startsWith('−');
            k.push(new Paragraph({
              keepNext: true,
              spacing: { before: ri === 0 ? 0 : 40, after: 40 },
              indent: { left: 720 },
              children: [
                ri === 0
                  ? new TextRun({ text: '\u2192  ', font: 'Arial', size: 22, bold: true })
                  : new TextRun({ text: isDoeHetZo ? '\u2212  ' : '   ', font: 'Arial', size: 22 }),
                new TextRun({ text: regel.replace(/^[−\-]\s*/, ''), font: 'Arial', size: 22 })
              ]
            }));
          }
        }
        const antwoordRegels = vraag.antwoordRegels || 3;
        k.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 0 }, children: [] }));
        for (let r = 0; r < antwoordRegels; r++) {
          k.push(new Paragraph({
            keepNext: r < antwoordRegels - 1,
            spacing: { before: 40, after: 40 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'BBBBBB', space: 4 } },
            children: [new TextRun({ text: ' ', font: 'Arial', size: 32 })]
          }));
        }
        k.push(new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }));
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // DOCUMENT OPBOUWEN
  // ══════════════════════════════════════════════════════════
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
        }
      },
      headers: { default: new Header({ children: headerKinderen }) },
      footers: { default: new Footer({ children: footerKinderen }) },
      children: k
    }]
  });

  return Packer.toBuffer(doc);
}



// ============================================================
// TOETS GENERATOR — examen-stijl (bronnen, pijltjes, meerkeuze)
// ============================================================
app.post('/api/genereer-toets', requireCanEdit, upload.single('bestand'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
  try {
    const schoolnaam  = db.getInstelling('schoolnaam')  || '';
    const logoBestand = db.getInstelling('logoBestand') || null;
    const { titel, aantalVragen, vak, niveau, documentSoort } = req.body;
    const nVragen = parseInt(aantalVragen) || 10;
    const maxPunten = nVragen;
    const inhoud = await extractTekstUitBestand(req.file.path, req.file.originalname);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    // Verwijder horizontale lijnen uit de tekst (series van ─ - _ = ═ * etc.)
    const inhoudSchoon = inhoud.split('\n')
      .filter(r => !/^[\s\-_=─━═▬*~|•]{3,}$/.test(r.trim()))
      .join('\n');

    const data = await chatJson({
      system: 'Je maakt toetsen in de stijl van officiële VMBO/HAVO examens voor Nederlandse leerlingen. Geef altijd alleen geldig JSON terug.',
      user: `Maak een toets in examen-stijl op basis van de tekst. Geef ALLEEN geldige JSON terug.

JSON-formaat:
{
  "vak": "${vak || 'Aardrijkskunde'}",
  "niveauLabel": "${niveau || 'VMBO-GL en TL'}",
  "jaar": "${new Date().getFullYear()}",
  "tijdvak": "tijdvak 1",
  "datum": "vrijdag [dag] [maand]",
  "tijd": "13.30 - 15.30 uur",
  "aantalVragen": ${nVragen},
  "maxPunten": ${maxPunten},
  "documentSoort": "${documentSoort || 'Toets'}",
  "code": "GT-0000-a-00-0",
  "aantalPaginas": "10",
  "secties": [
    {
      "titel": "Thema naam (bijv. Weer en klimaat)",
      "bronnen": [
        {
          "nummer": 1,
          "ondertitel": "Korte omschrijving van de bron",
          "tekst": "Tekst van de bron (max 5 zinnen). Gebruik \n voor nieuwe regels."
        }
      ],
      "vragen": [
        {
          "type": "open",
          "punten": 1,
          "context": "Lees bron 1.",
          "vraag": "Leg uit waarom...\nDoe het zo:\n− Kies eerst A of B.\n− Geef daarna een argument voor je keuze.",
          "antwoordRegels": 3
        },
        {
          "type": "meerkeuze",
          "punten": 1,
          "context": "Bekijk bron 1 en lees bron 2.",
          "vraag": "Welke uitspraak is juist?",
          "opties": [
            {"letter": "A", "tekst": "Antwoordoptie A"},
            {"letter": "B", "tekst": "Antwoordoptie B"},
            {"letter": "C", "tekst": "Antwoordoptie C"},
            {"letter": "D", "tekst": "Antwoordoptie D"}
          ]
        }
      ]
    }
  ]
}

Regels:
- Maak precies ${nVragen} vragen verspreid over 2-3 thema-secties
- Mix meerkeuze- en open vragen (50/50 ongeveer)
- Voeg ALLEEN bronnen toe als de tekst concrete leesteksten bevat die leerlingen echt kunnen lezen. Als er geen geschikte bronnen zijn, gebruik dan "bronnen": []
- Open vragen: gebruik pijltje-instructie ("Doe het zo: − ...") bij complexe vragen
- Meerkeuze: altijd 4 opties (A t/m D), soms 6 (A t/m F) bij combinatievragen
- Punten per vraag: 1p voor eenvoudig, 2p voor tweedelige vragen
- Bronnen bevatten alleen echte tekst die al in het document staat, nooit zelf verzinnen
- Als er geen bronnen zijn, laat context leeg ("context": "") in plaats van bronverwijzing

Tekst:
${String(inhoudSchoon).slice(0, 18000)}`,
      maxTokens: 3500,
      temperature: 0.2
    });

    if (titel) data.vak = titel;
    if (documentSoort) data.documentSoort = documentSoort;
    data.maxPunten = data.maxPunten || maxPunten;

    const docxBuffer = await bouwToetsExamenStijl({ schoolnaam, logoBestand, data });
    const bestandsnaam = `toets_${Date.now()}.docx`;
    fs.writeFileSync(path.join(uploadDir, bestandsnaam), docxBuffer);
    const naam = data.vak || titel || 'Toets';
    const mat = db.addMateriaal({ type: 'toets', naam, bestandsnaam, vak: data.vak || '' });
    res.json({ success: true, bestandsnaam, titel: naam, materiaalId: mat?.id });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    console.error('Toets generator fout:', e);
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('insufficient');
    res.status(500).json({ error: isQuota ? 'AI_QUOTA' : 'Fout bij genereren: ' + msg });
  }
});

// ============================================================
// TOETS GENERATOR — handmatig (wizard, geen AI)
// ============================================================
app.post('/api/genereer-toets-handmatig', requireCanEdit, async (req, res) => {
  try {
    const schoolnaam  = db.getInstelling('schoolnaam')  || '';
    const logoBestand = db.getInstelling('logoBestand') || null;
    const data = req.body;
    if (!data || !data.vak) return res.status(400).json({ error: 'Vak is verplicht' });

    data.secties = (data.secties || []).map(s => ({
      ...s,
      vragen: (s.vragen || []).filter(v => v.vraag && v.vraag.trim())
    })).filter(s => s.vragen.length);

    data.aantalVragen = (data.secties || []).reduce((t, s) => t + (s.vragen || []).length, 0);
    data.maxPunten = (data.secties || []).reduce((t, s) => t + (s.vragen || []).reduce((tt, v) => tt + (parseInt(v.punten) || 1), 0), 0);

    const docxBuffer = await bouwToetsExamenStijl({ schoolnaam, logoBestand, data });
    const bestandsnaam = `toets_${Date.now()}.docx`;
    fs.writeFileSync(path.join(uploadDir, bestandsnaam), docxBuffer);
    const naam = data.vak || 'Toets';
    const mat = db.addMateriaal({ type: 'toets', naam, bestandsnaam, vak: data.vak || '' });
    res.json({ success: true, bestandsnaam, titel: naam, materiaalId: mat?.id });
  } catch (e) {
    console.error('Toets handmatig fout:', e);
    res.status(500).json({ error: 'Fout bij aanmaken: ' + e.message });
  }
});

// ============================================================
// PRAKTIJK WERKBOEKJE — standaard layout (Wallmen-stijl)
// ============================================================
async function bouwWerkboekjeDocxVast({ schoolnaam, logoBestand, data }) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
    Table, TableRow, TableCell, WidthType, ShadingType,
    PageNumber, TabStopType, TabStopPosition
  } = require('docx');

  const GROEN = '2D5A3D', GROEN_DIM = 'E8F3EC', GRIJS = 'D1D5DB', TEKST = '44403C', WIT = 'FFFFFF', ROOD = 'B91C1C';
  const RAND = { style: BorderStyle.SINGLE, size: 4, color: GROEN };
  const RAND_DUN = { style: BorderStyle.SINGLE, size: 1, color: GRIJS };
  const RAND_GEEN = { style: BorderStyle.NONE, size: 0, color: 'auto' };

  let logoImageRun = null;
  if (logoBestand) {
    const logoPad = path.join(uploadDir, logoBestand);
    if (fs.existsSync(logoPad)) {
      const logoBuffer = fs.readFileSync(logoPad);
      const ext = path.extname(logoBestand).toLowerCase().replace('.', '');
      try { logoImageRun = new ImageRun({ data: logoBuffer, transformation: { width: 80, height: 40 }, type: { png:'png', jpg:'jpg', jpeg:'jpg', svg:'svg' }[ext] || 'png' }); } catch (_) {}
    }
  }

  const headerKinderen = [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GROEN, space: 6 } },
    children: logoImageRun
      ? [logoImageRun, new TextRun({ text: '\t' + (schoolnaam || ''), font: 'Arial', size: 18, color: TEKST })]
      : [new TextRun({ text: schoolnaam || '', font: 'Arial', size: 20, bold: true, color: GROEN }), new TextRun({ text: '\t' + (data.vak || 'Werkboekje'), font: 'Arial', size: 18, color: TEKST })]
  })];

  const footerKinderen = [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRIJS, space: 4 } },
    children: [new TextRun({ text: data.titel || 'Werkboekje', font: 'Arial', size: 16, color: TEKST }), new TextRun({ text: '\t', font: 'Arial', size: 16 }), new TextRun({ text: 'Pagina ', font: 'Arial', size: 16, color: TEKST }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: TEKST })]
  })];

  const balkTabel = (tekst) => new Table({
    width: { size: 9580, type: WidthType.DXA }, columnWidths: [9580],
    rows: [new TableRow({ children: [new TableCell({ borders: { top: RAND_GEEN, bottom: RAND_GEEN, left: RAND_GEEN, right: RAND_GEEN }, shading: { fill: GROEN, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 200, right: 200 }, width: { size: 9580, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: tekst, font: 'Arial', size: 24, bold: true, color: WIT })] })] })] })]
  });

  const k = [];

  if (data.vak) k.push(new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: data.vak, font: 'Arial', size: 32, bold: true, color: GROEN })] }));
  if (data.profieldeel) k.push(new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: 'Profieldeel:  ' + data.profieldeel, font: 'Arial', size: 24, color: TEKST })] }));
  k.push(new Paragraph({ spacing: { before: 100, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GROEN, space: 6 } }, children: [new TextRun({ text: 'Opdracht ' + (data.opdrachtnummer || '1') + ':  ', font: 'Arial', size: 30, bold: true, color: GROEN }), new TextRun({ text: (data.titel || '').replace('Werkboekje: ', ''), font: 'Arial', size: 30, bold: true, color: '1A3A26' })] }));
  if (data.duur) k.push(new Paragraph({ spacing: { before: 100, after: 200 }, children: [new TextRun({ text: 'Duur van de opdracht:', font: 'Arial', size: 22, bold: true }), new TextRun({ text: '   ' + data.duur, font: 'Arial', size: 22, color: TEKST })] }));
  k.push(new Paragraph({ spacing: { before: 0, after: 60 }, border: { top: RAND_DUN, bottom: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, children: [new TextRun({ text: 'Naam:', bold: true, font: 'Arial', size: 22 }), new TextRun({ text: '  ________________________________     ', font: 'Arial', size: 22 }), new TextRun({ text: 'Klas:', bold: true, font: 'Arial', size: 22 }), new TextRun({ text: '  ____________     ', font: 'Arial', size: 22 }), new TextRun({ text: 'Datum:', bold: true, font: 'Arial', size: 22 }), new TextRun({ text: '  ____________', font: 'Arial', size: 22 })] }));
  k.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));

  if (data.leerdoelen?.length) {
    k.push(balkTabel('Leerdoelen'));
    for (const doel of data.leerdoelen) k.push(new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: '\u2713  ', font: 'Arial', size: 22, bold: true, color: GROEN }), new TextRun({ text: doel, font: 'Arial', size: 22 })] }));
    k.push(new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }));
  }
  if (data.introductie) k.push(new Paragraph({ spacing: { before: 0, after: 360 }, children: [new TextRun({ text: data.introductie, font: 'Arial', size: 22, italics: true, color: TEKST })] }));

  if (data.materiaalstaat?.length) {
    k.push(balkTabel('Materiaalstaat'));
    k.push(new Paragraph({ spacing: { before: 100, after: 0 }, children: [] }));
    const kolW = [540, 580, 2200, 1080, 1080, 900, 3200];
    const kopRij = new TableRow({ tableHeader: true, children: ['Nr.','Aantal','Benaming','Lengte','Breedte','Dikte','Soort hout'].map((t, i) => new TableCell({ borders: { top: RAND, bottom: RAND, left: RAND, right: RAND }, shading: { fill: GROEN_DIM, type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, width: { size: kolW[i], type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Arial', size: 20, bold: true, color: GROEN })] })] })) });
    const dataRijen = data.materiaalstaat.map(r => new TableRow({ children: [String(r.nummer||''), String(r.aantal||''), String(r.benaming||''), String(r.lengte||''), String(r.breedte||''), String(r.dikte||''), String(r.soortHout||'')].map((cel, i) => new TableCell({ borders: { top: RAND_DUN, bottom: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, width: { size: kolW[i], type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: cel, font: 'Arial', size: 20, color: TEKST })] })] })) }));
    k.push(new Table({ width: { size: 9580, type: WidthType.DXA }, columnWidths: kolW, rows: [kopRij, ...dataRijen] }));
    k.push(new Paragraph({ spacing: { before: 360, after: 0 }, children: [] }));
  }

  if (data.veiligheidsregels?.length) {
    k.push(balkTabel('Voorbereiding'));
    k.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: 'In de praktijk is het verplicht om:', font: 'Arial', size: 22, bold: true })] }));
    for (const regel of data.veiligheidsregels) k.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: '\u2022  ', font: 'Arial', size: 22, bold: true, color: GROEN }), new TextRun({ text: regel, font: 'Arial', size: 22 })] }));
    k.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));
  }

  if (data.machines?.length) {
    k.push(balkTabel('Machines en gereedschappen'));
    k.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }));
    const machKolW = [4790, 4790];
    const machRijen = [];
    for (let i = 0; i < data.machines.length; i += 2) {
      machRijen.push(new TableRow({ children: [data.machines[i]||'', data.machines[i+1]||''].map((m, ci) => new TableCell({ borders: { top: RAND_DUN, bottom: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: machKolW[ci], type: WidthType.DXA }, children: [new Paragraph({ children: m ? [new TextRun({ text: '\u2022  ', font: 'Arial', size: 22, bold: true, color: GROEN }), new TextRun({ text: m, font: 'Arial', size: 22, italics: true })] : [] })] })) }));
    }
    k.push(new Table({ width: { size: 9580, type: WidthType.DXA }, columnWidths: machKolW, rows: machRijen }));
    k.push(new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }));
    k.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'Let op: tijdens het gebruik van machines altijd losse kleding vaststeken! Losse haren in een staart of knot! Draag altijd gehoorbescherming.', font: 'Arial', size: 20, bold: true, italics: true, color: ROOD })] }));
    k.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));
  }

  const heeftStappen = (data.secties || []).some(s => (s.stappen || []).length > 0);
  if (heeftStappen) k.push(balkTabel('Stappenplan'));
  for (const [i, sectie] of (data.secties || []).entries()) {
    if (sectie.titel) k.push(new Paragraph({ spacing: { before: 360, after: 140 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GROEN, space: 4 } }, children: [new TextRun({ text: 'Opdracht ' + (i+1) + '  \u2014  ' + sectie.titel, font: 'Arial', size: 28, bold: true, color: GROEN })] }));
    if (sectie.benodigdheden?.length) k.push(new Paragraph({ spacing: { before: 60, after: 100 }, children: [new TextRun({ text: 'Benodigdheden:  ', font: 'Arial', size: 22, bold: true }), new TextRun({ text: sectie.benodigdheden.join('   \u00b7   '), font: 'Arial', size: 22, color: TEKST })] }));

    for (const [j, s] of (sectie.stappen || []).entries()) {
      const stapTekst = (s.stap || '').slice(0, 250);
      const isTekening = s.type === 'tekening';

      if (isTekening) {
        // TEKENING: eigen pagina
        k.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 100 }, children: [new TextRun({ text: 'Stap ' + (j+1) + (stapTekst ? '   ' + stapTekst : ''), font: 'Arial', size: 24, bold: true, color: GROEN })] }));
        if (s.afbeeldingBase64) {
          try {
            const b64data = s.afbeeldingBase64.replace(/^data:[^;]+;base64,/, '');
            const imgBuf = Buffer.from(b64data, 'base64');
            const ext = (s.afbeeldingType || 'image/png').replace('image/', '');
            const typeMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'png' };
            const imgType = typeMap[ext] || 'png';
            k.push(new Paragraph({ spacing: { before: 200, after: 0 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ data: imgBuf, transformation: { width: 480, height: 600 }, type: imgType })] }));
          } catch (_) {
            k.push(new Paragraph({ spacing: { before: 200, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '[ Tekening invoegen ]', font: 'Arial', size: 20, color: 'B0ABA5', italics: true })] }));
          }
        } else {
          // Lege tekenruimte (heel de rest van pagina)
          k.push(new Paragraph({ spacing: { before: 100, after: 0 }, border: { top: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '[ Tekening invoegen ]', font: 'Arial', size: 20, color: 'B0ABA5', italics: true })] }));
          for (let r = 0; r < 28; r++) k.push(new Paragraph({ spacing: { before: 0, after: 0 }, border: { left: RAND_DUN, right: RAND_DUN, ...(r === 27 ? { bottom: RAND_DUN } : {}) }, children: [new TextRun({ text: ' ', font: 'Arial', size: 22 })] }));
        }

      } else {
        // NORMALE STAP: stap-balk + foto naast tekst (2 kolommen) of lege kader
        // Stap header balk
        k.push(new Table({ width: { size: 9580, type: WidthType.DXA }, columnWidths: [9580], rows: [new TableRow({ children: [new TableCell({ borders: { top: RAND_GEEN, bottom: RAND_GEEN, left: RAND_GEEN, right: RAND_GEEN }, shading: { fill: GROEN_DIM, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 180, right: 180 }, width: { size: 9580, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Stap ' + (j+1) + '   ', font: 'Arial', size: 24, bold: true, color: GROEN }), new TextRun({ text: stapTekst, font: 'Arial', size: 22, color: '1A1A1A' })] })] })] })] }));

        if (s.afbeeldingBase64) {
          // Foto aanwezig: afbeelding op vaste hoogte (8 cm breed, 6 cm hoog)
          try {
            const b64data = s.afbeeldingBase64.replace(/^data:[^;]+;base64,/, '');
            const imgBuf = Buffer.from(b64data, 'base64');
            const ext = (s.afbeeldingType || 'image/png').replace('image/', '');
            const typeMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'png' };
            const imgType = typeMap[ext] || 'png';
            k.push(new Paragraph({ spacing: { before: 60, after: 160 }, alignment: AlignmentType.LEFT, children: [new ImageRun({ data: imgBuf, transformation: { width: 302, height: 226 }, type: imgType })] }));
          } catch (_) {
            // Afbeelding kon niet geladen worden — lege kader
            k.push(new Paragraph({ spacing: { before: 60, after: 0 }, border: { top: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '[ Afbeelding invoegen ]', font: 'Arial', size: 18, color: 'B0ABA5', italics: true })] }));
            for (let r = 0; r < 6; r++) k.push(new Paragraph({ spacing: { before: 0, after: 0 }, border: { left: RAND_DUN, right: RAND_DUN, ...(r === 5 ? { bottom: RAND_DUN } : {}) }, children: [new TextRun({ text: ' ', font: 'Arial', size: 22 })] }));
            k.push(new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }));
          }
        } else {
          // Geen foto: lege kader om zelf in te plakken
          k.push(new Paragraph({ spacing: { before: 60, after: 0 }, border: { top: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '[ Afbeelding invoegen ]', font: 'Arial', size: 18, color: 'B0ABA5', italics: true })] }));
          for (let r = 0; r < 6; r++) k.push(new Paragraph({ spacing: { before: 0, after: 0 }, border: { left: RAND_DUN, right: RAND_DUN, ...(r === 5 ? { bottom: RAND_DUN } : {}) }, children: [new TextRun({ text: ' ', font: 'Arial', size: 22 })] }));
          k.push(new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }));
        }
      }
    }
  }

  const alleStappen = (data.secties || []).flatMap(s => s.stappen || []);
  if (alleStappen.length) {
    k.push(balkTabel('Controlelijst'));
    k.push(new Paragraph({ spacing: { before: 100, after: 80 }, children: [] }));
    for (const [j, s] of alleStappen.entries()) k.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '\u2610  ', font: 'Arial', size: 22 }), new TextRun({ text: 'Stap ' + (j+1) + ': ', font: 'Arial', size: 22, bold: true }), new TextRun({ text: s.stap || '', font: 'Arial', size: 22, color: TEKST })] }));
  }

  const doc = new Document({ styles: { default: { document: { run: { font: 'Arial', size: 22 } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, headers: { default: new Header({ children: headerKinderen }) }, footers: { default: new Footer({ children: footerKinderen }) }, children: k }] });
  return Packer.toBuffer(doc);
}

// ============================================================
// WERKBOEKJE — analyseer upload voor wizard (geen blind opslaan)
// ============================================================
app.post('/api/analyse-werkboekje', requireCanEdit, upload.single('bestand'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
  try {
    const inhoud = await extractTekstUitBestand(req.file.path, req.file.originalname);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const tekst = String(inhoud || '').replace(/\r/g, '').slice(0, 22000);
    if (!tekst.trim()) return res.status(400).json({ error: 'Geen leesbare tekst gevonden in dit bestand' });

    const data = await chatJson({
      system: 'Je analyseert lesmateriaal voor een Nederlands techniek-werkboekje. Geef uitsluitend geldig JSON terug. Geen uitleg buiten JSON.',
      user: `Haal uit onderstaande tekst zoveel mogelijk gegevens voor een werkboekje. Laat velden leeg als je het niet betrouwbaar uit de tekst kunt halen.

JSON-formaat:
{
  "titel": "",
  "vak": "",
  "niveau": "",
  "profieldeel": "",
  "opdrachtnummer": "1",
  "duur": "",
  "introductie": "",
  "leerdoelen": [""],
  "veiligheidsregels": [""],
  "materiaalstaat": [
    { "benaming": "", "aantal": "", "lengte": "", "breedte": "", "dikte": "", "soortHout": "" }
  ],
  "machines": [
    { "naam": "", "omschrijving": "" }
  ],
  "secties": [
    {
      "titel": "",
      "benodigdheden": [""],
      "stappen": [
        { "stap": "", "tip": "", "bijschrift": "" }
      ]
    }
  ]
}

Regels:
- Maak geen kant-en-klaar einddocument, maar een voorstel voor de wizard.
- Haal materiaal, gereedschap, machines, leerdoelen en stappen zoveel mogelijk uit de tekst.
- Schrijf stappen kort, concreet en praktisch voor leerlingen.
- Maximaal 4 leerdoelen, 12 materiaalregels, 12 machines/gereedschappen en 25 stappen totaal.
- Verzin geen exacte maten als die niet in de tekst staan.

Tekst:
${tekst}`,
      maxTokens: 4000,
      temperature: 0.2,
    });

    data.leerdoelen = Array.isArray(data.leerdoelen) ? data.leerdoelen.slice(0, 4) : [];
    data.veiligheidsregels = Array.isArray(data.veiligheidsregels) ? data.veiligheidsregels.slice(0, 8) : [];
    data.materiaalstaat = Array.isArray(data.materiaalstaat) ? data.materiaalstaat.slice(0, 12) : [];
    data.machines = Array.isArray(data.machines) ? data.machines.slice(0, 12) : [];
    data.secties = Array.isArray(data.secties) ? data.secties.slice(0, 4) : [];
    data.secties.forEach(s => { s.stappen = Array.isArray(s.stappen) ? s.stappen.slice(0, 8) : []; });

    res.json({ success: true, data });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('insufficient');
    res.status(500).json({ error: isQuota ? 'AI_QUOTA' : 'Fout bij analyseren: ' + msg });
  }
});

// ============================================================
// WERKBOEKJE GENERATOR — upload met AI (quota fallback)
// ============================================================
app.post('/api/genereer-werkboekje', requireCanEdit, upload.single('bestand'), async (req, res) => {
  return res.status(410).json({
    error: 'Opslaan en downloaden van werkboekjes is tijdelijk uitgezet.'
  });
});

// ============================================================
// WERKBOEKJE GENERATOR — handmatig (wizard, geen AI)
// ============================================================
app.post('/api/genereer-werkboekje-handmatig', requireCanEdit, async (req, res) => {
  return res.status(410).json({
    error: 'Opslaan en downloaden van werkboekjes is tijdelijk uitgezet.'
  });
});


// ============================================================
// LESBRIEVEN — CRUD + AI genereren
// ============================================================
app.get('/api/lesbrieven', requireAuth, (req, res) => {
  const { profielId, weekIdx, actIdx } = req.query;
  res.json(db.getLesbrieven(profielId || null, weekIdx != null ? parseInt(weekIdx) : null, actIdx != null ? parseInt(actIdx) : null));
});

app.get('/api/lesbrieven/:id', requireAuth, (req, res) => {
  const lb = db.getLesbrief(req.params.id);
  if (!lb) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(lb);
});

app.post('/api/lesbrieven', requireCanEdit, (req, res) => {
  const lb = db.addLesbrief(req.body);
  res.json(lb);
});

app.put('/api/lesbrieven/:id', requireCanEdit, (req, res) => {
  db.updateLesbrief(req.params.id, req.body);
  res.json({ success: true });
});

app.delete('/api/lesbrieven/:id', requireCanEdit, (req, res) => {
  db.deleteLesbrief(req.params.id);
  res.json({ success: true });
});

// ============================================================
// WERKBOEKJES
// ============================================================
app.get('/api/werkboekjes', requireAuth, (req, res) => {
  try {
    const { profielId, weekIdx, actIdx } = req.query;
    if (profielId && weekIdx != null && actIdx != null) {
      const wb = db.getWerkboekjeBySleutel(profielId, parseInt(weekIdx), parseInt(actIdx));
      return res.json(wb ? [wb] : []);
    }
    res.json([]);
  } catch (e) {
    res.status(500).json({ error: 'Fout bij ophalen: ' + e.message });
  }
});

app.post('/api/werkboekjes', requireCanEdit, (req, res) => {
  try {
    const wb = db.addWerkboekje(req.body);
    res.json(wb);
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken: ' + e.message });
  }
});

app.put('/api/werkboekjes/:id', requireCanEdit, (req, res) => {
  try {
    db.updateWerkboekje(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bijwerken: ' + e.message });
  }
});

app.delete('/api/werkboekjes/:id', requireCanEdit, (req, res) => {
  try {
    db.deleteWerkboekje(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Fout bij verwijderen: ' + e.message });
  }
});


// ============================================================
// WERKBOEKJE PDF — Playwright
// Eén bron: de HTML uit wbBouwHtml() wordt gebruikt voor preview,
// downloaden én opslaan als materiaal.
// ============================================================
function veiligeBestandsnaam(naam, fallback = 'werkboekje') {
  const basis = String(naam || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback;
  return basis;
}

async function maakWerkboekjePdfBuffer(html) {
  if (!html || typeof html !== 'string' || html.trim().length < 100) {
    throw new Error('Geen geldige HTML ontvangen voor PDF.');
  }

  if (!chromium) {
    ({ chromium } = require('playwright'));
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'load' });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
  } finally {
    await browser.close();
  }
}
const PLAYWRIGHT_INSTALL_HINT = 'Voer op de server uit: (1) npm install  (2) npx playwright install chromium  (3) npx playwright install-deps chromium';

function stuurPdfFout(res, actie, e) {
  const message = e && e.message ? e.message : String(e || 'Onbekende fout');
  const lower = message.toLowerCase();
  const mistPlaywright =
    lower.includes('playwright') ||
    lower.includes('browser') ||
    lower.includes('executable') ||
    lower.includes('shared librar') ||
    lower.includes('cannot open shared') ||
    lower.includes('no such file');

  return res.status(500).json({
    error: `PDF ${actie} mislukt: ${message}`,
    hint: mistPlaywright
      ? PLAYWRIGHT_INSTALL_HINT
      : undefined
  });
}













app.post('/api/werkboekjes/pdf-download', requireCanEdit, async (req, res) => {
  try {
    const { html, titel } = req.body || {};
    const pdfBuffer = await maakWerkboekjePdfBuffer(html);
    const bestandsnaam = `${veiligeBestandsnaam(titel || 'werkboekje')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${bestandsnaam}"`);
    res.send(pdfBuffer);
  } catch (e) {
    stuurPdfFout(res, 'download', e);
  }
});

app.post('/api/werkboekjes/pdf-materiaal', requireCanEdit, async (req, res) => {
  try {
    const { html, titel, vak } = req.body || {};
    const pdfBuffer = await maakWerkboekjePdfBuffer(html);
    const naam = titel || 'Werkboekje';
    const bestandsnaam = `${veiligeBestandsnaam(naam)}_${Date.now()}.pdf`;
    const pad = path.join(uploadDir, bestandsnaam);
    fs.writeFileSync(pad, pdfBuffer);
    const mat = db.addMateriaal({ type: 'werkboekje', naam, bestandsnaam, vak: vak || '' });
    res.json({
      success: true,
      titel: naam,
      bestandsnaam,
      materiaalId: mat?.id,
      downloadUrl: `/uploads/${bestandsnaam}`
    });
  } catch (e) {
    stuurPdfFout(res, 'opslaan', e);
  }
});

app.post('/api/lesbrieven/genereer', requireCanEdit, async (req, res) => {
  const { activiteitNaam, activiteitType, activiteitUren, profielNaam, weekThema, syllabuscodes } = req.body;
  try {
    const data = await chatJson({
      system: 'Je maakt docentenlesbrieven voor Nederlandse MBO/VMBO docenten. Geef altijd alleen geldig JSON terug.',
      user: `Maak een lesbrief voor een docent op basis van deze activiteit:
- Naam: ${activiteitNaam || 'onbekend'}
- Type: ${activiteitType || 'les'}
- Duur: ${activiteitUren || 1} uur
- Thema: ${weekThema || ''}
- Lesprofiel: ${profielNaam || ''}
- Syllabuscodes: ${syllabuscodes || ''}

Geef ALLEEN geldige JSON terug in dit formaat:
{
  "voorbereiding": "Beschrijf wat de docent moet voorbereiden (materialen, lokaal, apparatuur). Max 3-4 zinnen.",
  "benodigdheden": ["Materiaal 1", "Materiaal 2"],
  "lesverloop": [
    { "fase": "Introductie", "minuten": 10, "beschrijving": "Wat doet de docent in deze fase." },
    { "fase": "Instructie", "minuten": 20, "beschrijving": "Hoe legt de docent de stof uit." },
    { "fase": "Verwerking", "minuten": 30, "beschrijving": "Wat doen leerlingen, wat doet de docent." },
    { "fase": "Afsluiting", "minuten": 5, "beschrijving": "Hoe sluit de docent de les af." }
  ],
  "stappenplan": [
    { "stap": 1, "instructie": "Concrete instructie voor de docent." }
  ],
  "aandachtspunten": ["Veiligheidsaandachtspunt of didactische tip.", "..."],
  "differentiatie": {
    "snel": "Tips voor leerlingen die snel klaar zijn.",
    "langzaam": "Tips voor leerlingen die extra tijd nodig hebben."
  },
  "opmerkingen": ""
}

Regels:
- Lesverloop: tijden moeten optellen tot ${Math.round((activiteitUren || 1) * 60)} minuten
- Max 6 stappen in stappenplan
- Max 4 aandachtspunten
- Schrijf in aanspreekvorm voor de docent (bijv. "Zorg ervoor dat...", "Controleer of...")`,
      maxTokens: 2500,
      temperature: 0.3
    });
    res.json({ success: true, data });
  } catch (e) {
    const msg = e.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('insufficient');
    res.status(500).json({ error: isQuota ? 'AI_QUOTA' : 'Fout bij genereren: ' + msg });
  }
});


// ============================================================
// MATERIALEN BIBLIOTHEEK
// ============================================================
app.get('/api/materialen', requireAuth, (req, res) => {
  const { type } = req.query;
  res.json(db.getMaterialen(type || null));
});

app.delete('/api/materialen/:id', requireCanEdit, (req, res) => {
  const mat = db.getMateriaal(req.params.id);
  if (!mat) return res.status(404).json({ error: 'Niet gevonden' });
  // Verwijder bestand van schijf
  const pad = path.join(uploadDir, mat.bestandsnaam);
  if (fs.existsSync(pad)) { try { fs.unlinkSync(pad); } catch (_) {} }
  db.deleteMateriaal(req.params.id);
  res.json({ success: true });
});

// ============================================================
// LESBRIEF DOCX DOWNLOAD
// ============================================================
async function bouwLesbriefDocx(lb, schoolnaam) {
  const {
    Document, Packer, Paragraph, TextRun,
    Header, Footer, AlignmentType, BorderStyle,
    Table, TableRow, TableCell, WidthType,
    TabStopType, TabStopPosition, PageNumber,
    PageBreak
  } = require('docx');

  const GROEN = '2D5A3D', GROEN_DIM = 'EAF4EE', GRIJS = 'D1D5DB', TEKST = '1F2937', WIT = 'FFFFFF', AMBER = '92400E';
  const CEL_RAND = { style: BorderStyle.SINGLE, size: 1, color: GRIJS };
  const RAND_GEEN = { style: BorderStyle.NONE, size: 0, color: 'auto' };

  // Sectiekop met gekleurde achtergrond + linker accentlijn
  function sectieKop(tekst, paginaBreak = false) {
    return new Paragraph({
      pageBreakBefore: paginaBreak,
      spacing: { before: paginaBreak ? 0 : 400, after: 120 },
      shading: { type: 'clear', fill: GROEN_DIM },
      border: { left: { style: BorderStyle.SINGLE, size: 20, color: GROEN, space: 8 } },
      indent: { left: 120 },
      children: [new TextRun({ text: tekst, font: 'Arial', size: 26, bold: true, color: GROEN })]
    });
  }

  function alinea(tekst, bold = false, kleur = TEKST) {
    return new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text: tekst || '', font: 'Arial', size: 20, bold, color: kleur })]
    });
  }

  function bullet(tekst) {
    return new Paragraph({
      spacing: { before: 60, after: 60 },
      indent: { left: 400, hanging: 240 },
      children: [new TextRun({ text: '•  ' + (tekst || ''), font: 'Arial', size: 20, color: TEKST })]
    });
  }

  function ruimte(voor = 200, na = 0) {
    return new Paragraph({ spacing: { before: voor, after: na }, children: [new TextRun({ text: '' })] });
  }

  const info = lb;
  const children = [];

  // ---- TITELPAGINA BLOK ----
  children.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'Lesbrief', font: 'Arial', size: 52, bold: true, color: GROEN })]
  }));

  const naam = lb.activiteitNaam || '';
  const type = lb.activiteitType || '';
  const uren = lb.activiteitUren || '';
  if (naam || type) {
    children.push(new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        ...(type ? [new TextRun({ text: type + '  —  ', font: 'Arial', size: 22, color: '6B7280' })] : []),
        new TextRun({ text: naam, font: 'Arial', size: 22, bold: true, color: TEKST }),
        ...(uren ? [new TextRun({ text: `   ·   ${uren} uur`, font: 'Arial', size: 22, color: '6B7280' })] : []),
      ]
    }));
  }
  children.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GROEN, space: 8 } },
    children: [new TextRun({ text: '' })]
  }));

  // ---- 1. VOORBEREIDING + BENODIGDHEDEN ----
  if (info.voorbereiding || (info.benodigdheden && info.benodigdheden.length)) {
    children.push(ruimte(320));
    children.push(sectieKop('Voorbereiding'));
    if (info.voorbereiding) {
      children.push(alinea(info.voorbereiding));
    }
    if (info.benodigdheden && info.benodigdheden.length) {
      children.push(ruimte(160));
      children.push(alinea('Benodigdheden', true));
      info.benodigdheden.forEach(b => children.push(bullet(b)));
    }
  }

  // ---- 2. LESVERLOOP (eigen pagina als veel fases) ----
  if (info.lesverloop && info.lesverloop.length) {
    const totaal = info.lesverloop.reduce((t, f) => t + (parseInt(f.minuten) || 0), 0);
    const veelFases = info.lesverloop.length > 4;
    children.push(sectieKop('Lesverloop', veelFases));
    if (!veelFases) children.push(ruimte(0));
    children.push(alinea(`Totaal: ${totaal} minuten`, false, '6B7280'));
    children.push(ruimte(120));

    const tabelRijen = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            shading: { type: 'clear', fill: GROEN },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            borders: { top: RAND_GEEN, bottom: RAND_GEEN, left: RAND_GEEN, right: { style: BorderStyle.SINGLE, size: 1, color: '4B9A61' } },
            children: [new Paragraph({ children: [new TextRun({ text: 'Fase', font: 'Arial', size: 19, bold: true, color: WIT })] })]
          }),
          new TableCell({
            width: { size: 11, type: WidthType.PERCENTAGE },
            shading: { type: 'clear', fill: GROEN },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: { top: RAND_GEEN, bottom: RAND_GEEN, left: RAND_GEEN, right: { style: BorderStyle.SINGLE, size: 1, color: '4B9A61' } },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Min.', font: 'Arial', size: 19, bold: true, color: WIT })] })]
          }),
          new TableCell({
            width: { size: 67, type: WidthType.PERCENTAGE },
            shading: { type: 'clear', fill: GROEN },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            borders: { top: RAND_GEEN, bottom: RAND_GEEN, left: RAND_GEEN, right: RAND_GEEN },
            children: [new Paragraph({ children: [new TextRun({ text: 'Beschrijving', font: 'Arial', size: 19, bold: true, color: WIT })] })]
          }),
        ]
      }),
      ...info.lesverloop.map((f, i) => {
        const RIJ_BG = i % 2 === 0 ? 'F3F9F5' : WIT;
        const onderrand = i < info.lesverloop.length - 1
          ? { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
          : RAND_GEEN;
        return new TableRow({
          children: [
            new TableCell({
              shading: { type: 'clear', fill: RIJ_BG },
              margins: { top: 100, bottom: 100, left: 120, right: 80 },
              borders: { top: RAND_GEEN, bottom: onderrand, left: RAND_GEEN, right: { style: BorderStyle.SINGLE, size: 1, color: GRIJS } },
              children: [new Paragraph({ children: [new TextRun({ text: f.fase || '', font: 'Arial', size: 19, bold: true, color: GROEN })] })]
            }),
            new TableCell({
              shading: { type: 'clear', fill: RIJ_BG },
              margins: { top: 100, bottom: 100, left: 80, right: 80 },
              borders: { top: RAND_GEEN, bottom: onderrand, left: RAND_GEEN, right: { style: BorderStyle.SINGLE, size: 1, color: GRIJS } },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(f.minuten || 0), font: 'Arial', size: 19, color: TEKST })] })]
            }),
            new TableCell({
              shading: { type: 'clear', fill: RIJ_BG },
              margins: { top: 100, bottom: 100, left: 120, right: 80 },
              borders: { top: RAND_GEEN, bottom: onderrand, left: RAND_GEEN, right: RAND_GEEN },
              children: [new Paragraph({ children: [new TextRun({ text: f.beschrijving || '', font: 'Arial', size: 19, color: TEKST })] })]
            }),
          ]
        });
      })
    ];
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tabelRijen }));
  }

  // ---- 3. STAPPENPLAN ----
  if (info.stappenplan && info.stappenplan.length) {
    children.push(sectieKop('Stappenplan'));
    info.stappenplan.forEach((s, i) => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 80 },
        children: [
          new TextRun({ text: `Stap ${i + 1}`, font: 'Arial', size: 20, bold: true, color: GROEN }),
          new TextRun({ text: '   ' + (s.instructie || ''), font: 'Arial', size: 20, color: TEKST }),
        ]
      }));
      if (i < info.stappenplan.length - 1) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'F3F4F6', space: 0 } },
          children: [new TextRun({ text: '' })]
        }));
      }
    });
  }

  // ---- 4. AANDACHTSPUNTEN ----
  if (info.aandachtspunten && info.aandachtspunten.length) {
    children.push(sectieKop('Aandachtspunten'));
    info.aandachtspunten.forEach(p => {
      children.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 200 },
        children: [new TextRun({ text: '! ', font: 'Arial', size: 20, bold: true, color: AMBER }),
                   new TextRun({ text: p || '', font: 'Arial', size: 20, color: AMBER })]
      }));
    });
  }

  // ---- 5. DIFFERENTIATIE ----
  const diff = info.differentiatie;
  if (diff && (diff.snel || diff.langzaam)) {
    children.push(sectieKop('Differentiatie'));
    if (diff.snel) {
      children.push(alinea('Snel klaar', true, '065F46'));
      children.push(new Paragraph({
        spacing: { before: 60, after: 120 },
        indent: { left: 280 },
        children: [new TextRun({ text: diff.snel, font: 'Arial', size: 20, color: TEKST })]
      }));
    }
    if (diff.langzaam) {
      children.push(alinea('Extra tijd nodig', true, AMBER));
      children.push(new Paragraph({
        spacing: { before: 60, after: 120 },
        indent: { left: 280 },
        children: [new TextRun({ text: diff.langzaam, font: 'Arial', size: 20, color: TEKST })]
      }));
    }
  }

  // ---- 6. OPMERKINGEN ----
  if (info.opmerkingen) {
    children.push(sectieKop('Opmerkingen'));
    children.push(alinea(info.opmerkingen));
  }

  const doc = new Document({
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GROEN, space: 6 } },
            spacing: { after: 0 },
            children: [
              new TextRun({ text: schoolnaam || 'JaarPlan', font: 'Arial', size: 18, bold: true, color: GROEN }),
              new TextRun({ text: '\tLesbrief', font: 'Arial', size: 18, color: '9CA3AF' })
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRIJS, space: 6 } },
            children: [
              new TextRun({ text: lb.activiteitNaam || 'Lesbrief', font: 'Arial', size: 16, color: '9CA3AF' }),
              new TextRun({ children: ['\t', new PageNumber()], font: 'Arial', size: 16, color: '9CA3AF' })
            ]
          })]
        })
      },
      properties: {
        page: { margin: { top: 850, bottom: 850, left: 1000, right: 1000 } }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

app.get('/api/lesbrieven/:id/download', requireAuth, async (req, res) => {
  const lb = db.getLesbrief(req.params.id);
  if (!lb) return res.status(404).json({ error: 'Niet gevonden' });
  try {
    const schoolnaam = db.getInstelling('schoolnaam') || '';
    const docxBuffer = await bouwLesbriefDocx(lb, schoolnaam);
    const naam = (lb.activiteit_naam || lb.activiteitNaam || 'lesbrief').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="lesbrief_${naam}.docx"`);
    res.send(docxBuffer);
  } catch (e) {
    console.error('Lesbrief download fout:', e);
    res.status(500).json({ error: 'Fout bij genereren: ' + e.message });
  }
});

// ---- HEALTH ----
app.get('/health', (req, res) => res.json({ status: 'ok', db: 'sqlite' }));

// ---- START ----
db.seedIfEmpty();
app.listen(PORT, () => {
  console.log(`\nJaarPlan draait op http://localhost:${PORT}`);
  console.log(`Database: data/jaarplan.db\n`);
});
