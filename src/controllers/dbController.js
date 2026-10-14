const pool = require('../config/db');

// ==========================================
// MÓDULO PÓLIZAS Y PERSONAS
// ==========================================

// 1. CREAR PÓLIZA Y TITULAR
exports.crearPoliza = async (req, res) => {
    const client = await pool.connect();
    try {
        const { socio, valor_mes, usuario, telefono, nota, nombre, documento, fecha_nacimiento } = req.body;
        
        // Iniciar transacción (si falla una inserción, se deshace todo)
        await client.query('BEGIN');
        
        // Insertar en tabla POLIZAS
        const queryPoliza = `INSERT INTO polizas (socio, valor_mes, usuario, telefono, nota) 
                             VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        await client.query(queryPoliza, [socio, valor_mes, usuario, telefono, nota]);

        // Insertar a la persona TITULAR en tabla PERSONAS
        const queryPersona = `INSERT INTO personas (socio, nombre, documento, fecha_nacimiento, titular) 
                              VALUES ($1, $2, $3, $4, true)`;
        await client.query(queryPersona, [socio, nombre, documento, fecha_nacimiento]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Póliza y titular creados exitosamente." });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// 2. CONSULTAR PÓLIZA (Trae datos de la póliza, personas y el último pago)
exports.consultarPoliza = async (req, res) => {
    try {
        const { socio } = req.params;

        // Buscar Póliza
        const resPoliza = await pool.query('SELECT * FROM polizas WHERE socio = $1', [socio]);
        if (resPoliza.rows.length === 0) return res.status(404).json({ error: "Póliza no encontrada" });

        // Buscar Personas asociadas
        const resPersonas = await pool.query('SELECT * FROM personas WHERE socio = $1 ORDER BY titular DESC', [socio]);

        // Buscar el ÚLTIMO pago (Colilla más reciente)
        const resUltimoPago = await pool.query('SELECT * FROM colillas WHERE socio = $1 ORDER BY fecha DESC LIMIT 1', [socio]);

        res.json({
            poliza: resPoliza.rows[0],
            personas: resPersonas.rows,
            ultimo_pago: resUltimoPago.rows[0] || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. ACTUALIZAR PERSONA (O agregar una nueva si no tiene ID)
exports.guardarPersona = async (req, res) => {
    try {
        const { id, socio, nombre, documento, fecha_nacimiento, telefono, titular, fallecio, fecha_fallecimiento } = req.body;
        
        // Nota: El teléfono se guarda en la tabla polizas, así que lo actualizamos ahí
        await pool.query('UPDATE polizas SET telefono = $1 WHERE socio = $2', [telefono, socio]);

        if (id) {
            // Modificar persona existente
            const query = `UPDATE personas SET nombre=$1, documento=$2, fecha_nacimiento=$3, titular=$4, fallecio=$5, fecha_fallecimiento=$6 WHERE id=$7`;
            await pool.query(query, [nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento, id]);
        } else {
            // Crear nueva persona beneficiaria
            const query = `INSERT INTO personas (socio, nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
            await pool.query(query, [socio, nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento]);
        }
        res.json({ success: true, message: "Datos actualizados." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. ELIMINAR PERSONA
exports.eliminarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM personas WHERE id = $1', [id]);
        res.json({ success: true, message: "Persona eliminada." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ==========================================
// MÓDULO COLILLAS
// ==========================================

// 1. CREAR COLILLA (Requiere validación de socio previo en el frontend)
exports.crearColilla = async (req, res) => {
    try {
        const { socio, valor, fecha_desde, fecha_hasta, usuario } = req.body;
        const query = `INSERT INTO colillas (socio, valor, fecha, fecha_desde, fecha_hasta, usuario, liquidado) 
                       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, false) RETURNING *`;
        const result = await pool.query(query, [socio, valor, fecha_desde, fecha_hasta, usuario]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. CONSULTAR TODAS LAS COLILLAS DE UN SOCIO
exports.consultarColillasSocio = async (req, res) => {
    try {
        const { socio } = req.params;
        const query = 'SELECT * FROM colillas WHERE socio = $1 ORDER BY fecha DESC';
        const result = await pool.query(query, [socio]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};