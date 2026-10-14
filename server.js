const express = require('express');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar lectura de JSON en el cuerpo de las peticiones (Vital para el CRUD)
app.use(express.json());

// Servir la carpeta public (Vistas)
app.use(express.static(path.join(__dirname, 'public')));

// Enlazar las rutas API (Controladores de S3 y Base de datos)
app.use('/api', apiRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});