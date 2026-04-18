const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// serve frontend (public map)
app.use(express.static(path.join(__dirname, 'public')));

// test endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`JaarPlan draait op http://127.0.0.1:${PORT}`);
});
