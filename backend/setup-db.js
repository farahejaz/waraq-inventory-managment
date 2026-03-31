// setup-db.js — Run ONCE on Supabase SQL Editor or via: node setup-db.js
// This creates all tables and seeds the default admin user.
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to Supabase PostgreSQL...');

    // Sessions table (for express-session / connect-pg-simple)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid    VARCHAR NOT NULL PRIMARY KEY,
        sess   JSON    NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
    `);
    console.log('  ✔ session table ready');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        username   VARCHAR(50) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        role       VARCHAR(20) NOT NULL DEFAULT 'manager'
                   CHECK (role IN ('admin','manager','accountant')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✔ users table ready');

    // Main data store (JSONB key-value — one row per collection)
    await client.query(`
      CREATE TABLE IF NOT EXISTS waraq_data (
        key        VARCHAR(50) PRIMARY KEY,
        value      JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(50)
      );
    `);
    console.log('  ✔ waraq_data table ready');

    // Audit log
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id         SERIAL PRIMARY KEY,
        username   VARCHAR(50),
        action     VARCHAR(20),
        collection VARCHAR(50),
        record_id  VARCHAR(50),
        detail     TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✔ audit_log table ready');

    // Seed empty collections
    const collections = [
      'suppliers','customers','rawmaterials','products',
      'purchases','sales','production','cashflow'
    ];
    for (const col of collections) {
      await client.query(`
        INSERT INTO waraq_data (key, value)
        VALUES ($1, '[]')
        ON CONFLICT (key) DO NOTHING
      `, [col]);
    }
    console.log('  ✔ Collections seeded (empty)');

    // Seed default users
    const defaultUsers = [
      { username: 'admin',      password: 'admin123',   role: 'admin'      },
      { username: 'manager',    password: 'manager123', role: 'manager'    },
      { username: 'accountant', password: 'account123', role: 'accountant' },
    ];

    for (const u of defaultUsers) {
      const existing = await client.query(
        'SELECT id FROM users WHERE username = $1', [u.username]
      );
      if (existing.rows.length === 0) {
        const hash = await bcrypt.hash(u.password, 10);
        await client.query(
          'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
          [u.username, hash, u.role]
        );
        console.log(`  ✔ Created user: ${u.username} (${u.role}) — default password: ${u.password}`);
      } else {
        console.log(`  – User already exists: ${u.username}`);
      }
    }

    console.log('\n✅ Database setup complete!');
    console.log('⚠️  IMPORTANT: Change default passwords immediately after first login!\n');

  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
