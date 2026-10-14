const cacheS3 = { polizas: [], colillas: [] };
let socioActualGlobal = null; // Para recordar qué póliza estamos viendo

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById(`btn-${viewName}`).classList.add('active');
}

function showSubView(subViewId) {
    const parentView = document.getElementById(subViewId).closest('.view');
    parentView.querySelectorAll('.sub-view').forEach(sv => sv.classList.remove('active'));
    document.getElementById(subViewId).classList.add('active');

    if (subViewId === 'polizas-archivos' && cacheS3.polizas.length === 0) cargarDesdeS3('polizas', 'select-polizas');
    if (subViewId === 'colillas-archivos' && cacheS3.colillas.length === 0) cargarDesdeS3('colillas', 'select-colillas');
}

// ==========================================
// MÓDULO PÓLIZAS
// ==========================================

async function crearPoliza(e) {
    e.preventDefault();
    const payload = {
        socio: document.getElementById('p-socio').value,
        valor_mes: document.getElementById('p-valor').value,
        telefono: document.getElementById('p-telefono').value,
        usuario: document.getElementById('p-usuario').value,
        nombre: document.getElementById('p-nombre').value,
        documento: document.getElementById('p-documento').value,
        fecha_nacimiento: document.getElementById('p-fecha-nac').value,
        meses_iniciales: document.getElementById('p-meses').value,
        nota: document.getElementById('p-nota').value
    };
    try {
        const res = await fetch('/api/polizas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) { alert('Proceso exitoso: Póliza, titular y pago inicial registrados.'); e.target.reset(); }
        else { const err = await res.json(); alert('Error: ' + err.error); }
    } catch(err) { alert('Error de conexión'); }
}

async function consultarPoliza(forzarSocio = null) {
    const parametro = forzarSocio || document.getElementById('buscar-socio').value;
    if(!parametro) return;
    
    // Ocultar modal si viene de una selección forzada
    document.getElementById('modal-selector-polizas').style.display = 'none';

    try {
        const res = await fetch(`/api/polizas/${parametro}`);
        if(!res.ok) return alert('No se encontraron resultados para ese Socio o Documento.');
        const data = await res.json();
        
        // Si hay varios resultados (Multiples pólizas para un documento)
        if (data.multiple) {
            const ul = document.getElementById('lista-opciones-polizas');
            ul.innerHTML = '';
            data.opciones.forEach(op => {
                const li = document.createElement('li');
                li.style.marginBottom = '10px';
                li.innerHTML = `<button class="btn-small" onclick="consultarPoliza('${op.socio}')" style="width:100%;">Abrir Póliza N° ${op.socio}</button>`;
                ul.appendChild(li);
            });
            document.getElementById('modal-selector-polizas').style.display = 'block';
            return; // Se detiene aquí esperando que el usuario elija
        }

        // Si solo hay un resultado, cargamos todo normal
        socioActualGlobal = data.poliza.socio;
        document.getElementById('detalle-poliza-container').style.display = 'block';
        
        document.getElementById('lbl-socio').textContent = data.poliza.socio;
        document.getElementById('lbl-telefono').textContent = data.poliza.telefono || 'N/A';
        document.getElementById('lbl-valormes').textContent = data.poliza.valor_mes;
        document.getElementById('lbl-nota').textContent = data.poliza.nota || 'Sin notas';

        const lblPago = document.getElementById('lbl-ultimopago');
        if(data.ultimo_pago) {
            lblPago.innerHTML = `Última colilla (#${data.ultimo_pago.id}): <b>$${data.ultimo_pago.valor}</b> el <b>${new Date(data.ultimo_pago.fecha).toLocaleDateString()}</b>.`;
        } else {
            lblPago.textContent = "No hay pagos registrados.";
        }

        const tbody = document.querySelector('#tabla-personas tbody');
        tbody.innerHTML = '';
        data.personas.forEach(p => {
            const tr = document.createElement('tr');
            // Las variables p.mayor_65 y p.mayor_70 vienen de la DB calculadas!
            tr.innerHTML = `
                <td>${p.nombre} <br><small style="color:gray;">${p.mayor_70 ? 'Mayor 70' : (p.mayor_65 ? 'Mayor 65' : 'Menor 65')}</small></td>
                <td>${p.documento || ''}</td>
                <td style="text-align:center;">${p.titular ? '<span style="color:green; font-weight:bold;">★ Sí</span>' : 'No'}</td>
                <td>${p.fallecio ? '<b style="color:red;">Sí</b>' : 'No'}</td>
                <td>
                    <button class="btn-small" onclick='abrirModalEdicion(${JSON.stringify(p)}, "${data.poliza.telefono || ''}")'>Editar</button>
                    <button class="btn-danger" onclick="eliminarPersona(${p.id})">Borrar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) { console.error(err); }
}

// ==========================================
// MODALES Y EDICIÓN (Personas)
// ==========================================

function abrirModalEdicion(persona = null, telefonoPoliza = '') {
    const modal = document.getElementById('modal-edicion');
    document.getElementById('modal-titulo').textContent = persona ? 'Modificar Persona' : 'Agregar Beneficiario';
    
    document.getElementById('edit-id').value = persona ? persona.id : '';
    document.getElementById('edit-nombre').value = persona ? persona.nombre : '';
    document.getElementById('edit-documento').value = persona ? persona.documento : '';
    document.getElementById('edit-nacimiento').value = persona && persona.fecha_nacimiento ? persona.fecha_nacimiento.split('T')[0] : '';
    document.getElementById('edit-telefono').value = telefonoPoliza;
    document.getElementById('edit-titular').checked = persona ? persona.titular : false;
    document.getElementById('edit-fallecio').checked = persona ? persona.fallecio : false;
    
    toggleFallecimiento();
    if(persona && persona.fallecio && persona.fecha_fallecimiento) {
        document.getElementById('edit-fechafallecimiento').value = persona.fecha_fallecimiento.split('T')[0];
    }

    modal.style.display = 'block';
}

function toggleFallecimiento() {
    const isFallecido = document.getElementById('edit-fallecio').checked;
    document.getElementById('div-fechafallecimiento').style.display = isFallecido ? 'block' : 'none';
}

function cerrarModal() { document.getElementById('modal-edicion').style.display = 'none'; }

async function guardarPersonaEdicion() {
    const payload = {
        id: document.getElementById('edit-id').value || null,
        socio: socioActualGlobal,
        nombre: document.getElementById('edit-nombre').value,
        documento: document.getElementById('edit-documento').value,
        fecha_nacimiento: document.getElementById('edit-nacimiento').value || null,
        telefono: document.getElementById('edit-telefono').value,
        titular: document.getElementById('edit-titular').checked,
        fallecio: document.getElementById('edit-fallecio').checked,
        fecha_fallecimiento: document.getElementById('edit-fallecio').checked ? document.getElementById('edit-fechafallecimiento').value : null
    };

    try {
        const res = await fetch('/api/personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) { cerrarModal(); consultarPoliza(); }
        else { const err = await res.json(); alert('Error: ' + err.error); }
    } catch(err) { console.error(err); }
}

async function eliminarPersona(id) {
    if(confirm('¿Está seguro de eliminar esta persona? Todos sus datos se perderán.')) {
        await fetch(`/api/personas/${id}`, { method: 'DELETE' });
        consultarPoliza();
    }
}

// ==========================================
// MÓDULO COLILLAS
// ==========================================

async function validarSocioParaPago() {
    const socio = document.getElementById('c-validar-socio').value;
    if(!socio) return;
    const res = await fetch(`/api/polizas/${socio}`);
    if(res.ok) {
        document.getElementById('form-crear-colilla').style.display = 'flex';
        document.getElementById('c-lbl-socio').textContent = socio;
    } else {
        alert('Póliza no encontrada. Verifique el número de socio.');
        document.getElementById('form-crear-colilla').style.display = 'none';
    }
}

async function crearColilla(e) {
    e.preventDefault();
    const payload = {
        socio: document.getElementById('c-lbl-socio').textContent,
        valor: document.getElementById('c-valor').value,
        fecha_desde: document.getElementById('c-fecha-desde').value,
        fecha_hasta: document.getElementById('c-fecha-hasta').value,
        usuario: document.getElementById('c-usuario').value
    };
    try {
        const res = await fetch('/api/colillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) { alert('Pago (Colilla) registrado correctamente.'); e.target.reset(); document.getElementById('form-crear-colilla').style.display = 'none'; }
    } catch(err) { alert('Error al registrar pago'); }
}

async function consultarColillas(socioTarget, tablaContenedorId) {
    const res = await fetch(`/api/colillas/${socioTarget}`);
    const data = await res.json();
    const tbody = document.querySelector(`#${tablaContenedorId} tbody`);
    tbody.innerHTML = '';
    
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay pagos registrados.</td></tr>';
    } else {
        data.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${new Date(c.fecha).toLocaleDateString()}</td>
                <td>$${c.valor}</td>
                <td>${new Date(c.fecha_desde).toLocaleDateString()} a ${new Date(c.fecha_hasta).toLocaleDateString()}</td>
                <td>${c.usuario}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    document.getElementById(tablaContenedorId).style.display = 'table';
}

function consultarColillasDesdeTab() {
    const socio = document.getElementById('buscar-socio-colilla').value;
    if(socio) consultarColillas(socio, 'tabla-colillas');
}

function abrirHistorialPagos() {
    document.getElementById('modal-pagos-socio').textContent = socioActualGlobal;
    document.getElementById('modal-pagos').style.display = 'block';
    consultarColillas(socioActualGlobal, 'tabla-modal-colillas');
}
function cerrarModalPagos() { document.getElementById('modal-pagos').style.display = 'none'; }

// ==========================================
// MÓDULO S3 (ARCHIVOS)
// ==========================================
async function cargarDesdeS3(carpeta, selectId) {
    try {
        const res = await fetch(`/api/s3/${carpeta}`);
        const data = await res.json();
        cacheS3[carpeta] = data;
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">-- Seleccione un documento PDF --</option>';
        data.forEach(f => {
            const op = document.createElement('option');
            op.value = f.url; op.textContent = f.nombre;
            select.appendChild(op);
        });
    } catch (e) { console.error(`Error S3`, e); }
}

function displayPdf(selectId, viewerId) {
    const url = document.getElementById(selectId).value;
    const iframe = document.getElementById(viewerId);
    if(url) { iframe.src = url; iframe.style.display = 'block'; } 
    else iframe.style.display = 'none';
}