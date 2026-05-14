/**
 * Run once to create all tables:  node src/config/setupDb.js
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(
    path.join(__dirname, '../../database/schema.sql'),
    'utf8'
  );

  // Run each statement individually so duplicate index/column errors are skipped
  const IGNORE_CODES = new Set(['ER_DUP_KEYNAME', 'ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR']);
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (e) {
      if (!IGNORE_CODES.has(e.code)) throw e;
    }
  }
  console.log('✅ Database and tables created successfully.');

  // ── Column migrations (safe to re-run; ignored if column already exists) ──
  const migrations = [
    `ALTER TABLE tasks ADD COLUMN source ENUM('manual','moodle') DEFAULT 'manual'`,
    `ALTER TABLE tasks ADD COLUMN moodle_id VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE tasks ADD COLUMN moodle_synced_at TIMESTAMP NULL DEFAULT NULL`,
  ];
  for (const sql of migrations) {
    try {
      await conn.query(sql);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e; // ignore "column already exists"
    }
  }
  console.log('✅ Migrations applied.');

  await conn.end();
}

setup().catch(err => {
  console.error('❌ Setup failed:');
  console.error('   Code   :', err.code);
  console.error('   Message:', err.message || err.sqlMessage || String(err));
  process.exit(1);
});
