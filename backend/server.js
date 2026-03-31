// server.js — AK Copy House Multan Business Manager Backend
// Deployment: Render (backend) + Supabase (PostgreSQL)
require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const bcrypt       = require('bcryptjs');
const cors         = require('cors');
const { Pool }     = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database pool (Supabase PostgreSQL via DATABASE_URL) ───────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('Unexpected PG error', err));

// ── CORS (allow Vercel frontend) ───────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,              // e.g. https://your-app.vercel.app
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Sessions (stored in Supabase, persists across Render restarts) ─────────
app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'waraq-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// ── Auth middleware ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.includes(req.session.user.role)) return next();
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}

// ── Audit logger ──────────────────────────────────────────────────────────
async function audit(username, action, collection, recordId, detail) {
  try {
    await pool.query(
      'INSERT INTO audit_log (username, action, collection, record_id, detail) VALUES ($1,$2,$3,$4,$5)',
      [username, action, collection, recordId || null, detail || null]
    );
  } catch (e) { /* non-critical */ }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    await audit(user.username, 'LOGIN', null, null, 'User logged in');
    res.json({ success: true, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  const username = req.session?.user?.username;
  req.session.destroy(() => {
    if (username) audit(username, 'LOGOUT', null, null, null);
    res.json({ success: true });
  });
});

// GET /auth/me
app.get('/auth/me', (req, res) => {
  if (req.session?.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// POST /auth/change-password
app.post('/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.user.id]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is wrong' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
    audit(user.username, 'CHANGE_PASSWORD', 'users', String(user.id), null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DATA ROUTES — Generic collection CRUD
// ══════════════════════════════════════════════════════════════════════════

const VALID_COLLECTIONS = [
  'suppliers','customers','rawmaterials','products',
  'purchases','sales','production','cashflow','salaries'
];

// GET /api/:collection
app.get('/api/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!VALID_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }
  try {
    const result = await pool.query(
      'SELECT value FROM waraq_data WHERE key = $1', [collection]
    );
    res.json(result.rows.length ? result.rows[0].value : []);
  } catch (err) {
    console.error(`GET /${collection} error:`, err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/:collection/bulk
app.post('/api/:collection/bulk', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!VALID_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  const role = req.session.user.role;
  const writeRestrictions = {
    accountant: ['cashflow', 'purchases', 'sales'],
  };
  if (writeRestrictions[role] && !writeRestrictions[role].includes(collection)) {
    return res.status(403).json({ error: `${role} cannot modify ${collection}` });
  }

  const data = req.body;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must be an array' });
  }

  try {
    await pool.query(`
      INSERT INTO waraq_data (key, value, updated_at, updated_by)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT (key) DO UPDATE
        SET value = $2, updated_at = NOW(), updated_by = $3
    `, [collection, JSON.stringify(data), req.session.user.username]);

    await audit(req.session.user.username, 'BULK_SAVE', collection, null,
      `Saved ${data.length} records`);

    res.json({ success: true, count: data.length });
  } catch (err) {
    console.error(`POST /${collection}/bulk error:`, err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Users management (admin only) ─────────────────────────────────────────

app.get('/api/users', requireRole('admin'), async (req, res) => {
  const result = await pool.query(
    'SELECT id, username, role, created_at FROM users ORDER BY id'
  );
  res.json(result.rows);
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, role required' });
  }
  if (!['admin','manager','accountant'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1,$2,$3) RETURNING id,username,role',
      [username.toLowerCase().trim(), hash, role]
    );
    audit(req.session.user.username, 'CREATE_USER', 'users', String(result.rows[0].id), username);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).json({ error: "Can't delete your own account" });
  }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  audit(req.session.user.username, 'DELETE_USER', 'users', id, null);
  res.json({ success: true });
});

// ── Audit log (admin only) ─────────────────────────────────────────────────
app.get('/api/audit', requireRole('admin'), async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200'
  );
  res.json(result.rows);
});

// ── Health check (used by Render health monitoring) ────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 AK Copy House Multan server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
