const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'projects.json');

app.use(express.json());
app.use(express.static(__dirname));

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

const STAGES = [
  { id: 'idea',    name: '创意构思', desc: '确定选题、目标观众、核心钩子', tool: 'Claude Code / Codex', duration: '10-20 min', output: '脚本大纲 + 分镜表' },
  { id: 'script',  name: '脚本生成', desc: '口播文案 + 画面描述 + 字幕', tool: 'Claude Code', duration: '15-30 min', output: '分镜 JSON' },
  { id: 'storyboard', name: '分镜绘制', desc: '关键帧画面生成与风格统一', tool: 'Seedance / 图像模型', duration: '30-60 min', output: '关键帧图片集' },
  { id: 'video',   name: '视频生成', desc: '文生视频 / 图生视频，逐镜生成', tool: 'Seedance AI', duration: '1-3 h', output: '分镜视频片段' },
  { id: 'voice',   name: '配音配乐', desc: 'TTS 配音、背景音乐、音效', tool: 'TTS / 音乐模型', duration: '20-40 min', output: '音频轨' },
  { id: 'edit',    name: '剪辑合成', desc: '拼接、字幕、转场、封面', tool: '剪辑脚本 / FFmpeg', duration: '30-60 min', output: '成片 + 封面' },
  { id: 'publish', name: '多平台发布', desc: '标题、标签、分发排期', tool: '发布 API', duration: '10-20 min', output: '各平台分发包' }
];

const COST = { idea: 0, script: 0.02, storyboard: 0.15, video: 0.8, voice: 0.05, edit: 0.02, publish: 0 };

function estimate(durationSec = 60, scenes = 8, quality = 'standard') {
  const q = { draft: 0.5, standard: 1, high: 2.2 }[quality] || 1;
  const genCost = scenes * 0.09 * q;
  const totalCost = Object.values(COST).reduce((a, b) => a + b, 0) * q + genCost;
  const totalMin = 115 + scenes * 6 * q + durationSec / 60 * 2;
  return {
    quality, scenes, durationSec,
    estimatedCost: Math.round(totalCost * 100) / 100,
    estimatedMinutes: Math.round(totalMin),
    estimatedHours: (Math.round(totalMin) / 60).toFixed(1)
  };
}

function buildStoryboard(idea, scenes, durationSec) {
  const beatPatterns = ['钩子/冲突开场', '痛点共鸣', '解决方案引入', '核心功能演示', '数据/效果对比', '真实案例', '避坑指南', '行动号召'];
  const perScene = Math.round(durationSec / scenes);
  const shotTypes = ['特写', '中景', '全景', '屏幕录制', '实拍空镜', '图形动效'];
  return Array.from({ length: scenes }, (_, i) => ({
    no: i + 1,
    beat: beatPatterns[i % beatPatterns.length],
    shotType: shotTypes[i % shotTypes.length],
    durationSec: perScene,
    voiceover: `【${idea}】第 ${i + 1} 段：${beatPatterns[i % beatPatterns.length]} —— 这里是口播文案要点，需要补充具体细节与数据。`,
    visual: `画面描述：围绕「${idea}」的${shotTypes[i % shotTypes.length]}，风格统一，主体居中，字幕位于下三分之一。`,
    prompt: `Seedance prompt: ${idea}, ${shotTypes[i % shotTypes.length]}, cinematic lighting, consistent style, 9:16`
  }));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/plan', (req, res) => {
  const { idea = '', scenes = 8, durationSec = 60, quality = 'standard' } = req.body || {};
  if (!idea.trim()) return res.status(400).json({ error: '请填写创意主题' });
  const est = estimate(durationSec, scenes, quality);
  const storyboard = buildStoryboard(idea, scenes, durationSec);
  res.json({ idea, stages: STAGES, estimate: est, storyboard });
});

app.post('/api/projects', (req, res) => {
  const { idea = '', scenes = 8, durationSec = 60, quality = 'standard' } = req.body || {};
  const est = estimate(durationSec, scenes, quality);
  const project = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    idea, estimate: est,
    progress: STAGES.map(s => ({ id: s.id, done: false })),
    storyboard: buildStoryboard(idea, scenes, durationSec)
  };
  const all = load(); all.unshift(project); save(all.slice(0, 50));
  res.json(project);
});

app.get('/api/projects', (req, res) => {
  res.json(load().map(p => ({
    id: p.id, ts: p.ts, idea: p.idea, cost: p.estimate.estimatedCost,
    minutes: p.estimate.estimatedMinutes,
    done: p.progress.filter(x => x.done).length, total: p.progress.length
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
  const stage = req.body.stage;
  const item = p.progress.find(x => x.id === stage);
  if (item) item.done = !item.done;
  save(all);
  res.json({ id: p.id, progress: p.progress });
});

app.get('/api/projects/:id/export', (req, res) => {
  const p = load().find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

app.listen(PORT, () => console.log(`AI Video Workflow running on http://localhost:${PORT}`));
