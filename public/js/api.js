// ============================================================
// api.js — Alle communicatie met de server via REST API
// ============================================================

const API = {
  async _fetch(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401) { window.location.reload(); return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Serverfout');
    return data;
  },

  // AUTH
  async login(email, wachtwoord) { return this._fetch('/api/login', { method: 'POST', body: { email, wachtwoord } }); },
  async logout() { return this._fetch('/api/logout', { method: 'POST' }); },
  async getSession() { return this._fetch('/api/session'); },

  // GEBRUIKERS
  async getGebruikers() { return this._fetch('/api/gebruikers'); },
  async addGebruiker(data) { return this._fetch('/api/gebruikers', { method: 'POST', body: data }); },
  async updateGebruiker(id, data) { return this._fetch(`/api/gebruikers/${id}`, { method: 'PUT', body: data }); },
  async deleteGebruiker(id) { return this._fetch(`/api/gebruikers/${id}`, { method: 'DELETE' }); },
  async setHoofdklassen(id, hoofdklassen) { return this._fetch(`/api/gebruikers/${id}/hoofdklassen`, { method: 'PUT', body: { hoofdklassen } }); },

  // VAKKEN
  async getVakken() { return this._fetch('/api/vakken'); },
  async addVak(data) { return this._fetch('/api/vakken', { method: 'POST', body: data }); },
  async updateVak(id, data) { return this._fetch(`/api/vakken/${id}`, { method: 'PUT', body: data }); },
  async deleteVak(id) { return this._fetch(`/api/vakken/${id}`, { method: 'DELETE' }); },

  // KLASSEN
  async getKlassen() { return this._fetch('/api/klassen'); },
  async addKlas(data) { return this._fetch('/api/klassen', { method: 'POST', body: data }); },
  async updateKlas(id, data) { return this._fetch(`/api/klassen/${id}`, { method: 'PUT', body: data }); },
  async deleteKlas(id) { return this._fetch(`/api/klassen/${id}`, { method: 'DELETE' }); },

  // SCHOOLJAREN
  async getSchooljaren() { return this._fetch('/api/schooljaren'); },
  async addSchooljaar(naam) { return this._fetch('/api/schooljaren', { method: 'POST', body: { naam } }); },
  async deleteSchooljaar(naam) { return this._fetch(`/api/schooljaren/${encodeURIComponent(naam)}`, { method: 'DELETE' }); },

  // WEKEN
  async getWeken(schooljaar) { return this._fetch(`/api/weken/${encodeURIComponent(schooljaar)}`); },
  async updateWeekThema(weekId, thema) { return this._fetch(`/api/weken/${weekId}/thema`, { method: 'PUT', body: { thema } }); },
  async updateWeekType(weekId, weektype, vakantieNaam) { return this._fetch(`/api/weken/${weekId}/type`, { method: 'PUT', body: { weektype, vakantieNaam } }); },
  async updateDagnotities(weekId, dagnotities) { return this._fetch(`/api/weken/${weekId}/dagnotities`, { method: 'PUT', body: { dagnotities } }); },

  // OPDRACHTEN
  async getOpdrachten(klasId) { return this._fetch('/api/opdrachten' + (klasId ? `?klasId=${klasId}` : '')); },
  async addOpdracht(data) { return this._fetch('/api/opdrachten', { method: 'POST', body: data }); },
  async updateOpdracht(id, data) { return this._fetch(`/api/opdrachten/${id}`, { method: 'PUT', body: data }); },
  async deleteOpdracht(id) { return this._fetch(`/api/opdrachten/${id}`, { method: 'DELETE' }); },
  async afvinken(id) { return this._fetch(`/api/opdrachten/${id}/afvinken`, { method: 'POST' }); },
  async setOpmerking(id, opmerking) { return this._fetch(`/api/opdrachten/${id}/opmerking`, { method: 'POST', body: { opmerking } }); },

  // LESPROFIELEN
  async getLesprofielen() { return this._fetch('/api/lesprofielen'); },
  async addLesprofiel(data) { return this._fetch('/api/lesprofielen', { method: 'POST', body: data }); },
  async updateLesprofiel(id, data) { return this._fetch(`/api/lesprofielen/${id}`, { method: 'PUT', body: data }); },
  async deleteLesprofiel(id) { return this._fetch(`/api/lesprofielen/${id}`, { method: 'DELETE' }); },

  // STATS
  async getStats() { return this._fetch('/api/stats'); },
};

// ============================================================
// Cache
// ============================================================
const Cache = {
  _data: {},
  _ttl: {},
  set(key, val, ttlMs = 30000) { this._data[key] = val; this._ttl[key] = Date.now() + ttlMs; },
  get(key) { if (!this._data[key] || Date.now() > this._ttl[key]) return null; return this._data[key]; },
  invalidate(...keys) { keys.forEach(k => { delete this._data[k]; delete this._ttl[k]; }); },
  invalidateAll() { this._data = {}; this._ttl = {}; }
};
