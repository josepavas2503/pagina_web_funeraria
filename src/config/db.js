// src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
    // Railway proporciona esta variable automáticamente al enlazar PostgreSQL
    connectionString: process.env.DATABASE_URL, 
    ssl: {
        rejectUnauthorized: false // Necesario para conexiones en la nube
    }
});

module.exports = pool;