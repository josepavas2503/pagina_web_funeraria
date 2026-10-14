const express = require('express');
const router = express.Router();
const s3Controller = require('../controllers/s3Controller');
const dbController = require('../controllers/dbController');

// Rutas S3 (Archivos PDF)
router.get('/s3/:folder', s3Controller.getFilesByFolder);

// Rutas Pólizas
router.post('/polizas', dbController.crearPoliza);
router.get('/polizas/:socio', dbController.consultarPoliza);

// Rutas Personas (Beneficiarios y Titulares)
router.post('/personas', dbController.guardarPersona);
router.delete('/personas/:id', dbController.eliminarPersona);

// Rutas Colillas (Pagos)
router.post('/colillas', dbController.crearColilla);
router.get('/colillas/:socio', dbController.consultarColillasSocio);

module.exports = router;