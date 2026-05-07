// ============================================================
// api.js — Alle communicatie met de server via REST API
// ============================================================

const API = {
  async _fetch(url, opts = {}) {
    const fetchOpts = {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    };

    if (opts.body !== undefined) {
      fetchOpts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, fetchOpts);

    if (res.status === 401) {
      window.location.reload();
      return null;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    let data;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server gaf geen JSON terug (${res.status}). Eerste deel response: ${text.slice(0, 200)}`);
    }

    if (!res.ok) throw new Error(data.error || 'Serverfout');
    return data;
  },

  async _fetchForm(url, formData, opts = {}) {
    const res = await fetch(url, {
      method: opts.method || 'POST',
      credentials: 'same-origin',
      body: formData
    });

    if (res.status === 401) {
      window.location.reload();
      return null;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    let data;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server gaf geen JSON terug (${res.status}). Eerste deel response: ${text.slice(0, 200)}`);
    }

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
  async getOpdrachtenByKlas(klasId) { return this.getOpdrachten(klasId); },
  async addOpdracht(data) { return this._fetch('/api/opdrachten', { method: 'POST', body: data }); },
  async updateOpdracht(id, data) { return this._fetch(`/api/opdrachten/${id}`, { method: 'PUT', body: data }); },
  async deleteOpdracht(id) { return this._fetch(`/api/opdrachten/${id}`, { method: 'DELETE' }); },
  async afvinken(id) { return this._fetch(`/api/opdrachten/${id}/afvinken`, { method: 'POST' }); },
  async setOpmerking(id, opmerking) { return this._fetch(`/api/opdrachten/${id}/opmerking`, { method: 'POST', body: { opmerking } }); },

  // LES MODULES
  async getLesModules() { return this._fetch('/api/les-modules'); },

  // LESPROFIELEN
  async getLesprofielen() { return this._fetch('/api/lesprofielen'); },
  async addLesprofiel(data) { return this._fetch('/api/lesprofielen', { method: 'POST', body: data }); },
  async updateLesprofiel(id, data) { return this._fetch(`/api/lesprofielen/${id}`, { method: 'PUT', body: data }); },
  async deleteLesprofiel(id) { return this._fetch(`/api/lesprofielen/${id}`, { method: 'DELETE' }); },
  async analyseSyllabus(file) {
    const formData = new FormData();
    formData.append('bestand', file);
    return this._fetchForm('/api/analyse-syllabus', formData);
  },
  async genereerLesprofielUitSyllabus(data) { return this._fetch('/api/genereer-lesprofiel-uit-syllabus', { method: 'POST', body: data }); },
  async genereerLesprofielWizard(data) { return this._fetch('/api/genereer-lesprofiel-wizard', { method: 'POST', body: data }); },

  // LESBRIEVEN
  async getLesbrieven(profielId, weekIdx, actIdx) {
    let url = `/api/lesbrieven?profielId=${profielId}`;
    if (weekIdx != null) url += `&weekIdx=${weekIdx}`;
    if (actIdx != null) url += `&actIdx=${actIdx}`;
    return this._fetch(url);
  },
  async getLesbrief(id) { return this._fetch(`/api/lesbrieven/${id}`); },
  async addLesbrief(data) { return this._fetch('/api/lesbrieven', { method: 'POST', body: data }); },
  async updateLesbrief(id, data) { return this._fetch(`/api/lesbrieven/${id}`, { method: 'PUT', body: data }); },
  async deleteLesbrief(id) { return this._fetch(`/api/lesbrieven/${id}`, { method: 'DELETE' }); },
  async genereerLesbrief(data) { return this._fetch('/api/lesbrieven/genereer', { method: 'POST', body: data }); },

  // TAKEN
  async getTaken() { return this._fetch('/api/taken'); },
  async addTaak(data) { return this._fetch('/api/taken', { method: 'POST', body: data }); },
  async updateTaak(id, data) { return this._fetch(`/api/taken/${id}`, { method: 'PUT', body: data }); },
  async deleteTaak(id) { return this._fetch(`/api/taken/${id}`, { method: 'DELETE' }); },
  async taakOppakken(id) { return this._fetch(`/api/taken/${id}/oppakken`, { method: 'POST' }); },
  async taakAfvinken(id) { return this._fetch(`/api/taken/${id}/afvinken`, { method: 'POST' }); },

  // ROOSTER
  async getRooster(userId) { return this._fetch(`/api/rooster/${userId}`); },
  async saveRooster(userId, rooster) { return this._fetch(`/api/rooster/${userId}`, { method: 'PUT', body: rooster }); },

  // MATERIALEN
  async getMaterialen(type) { return this._fetch('/api/materialen' + (type ? `?type=${type}` : '')); },
  async deleteMateriaal(id) { return this._fetch(`/api/materialen/${id}`, { method: 'DELETE' }); },

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
