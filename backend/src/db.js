const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false;

function parsePgUrl(str) {
  const u = new URL(str);
  return {
    host: u.hostname,
    port: parseInt(u.port, 10) || 5432,
    database: (u.pathname || '').replace(/^\//, '').replace(/\/$/, '') || undefined,
    user: u.username || undefined,
    password: typeof u.password === 'string' ? u.password : '',
  };
}

let poolConfig;
if (connectionString) {
  try {
    poolConfig = { ...parsePgUrl(connectionString), ssl };
  } catch (_) {
    const m = connectionString.match(/^(?:postgres(?:ql)?:\/\/)(?:([^:@]+)(?::([^@]*))?@)?([^:\/]+)(?::(\d+))?\/(.+)?$/i);
    poolConfig = m
      ? {
          host: m[3],
          port: parseInt(m[4], 10) || 5432,
          database: (m[5] || '').replace(/\?.*$/, '') || undefined,
          user: m[1] || undefined,
          password: typeof m[2] === 'string' ? m[2] : '',
          ssl,
        }
      : { connectionString, ssl };
  }
} else {
  poolConfig = { ssl };
}

// SCRAM requires password to be a string; never pass undefined
if (poolConfig.password === undefined || poolConfig.password === null) {
  poolConfig.password = '';
}

const pool = new Pool(poolConfig);

module.exports = { pool };
