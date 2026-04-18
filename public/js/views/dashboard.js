function renderDashboard() {
  const user = Auth.currentUser;
  const stats = DB.getStats(user?.rol === 'docent' ? user.id : null);

  document.getElementById('view-dashboard').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="breadcrumb">Overzicht</div>
        <h1>Dashboard</h1>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Klassen</div>
        <div class="stat-value">${stats.aantalKlassen}</div>
        <div class="stat-sub">Actieve klassen</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Opdrachten</div>
        <div class="stat-value">${stats.aantalOpdrachten}</div>
        <div class="stat-sub">In planning</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Toetsen</div>
        <div class="stat-value">${stats.aantalToetsen}</div>
        <div class="stat-sub">Met bestand</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Vakken</div>
        <div class="stat-value">${stats.aantalVakken}</div>
        <div class="stat-sub">Uniek</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Welkom ${user?.naam || ''}</h2>
      </div>
      <div class="card-body">
        <p style="color:var(--ink-muted);font-size:13px">
          Dit dashboard geeft een overzicht van jouw klassen, opdrachten en toetsen.
        </p>
      </div>
    </div>
  `;
}
