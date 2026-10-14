const express = require('express');
const router = express.Router();
const s3Controller = require('../controllers/s3Controller');
const dbController = require('../controllers/dbController');

// Rutas S3 (Archivos)
router.get('/s3/:folder', s3Controller.getFilesByFolder);

// Rutas Base de Datos (Pólizas)
router.get('/polizas/:documento', dbController.consultarPoliza);
router.post('/polizas', dbController.crearPoliza);

// Rutas Base de Datos (Colillas)
router.get('/colillas/:socio', dbController.consultarColillas);
router.post('/colillas', dbController.crearColilla);

module.exports = router;