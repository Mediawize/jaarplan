// public/js/views/toetsen.js
// Tijdelijke compatibiliteit na verhuizing naar lesmaterialen.js.
// De echte omgeving staat nu in public/js/views/lesmaterialen.js.

async function renderToetsen() {
  if (typeof renderLesmaterialen === 'function') {
    return renderLesmaterialen();
  }
  console.error('renderLesmaterialen is niet geladen. Controleer of lesmaterialen.js in app.html staat.');
}
