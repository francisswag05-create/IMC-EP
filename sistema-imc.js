// sistema-imc.js (Versión Final Definitiva: Login, Filtros, Word y Diseño Integrados)

// --- 1. VARIABLES GLOBALES ---
let isAuthenticated = false;
let currentAdminUser = null; 
let currentAdminFullName = null; 
let currentUserRole = null;
let allRecordsFromDB = [];
let currentFilteredRecords = [];
let isEditMode = false;
let currentEditingRecordId = null;
let progressionChart = null; 

// --- 2. UTILIDAD DE INTERFAZ ---
function displayMessage(title, text, type) {
    const box = document.getElementById('message-box');
    if (!box) return;
    
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

// --- 3. LÓGICA DE FILTROS ---
function populateUnitFilter() {
    const unitSelect = document.getElementById('unit-filter');
    if (!unitSelect) return;

    const units = [...new Set(allRecordsFromDB.map(item => item.unidad))].sort();
    const currentVal = unitSelect.value;
    
    unitSelect.innerHTML = '<option value="">Todas las Unidades</option>';
    
    units.forEach(unit => {
        if (unit && unit.trim() !== "") {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        }
    });
    
    if (currentVal) unitSelect.value = currentVal;
}

function populateMonthFilter() {
    const filterSelect = document.getElementById('month-filter');
    if (!filterSelect) return; 
    
    const monthCounts = allRecordsFromDB.reduce((acc, record) => {
        if (!record.fecha) return acc;
        const monthYear = record.fecha.substring(3); 
        acc[monthYear] = (acc[monthYear] || 0) + 1;
        return acc;
    }, {});
    
    filterSelect.innerHTML = `<option value="">Todos los Meses</option>`;
    
    Object.keys(monthCounts).sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        if (yearA !== yearB) return yearB - yearA; 
        return monthB - monthA; 
    }).forEach(monthYear => {
        const [month, year] = monthYear.split('/');
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = `${monthName.toUpperCase()} ${year} (${monthCounts[monthYear]})`;
        filterSelect.appendChild(option);
    });
}

function filterTable() {
    const nameSearchTerm = document.getElementById('name-filter').value.toLowerCase().trim();
    const ageFilterValue = document.getElementById('age-filter').value;
    const monthFilter = document.getElementById('month-filter').value; 
    const aptitudeFilterValue = (document.getElementById('aptitude-filter').value || '').toUpperCase(); 
    const unitFilterValue = document.getElementById('unit-filter').value; 

    let recordsToDisplay = allRecordsFromDB;
    
    if (nameSearchTerm) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            `${record.apellido} ${record.nombre}`.toLowerCase().includes(nameSearchTerm)
        );
    }
    
    if (ageFilterValue && !isNaN(parseInt(ageFilterValue))) {
        recordsToDisplay = recordsToDisplay.filter(record => record.edad == ageFilterValue);
    }
    
    if (monthFilter) { 
        recordsToDisplay = recordsToDisplay.filter(record => 
            record.fecha && record.fecha.substring(3) === monthFilter
        );
    }

    if (unitFilterValue) {
        recordsToDisplay = recordsToDisplay.filter(record => record.unidad === unitFilterValue);
    }
    
    if (aptitudeFilterValue && aptitudeFilterValue !== 'TODAS LAS APTITUDES') {
        recordsToDisplay = recordsToDisplay.filter(record => {
            const { resultado } = getAptitude(record.imc, record.sexo, record.pab, record.pa);
            return resultado.startsWith(aptitudeFilterValue);
        });
    }
    
    currentFilteredRecords = recordsToDisplay.map(record => {
        const { resultado, clasificacionMINSA, paClasificacion, riesgoAEnf, motivoInapto } = getAptitude(record.imc, record.sexo, record.pab, record.pa); 
        return {
            ...record,
            clasificacionMINSA: clasificacionMINSA,
            resultado: resultado,
            paClasificacion: paClasificacion,
            riesgoAEnf: riesgoAEnf,
            motivo: motivoInapto
        };
    });

    renderTable(currentFilteredRecords);
    renderProgressionChart(currentFilteredRecords);
}

// --- 4. UI UPDATES (CORREGIDO EL ERROR DE VARIABLES) ---
async function updateUI() {
    const publicView = document.getElementById('public-access-view');
    const adminView = document.getElementById('admin-dashboard-view');
    const userInfo = document.getElementById('current-user-info');
    const monitoringTextEl = document.getElementById('monitoring-status-text');
    const userManagementSection = document.getElementById('user-management-section');

    if (!publicView || !adminView) return;

    if (isAuthenticated) {
        publicView.classList.add('hidden-view');
        adminView.classList.remove('hidden-view');
        userInfo.textContent = `Usuario: ${currentAdminUser}`;
        userInfo.classList.remove('text-color-accent-lime', 'border-gray-600');
        userInfo.classList.add('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');

        if (monitoringTextEl && currentAdminFullName) {
            monitoringTextEl.innerHTML = `<i class="fas fa-check-double mr-3 text-color-accent-gold"></i> Monitoreo Activo: <span class="text-color-accent-lime">${currentAdminFullName}</span>`;
        }
        
        if (userManagementSection) {
            userManagementSection.style.display = currentUserRole === 'superadmin' ? 'grid' : 'none';
        }
        
        updateAdminTableHeaders();
        await fetchAndDisplayRecords(); 
        
        if (currentUserRole === 'superadmin') {
            await fetchAndDisplayUsers();
        }

    } else {
        publicView.classList.remove('hidden-view');
        adminView.classList.add('hidden-view');
        userInfo.textContent = 'Estado: SIN AUTENTICAR';
        userInfo.classList.remove('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');
        userInfo.classList.add('text-color-accent-lime', 'border-gray-600');
        
        if (userManagementSection) userManagementSection.style.display = 'none';
    }
}

function updateAdminTableHeaders() {
    const tableHeaderRow = document.querySelector('#admin-dashboard-view thead tr');
    if (tableHeaderRow) {
        tableHeaderRow.innerHTML = `
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">CIP</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">GRADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">APELLIDO/NOMBRE</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">PA / CLASIF</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">PAB / RIESGO</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">PESO/ALT</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">EDAD</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">CLASIF IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">APTITUD</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-color-accent-lime">FECHA</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-color-accent-lime">ACCION</th>
        `;
    }
}

// --- 5. CRUD API ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records');
        if (!response.ok) throw new Error('Error al obtener registros.');
        allRecordsFromDB = await response.json();
        
        populateMonthFilter();
        populateUnitFilter();
        filterTable();
        
    } catch (error) {
        console.error("Error:", error);
        const tb = document.getElementById('admin-table-body');
        if(tb) tb.innerHTML = `<tr><td colspan="12" class="text-center py-10">Error de conexión.</td></tr>`;
    }
}

function renderTable(records) {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (!isAuthenticated) {
        tableBody.innerHTML = `<tr><td colspan="12" class="text-center py-4">No está autenticado.</td></tr>`;
        return;
    }
    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="12" class="text-center py-10">No hay registros.</td></tr>`;
        return;
    }
    
    records.forEach(data => {
        const { resultado, paClasificacion, riesgoAEnf, clasificacionMINSA } = getAptitude(data.imc, data.sexo, data.pab, data.pa);
        
        const badgeClass = resultado.startsWith('INAPTO') ? 'bg-red-700 text-white' : 'bg-green-700 text-white';
        const rowBgClass = resultado.startsWith('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        let clasifDisplay = clasificacionMINSA;
        if(clasifDisplay === 'NO ASISTIÓ') clasifDisplay = "NO ASISTIÓ";
        else if(clasifDisplay.includes('EXCEPCIÓN')) clasifDisplay = "SOBREPESO (EXC)";

        // Botones
        let editBtn = `<button onclick="handleEditRecord(${data.id})" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Editar"><i class="fas fa-pencil-alt"></i></button>`;
        if(data.motivo === 'NO ASISTIÓ') editBtn = `<button class="text-gray-500 text-lg mr-4" disabled><i class="fas fa-pencil-alt"></i></button>`;
        const delBtn = `<button onclick="deleteRecord(${data.id})" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar"><i class="fas fa-trash-alt"></i></button>`;

        const displayPeso = data.peso > 0 ? data.peso : '-';
        const displayAltura = data.altura > 0.1 ? data.altura : '-';
        const displayIMC = data.imc > 0 ? data.imc : 'N/A';

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${data.cip || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold">${data.grado || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">${(data.apellido || 'N/A').toUpperCase()}, ${data.nombre || ''}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${data.pa || 'N/A'} <span class="text-xs opacity-75">(${paClasificacion})</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${data.pab || 'N/A'} <span class="text-xs opacity-75">(${riesgoAEnf})</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${displayPeso} / ${displayAltura}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-gold">${data.edad || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-lg font-extrabold ${resultado.startsWith('INAPTO') ? 'text-red-500' : 'text-color-accent-gold'}">${displayIMC}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">${clasifDisplay}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="inline-flex px-3 py-1 text-xs font-bold rounded-full ${badgeClass}">${resultado}</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-color-text-muted">${data.fecha || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center">${editBtn}${delBtn}</td>
        `;
    });
}

function renderProgressionChart(records) {
    const ctx = document.getElementById('bmiProgressionChart');
    const chartCard = document.getElementById('stats-chart-card');
    if (!ctx || !chartCard) return;

    // Solo mostrar si es un solo usuario filtrado
    const cipList = records.map(r => r.cip);
    const isIndividual = records.length > 0 && cipList.every((val, i, arr) => val === arr[0]);
    
    if (!isIndividual) {
        chartCard.style.display = 'none';
        return;
    }
    
    chartCard.style.display = 'block';

    const chartRecordsAsc = [...records].map(r => {
        const parts = r.fecha.split('/'); 
        const sortKey = parseInt(parts[2]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[0]); 
        return { ...r, sortKey };
    }).sort((a, b) => a.sortKey - b.sortKey);

    const labels = chartRecordsAsc.map(r => r.fecha + (r.motivo==='NO ASISTIÓ' ? ' (X)' : ''));
    const dataPoints = chartRecordsAsc.map(r => r.motivo === 'NO ASISTIÓ' ? null : parseFloat(r.imc));

    if (progressionChart) progressionChart.destroy();

    progressionChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Índice de Masa Corporal (IMC)',
                data: dataPoints,
                borderColor: '#CCFF00',
                backgroundColor: 'rgba(204, 255, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                spanGaps: true,
                pointRadius: 5,
                pointBackgroundColor: dataPoints.map(imc => {
                    if (imc === null) return '#808080';
                    if (imc >= 30) return '#E74C3C'; 
                    if (imc >= 25) return '#FFD700';
                    return '#008744';
                })
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#EEEEEE' } },
                title: { display: true, text: `${records[0].grado} ${records[0].apellido} - PROGRESIÓN`, color: '#FFD700', font: { size: 16 } }
            },
            scales: {
                y: { min: 15, max: 40, ticks: { color: '#A0A0A0' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, title: { display: true, text: 'IMC', color: '#A0A0A0' } },
                x: { ticks: { color: '#A0A0A0' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
            }
        }
    });
}

// --- 5. CÁLCULOS Y LÓGICA DE NEGOCIO ---

function calculateIMC(w, h) { return h > 0 ? (w / (h * h)).toFixed(1) : 0; }

function getRiskByWaist(sex, pab) {
    const p = parseFloat(pab);
    if (p === 0 || isNaN(p)) return 'N/A';
    if (sex === 'Masculino') return p < 94 ? 'RIESGO BAJO' : p < 102 ? 'RIESGO ALTO' : 'RIESGO MUY ALTO';
    return p < 80 ? 'RIESGO BAJO' : p < 88 ? 'RIESGO ALTO' : 'RIESGO MUY ALTO';
}

function getClassificacionPA(pa) {
    if (!pa || !pa.includes('/')) return 'N/A';
    const [s, d] = pa.split('/').map(Number);
    if (isNaN(s)) return 'N/A';
    if (s >= 140 || d >= 90) return 'HIPERTENSION (ESTADIO 2)';
    if (s >= 130 || d >= 80) return 'HIPERTENSION (ESTADIO 1)';
    if (s >= 120 && d < 80) return 'ELEVADA';
    return 'NORMAL';
}

function getAptitude(imc, sex, pab, pa) {
    const i = parseFloat(imc), p = parseFloat(pab);
    if (i === 0 || isNaN(i)) return { resultado: 'INAPTO', clasificacionMINSA: 'NO ASISTIÓ', paClasificacion: 'N/A', riesgoAEnf: 'N/A', motivoInapto: 'NO ASISTIÓ' };
    
    let minsa = "NORMAL";
    if (i < 18.5) minsa = "DELGADEZ";
    else if (i < 25) minsa = "NORMAL";
    else if (i < 30) minsa = "SOBREPESO";
    else if (i < 35) minsa = "OBESIDAD I";
    else if (i < 40) minsa = "OBESIDAD II";
    else minsa = "OBESIDAD III";
    
    const paClass = getClassificacionPA(pa);
    const riesgo = getRiskByWaist(sex, pab);
    
    let inapto = false, motivo = "";
    if (i >= 30.0) { inapto = true; motivo = "IMC Obesidad"; } 
    else if ((sex === 'Masculino' && p >= 94) || (sex === 'Femenino' && p >= 80)) { inapto = true; motivo = "Riesgo Abdominal"; }

    let res = "APTO";
    if (inapto) {
        if ((sex === 'Masculino' && p < 94) || (sex === 'Femenino' && p < 80)) {
            res = "APTO (EXCEPCIÓN)";
        } else {
            res = `INAPTO (${motivo})`;
        }
    }
    return { resultado: res, clasificacionMINSA: minsa, paClasificacion: paClass, riesgoAEnf: riesgo, motivoInapto: motivo };
}

function applyMilitaryIMCException(imc, sex, pab) {
    if (parseFloat(imc) > 29.9) {
        if ((sex === 'Masculino' && parseFloat(pab) < 94) || (sex === 'Femenino' && parseFloat(pab) < 84)) return { imc: 29.9, sobrescrito: true, motivo: "APTO (EXCEPCIÓN PAB)" };
    }
    return { imc: parseFloat(imc), sobrescrito: false, motivo: "" };
}

// --- 6. CONEXIÓN API (CRUD) ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records');
        if (!response.ok) throw new Error('Error al cargar registros.');
        allRecordsFromDB = await response.json();
        populateMonthFilter();
        populateUnitFilter();
        filterTable();
    } catch (error) {
        console.error("Error:", error);
        const tb = document.getElementById('admin-table-body');
        if(tb) tb.innerHTML = `<tr><td colspan="12" class="text-center">Error de conexión.</td></tr>`;
    }
}

async function saveRecord(record) {
    try {
        const response = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
        if (!response.ok) throw new Error('Error al guardar.');
        displayMessage('ÉXITO', 'Registro guardado.', 'success');
        document.getElementById('admin-record-form').reset();
        const now = new Date();
        document.getElementById('input-registro-month').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

async function updateRecord(id, record) {
    try {
        const response = await fetch(`/api/records/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
        if (!response.ok) throw new Error('Error al actualizar.');
        displayMessage('ÉXITO', 'Registro actualizado.', 'success');
        cancelEdit();
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

async function deleteRecord(id) {
    if (!confirm('¿Eliminar registro?')) return;
    try {
        await fetch(`/api/records/${id}`, { method: 'DELETE' });
        displayMessage('ELIMINADO', 'Registro borrado.', 'warning');
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

// --- 7. FORMULARIOS Y EDICIÓN ---

function handleEditRecord(id) {
    const r = allRecordsFromDB.find(x => x.id === id);
    if (!r) return;
    const f = document.getElementById('admin-record-form');
    f['input-gguu'].value = r.gguu; f['input-unidad'].value = r.unidad; f['input-dni'].value = r.dni; f['input-userid'].value = r.cip;
    f['input-role'].value = r.grado; f['input-sex-admin'].value = r.sexo; f['input-lastname'].value = r.apellido; f['input-firstname'].value = r.nombre;
    f['input-age-admin'].value = r.edad; f['input-weight-admin'].value = r.peso; f['input-height-admin'].value = r.altura; f['input-pab'].value = r.pab; f['input-pa'].value = r.pa;
    
    if(r.fecha && r.fecha.length===10) {
        const [d, m, y] = r.fecha.split('/');
        f['input-registro-month'].value = `${y}-${m}`;
    }
    isEditMode = true; currentEditingRecordId = id;
    document.getElementById('cancel-edit-button').classList.remove('hidden');
    document.querySelector('#admin-record-form button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> ACTUALIZAR REGISTRO';
    f.scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    isEditMode = false; currentEditingRecordId = null;
    document.getElementById('admin-record-form').reset();
    document.getElementById('cancel-edit-button').classList.add('hidden');
    document.querySelector('#admin-record-form button[type="submit"]').innerHTML = '<i class="fas fa-database"></i> GUARDAR';
    const now = new Date();
    document.getElementById('input-registro-month').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

// --- 8. LOGIN Y USUARIOS ---

async function attemptAdminLogin() {
    const u = document.getElementById('admin-username').value;
    const p = document.getElementById('admin-password').value;
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({cip:u, password:p}) });
        const d = await res.json();
        if(!res.ok) throw new Error(d.message);
        isAuthenticated = true; currentAdminUser = d.user.cip; currentAdminFullName = d.user.fullName; currentUserRole = d.user.role;
        updateUI();
        displayMessage('BIENVENIDO', `Hola, ${currentAdminFullName}`, 'success');
    } catch(e) { displayMessage('ACCESO DENEGADO', e.message, 'error'); }
}

function logoutAdmin() {
    isAuthenticated = false; currentAdminUser = null;
    updateUI();
    displayMessage('SESIÓN CERRADA', 'Hasta luego.', 'warning');
}

async function fetchAndDisplayUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();
    const tb = document.getElementById('users-table-body');
    if(tb) {
        tb.innerHTML = '';
        users.forEach(u => {
            tb.insertRow().innerHTML = `<td class="px-4 py-3">${u.cip}</td><td class="px-4 py-3">${u.fullName}</td><td class="px-4 py-3 text-center"><button onclick="handleEditUser('${u.cip}')" class="text-blue-500"><i class="fas fa-pencil-alt"></i></button></td>`;
        });
    }
}

function handleEditUser(cip) {
    const p = prompt(`Nueva contraseña para ${cip}:`);
    if(p) fetch(`/api/users/password/${cip}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({newPassword:p})}).then(()=>{alert('Clave cambiada');});
}

// --- 9. EXPORTACIONES ---

function exportToExcel() {
    if (!isAuthenticated) { displayMessage('Error', 'Inicie sesión.', 'error'); return; }
    const btn = document.getElementById('export-excel-button');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GENERANDO...'; btn.disabled = true;
    fetch('/api/export-excel', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ records: currentFilteredRecords, reportMonth: document.getElementById('input-report-month').value }) })
    .then(res => res.blob()).then(blob => {
        const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Reporte_SIMCEP.xlsx`; document.body.appendChild(a); a.click(); a.remove();
        displayMessage('ÉXITO', 'Excel descargado.', 'success');
    }).catch(e => displayMessage('ERROR', e.message, 'error')).finally(() => { btn.innerHTML = original; btn.disabled = false; });
}

// --- FUNCIÓN CORREGIDA QUE FALTABA ---
function exportToWord() {
    if (!isAuthenticated) { displayMessage('Error', 'Inicie sesión.', 'error'); return; }
    if (currentFilteredRecords.length === 0) { displayMessage('Vacío', 'No hay datos.', 'warning'); return; }
    
    const reportDate = new Date().toLocaleDateString('es-ES');
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte</title></head><body>`;
    html += `<h1 style="text-align:center; color:#1e3a8a;">REPORTE SIMCEP</h1><p style="text-align:center;">Fecha: ${reportDate}</p>`;
    html += `<table border="1" style="width:100%; border-collapse:collapse;"><thead><tr style="background:#2F4F4F; color:white;"><th>CIP</th><th>GRADO</th><th>NOMBRE</th><th>IMC</th><th>CLASIF</th></tr></thead><tbody>`;
    
    currentFilteredRecords.forEach(r => {
        const apt = getAptitude(r.imc, r.sexo, r.pab, r.pa);
        const color = apt.resultado.startsWith('INAPTO') ? 'color:red; font-weight:bold;' : 'color:green;';
        html += `<tr><td>${r.cip}</td><td>${r.grado}</td><td>${r.apellido}</td><td>${r.imc}</td><td style="${color}">${apt.resultado}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `Reporte_SIMCEP.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function exportStatsToWord() { displayMessage('INFO', 'Use "Descargar Gráfica PNG" para insertar en Word.', 'warning'); }
function downloadChartAsImage() {
    const canvas = document.getElementById('bmiProgressionChart');
    if(!canvas || !progressionChart) { displayMessage('Error', 'No hay gráfica.', 'error'); return; }
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'Grafica_IMC.png'; a.click();
}

// --- 10. AUTOCOMPLETADO DE DATOS (DNI o CIP) ---

function handleAutofill(value) {
    if (value && value.length >= 6) { 
        fetch(`/api/patient/${value}`).then(r => r.json()).then(d => {
            if (d.cip) {
                const f = document.getElementById('admin-record-form');
                f['input-gguu'].value = d.gguu || '';
                f['input-unidad'].value = d.unidad || '';
                f['input-dni'].value = d.dni || (value.length === 8 ? value : ''); 
                f['input-userid'].value = d.cip || (value.length !== 8 ? value : '');
                f['input-role'].value = d.grado || '';
                f['input-lastname'].value = d.apellido || '';
                f['input-firstname'].value = d.nombre || '';
                f['input-age-admin'].value = d.edad || '';
                f['input-sex-admin'].value = d.sexo || 'Masculino';
                f['input-weight-admin'].value = '';
                f['input-height-admin'].value = '';
                f['input-pab'].value = '';
                f['input-pa'].value = '';
                displayMessage('AUTOCOMPLETADO', `Datos de ${d.grado} ${d.apellido} cargados.`, 'success');
            }
        }).catch(() => { /* Silencio */ });
    }
}

// LISTENERS DE AUTOCOMPLETADO
document.getElementById('input-dni')?.addEventListener('blur', (e) => handleAutofill(e.target.value));
document.getElementById('input-userid')?.addEventListener('blur', (e) => handleAutofill(e.target.value));


// --- 11. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const regInp = document.getElementById('input-registro-month');
    if(regInp) regInp.value = `${now.getFullYear()}-${mStr}`;
    
    document.getElementById('admin-login-button')?.addEventListener('click', attemptAdminLogin);
    document.getElementById('logout-button')?.addEventListener('click', logoutAdmin);
    document.getElementById('unit-filter')?.addEventListener('change', filterTable);
    document.getElementById('month-filter')?.addEventListener('change', filterTable);
    document.getElementById('name-filter')?.addEventListener('input', filterTable);
    document.getElementById('age-filter')?.addEventListener('input', filterTable);
    document.getElementById('aptitude-filter')?.addEventListener('change', filterTable);
    document.getElementById('export-excel-button')?.addEventListener('click', exportToExcel);
    document.getElementById('export-word-button')?.addEventListener('click', exportToWord);
    document.getElementById('export-stats-button')?.addEventListener('click', exportStatsToWord);
    document.getElementById('download-chart-button')?.addEventListener('click', downloadChartAsImage);
    document.getElementById('cancel-edit-button')?.addEventListener('click', cancelEdit);
    
    document.getElementById('add-user-form')?.addEventListener('submit', async (e)=>{
        e.preventDefault();
        await fetch('/api/users', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
            cip: document.getElementById('input-new-cip').value,
            fullName: document.getElementById('input-new-fullname').value,
            email: document.getElementById('input-new-email').value,
            password: document.getElementById('input-new-password').value
        })});
        displayMessage('Usuario', 'Creado', 'success');
        fetchAndDisplayUsers();
    });

    document.getElementById('admin-record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const regMonthVal = f['input-registro-month'].value;
        const [y, m] = regMonthVal.split('-').map(Number);
        const now = new Date();
        if (y > now.getFullYear() || (y === now.getFullYear() && m > (now.getMonth()+1))) {
            displayMessage('ERROR', 'Mes futuro no permitido.', 'error'); return;
        }
        const rec = {
            gguu: f['input-gguu'].value, unidad: f['input-unidad'].value, dni: f['input-dni'].value, cip: f['input-userid'].value,
            grado: f['input-role'].value, sexo: f['input-sex-admin'].value, pa: f['input-pa'].value,
            apellido: f['input-lastname'].value, nombre: f['input-firstname'].value, edad: f['input-age-admin'].value,
            peso: f['input-weight-admin'].value, altura: f['input-height-admin'].value, pab: f['input-pab'].value,
            fecha: `01/${String(m).padStart(2,'0')}/${y}`, dob: f['input-dob'].value || '1990-01-01'
        };
        const imcReal = calculateIMC(rec.peso, rec.altura);
        const exc = applyMilitaryIMCException(imcReal, rec.sexo, rec.pab);
        rec.imc = exc.imc.toFixed(1);
        const apt = getAptitude(rec.imc, rec.sexo, rec.pab, rec.pa);
        rec.motivo = exc.sobrescrito ? exc.motivo : apt.motivoInapto;
        rec.paClasificacion = apt.paClasificacion; rec.riesgoAEnf = apt.riesgoAEnf; rec.registradoPor = currentAdminUser;

        if(isEditMode) updateRecord(currentEditingRecordId, rec);
        else saveRecord(rec);
    });

    // Conectar la calculadora pública con los IDs correctos del nuevo HTML
    document.getElementById('bmi-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const w = parseFloat(document.getElementById('input-weight').value);
        const h = parseFloat(document.getElementById('input-height').value);
        const p = parseFloat(document.getElementById('input-pab-public').value); // ID CORRECTO
        const s = document.getElementById('input-sex').value;
        if(w>0 && h>0) {
            const imc = calculateIMC(w, h);
            const apt = getAptitude(imc, s, p, 'N/A');
            document.getElementById('bmi-value').textContent = imc;
            document.getElementById('aptitude-badge').textContent = apt.resultado;
            document.getElementById('aptitude-detail').textContent = apt.clasificacionMINSA;
            document.getElementById('result-box').classList.remove('hidden');
            const badge = document.getElementById('aptitude-badge');
            const color = apt.resultado.startsWith('INAPTO') ? 'bg-red-700' : 'bg-green-700';
            badge.className = `px-5 py-2 font-bold rounded-full shadow-lg uppercase ${color} text-white`;
        }
    });

    updateUI();
});