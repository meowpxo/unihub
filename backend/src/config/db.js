const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'unihub_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+08:00',   // Malaysia time (MYT)
  charset:            'utf8mb4',
});

// Test the connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:');
    console.error('   Code    :', err.code);
    console.error('   Message :', err.message);
    console.error('   Host    :', process.env.DB_HOST, ':', process.env.DB_PORT || 3306);
    console.error('   Database:', process.env.DB_NAME);
    process.exit(1);
  });

module.exports = pool;
