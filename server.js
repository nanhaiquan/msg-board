// ─── 配置：你只需要改这个区域 ───
const CONFIG = {
  port: process.env.PORT || 3000,
  dbPath: './data/msgs.db',
  siteTitle: '留言板',
  siteDesc: '留下你想说的话',
};
// ────────────────────────────────

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.dirname(path.join(__dirname, CONFIG.dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(__dirname, CONFIG.dbPath));
db.exec(`CREATE TABLE IF NOT EXISTS msgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '匿名',
  content TEXT NOT NULL,
  time TEXT NOT NULL
)`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/msgs', (req, res) => {
  const msgs = db.prepare('SELECT * FROM msgs ORDER BY id ASC LIMIT 200').all();
  res.json(msgs.map(m => ({ _id: m.id, name: m.name, content: m.content, time: m.time })));
});

app.post('/api/msgs', (req, res) => {
  const { name, content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  const info = db.prepare('INSERT INTO msgs (name, content, time) VALUES (?, ?, ?)').run(
    (name || '匿名').trim().slice(0, 20),
    content.trim().slice(0, 1000),
    new Date().toISOString()
  );
  res.json({ _id: info.lastInsertRowid, name: (name || '匿名').trim().slice(0, 20), content: content.trim().slice(0, 1000), time: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CONFIG.port, () => {
  console.log('✓ http://localhost:' + CONFIG.port);
});
