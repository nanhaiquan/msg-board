// ─── 配置 ───
const CONFIG = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || '',
  siteTitle: '南海山',
  siteDesc: '聚合 · 连接 · 创造',
};
// ─────────────

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── 违禁词 ───
const BANNED_WORDS = [
  '违禁词1','违禁词2', // 占位，后面你改
];
function checkBanned(text) {
  for (const w of BANNED_WORDS) {
    if (text.includes(w)) return w;
  }
  return null;
}

// ─── 数据库 ───
let pool;
if (CONFIG.dbUrl) {
  pool = new Pool({ connectionString: CONFIG.dbUrl });
  pool.query(`
    CREATE TABLE IF NOT EXISTS msgs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '匿名',
      content TEXT NOT NULL,
      time TEXT NOT NULL,
      banned BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS banned_users (
      id SERIAL PRIMARY KEY,
      ip TEXT NOT NULL,
      reason TEXT,
      time TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `).catch(e => { console.error('DB error:', e.message); pool = null; });
}

// ─── API ───
app.get('/api/msgs', async (req, res) => {
  if (!pool) return res.json([]);
  const r = await pool.query('SELECT * FROM msgs WHERE banned=FALSE ORDER BY id DESC LIMIT 100');
  res.json(r.rows.map(m => ({ _id: m.id, name: m.name, content: m.content, time: m.time })));
});

app.post('/api/msgs', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { name, content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  // 违禁词检查
  const banned = checkBanned(content) || (name && checkBanned(name));
  if (banned) return res.status(403).json({ error: '内容包含违规词' });
  // IP 检查是否被封禁
  const ip = req.ip || req.connection.remoteAddress;
  const bannedIp = await pool.query('SELECT * FROM banned_users WHERE ip=$1', [ip]);
  if (bannedIp.rows.length > 0) return res.status(403).json({ error: '您已被封禁' });
  const r = await pool.query(
    'INSERT INTO msgs (name, content, time) VALUES ($1, $2, $3) RETURNING id',
    [(name || '匿名').trim().slice(0, 20), content.trim().slice(0, 1000), new Date().toISOString()]
  );
  res.json({ _id: r.rows[0].id, name: (name || '匿名').trim().slice(0, 20), content: content.trim().slice(0, 1000), time: new Date().toISOString() });
});

// ─── 管理 API ───
app.post('/api/admin/delete', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { id, adminKey } = req.body;
  if (adminKey !== 'nanhaishan2024') return res.status(403).json({ error: '无权限' });
  await pool.query('UPDATE msgs SET banned=TRUE WHERE id=$1', [id]);
  res.json({ ok: true });
});

app.post('/api/admin/ban', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { ip, reason, adminKey } = req.body;
  if (adminKey !== 'nanhaishan2024') return res.status(403).json({ error: '无权限' });
  await pool.query('INSERT INTO banned_users (ip, reason, time) VALUES ($1, $2, $3)', [ip, reason || '违规', new Date().toISOString()]);
  res.json({ ok: true });
});

app.get('/api/admin/msgs', async (req, res) => {
  if (!pool) return res.json([]);
  const { key } = req.query;
  if (key !== 'nanhaishan2024') return res.status(403).json({ error: '无权限' });
  const r = await pool.query('SELECT * FROM msgs ORDER BY id DESC LIMIT 100');
  res.json(r.rows);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CONFIG.port, () => {
  console.log('✓ http://localhost:' + CONFIG.port);
});
