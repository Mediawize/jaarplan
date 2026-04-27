// ============================================================
// server.js — JaarPlan API server
// ============================================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./db/database');
const { Schooljaar } = require('./db/schooljaar');
const { analyseSyllabusPdf, generateLesprofielFromPdf } = require('./services/syllabusGenerator');
const { chatJson } = require('./services/aiClient');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WAARSCHUWING: SESSION_SECRET niet ingesteld in .env!');
}
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  WAARSCHUWING: RESEND_API_KEY niet ingesteld — wachtwoord reset e-mails werken niet.');
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  WAARSCHUWING: OPENAI_API_KEY niet ingesteld — AI generatoren werken niet.');
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
app.use(express.json());

// ---- ROUTES ----
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/reset-wachtwoord', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(session({
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
app.post('/api/klassen', requireCanEdit, (req, res) => res.json(db.addKlas(req.body)));
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
app.get('/api/lesprofielen', requireAuth, (req, res) => res.json(db.getLesprofielen()));
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
      return res.status(400).json({ error: 'Geen PDF ontvangen. Kies eerst een syllabusbestand.' });
    }
    if (!/\.pdf$/i.test(file.originalname || '')) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Alleen PDF-bestanden worden ondersteund bij analyseren.' });
    }
    const analysed = await analyseSyllabusPdf(file.path);
    const uploadToken = createUploadToken();
    syllabusUploadTokens.set(uploadToken, {
      filePath: file.path,
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
    const gegenereerd = await generateLesprofielFromPdf(uploadInfo.filePath, {
      moduleCode: String(moduleCode),
      niveau: String(niveau).toUpperCase(),
      aantalWeken: Number(aantalWeken),
      urenTheorie: Number(urenTheorie),
      urenPraktijk: Number(urenPraktijk),
      naam,
      vakId
    });
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
// SCHOOL INSTELLINGEN — logo + naam opslaan / ophalen
// ============================================================
app.get('/api/instellingen', requireAuth, (req, res) => {
  const schoolnaam  = db.getInstelling('schoolnaam')  || '';
  const logoBestand = db.getInstelling('logoBestand') || null;
  res.json({ schoolnaam, logoBestand });
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
  k.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: data.niveauLabel || 'Toets', font: 'Arial', size: 28, bold: true })]
  }));
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

      // Brontekst (ingekaderd)
      if (bron.tekst) {
        const regels = bron.tekst.split('\n').filter(r => r.trim());
        const bronRand = { style: BorderStyle.SINGLE, size: 4, color: '888888' };
        for (const [ri, regel] of regels.entries()) {
          k.push(new Paragraph({
            spacing: { before: ri === 0 ? 0 : 0, after: 0 },
            border: {
              top:    ri === 0 ? bronRand : { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: ri === regels.length - 1 ? bronRand : { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left:   bronRand,
              right:  bronRand,
            },
            children: [new TextRun({ text: (ri === 0 ? '' : '') + regel, font: 'Arial', size: 22 })]
          }));
        }
        k.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }));
      }
    }

    // Vragen
    for (const vraag of (sectie.vragen || [])) {
      const vnr = vraagTeller++;
      const punten = vraag.punten || 1;

      // Bronnummer-referentie en vraagnummer op één regel
      // Formaat: "1p  5   Lees bron 2.\n   → Vraag..."
      if (vraag.type === 'meerkeuze') {

        // Vraag + bronreferentie
        k.push(new Paragraph({
          spacing: { before: 280, after: 80 },
          children: [
            new TextRun({ text: `${punten}p   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: `${vnr}   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: vraag.context || '', font: 'Arial', size: 22 }),
          ]
        }));

        if (vraag.vraag) {
          k.push(new Paragraph({
            spacing: { before: 0, after: 100 },
            indent: { left: 720 },
            children: [new TextRun({ text: vraag.vraag, font: 'Arial', size: 22 })]
          }));
        }

        // Meerkeuze-opties als tabel (A/B/C/D)
        if (vraag.opties?.length) {
          const kolW = [480, 4550, 480, 4070]; // totaal 9580
          const rijItems = [];
          for (let i = 0; i < vraag.opties.length; i += 2) {
            const optA = vraag.opties[i];
            const optB = vraag.opties[i + 1];
            const randDun = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
            const randNone = { style: BorderStyle.NONE, size: 0, color: 'auto' };
            rijItems.push(new TableRow({
              children: [
                new TableCell({
                  borders: { top: randNone, bottom: randNone, left: randNone, right: randNone },
                  width: { size: 480, type: WidthType.DXA },
                  margins: { top: 60, bottom: 60, left: 80, right: 40 },
                  children: [new Paragraph({ children: [new TextRun({ text: optA?.letter || '', font: 'Arial', size: 22, bold: true })] })]
                }),
                new TableCell({
                  borders: { top: randNone, bottom: randDun, left: randNone, right: randNone },
                  width: { size: 4550, type: WidthType.DXA },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [new Paragraph({ children: [new TextRun({ text: optA?.tekst || '', font: 'Arial', size: 22 })] })]
                }),
                new TableCell({
                  borders: { top: randNone, bottom: randNone, left: randNone, right: randNone },
                  width: { size: 480, type: WidthType.DXA },
                  margins: { top: 60, bottom: 60, left: 80, right: 40 },
                  children: [new Paragraph({ children: [new TextRun({ text: optB?.letter || '', font: 'Arial', size: 22, bold: true })] })]
                }),
                new TableCell({
                  borders: { top: randNone, bottom: randDun, left: randNone, right: randNone },
                  width: { size: 4070, type: WidthType.DXA },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [new Paragraph({ children: [new TextRun({ text: optB?.tekst || '', font: 'Arial', size: 22 })] })]
                }),
              ]
            }));
          }
          if (rijItems.length) {
            k.push(new Table({ width: { size: 9580, type: WidthType.DXA }, columnWidths: kolW, rows: rijItems }));
          }
        }
        k.push(new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }));

      } else {
        // Open vraag met pijltje → en antwoordruimte

        k.push(new Paragraph({
          spacing: { before: 280, after: 80 },
          children: [
            new TextRun({ text: `${punten}p   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: `${vnr}   `, font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: vraag.context || '', font: 'Arial', size: 22 }),
          ]
        }));

        if (vraag.vraag) {
          // Vraag met doe-het-zo instructies splitsen
          const regels = vraag.vraag.split('\n').filter(r => r.trim());
          for (const [ri, regel] of regels.entries()) {
            const isDoeHetZo = regel.toLowerCase().startsWith('doe het zo') || regel.startsWith('−');
            k.push(new Paragraph({
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

        // Antwoordruimte (lijntjes)
        const regels = vraag.antwoordRegels || 3;
        k.push(new Paragraph({ spacing: { before: 80, after: 0 }, children: [] }));
        for (let r = 0; r < regels; r++) {
          k.push(new Paragraph({
            spacing: { before: 0, after: 0 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA', space: 2 } },
            children: [new TextRun({ text: ' ', font: 'Arial', size: 28 })]
          }));
        }
        k.push(new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }));
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
    const { titel, aantalVragen, vak, niveau } = req.body;
    const nVragen = parseInt(aantalVragen) || 10;
    const inhoud = await extractTekstUitBestand(req.file.path, req.file.originalname);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const maxPunten = nVragen;

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
- Elke sectie heeft 1-3 bronnen met relevante tekst uit het document
- Open vragen: gebruik pijltje-instructie ("Doe het zo: − ...") bij complexe vragen
- Meerkeuze: altijd 4 opties (A t/m D), soms 6 (A t/m F) bij combinatievragen
- Punten per vraag: 1p voor eenvoudig, 2p voor tweedelige vragen
- Bronnen bevatten echte informatie uit de tekst (geen verzinsels)
- Context verwijst naar de juiste bronnen ("Lees bron 1.", "Bekijk bron 2 en lees bron 3.")

Tekst:
${String(inhoud).slice(0, 18000)}`,
      maxTokens: 3500,
      temperature: 0.2
    });

    if (titel) data.vak = titel;
    data.maxPunten = data.maxPunten || maxPunten;

    const docxBuffer = await bouwToetsExamenStijl({ schoolnaam, logoBestand, data });
    const bestandsnaam = `toets_${Date.now()}.docx`;
    fs.writeFileSync(path.join(uploadDir, bestandsnaam), docxBuffer);
    res.json({ success: true, bestandsnaam, titel: data.vak || titel || 'Toets' });
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
    res.json({ success: true, bestandsnaam, titel: data.vak || 'Toets' });
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
    const dataRijen = data.materiaalstaat.map(r => new TableRow({ children: [String(r.nummer||''), '', String(r.benaming||''), String(r.lengte||''), String(r.breedte||''), String(r.dikte||''), String(r.soortHout||'')].map((cel, i) => new TableCell({ borders: { top: RAND_DUN, bottom: RAND_DUN, left: RAND_DUN, right: RAND_DUN }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, width: { size: kolW[i], type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: cel, font: 'Arial', size: 20, color: TEKST })] })] })) }));
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

  k.push(balkTabel('Stappenplan'));
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
// WERKBOEKJE GENERATOR — upload met AI (quota fallback)
// ============================================================
app.post('/api/genereer-werkboekje', requireCanEdit, upload.single('bestand'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand geupload' });
  try {
    const schoolnaam  = db.getInstelling('schoolnaam')  || '';
    const logoBestand = db.getInstelling('logoBestand') || null;
    const { titel } = req.body;
    const inhoud = await extractTekstUitBestand(req.file.path, req.file.originalname);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    let data; let aiGebruikt = true;
    try {
      data = await chatJson({ system: 'Je maakt praktijk werkboekjes voor Nederlandse leerlingen. Geef altijd alleen geldig JSON terug.', user: 'Vul dit JSON-template in op basis van de tekst. ALLEEN JSON, geen uitleg.\n\nTemplate:\n{\n  "titel": "Werkboekje: [onderwerp]",\n  "vak": "BWI",\n  "profieldeel": "",\n  "opdrachtnummer": "1",\n  "duur": "",\n  "leerdoelen": ["De leerling kan ..."],\n  "introductie": "",\n  "veiligheidsregels": ["Werkpak dragen.", "Geen losse kleding.", "Haren in staart."],\n  "materiaalstaat": [{"nummer":1,"benaming":"","lengte":"","breedte":"","dikte":"18","soortHout":"Multiplex"}],\n  "machines": [],\n  "secties": [{"titel":"","benodigdheden":[],"stappen":[{"stap":"","heeftAfbeelding":true}]}]\n}\n\nRegels: max 3 secties, 4-8 stappen, max 4 leerdoelen, max 12 materiaalrijen.\n\nTekst:\n' + String(inhoud).slice(0, 20000), maxTokens: 2500, temperature: 0.2 });
    } catch (aiErr) {
      const msg = aiErr.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('OPENAI_API_KEY')) {
        aiGebruikt = false;
        const eersteRegel = String(inhoud).split('\n').find(r => r.trim().length > 4) || '';
        data = { titel: titel || ('Werkboekje: ' + eersteRegel.slice(0, 40).trim()), vak: '', profieldeel: '', opdrachtnummer: '1', duur: '', leerdoelen: [], introductie: '', veiligheidsregels: ['Je werkpak en werkschoenen aantrekken.', 'Loshangende kleding is verboden.', 'Losse haren in een staart of knot.', 'Gehoorbescherming is verplicht bij machines.'], materiaalstaat: [], machines: [], secties: [{ titel: 'Stappenplan', benodigdheden: [], stappen: [{ stap: 'Stap 1 - vul hier de stappen in.', heeftAfbeelding: true }] }] };
      } else { throw aiErr; }
    }
    if (titel) data.titel = titel;
    const docxBuffer = await bouwWerkboekjeDocxVast({ schoolnaam, logoBestand, data });
    const bestandsnaam = 'werkboekje_' + Date.now() + '.docx';
    fs.writeFileSync(path.join(uploadDir, bestandsnaam), docxBuffer);
    res.json({ success: true, bestandsnaam, titel: data.titel || titel || 'Werkboekje', waarschuwing: aiGebruikt ? null : 'AI niet beschikbaar. Leeg werkboekje aangemaakt.' });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    res.status(500).json({ error: 'Fout bij genereren: ' + e.message });
  }
});

// ============================================================
// WERKBOEKJE GENERATOR — handmatig (wizard, geen AI)
// ============================================================
app.post('/api/genereer-werkboekje-handmatig', requireCanEdit, async (req, res) => {
  try {
    const schoolnaam  = db.getInstelling('schoolnaam')  || '';
    const logoBestand = db.getInstelling('logoBestand') || null;
    const data = req.body;
    if (!data || !data.titel) return res.status(400).json({ error: 'Titel is verplicht' });
    data.secties = (data.secties || []).map(s => ({ ...s, stappen: (s.stappen || []).filter(p => p.stap && p.stap.trim()) })).filter(s => s.titel || s.stappen.length);
    const docxBuffer = await bouwWerkboekjeDocxVast({ schoolnaam, logoBestand, data });
    const bestandsnaam = 'werkboekje_' + Date.now() + '.docx';
    fs.writeFileSync(path.join(uploadDir, bestandsnaam), docxBuffer);
    res.json({ success: true, bestandsnaam, titel: data.titel || 'Werkboekje' });
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken: ' + e.message });
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
