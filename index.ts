import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

config({ path: resolve(__dirname, '../.env.development') });

const app = Fastify({ logger: { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } } } });

const users: any[] = [];
function genTokens(userId: string) {
  const s = process.env.JWT_SECRET || 'dev-secret';
  return { accessToken: jwt.sign({ userId, type: 'access' }, s, { expiresIn: '15m' }), refreshToken: jwt.sign({ userId, type: 'refresh' }, s, { expiresIn: '7d' }) };
}

async function bootstrap() {
  for (const k of ['JWT_SECRET']) { if (!process.env[k]) { app.log.error(`Missing: ${k}`); process.exit(1); } }
  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });

  // Auth
  app.post('/api/v1/auth/register', async (req, reply) => {
    const { email, password, name }: any = req.body;
    if (!email || !password) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_001', message: '参数错误' } });
    if (users.find(u => u.email === email)) return reply.status(409).send({ success: false, error: { code: 'VALIDATION_001', message: '邮箱已注册' } });
    const user = { id: crypto.randomUUID(), email, name: name || '', passwordHash: await bcrypt.hash(password, 12), role: 'user', createdAt: new Date().toISOString() };
    users.push(user);
    const t = genTokens(user.id);
    return reply.send({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...t } });
  });
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { email, password }: any = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return reply.status(401).send({ success: false, error: { code: 'AUTH_001', message: '邮箱或密码错误' } });
    const t = genTokens(user.id);
    return reply.send({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...t } });
  });
  app.post('/api/v1/auth/refresh', async (req, reply) => {
    try {
      const { refreshToken }: any = req.body;
      const d: any = jwt.verify(refreshToken, process.env.JWT_SECRET || 'dev-secret');
      const t = genTokens(d.userId);
      return reply.send({ success: true, data: t });
    } catch { return reply.status(401).send({ success: false, error: { code: 'AUTH_002', message: 'Token 过期' } }); }
  });

  // Chat
  app.post('/api/v1/chat', async (req, reply) => {
    const { messages, mode }: any = req.body;
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return reply.status(503).send({ success: false, error: { code: 'INTERNAL_001', message: 'AI 未配置' } });
    const sp = mode === 'learning' ? '你是 Genesis 学习助手。回答结构化、有层次。' : '你是 Genesis AI 助手。回答自然简洁。';
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: sp }, ...(messages || [])], max_tokens: 4096 }),
      });
      const d: any = await r.json();
      return reply.send({ success: true, data: { content: d.choices[0].message.content } });
    } catch { return reply.status(502).send({ success: false, error: { code: 'INTERNAL_001', message: 'AI 不可达' } }); }
  });

  // Learn
  app.post('/api/v1/learn/deconstruct', async (req, reply) => {
    const { title }: any = req.body;
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return reply.status(503).send({ success: false, error: { code: 'INTERNAL_001', message: 'AI 未配置' } });
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: `将「${title}」分解为3-5个阶段，JSON格式：[{"title":"阶段名","summary":"概要","nodes":[{"title":"知识点","summary":"说明"}]}]` }], max_tokens: 4096 }),
      });
      const d: any = await r.json();
      return reply.send({ success: true, data: { content: d.choices[0].message.content } });
    } catch { return reply.status(502).send({ success: false, error: { code: 'INTERNAL_001', message: 'AI 不可达' } }); }
  });

  // Ingest
  app.post('/api/v1/ingest/url', async (req, reply) => {
    const { url }: any = req.body;
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return reply.status(503).send({ success: false, error: { code: 'INTERNAL_001', message: 'AI 未配置' } });
    try {
      const pr = await fetch(url, { headers: { 'User-Agent': 'Genesis/1.0' } });
      const html = await pr.text();
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: `总结以下内容：\n${html.substring(0, 6000)}` }], max_tokens: 1024 }),
      });
      const d: any = await r.json();
      return reply.send({ success: true, data: { summary: d.choices[0].message.content, source: url } });
    } catch { return reply.status(502).send({ success: false, error: { code: 'INTERNAL_001', message: '处理失败' } }); }
  });

  // Events
  const events: any[] = [];
  app.get('/api/v1/events', async () => ({ success: true, data: events }));
  app.post('/api/v1/events', async (req, reply) => {
    const { title, startAt }: any = req.body;
    const e = { id: crypto.randomUUID(), title, startAt, createdAt: new Date().toISOString() };
    events.push(e);
    return reply.send({ success: true, data: e });
  });

  // Finances
  const finances: any[] = [];
  app.get('/api/v1/finances', async () => ({ success: true, data: finances }));
  app.post('/api/v1/finances', async (req, reply) => {
    const { amount, type, category }: any = req.body;
    const f = { id: crypto.randomUUID(), amount, type, category, recordedAt: new Date().toISOString() };
    finances.push(f);
    return reply.send({ success: true, data: f });
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  await app.listen({ port: parseInt(process.env.PORT || '3000'), host: process.env.HOST || '0.0.0.0' });
  app.log.info('Server running');
}
bootstrap().catch((e) => { console.error(e); process.exit(1); });
