// =================================================================================================
// Archivo: sistema-imc.js (VERSIÓN FINAL CORREGIDA - CON LOGIN Y ELIMINAR FUNCIONALES)
// =================================================================================================

// --- 1. Credenciales de Administrador (Autenticación Local Simple) ---
const ADMIN_CREDENTIALS = {
    'fpachecov': 'fpachecov',
    'jordayac': '123456789',
    '123456': '123456'
};

const ADMIN_DETAILS = {
    'fpachecov': 'Pacheco Valverde Francis',
    'jordayac': 'Ordaya Crisostomo Jesser',
    '123456': 'USUARIO DE PRUEBA'
};


// --- 2. Variables de Estado Globales ---
let isAuthenticated = false;
let currentAdminUser = null;
let allRecordsFromDB = [];
let currentFilteredRecords = [];


// --- 3. Funciones de Utilidad y UI ---

function displayMessage(title, text, type) {
    const box = document.getElementById('message-box');
    const titleEl = box.querySelector('p:nth-child(1)');
    const textEl = box.querySelector('p:nth-child(2)');

    box.classList.remove('hidden', 'bg-red-600', 'bg-yellow-600', 'bg-green-600');
    let bgColor = '';
    if (type === 'error' || type === 'alert') bgColor = 'bg-red-600';
    else if (type === 'warning') bgColor = 'bg-yellow-600';
    else if (type === 'success') bgColor = 'bg-green-600';

    box.classList.add(bgColor);
    titleEl.innerHTML = title;
    textEl.textContent = text;
    box.classList.remove('hidden');

    setTimeout(() => {
        box.classList.add('hidden');
    }, 5000);
}

async function updateUI() {
    const publicView = document.getElementById('public-access-view');
    const adminView = document.getElementById('admin-dashboard-view');
    const userInfo = document.getElementById('current-user-info');
    const monitoringTextEl = document.getElementById('monitoring-status-text');

    if (isAuthenticated) {
        publicView.classList.add('hidden-view');
        adminView.classList.remove('hidden-view');
        userInfo.textContent = `Usuario: ${currentAdminUser.toUpperCase()}`;
        userInfo.classList.remove('text-color-accent-lime', 'border-gray-600');
        userInfo.classList.add('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');

        if (monitoringTextEl && ADMIN_DETAILS[currentAdminUser]) {
            const adminName = ADMIN_DETAILS[currentAdminUser];
            monitoringTextEl.innerHTML = `
                <i class="fas fa-check-double mr-3 text-color-accent-gold"></i>
                **SISTEMA ONLINE.** Monitoreo Activo: <span class="text-color-accent-lime">${adminName}</span>`;
        }
        
        updateAdminTableHeaders();
        await fetchAndDisplayRecords();
    } else {
        publicView.classList.remove('hidden-view');
        adminView.classList.add('hidden-view');
        userInfo.textContent = 'Estado: SIN AUTENTICAR';
        userInfo.classList.remove('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');
        userInfo.classList.add('text-color-accent-lime', 'border-gray-600');

        if (monitoringTextEl) {
            monitoringTextEl.innerHTML = '¡Sistema en espera! Inicie sesión para activar el monitoreo.';
        }
    }
}

function updateAdminTableHeaders() {
    const tableHeaderRow = document.querySelector('#admin-dashboard-view thead tr');
    if (tableHeaderRow) {
        // **[CORREGIDO]** Se restauran todas las columnas y se añade ACCIÓN al final
        tableHeaderRow.innerHTML = `
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">CIP</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">GRADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">APELLIDO/NOMBRE</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PESO/ALTURA</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">EDAD</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">RESULTADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">SEXO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">FECHA</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-color-accent-lime">ACCIÓN</th>
        `;
    }
}

function getSimplifiedAptitudeStyle(resultado) {
    if (resultado.includes('INAPTO')) return 'bg-red-700 text-white';
    return 'bg-green-700 text-white';
}


// --- 4. Funciones de Cálculo de IMC y Clasificación ---

function calculateIMC(weight, height) {
    if (height > 0) {
        const imc = weight / (height * height);
        return imc.toFixed(1);
    }
    return 0;
}

function getAptitude(imc) {
    const imcFloat = parseFloat(imc);
    let clasificacionMINSA, resultado, detalle;

    if (imcFloat < 18.5) clasificacionMINSA = "Bajo Peso";
    else if (imcFloat <= 24.9) clasificacionMINSA = "Normal";
    else if (imcFloat <= 29.9) clasificacionMINSA = "Sobrepeso";
    else if (imcFloat <= 34.9) clasificacionMINSA = "Obesidad I";
    else if (imcFloat <= 39.9) clasificacionMINSA = "Obesidad II";
    else clasificacionMINSA = "Obesidad III";

    if (imcFloat < 30.0) {
        if (imcFloat < 18.5) {
             resultado = "APTO (Bajo)";
             detalle = `Clasificación MINSA: ${clasificacionMINSA}. Apto. Recomendación: Evaluar ganancia de peso saludable.`;
        } else {
             resultado = "APTO";
             detalle = `Clasificación MINSA: ${clasificacionMINSA}. Aptitud confirmada.`;
        }
    } else {
        resultado = "INAPTO";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. INAPTO. Se requiere reevaluación médica inmediata.`;
    }
    return { resultado, detalle };
}

document.getElementById('bmi-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('input-weight').value);
    const height = parseFloat(document.getElementById('input-height').value);
    if (weight > 0 && height > 0) {
        const imc = calculateIMC(weight, height);
        const { resultado, detalle } = getAptitude(imc);
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        document.getElementById('bmi-value').textContent = imc;
        document.getElementById('aptitude-badge').textContent = resultado;
        document.getElementById('aptitude-badge').className = `aptitude-badge px-5 py-2 font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('aptitude-detail').textContent = detalle;
        document.getElementById('result-box').classList.remove('hidden');
    } else {
        displayMessage('Error de Entrada', 'Por favor ingrese valores válidos de peso y altura.', 'error');
        document.getElementById('result-box').classList.add('hidden');
    }
});


// --- 5. Funciones de Autenticación y Administración ---

function attemptAdminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    if (ADMIN_CREDENTIALS[username] === password) {
        isAuthenticated = true;
        currentAdminUser = username;
        displayMessage('ACCESO CONCEDIDO', `Bienvenido, ${username.toUpperCase()}. Acceso a Módulo de Gestión.`, 'success');
        updateUI();
    } else {
        displayMessage('ACCESO DENEGADO', 'Credenciales de Usuario o Clave incorrectas.', 'error');
    }
}

function logoutAdmin() {
    isAuthenticated = false;
    currentAdminUser = null;
    allRecordsFromDB = [];
    currentFilteredRecords = [];
    displayMessage('SESIÓN CERRADA', 'Has salido del módulo de administración.', 'warning');
    const adminResultBox = document.getElementById('admin-result-box');
    if (adminResultBox) adminResultBox.classList.add('hidden');
    updateUI();
}

// --- 6. Funciones de Data y CRUD (Comunicación con el Servidor Local) ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records');
        if (!response.ok) throw new Error('Error al obtener los registros del servidor.');
        allRecordsFromDB = await response.json();
        populateMonthFilter();
        filterTable();
    } catch (error) {
        console.error("Error fetching records:", error);
        displayMessage('Error de Conexión', 'No se pudieron cargar los registros. Asegúrese de que el servidor esté funcionando.', 'error');
        const tableBody = document.getElementById('admin-table-body');
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-10">Error al cargar datos. Verifique la consola.</td></tr>`;
    }
}

async function saveRecord(record) {
    try {
        const response = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al guardar el registro.');
        }
        displayMessage('REGISTRO EXITOSO', `Personal con CIP ${record.cip} ha sido guardado en la base de datos.`, 'success');
        document.getElementById('admin-record-form').reset();
        setTimeout(() => document.getElementById('admin-result-box').classList.add('hidden'), 5000);
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error saving record:', error);
        displayMessage('Error al Guardar', error.message, 'error');
    }
}

async function deleteRecord(cip) {
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente el registro con CIP ${cip}?`)) {
        return;
    }
    try {
        const response = await fetch(`/api/records/${cip}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar el registro.');
        }
        displayMessage('ELIMINADO', `El registro con CIP ${cip} ha sido eliminado.`, 'warning');
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error deleting record:', error);
        displayMessage('Error al Eliminar', error.message, 'error');
    }
}

function populateMonthFilter() {
    const filterSelect = document.getElementById('month-filter');
    const monthCounts = allRecordsFromDB.reduce((acc, record) => {
        const monthYear = record.fecha.substring(3); 
        acc[monthYear] = (acc[monthYear] || 0) + 1;
        return acc;
    }, {});
    filterSelect.innerHTML = '<option value="">Todos los Meses</option>';
    Object.keys(monthCounts).sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        if (yearA !== yearB) return yearB - yearA; 
        return monthB - monthA; 
    }).forEach(monthYear => {
        const count = monthCounts[monthYear];
        const [month, year] = monthYear.split('/');
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} (${count} Registros)`;
        filterSelect.appendChild(option);
    });
    const defaultOption = filterSelect.querySelector('option[value=""]');
    defaultOption.textContent = `Todos los Meses (${allRecordsFromDB.length} Registros)`;
}

function filterTable() {
    const nameSearchTerm = document.getElementById('name-filter').value.toLowerCase().trim();
    const ageFilterValue = document.getElementById('age-filter').value;
    const monthFilter = document.getElementById('month-filter').value;
    let recordsToDisplay = allRecordsFromDB;
    if (nameSearchTerm) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            `${record.apellido} ${record.nombre}`.toLowerCase().includes(nameSearchTerm)
        );
    }
    if (ageFilterValue && !isNaN(parseInt(ageFilterValue))) {
        const ageToMatch = parseInt(ageFilterValue);
        recordsToDisplay = recordsToDisplay.filter(record => record.edad === ageToMatch);
    }
    if (monthFilter) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            record.fecha.substring(3) === monthFilter
        );
    }
    currentFilteredRecords = recordsToDisplay;
    renderTable(currentFilteredRecords);
}

function renderTable(records) {
    const tableBody = document.getElementById('admin-table-body');
    tableBody.innerHTML = '';
    // **[CORREGIDO]** El colspan ahora es 10 para incluir la nueva columna
    const COLSPAN_VALUE = 10;
    if (!isAuthenticated) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-4">No está autenticado.</td></tr>`;
        return;
    }
    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-10">No hay registros que coincidan con los filtros.</td></tr>`;
        return;
    }
    records.forEach(data => {
        const { resultado } = getAptitude(data.imc);
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        const rowBgClass = resultado.includes('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        // **[CORREGIDO]** Se renderizan todas las columnas originales y se añade la celda de acción
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${data.cip || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold">${data.grado || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">${(data.apellido || 'N/A').toUpperCase()}, ${data.nombre || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${data.peso || 'N/A'} kg / ${data.altura || 'N/A'} m</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-gold">${data.edad || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-lg font-extrabold ${resultado.includes('INAPTO') ? 'text-red-500' : 'text-color-accent-gold'}">${data.imc || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="inline-flex px-3 py-1 text-xs font-bold rounded-full ${badgeClass}">${resultado}</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-color-text-muted">${data.sexo || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-color-text-muted">${data.fecha || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center">
                <button onclick="deleteRecord('${data.cip}')" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar Registro">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
    });
}

function exportToWord() {
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para exportar.', 'error');
        return;
    }
    if (currentFilteredRecords.length === 0) {
        displayMessage('Sin Datos', 'No hay registros para exportar.', 'warning');
        return;
    }
    const tableHeaderStyle = "background-color: #333; color: white; padding: 3px; text-align: center; font-size: 10px; border: 1px solid #333; font-weight: bold; border-collapse: collapse; white-space: nowrap; font-family: 'Arial', sans-serif;";
    const cellStyle = "padding: 3px; text-align: center; font-size: 10px; border: 1px solid #ccc; vertical-align: middle; border-collapse: collapse; font-family: 'Arial', sans-serif;";
    const inaptoTextStyle = 'style="color: #991b1b; font-weight: bold; text-align: center; font-family: \'Arial\', sans-serif;"';
    const aptoTextStyle = 'style="color: #065f46; font-weight: bold; text-align: center; font-family: \'Arial\', sans-serif;"';
    const titleStyle = "text-align: center; color: #1e3a8a; font-size: 18px; margin-bottom: 5px; font-weight: bold; font-family: 'Arial', sans-serif;";
    const subtitleStyle = "text-align: center; font-size: 12px; margin-bottom: 20px; font-family: 'Arial', sans-serif;";
    const reportDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte SIMCEP</title><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 70%; margin: 20px auto; } td, th { border-collapse: collapse; }</style></head><body><div style="text-align: center; width: 100%;"><h1 style="${titleStyle}">REPORTE DE ÍNDICE DE MASA CORPORAL (SIMCEP)</h1><p style="${subtitleStyle}">Fecha: ${reportDate} | Registros Filtrados: ${currentFilteredRecords.length}</p></div><table border="1"><thead><tr><th style="${tableHeaderStyle}; width: 10%;">GRADO</th><th style="${tableHeaderStyle}; width: 35%;">APELLIDO, NOMBRE</th><th style="${tableHeaderStyle}; width: 10%;">EDAD</th><th style="${tableHeaderStyle}; width: 15%;">IMC</th><th style="${tableHeaderStyle}; width: 20%;">RESULTADO</th><th style="${tableHeaderStyle}; width: 10%;">FECHA</th></tr></thead><tbody>`;
    currentFilteredRecords.forEach(record => {
        const { resultado } = getAptitude(record.imc); 
        const textStyleTag = resultado.includes('INAPTO') ? inaptoTextStyle : aptoTextStyle;
        const nameCellStyle = `${cellStyle} text-align: left; font-weight: bold;`;
        htmlContent += `<tr><td style="${cellStyle}">${record.grado || 'N/A'}</td><td style="${nameCellStyle}">${(record.apellido || 'N/A').toUpperCase()}, ${record.nombre || 'N/A'}</td><td style="${cellStyle}">${record.edad || 'N/A'}</td><td style="${cellStyle} font-weight: bold;">${record.imc || 'N/A'}</td><td style="${cellStyle}" ${textStyleTag}>${resultado}</td><td style="${cellStyle}">${record.fecha || 'N/A'}</td></tr>`;
    });
    htmlContent += `</tbody></table><div style="margin: 40px auto 0 auto; width: 70%; text-align: center; border: none; font-family: 'Arial', sans-serif;"><h4 style="font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #1e3a8a;">LEYES DE CLASIFICACIÓN DE IMC (MINSA - PERÚ)</h4><p style="font-size: 10px; margin: 5px 0; text-align: left; padding-left: 10%;">**Clasificación y Rango (IMC kg/m²):**<br>- Bajo peso: &lt; 18.5 (APTO - Bajo)<br>- Peso normal: 18.5 - 24.9 (APTO)<br>- Sobrepeso: 25.0 - 29.9 (APTO - *Requiere monitoreo*)<br>- Obesidad I, II, III: &ge; 30.0 (INAPTO)</p><p style="font-size: 10px; margin-top: 15px; color: #555; text-align: left; padding-left: 10%;">*La aptitud operacional INAPTO en SIMCEP es determinada por un IMC &ge; 30.0, alineado a directivas sanitarias de las Fuerzas Armadas.</p></div></body></html>`;
    const date = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    const filename = `Reporte_SIMCEP_IMC_Word_${date}.doc`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    displayMessage('Exportación Exitosa', `Se ha generado el archivo ${filename} para Word.`, 'success');
}


// --- 7. Event Listeners ---

document.getElementById('admin-record-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para registrar personal.', 'error');
        return;
    }
    const form = e.target;
    const sexo = form.elements['input-sex-admin'].value;
    const cip = form.elements['input-userid'].value;
    const grado = form.elements['input-role'].value;
    const apellido = form.elements['input-lastname'].value;
    const nombre = form.elements['input-firstname'].value;
    const edad = parseInt(form.elements['input-age-admin'].value);
    const peso = parseFloat(form.elements['input-weight-admin'].value);
    const altura = parseFloat(form.elements['input-height-admin'].value);
    if (peso > 0 && altura > 0 && cip && grado && apellido && nombre && edad > 0) {
        const imc = calculateIMC(peso, altura);
        const { resultado, detalle } = getAptitude(imc);
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        document.getElementById('admin-bmi-value').textContent = imc;
        document.getElementById('admin-aptitude-badge').textContent = resultado;
        document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('admin-aptitude-detail').textContent = detalle;
        document.getElementById('admin-result-box').classList.remove('hidden');
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        const newRecord = { sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha: formattedDate, registradoPor: currentAdminUser };
        saveRecord(newRecord);
    } else {
        displayMessage('Error de Entrada', 'Por favor, complete todos los campos obligatorios.', 'error');
        document.getElementById('admin-result-box').classList.add('hidden');
    }
});

document.getElementById('admin-login-button').addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button').addEventListener('click', logoutAdmin);
document.getElementById('export-word-button').addEventListener('click', exportToWord);
document.getElementById('name-filter').addEventListener('input', filterTable);
document.getElementById('age-filter').addEventListener('input', filterTable);
document.getElementById('month-filter').addEventListener('change', filterTable);
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});