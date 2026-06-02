// ─── 配置 ───
const CONFIG = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || process.env.PGURL || '',
  siteTitle: '留言板',
  siteDesc: '留下你想说的话',
};
// ─────────────

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool;
if (CONFIG.dbUrl) {
  pool = new Pool({ connectionString: CONFIG.dbUrl });
  pool.query(`CREATE TABLE IF NOT EXISTS msgs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '匿名',
    content TEXT NOT NULL,
    time TEXT NOT NULL
  )`).catch(e => { console.error('DB init error:', e.message); pool = null; });
  console.log('DB connected');
} else {
  console.log('No DATABASE_URL, running without DB');
}

app.get('/api/msgs', async (req, res) => {
  if (!pool) return res.json([]);
  const r = await pool.query('SELECT * FROM msgs ORDER BY id ASC LIMIT 200');
  res.json(r.rows.map(m => ({ _id: m.id, name: m.name, content: m.content, time: m.time })));
});

app.post('/api/msgs', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { name, content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  const r = await pool.query(
    'INSERT INTO msgs (name, content, time) VALUES ($1, $2, $3) RETURNING id',
    [(name || '匿名').trim().slice(0, 20), content.trim().slice(0, 1000), new Date().toISOString()]
  );
  res.json({ _id: r.rows[0].id, name: (name || '匿名').trim().slice(0, 20), content: content.trim().slice(0, 1000), time: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CONFIG.port, () => {
  console.log('✓ http://localhost:' + CONFIG.port);
});
