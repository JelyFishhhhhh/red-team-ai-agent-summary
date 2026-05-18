const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const PAPERS_PATH = path.resolve(__dirname, '../../app/public/papers.json');
const ATTACK_PATH = path.resolve(__dirname, '../../app/src/data/attack-enterprise.json');

app.use(cors({ origin: 'http://localhost:5174' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/papers', (req, res) => {
  try {
    const data = fs.readFileSync(PAPERS_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/papers', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming.agents || !Array.isArray(incoming.agents)) {
      return res.status(400).json({ error: 'Invalid papers data: missing agents array' });
    }
    incoming.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(PAPERS_PATH, JSON.stringify(incoming, null, 2));
    res.json({ ok: true, lastUpdated: incoming.lastUpdated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/attack', (req, res) => {
  try {
    const data = fs.readFileSync(ATTACK_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Editor API running on http://localhost:${PORT}`));
