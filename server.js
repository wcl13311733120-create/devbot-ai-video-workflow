const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const W = require('./lib/workflow');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'projects.json');

app.use(express.json());
app.use(express.static(__dirname));

/* ---------------- 存储 ---------------- */
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch (e) { return []; }
}
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

/* ---------------- API ---------------- */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/stages', (req, res) => res.json({
  stages: W.STAGES, platforms: W.PLATFORMS, quality: W.QUALITY
}));

app.post('/api/plan', (req, res) => {
  try {
    res.json(W.buildPlan(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/estimate', (req, res) => {
  res.json(W.estimate(req.body || {}));
});

app.post('/api/projects', (req, res) => {
  const b = req.body || {};
  try {
    const plan = W.buildPlan(b);
    const project = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      idea: plan.idea,
      platform: plan.estimate.platform,
      quality: plan.estimate.quality,
      scenes: plan.estimate.scenes,
      durationSec: plan.estimate.durationSec,
      cost: plan.estimate.estimatedCost,
      minutes: plan.estimate.estimatedMinutes,
      total: W.STAGES.length,
      progress: W.STAGES.map(s => ({ id: s.id, done: false })),
      plan
    };
    const all = load();
    all.unshift(project);
    save(all.slice(0, 50));
    res.json(project);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/projects', (req, res) => {
  res.json(load().map(p => ({
    id: p.id, ts: p.ts, idea: p.idea, platform: p.platform,
    cost: p.cost, minutes: p.minutes,
    done: (p.progress || []).filter(x => x.done).length,
    total: p.total || W.STAGES.length
  })));
});

app.get('/api/projects/:id', (req, res) => {
  const p = load().find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

app.post('/api/projects/:id/toggle', (req, res) => {
  const all = load();
  const p = all.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const stage = req.body && req.body.stage;
  if (!p.progress) p.progress = W.STAGES.map(s => ({ id: s.id, done: false }));
  const item = p.progress.find(x => x.id === stage);
  if (item) item.done = !item.done;
  p.done = p.progress.filter(x => x.done).length;
  save(all);
  res.json({ id: p.id, progress: p.progress, done: p.done });
});

app.get('/api/projects/:id/export', (req, res) => {
  const p = load().find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

app.listen(PORT, () => console.log(`AI Video Workflow running on http://localhost:${PORT}`));
