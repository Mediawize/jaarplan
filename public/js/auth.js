const Auth = {
  currentUser: null,

  init() {
    const saved = sessionStorage.getItem('jp_session');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      return true;
    }
    return false;
  },

  login(email, wachtwoord) {
    const users = DB.getGebruikers();
    const user = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.wachtwoord === wachtwoord
    );

    if (!user) return { error: 'Onjuist e-mailadres of wachtwoord.' };

    const session = {
      id: user.id,
      naam: user.naam + ' ' + user.achternaam,
      rol: user.rol,
      email: user.email,
      vakken: user.vakken || []
    };

    this.currentUser = session;
    sessionStorage.setItem('jp_session', JSON.stringify(session));
    return { success: true, user: session };
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('jp_session');
  },

  isAdmin() {
    return this.currentUser?.rol === 'admin';
  },

  isDocent() {
    return this.currentUser?.rol === 'docent';
  },

  isManagement() {
    return this.currentUser?.rol === 'management';
  },

  canEdit() {
    return this.isAdmin() || this.isDocent();
  },

  /**
   * Goede vaste rechtenlogica:
   * - Admin ziet alle klassen.
   * - Management ziet alle klassen, maar kan niet wijzigen.
   * - Docent ziet klassen die expliciet aan hem gekoppeld zijn.
   * - Docent ziet ook klassen waarvan het vak gekoppeld is aan zijn account.
   *
   * Hierdoor krijg je niet meer onterecht 'geen klassen' als een klas
   * nog niet aan docentId hangt, maar wel aan een vak dat de docent geeft.
   */
  getZichtbareKlassen() {
    if (!this.currentUser) return [];

    const alleKlassen = DB.getKlassen();

    if (this.isAdmin() || this.isManagement()) {
      return alleKlassen;
    }

    if (this.isDocent()) {
      const vakken = this.currentUser.vakken || [];

      return alleKlassen.filter(klas => {
        const isEigenDocent = klas.docentId === this.currentUser.id;
        const isEigenVak = klas.vakId && vakken.includes(klas.vakId);
        return isEigenDocent || isEigenVak;
      });
    }

    return [];
  },

  /**
   * Klasses die een gebruiker mag kiezen/koppelen in formulieren.
   * Nu gelijk aan zichtbare klassen, maar apart gehouden zodat dit later
   * makkelijk strenger of ruimer gemaakt kan worden.
   */
  getKoppelbareKlassen() {
    return this.getZichtbareKlassen();
  }
};

// ---- Login UI functions ----
function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !pw) {
    errEl.textContent = 'Vul e-mailadres en wachtwoord in.';
    errEl.style.display = 'block';
    return;
  }

  const result = Auth.login(email, pw);
  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return;
  }

  startApp();
}

function fillDemo(email, pw) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = pw;
}

function doLogout() {
  Auth.logout();
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen')?.style.display !== 'none') {
    doLogin();
  }
});
