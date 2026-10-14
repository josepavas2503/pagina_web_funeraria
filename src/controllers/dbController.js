const pool = require('../config/db');

// Función interna para calcular edad exacta en base a dos fechas
function calcularEdades(fechaNacimiento, fechaAfiliacion) {
    const nac = new Date(fechaNacimiento);
    const afil = new Date(fechaAfiliacion);
    let edad = afil.getFullYear() - nac.getFullYear();
    const mes = afil.getMonth() - nac.getMonth();
    if (mes < 0 || (mes === 0 && afil.getDate() < nac.getDate())) {
        edad--;
    }
    return { mayor_65: edad >= 65, mayor_70: edad >= 70 };
}

// ==========================================
// MÓDULO PÓLIZAS Y PERSONAS
// ==========================================

exports.crearPoliza = async (req, res) => {
    const client = await pool.connect();
    try {
        const { socio, valor_mes, usuario, telefono, nota, nombre, documento, fecha_nacimiento, meses_iniciales } = req.body;
        
        await client.query('BEGIN');
        
        // 1. Insertar Póliza
        const queryPoliza = `INSERT INTO polizas (socio, valor_mes, usuario, telefono, nota) VALUES ($1, $2, $3, $4, $5)`;
        await client.query(queryPoliza, [socio, valor_mes, usuario, telefono, nota]);

        // 2. Calcular edades e insertar Titular
        const fechaActual = new Date();
        const { mayor_65, mayor_70 } = calcularEdades(fecha_nacimiento, fechaActual);
        
        const queryPersona = `INSERT INTO personas (socio, nombre, documento, fecha_nacimiento, titular, mayor_65, mayor_70, fecha_afiliacion) 
                              VALUES ($1, $2, $3, $4, true, $5, $6, CURRENT_DATE)`;
        await client.query(queryPersona, [socio, nombre, documento, fecha_nacimiento, mayor_65, mayor_70]);

        // 3. Crear el primer pago (Colilla)
        const valor_total = valor_mes * parseInt(meses_iniciales);
        const fechaHasta = new Date(fechaActual);
        fechaHasta.setMonth(fechaHasta.getMonth() + parseInt(meses_iniciales));

        const queryColilla = `INSERT INTO colillas (socio, valor, fecha, fecha_desde, fecha_hasta, usuario) 
                              VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE, $3, $4) RETURNING id`;
        const resColilla = await client.query(queryColilla, [socio, valor_total, fechaHasta, usuario]);
        const colillaId = resColilla.rows[0].id;

        // 4. Registrar ingreso en tabla SALDO
        const conceptoSaldo = `Pago inicial (${meses_iniciales} meses) - Póliza ${socio}`;
        const querySaldo = `INSERT INTO saldo (id_tipo, concepto, valor, saldo, usuario) VALUES ($1, $2, $3, $4, $5)`;
        await client.query(querySaldo, [`COLILLA_${colillaId}`, conceptoSaldo, valor_total, valor_total, usuario]); // Puedes ajustar la lógica matemática del saldo total luego

        await client.query('COMMIT');
        res.json({ success: true, message: "Póliza, titular y pago inicial registrados." });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

exports.consultarPoliza = async (req, res) => {
    try {
        const { parametro } = req.params; // Puede ser número de socio o documento

        // Buscar todos los socios que coincidan con el socio explícito o que tengan una persona con ese documento
        const queryBusqueda = `
            SELECT DISTINCT p.socio, po.telefono, po.valor_mes, po.nota 
            FROM polizas po
            JOIN personas p ON po.socio = p.socio
            WHERE po.socio::text = $1 OR p.documento = $1
        `;
        const resBusqueda = await pool.query(queryBusqueda, [parametro]);

        if (resBusqueda.rows.length === 0) return res.status(404).json({ error: "No se encontraron pólizas." });

        // Si devuelve MÁS DE UNA póliza (ej. documento está en varias), devolver lista para que el usuario elija
        if (resBusqueda.rows.length > 1) {
            return res.json({ multiple: true, opciones: resBusqueda.rows });
        }

        // Si solo hay una, devolver todos los datos (Póliza, personas, último pago)
        const socioEncontrado = resBusqueda.rows[0].socio;
        const resPersonas = await pool.query('SELECT * FROM personas WHERE socio = $1 ORDER BY titular DESC', [socioEncontrado]);
        const resUltimoPago = await pool.query('SELECT * FROM colillas WHERE socio = $1 ORDER BY fecha DESC LIMIT 1', [socioEncontrado]);

        res.json({
            multiple: false,
            poliza: resBusqueda.rows[0],
            personas: resPersonas.rows,
            ultimo_pago: resUltimoPago.rows[0] || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.guardarPersona = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, socio, nombre, documento, fecha_nacimiento, telefono, titular, fallecio, fecha_fallecimiento } = req.body;
        await client.query('BEGIN');

        // Actualizar el teléfono de la póliza general
        await client.query('UPDATE polizas SET telefono = $1 WHERE socio = $2', [telefono, socio]);

        // Regla: Si esta persona se marca como titular, quitarle el titular a los demás de la misma póliza
        if (titular) {
            await client.query('UPDATE personas SET titular = false WHERE socio = $1', [socio]);
        }

        if (id) {
            // Modificación: Leer fecha_afiliacion original para recalcular edades
            const resAfil = await client.query('SELECT fecha_afiliacion FROM personas WHERE id = $1', [id]);
            const fechaAfil = resAfil.rows[0].fecha_afiliacion;
            const { mayor_65, mayor_70 } = calcularEdades(fecha_nacimiento, fechaAfil);

            const query = `UPDATE personas SET nombre=$1, documento=$2, fecha_nacimiento=$3, titular=$4, fallecio=$5, 
                           fecha_fallecimiento=$6, mayor_65=$7, mayor_70=$8 WHERE id=$9`;
            await client.query(query, [nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento, mayor_65, mayor_70, id]);
        } else {
            // Nueva Persona: Se afilia hoy
            const { mayor_65, mayor_70 } = calcularEdades(fecha_nacimiento, new Date());
            const query = `INSERT INTO personas (socio, nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento, mayor_65, mayor_70, fecha_afiliacion) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)`;
            await client.query(query, [socio, nombre, documento, fecha_nacimiento, titular, fallecio, fecha_fallecimiento, mayor_65, mayor_70]);
        }

        // Validación Final: Asegurarse de que al menos exista 1 titular
        const checkTitular = await client.query('SELECT count(*) FROM personas WHERE socio = $1 AND titular = true', [socio]);
        if (parseInt(checkTitular.rows[0].count) !== 1) {
            throw new Error("Debe existir obligatoriamente 1 titular en la póliza (ni cero, ni varios).");
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Datos de la persona guardados y evaluados." });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

exports.eliminarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        // Impedir que se elimine si es el titular (opcionalmente puedes agregar esa lógica, pero dejaremos el borrado por ahora)
        await pool.query('DELETE FROM personas WHERE id = $1', [id]);
        res.json({ success: true, message: "Persona eliminada." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// MÓDULO COLILLAS
// ==========================================
exports.crearColilla = async (req, res) => {
    const client = await pool.connect();
    try {
        const { socio, meses, valor_total, fecha_desde, fecha_hasta, usuario } = req.body;
        await client.query('BEGIN');

        // Insertar Colilla
        const queryCol = `INSERT INTO colillas (socio, valor, fecha, fecha_desde, fecha_hasta, usuario) 
                          VALUES ($1, $2, CURRENT_DATE, $3, $4, $5) RETURNING id`;
        const resCol = await client.query(queryCol, [socio, valor_total, fecha_desde, fecha_hasta, usuario]);
        
        // Insertar Saldo
        const querySaldo = `INSERT INTO saldo (id_tipo, concepto, valor, saldo, usuario) VALUES ($1, $2, $3, $4, $5)`;
        await client.query(querySaldo, [`COLILLA_${resCol.rows[0].id}`, `Pago de ${meses} mes(es) - Socio ${socio}`, valor_total, valor_total, usuario]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Colilla y saldo registrados." });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

exports.consultarColillasSocio = async (req, res) => {
    try {
        const { socio } = req.params;
        const result = await pool.query('SELECT * FROM colillas WHERE socio = $1 ORDER BY fecha DESC', [socio]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};