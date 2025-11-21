// sistema-imc.js (Versión Definitiva: Filtros, Lógica Militar y Validaciones Completas)

// --- 1. Variables de Estado Globales ---
let isAuthenticated = false;
let currentAdminUser = null; 
let currentAdminFullName = null; 
let currentUserRole = null;
let allRecordsFromDB = [];
let currentFilteredRecords = [];
let isEditMode = false;
let currentEditingRecordId = null;
let progressionChart = null; // Variable para la instancia del gráfico Chart.js

// --- 2. Funciones de Utilidad y UI ---
function displayMessage(title, text, type) {
    const box = document.getElementById('message-box');
    if (!box) return; // Protección contra errores si no existe el elemento

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

// --- 3. Lógica de Filtros (INCLUYE NUEVO FILTRO DE UNIDAD) ---

function populateUnitFilter() {
    const unitSelect = document.getElementById('unit-filter');
    if (!unitSelect) return;

    // Obtener lista única de unidades de la BD y ordenarlas
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
    
    // Mantener selección si existe
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
    const unitFilterValue = document.getElementById('unit-filter').value; // NUEVO: Filtro Unidad

    let recordsToDisplay = allRecordsFromDB;
    
    // 1. Filtro Nombre
    if (nameSearchTerm) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            `${record.apellido} ${record.nombre}`.toLowerCase().includes(nameSearchTerm)
        );
    }
    
    // 2. Filtro Edad
    if (ageFilterValue && !isNaN(parseInt(ageFilterValue))) {
        const ageToMatch = parseInt(ageFilterValue);
        recordsToDisplay = recordsToDisplay.filter(record => record.edad === ageToMatch);
    }
    
    // 3. Filtro Mes
    if (monthFilter) { 
        recordsToDisplay = recordsToDisplay.filter(record => 
            record.fecha && record.fecha.substring(3) === monthFilter
        );
    }
    
    // 4. Filtro Unidad (NUEVO)
    if (unitFilterValue) {
        recordsToDisplay = recordsToDisplay.filter(record => record.unidad === unitFilterValue);
    }
    
    // 5. Filtro Aptitud
    if (aptitudeFilterValue && aptitudeFilterValue !== 'TODAS LAS APTITUDES') {
        recordsToDisplay = recordsToDisplay.filter(record => {
            const { resultado } = getAptitude(record.imc, record.sexo, record.pab, record.pa);
            return resultado.startsWith(aptitudeFilterValue);
        });
    }
    
    // Recalcular estados visuales y actualizar global
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

// --- 4. Renderizado de Tablas y Gráficas ---

function renderTable(records) {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    const COLSPAN_VALUE = 12;
    
    if (!isAuthenticated) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-4">No está autenticado.</td></tr>`;
        return;
    }
    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-10">No hay registros que coincidan con los filtros.</td></tr>`;
        return;
    }
    
    records.forEach(data => {
        const { resultado, paClasificacion, riesgoAEnf, clasificacionMINSA } = getAptitude(data.imc, data.sexo, data.pab, data.pa);
        
        const badgeClass = resultado.startsWith('INAPTO') ? 'bg-red-700 text-white' : 'bg-green-700 text-white';
        const rowBgClass = resultado.startsWith('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        // Determinar qué mostrar en clasificación (si es excepción o no asistió)
        let clasifDisplay = clasificacionMINSA;
        if (clasificacionMINSA === 'NO ASISTIÓ') clasifDisplay = "NO ASISTIÓ";
        else if (clasificacionMINSA.includes('EXCEPCIÓN')) clasifDisplay = "SOBREPESO (EXC)";
        else if (clasificacionMINSA === 'NORMAL') clasifDisplay = "NORMAL"; // Asegurar mayúsculas si es necesario
        
        // Botones de acción
        let editBtn = `<button onclick="handleEditRecord(${data.id})" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Editar"><i class="fas fa-pencil-alt"></i></button>`;
        if (data.motivo === 'NO ASISTIÓ') editBtn = `<button class="text-gray-500 text-lg mr-4" disabled title="No editable"><i class="fas fa-pencil-alt"></i></button>`;
        
        const deleteBtn = `<button onclick="deleteRecord(${data.id})" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar"><i class="fas fa-trash-alt"></i></button>`;

        // Formateo visual de valores nulos
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
            <td class="px-4 py-3 whitespace-nowrap text-center">${editBtn}${deleteBtn}</td>
        `;
    });
}

function renderProgressionChart(records) {
    const ctx = document.getElementById('bmiProgressionChart');
    const chartCard = document.getElementById('stats-chart-card');
    if (!ctx || !chartCard) return;

    // Solo mostrar si es un solo usuario filtrado (por CIP)
    const cipList = records.map(r => r.cip);
    const isIndividual = records.length > 0 && cipList.every((val, i, arr) => val === arr[0]);
    
    if (!isIndividual) {
        chartCard.style.display = 'none';
        return;
    }
    
    chartCard.style.display = 'block';

    // Ordenar cronológicamente para la gráfica
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
                borderColor: '#CCFF00', // Lime
                backgroundColor: 'rgba(204, 255, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                spanGaps: true,
                pointRadius: 5,
                pointBackgroundColor: dataPoints.map(imc => {
                    if (imc === null) return '#808080';
                    if (imc >= 30) return '#E74C3C'; // Obesidad = Rojo
                    if (imc >= 25) return '#FFD700'; // Sobrepeso = Amarillo
                    return '#008744'; // Normal = Verde
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#EEEEEE' } },
                title: { 
                    display: true, 
                    text: `${records[0].grado} ${records[0].apellido} - PROGRESIÓN`, 
                    color: '#FFD700',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw === null ? 'NO ASISTIÓ' : `IMC: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    min: 15, max: 40, 
                    ticks: { color: '#A0A0A0' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    title: { display: true, text: 'IMC', color: '#A0A0A0' }
                },
                x: { 
                    ticks: { color: '#A0A0A0' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                }
            }
        }
    });
}

// --- 5. Lógica de Negocio (Cálculos Aptitud) ---

function calculateIMC(weight, height) {
    if (height > 0) return (weight / (height * height)).toFixed(1);
    return 0; 
}

function applyMilitaryIMCException(imcReal, sexo, pab) {
    const imcFloat = parseFloat(imcReal);
    const pabFloat = parseFloat(pab);
    
    if (imcFloat > 29.9) { 
        if ((sexo === 'Masculino' && pabFloat < 94) || (sexo === 'Femenino' && pabFloat < 84)) {
            return { imc: 29.9, sobrescrito: true, motivo: "APTO (EXCEPCIÓN PAB)" };
        }
    }
    return { imc: imcFloat, sobrescrito: false, motivo: "" };
}

function getClassificacionPA(paString) {
    if (!paString || !paString.includes('/')) return 'N/A';
    const [sist, diast] = paString.split('/').map(Number);
    if (isNaN(sist) || isNaN(diast)) return 'N/A';
    if (sist >= 140 || diast >= 90) return 'HIPERTENSION (ESTADIO 2)';
    if (sist >= 130 || diast >= 80) return 'HIPERTENSION (ESTADIO 1)';
    if (sist >= 120 && diast < 80) return 'ELEVADA';
    return 'NORMAL';
}

function getRiskByWaist(sexo, pab) {
    const p = parseFloat(pab);
    if (p === 0 || isNaN(p)) return 'N/A';
    
    if (sexo === 'Masculino') return p < 94 ? 'RIESGO BAJO' : p < 102 ? 'RIESGO ALTO' : 'RIESGO MUY ALTO';
    return p < 80 ? 'RIESGO BAJO' : p < 88 ? 'RIESGO ALTO' : 'RIESGO MUY ALTO';
}

function getAptitude(imc, sexo, pab, paString) {
    const i = parseFloat(imc);
    const p = parseFloat(pab); 
    
    if (i === 0 || isNaN(i)) return { resultado: 'INAPTO', clasificacionMINSA: 'NO ASISTIÓ', paClasificacion: 'N/A', riesgoAEnf: 'N/A', motivoInapto: 'NO ASISTIÓ' };
    
    let minsa = "NORMAL";
    if (i < 18.5) minsa = "DELGADEZ";
    else if (i < 25) minsa = "NORMAL";
    else if (i < 30) minsa = "SOBREPESO";
    else if (i < 35) minsa = "OBESIDAD I";
    else if (i < 40) minsa = "OBESIDAD II";
    else minsa = "OBESIDAD III";
    
    const paClass = getClassificacionPA(paString);
    const riesgo = getRiskByWaist(sexo, pab);
    
    let inapto = false;
    let motivo = "";

    if (i >= 30.0) { inapto = true; motivo = "IMC Obesidad"; } 
    else if ((sexo === 'Masculino' && p >= 94) || (sexo === 'Femenino' && p >= 80)) { inapto = true; motivo = "Riesgo Abdominal"; }

    let res = "APTO";
    
    // Excepción PAB para anular INAPTO
    if (inapto) {
        const cumpleExcepcion = (sexo === 'Masculino' && p < 94) || (sexo === 'Femenino' && p < 80);
        if (cumpleExcepcion) {
            res = "APTO (EXCEPCIÓN)";
        } else {
            res = `INAPTO (${motivo})`;
        }
    }

    return { resultado: res, clasificacionMINSA: minsa, paClasificacion: paClass, riesgoAEnf: riesgo, motivoInapto: motivo };
}

// --- 6. Conexión con API (CRUD) ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records'); // El servidor ya devuelve los registros
        if (!response.ok) throw new Error('Error al cargar registros.');
        allRecordsFromDB = await response.json();
        
        populateMonthFilter();
        populateUnitFilter(); // Llenar filtro de unidades
        filterTable(); // Renderizar tabla con filtros aplicados
        
    } catch (error) {
        console.error("Error:", error);
        const tb = document.getElementById('admin-table-body');
        if(tb) tb.innerHTML = `<tr><td colspan="12" class="text-center">Error de conexión con el servidor.</td></tr>`;
    }
}

async function saveRecord(record) {
    try {
        const response = await fetch('/api/records', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
        });
        if (!response.ok) throw new Error('Error al guardar.');
        displayMessage('ÉXITO', 'Registro guardado.', 'success');
        document.getElementById('admin-record-form').reset();
        
        // Reset mes al actual
        const now = new Date();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('input-registro-month').value = `${now.getFullYear()}-${monthStr}`;
        
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

async function updateRecord(id, record) {
    try {
        const response = await fetch(`/api/records/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
        });
        if (!response.ok) throw new Error('Error al actualizar.');
        displayMessage('ÉXITO', 'Registro actualizado.', 'success');
        cancelEdit();
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

async function deleteRecord(id) {
    if (!confirm('¿Eliminar este registro permanentemente?')) return;
    try {
        await fetch(`/api/records/${id}`, { method: 'DELETE' });
        displayMessage('ELIMINADO', 'Registro borrado.', 'warning');
        await fetchAndDisplayRecords();
    } catch (error) { displayMessage('ERROR', error.message, 'error'); }
}

// --- 7. Manejo del Formulario y Edición ---

function handleEditRecord(id) {
    const r = allRecordsFromDB.find(x => x.id === id);
    if (!r) return;
    
    const f = document.getElementById('admin-record-form');
    f['input-gguu'].value = r.gguu;
    f['input-unidad'].value = r.unidad;
    f['input-dni'].value = r.dni;
    f['input-userid'].value = r.cip;
    f['input-role'].value = r.grado;
    f['input-sex-admin'].value = r.sexo;
    f['input-lastname'].value = r.apellido;
    f['input-firstname'].value = r.nombre;
    f['input-age-admin'].value = r.edad;
    f['input-weight-admin'].value = r.peso;
    f['input-height-admin'].value = r.altura;
    f['input-pab'].value = r.pab;
    f['input-pa'].value = r.pa;
    
    // Formatear fecha DD/MM/YYYY -> YYYY-MM para el input type="month"
    if(r.fecha && r.fecha.length === 10) {
        const [d, m, y] = r.fecha.split('/');
        f['input-registro-month'].value = `${y}-${m}`;
    }

    isEditMode = true;
    currentEditingRecordId = id;
    
    const cancelBtn = document.getElementById('cancel-edit-button');
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    
    const submitBtn = document.querySelector('#admin-record-form button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> ACTUALIZAR REGISTRO';
    
    f.scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    isEditMode = false;
    currentEditingRecordId = null;
    document.getElementById('admin-record-form').reset();
    
    const cancelBtn = document.getElementById('cancel-edit-button');
    if(cancelBtn) cancelBtn.classList.add('hidden');
    
    const submitBtn = document.querySelector('#admin-record-form button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-database"></i> GUARDAR Y CALCULAR APTITUD';
    
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('input-registro-month').value = `${now.getFullYear()}-${monthStr}`;
    
    const resBox = document.getElementById('admin-result-box');
    if (resBox) resBox.classList.add('hidden');
}

// --- 8. Login y Gestión de Usuarios ---

async function attemptAdminLogin() {
    const u = document.getElementById('admin-username').value;
    const p = document.getElementById('admin-password').value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({cip:u, password:p})
        });
        const d = await res.json();
        if(!res.ok) throw new Error(d.message);
        
        isAuthenticated = true;
        currentAdminUser = d.user.cip; 
        currentAdminFullName = d.user.fullName; 
        currentUserRole = d.user.role;
        
        updateUI();
        displayMessage('BIENVENIDO', `Hola, ${currentAdminFullName}`, 'success');
    } catch(e) { displayMessage('ACCESO DENEGADO', e.message, 'error'); }
}

function logoutAdmin() {
    isAuthenticated = false;
    currentAdminUser = null;
    currentAdminFullName = null;
    currentUserRole = null;
    allRecordsFromDB = [];
    updateUI();
    displayMessage('SESIÓN CERRADA', 'Hasta luego.', 'warning');
}

async function fetchAndDisplayUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();
    const tb = document.getElementById('users-table-body');
    if(!tb) return;
    tb.innerHTML = '';
    users.forEach(u => {
        tb.insertRow().innerHTML = `<td class="px-4 py-3">${u.cip}</td><td class="px-4 py-3">${u.fullName}</td><td class="px-4 py-3 text-center"><button onclick="handleEditUser('${u.cip}')" class="text-blue-500"><i class="fas fa-pencil-alt"></i></button></td>`;
    });
}

function handleEditUser(cip) {
    const p = prompt(`Nueva contraseña para ${cip}:`);
    if(p) fetch(`/api/users/password/${cip}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({newPassword:p})})
    .then(r=>{ if(r.ok) alert('Contraseña cambiada'); else alert('Error'); });
}

// --- 9. Exportación Excel (BOTÓN) ---

function exportToExcel() {
    if (!isAuthenticated) { displayMessage('Error', 'Inicie sesión.', 'error'); return; }
    
    const btn = document.getElementById('export-excel-button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GENERANDO...'; btn.disabled = true;
    
    fetch('/api/export-excel', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ 
            records: currentFilteredRecords, // Envía lo que se ve en pantalla (filtrado por unidad/mes)
            reportMonth: document.getElementById('input-report-month').value 
        })
    })
    .then(res => {
        if(!res.ok) throw new Error('Error al generar Excel');
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; 
        const d = new Date();
        a.download = `Reporte_SIMCEP_${d.getFullYear()}${d.getMonth()+1}${d.getDate()}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        displayMessage('ÉXITO', 'Excel descargado.', 'success');
    })
    .catch(e => displayMessage('ERROR', e.message, 'error'))
    .finally(() => { btn.innerHTML = originalText; btn.disabled = false; });
}

// --- 10. Event Listeners Globales ---

// Formulario Registro
document.getElementById('admin-record-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const regMonthVal = f['input-registro-month'].value; // YYYY-MM
    
    // Validar mes futuro
    const [y, m] = regMonthVal.split('-').map(Number);
    const now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > (now.getMonth() + 1))) {
        displayMessage('ERROR', 'No se puede registrar en mes futuro.', 'error'); return;
    }

    const rec = {
        gguu: f['input-gguu'].value,
        unidad: f['input-unidad'].value,
        dni: f['input-dni'].value,
        cip: f['input-userid'].value,
        grado: f['input-role'].value,
        sexo: f['input-sex-admin'].value,
        pa: f['input-pa'].value,
        apellido: f['input-lastname'].value,
        nombre: f['input-firstname'].value,
        edad: f['input-age-admin'].value,
        peso: f['input-weight-admin'].value,
        altura: f['input-height-admin'].value,
        pab: f['input-pab'].value,
        fecha: `01/${String(m).padStart(2,'0')}/${y}`, // Formato para BD: 01/MM/YYYY
        dob: f['input-dob'].value || '1990-01-01'
    };
    
    const imcReal = calculateIMC(rec.peso, rec.altura);
    const exc = applyMilitaryIMCException(imcReal, rec.sexo, rec.pab);
    rec.imc = exc.imc.toFixed(1);
    const apt = getAptitude(rec.imc, rec.sexo, rec.pab, rec.pa);
    rec.motivo = exc.sobrescrito ? exc.motivo : apt.motivoInapto;
    rec.paClasificacion = apt.paClasificacion;
    rec.riesgoAEnf = apt.riesgoAEnf;
    rec.registradoPor = currentAdminUser;

    if(isEditMode) updateRecord(currentEditingRecordId, rec);
    else saveRecord(rec);
});

// Calculadora Pública
document.getElementById('bmi-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = parseFloat(document.getElementById('input-weight').value);
    const h = parseFloat(document.getElementById('input-height').value);
    const p = parseFloat(document.getElementById('input-pab-public').value);
    const s = document.getElementById('input-sex').value;
    
    if(w>0 && h>0) {
        const imc = calculateIMC(w, h);
        const apt = getAptitude(imc, s, p, 'N/A');
        
        document.getElementById('bmi-value').textContent = imc;
        document.getElementById('aptitude-badge').textContent = apt.resultado;
        document.getElementById('aptitude-detail').textContent = apt.clasificacionMINSA;
        
        const box = document.getElementById('result-box');
        box.classList.remove('hidden');
        
        const badge = document.getElementById('aptitude-badge');
        if(apt.resultado.startsWith('INAPTO')) {
            badge.className = 'px-5 py-2 font-bold rounded-full shadow-lg uppercase bg-red-700 text-white';
            document.getElementById('bmi-value').style.color = 'var(--color-alert-red)';
        } else {
            badge.className = 'px-5 py-2 font-bold rounded-full shadow-lg uppercase bg-green-700 text-white';
            document.getElementById('bmi-value').style.color = 'var(--color-accent-lime)';
        }
    }
});

// Autocompletado
document.getElementById('input-dni')?.addEventListener('blur', (e) => {
    const v = e.target.value;
    if(v.length === 8) {
        fetch(`/api/patient/${v}`).then(r=>r.json()).then(d => {
            if(d.cip) {
                const f = document.getElementById('admin-record-form');
                f['input-gguu'].value = d.gguu;
                f['input-unidad'].value = d.unidad;
                f['input-userid'].value = d.cip;
                f['input-role'].value = d.grado;
                f['input-lastname'].value = d.apellido;
                f['input-firstname'].value = d.nombre;
                f['input-age-admin'].value = d.edad;
                f['input-sex-admin'].value = d.sexo;
                displayMessage('AUTOCOMPLETADO', 'Datos personales cargados.', 'success');
            }
        });
    }
});

// Listeners de Filtros
document.getElementById('unit-filter')?.addEventListener('change', filterTable);
document.getElementById('month-filter')?.addEventListener('change', filterTable);
document.getElementById('aptitude-filter')?.addEventListener('change', filterTable);
document.getElementById('name-filter')?.addEventListener('input', filterTable);
document.getElementById('age-filter')?.addEventListener('input', filterTable);

// Botones
document.getElementById('admin-login-button')?.addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button')?.addEventListener('click', logoutAdmin);
document.getElementById('cancel-edit-button')?.addEventListener('click', cancelEdit);
document.getElementById('export-excel-button')?.addEventListener('click', exportToExcel);
document.getElementById('export-stats-button')?.addEventListener('click', () => displayMessage('INFO', 'Función gráfica en desarrollo para reporte Word.', 'warning'));
document.getElementById('export-word-button')?.addEventListener('click', exportToWord);
document.getElementById('download-chart-button')?.addEventListener('click', downloadChartAsImage);

// Usuario Nuevo
document.getElementById('add-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/users', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
            cip: document.getElementById('input-new-cip').value,
            fullName: document.getElementById('input-new-fullname').value,
            email: document.getElementById('input-new-email').value,
            password: document.getElementById('input-new-password').value
        })
    });
    displayMessage('USUARIO', 'Usuario creado correctamente.', 'success');
    document.getElementById('add-user-form').reset();
    fetchAndDisplayUsers();
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const regInput = document.getElementById('input-registro-month');
    if(regInput) regInput.value = `${now.getFullYear()}-${monthStr}`;
    updateUI();
});