const cacheS3 = { polizas: [], colillas: [] };

// Control de vistas principales
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById(`btn-${viewName}`).classList.add('active');
}

// Control de sub-vistas (Pestañas internas)
function showSubView(subViewId) {
    const parentView = document.getElementById(subViewId).closest('.view');
    parentView.querySelectorAll('.sub-view').forEach(sv => sv.classList.remove('active'));
    document.getElementById(subViewId).classList.add('active');

    // Cargar S3 dinámicamente si se abre la pestaña de archivos
    if (subViewId === 'polizas-archivos' && cacheS3.polizas.length === 0) {
        cargarDesdeS3('polizas', 'select-polizas');
    }
    if (subViewId === 'colillas-archivos' && cacheS3.colillas.length === 0) {
        cargarDesdeS3('colillas', 'select-colillas');
    }
}

// Lógica de S3
async function cargarDesdeS3(carpeta, selectId) {
    try {
        const res = await fetch(`/api/s3/${carpeta}`);
        const data = await res.json();
        cacheS3[carpeta] = data;
        
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">-- Seleccione un documento PDF --</option>';
        data.forEach(file => {
            const option = document.createElement('option');
            option.value = file.url;
            option.textContent = file.nombre;
            select.appendChild(option);
        });
    } catch (e) {
        console.error(`Error S3 (${carpeta})`, e);
    }
}

function displayPdf(selectId, viewerId) {
    const url = document.getElementById(selectId).value;
    const iframe = document.getElementById(viewerId);
    if (url) {
        iframe.src = url;
        iframe.style.display = 'block';
    } else {
        iframe.style.display = 'none';
    }
}

// Lógica de Base de Datos (Pólizas)
async function consultarPoliza() {
    const doc = document.getElementById('buscar-documento').value;
    const res = await fetch(`/api/polizas/${doc}`);
    const data = await res.json();
    document.getElementById('resultado-poliza').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

async function crearPoliza(e) {
    e.preventDefault();
    const payload = {
        socio: document.getElementById('p-socio').value,
        nombre: document.getElementById('p-nombre').value,
        documento: document.getElementById('p-documento').value,
        fecha_nacimiento: document.getElementById('p-fecha-nac').value,
        telefono: document.getElementById('p-telefono').value,
        titular: document.getElementById('p-titular').value,
        valor_mes: document.getElementById('p-valor').value,
        nota: document.getElementById('p-nota').value,
    };
    await fetch('/api/polizas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    alert('Póliza guardada');
    e.target.reset();
}

// Lógica de Base de Datos (Colillas)
async function consultarColillas() {
    const socio = document.getElementById('buscar-socio-colilla').value;
    const res = await fetch(`/api/colillas/${socio}`);
    const data = await res.json();
    document.getElementById('resultado-colillas').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

async function crearColilla(e) {
    e.preventDefault();
    const payload = {
        socio: document.getElementById('c-socio').value,
        meses: document.getElementById('c-meses').value,
        valor_total: document.getElementById('c-valor').value
    };
    await fetch('/api/colillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    alert('Colilla generada');
    e.target.reset();
}