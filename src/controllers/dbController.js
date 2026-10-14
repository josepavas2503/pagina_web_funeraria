// src/controllers/dbController.js
const pool = require('../config/db');

// --- PÓLIZAS ---
exports.consultarPoliza = async (req, res) => {
    try {
        const { documento } = req.params;
        const query = 'SELECT * FROM polizas WHERE documento = $1';
        const result = await pool.query(query, [documento]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearPoliza = async (req, res) => {
    try {
        const { socio, nombre, fecha_nacimiento, documento, telefono, nota, titular, valor_mes } = req.body;
        const query = `INSERT INTO polizas (socio, nombre, fecha_nacimiento, documento, telefono, nota, titular, valor_mes) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        const result = await pool.query(query, [socio, nombre, fecha_nacimiento, documento, telefono, nota, titular, valor_mes]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- COLILLAS ---
exports.consultarColillas = async (req, res) => {
    try {
        const { socio } = req.params;
        const query = 'SELECT * FROM colillas WHERE socio = $1 ORDER BY fecha DESC';
        const result = await pool.query(query, [socio]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearColilla = async (req, res) => {
    try {
        const { socio, meses, valor_total } = req.body;
        const query = `INSERT INTO colillas (socio, meses, valor_total, fecha) VALUES ($1, $2, $3, NOW()) RETURNING *`;
        const result = await pool.query(query, [socio, meses, valor_total]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};