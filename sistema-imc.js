// =================================================================================================
// Archivo: sistema-imc.js (VERSIÓN FINAL CON RECUPERACIÓN DE CONTRASEÑA)
// =================================================================================================

// --- 1. Variables de Estado Globales ---
let isAuthenticated = false;
let currentAdminUser = null; 
let currentAdminFullName = null; 
let currentUserRole = null;
let allRecordsFromDB = [];
let currentFilteredRecords = [];
let isEditMode = false;
let currentEditingRecordId = null;

// --- 2. Funciones de Utilidad y UI ---

function displayMessage(title, text, type) {
    const box = document.getElementById('message-box');
    const titleEl = box.querySelector('p:nth-child(1)');
    const textEl = box.querySelector('p:nth-child(2)');
    box.classList.remove('hidden', 'bg-red-600', 'bg-yellow-600', 'bg-green-600');
    let bgColor = type === 'error' || type === 'alert' ? 'bg-red-600' : (type === 'warning' ? 'bg-yellow-600' : 'bg-green-600');
    box.classList.add(bgColor);
    titleEl.innerHTML = title;
    textEl.textContent = text;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 5000);
}

async function updateUI() {
    const publicView = document.getElementById('public-access-view');
    const adminView = document.getElementById('admin-dashboard-view');
    const userInfo = document.getElementById('current-user-info');
    const monitoringTextEl = document.getElementById('monitoring-status-text');
    const userManagementSection = document.getElementById('user-management-section');

    if (isAuthenticated) {
        publicView.classList.add('hidden-view');
        adminView.classList.remove('hidden-view');
        userInfo.textContent = `Usuario: ${currentAdminUser.toUpperCase()}`;
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
        
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';

        if (monitoringTextEl) {
            monitoringTextEl.innerHTML = '¡Sistema en espera! Inicie sesión para activar el monitoreo.';
        }
        
        if (userManagementSection) {
            userManagementSection.style.display = 'none';
        }
    }
}

function updateAdminTableHeaders() {
    const tableHeaderRow = document.querySelector('#admin-dashboard-view thead tr');
    if (tableHeaderRow) {
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

// --- 3. Funciones de Cálculo de IMC y Clasificación ---

function calculateIMC(weight, height) {
    if (height > 0) return (weight / (height * height)).toFixed(1);
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
        resultado = imcFloat < 18.5 ? "APTO (Bajo)" : "APTO";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. ${resultado === "APTO" ? "Aptitud confirmada." : "Recomendación: Evaluar ganancia de peso saludable."}`;
    } else {
        resultado = "INAPTO";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. INAPTO. Se requiere reevaluación médica inmediata.`;
    }
    return { resultado, detalle };
}

// --- 4. Funciones de Autenticación y Administración ---

async function attemptAdminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cip: username, password: password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error en el inicio de sesión.');
        
        isAuthenticated = true;
        currentAdminUser = data.user.cip;
        currentAdminFullName = data.user.fullName;
        currentUserRole = data.user.role;
        
        displayMessage('ACCESO CONCEDIDO', `Bienvenido, ${currentAdminFullName}.`, 'success');
        updateUI();
    } catch (error) {
        displayMessage('ACCESO DENEGADO', error.message, 'error');
        console.error("Detalle del error de login:", error);
    }
}

function logoutAdmin() {
    isAuthenticated = false;
    currentAdminUser = null;
    currentAdminFullName = null;
    currentUserRole = null;
    allRecordsFromDB = [];
    currentFilteredRecords = [];
    cancelEdit();
    displayMessage('SESIÓN CERRADA', 'Has salido del módulo de administración.', 'warning');
    const adminResultBox = document.getElementById('admin-result-box');
    if (adminResultBox) adminResultBox.classList.add('hidden');
    updateUI();
}

// --- 5. Funciones CRUD para Registros de IMC ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records');
        if (!response.ok) throw new Error('Error al obtener los registros.');
        allRecordsFromDB = await response.json();
        populateMonthFilter();
        filterTable();
    } catch (error) {
        console.error("Error fetching records:", error);
        displayMessage('Error de Conexión', 'No se pudieron cargar los registros.', 'error');
        document.getElementById('admin-table-body').innerHTML = `<tr><td colspan="10" class="text-center py-10">Error al cargar datos.</td></tr>`;
    }
}

async function saveRecord(record) {
    try {
        const response = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Error al guardar.');
        displayMessage('REGISTRO EXITOSO', `Personal con CIP ${record.cip} ha sido guardado.`, 'success');
        document.getElementById('admin-record-form').reset();
        setTimeout(() => document.getElementById('admin-result-box').classList.add('hidden'), 5000);
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error saving record:', error);
        displayMessage('Error al Guardar', error.message, 'error');
    }
}

async function deleteRecord(id) {
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente este registro?`)) return;
    try {
        const response = await fetch(`/api/records/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error((await response.json()).message || 'Error al eliminar.');
        displayMessage('ELIMINADO', `El registro ha sido eliminado.`, 'warning');
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error deleting record:', error);
        displayMessage('Error al Eliminar', error.message, 'error');
    }
}

// --- FUNCIONES PARA GESTIÓN DE USUARIOS ---

async function fetchAndDisplayUsers() {
    const tableBody = document.getElementById('users-table-body');
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('No se pudieron cargar los usuarios.');
        const users = await response.json();
        tableBody.innerHTML = users.length === 0 ? '<tr><td colspan="3" class="text-center py-6">No hay administradores.</td></tr>' : '';
        users.forEach(user => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${user.cip}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">${user.fullName}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <button onclick="handleDeleteUser('${user.cip}')" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar Usuario"><i class="fas fa-trash-alt"></i></button>
                </td>`;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-6">Error al cargar usuarios.</td></tr>`;
        console.error(error);
    }
}

async function handleAddUser(event) {
    event.preventDefault();
    const cip = document.getElementById('input-new-cip').value;
    const fullName = document.getElementById('input-new-fullname').value;
    const password = document.getElementById('input-new-password').value;
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cip, fullName, password })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Error al crear usuario.');
        displayMessage('ÉXITO', `Usuario ${cip} creado correctamente.`, 'success');
        document.getElementById('add-user-form').reset();
        await fetchAndDisplayUsers();
    } catch (error) {
        displayMessage('ERROR', error.message, 'error');
    }
}

async function handleDeleteUser(cip) {
    if (cip === currentAdminUser) return displayMessage('ACCIÓN DENEGADA', 'No puedes eliminar tu propio usuario.', 'warning');
    if (!confirm(`¿Estás seguro de eliminar al administrador con CIP ${cip}?`)) return;
    try {
        const response = await fetch(`/api/users/${cip}`, { method: 'DELETE' });
        if (!response.ok) throw new Error((await response.json()).message || 'Error al eliminar.');
        displayMessage('USUARIO ELIMINADO', `El usuario con CIP ${cip} ha sido eliminado.`, 'warning');
        await fetchAndDisplayUsers();
    } catch (error) {
        displayMessage('ERROR', error.message, 'error');
    }
}

// --- FUNCIONES DE EDICIÓN DE REGISTROS ---

function handleEditRecord(id) {
    const recordToEdit = allRecordsFromDB.find(record => record.id === id);
    if (!recordToEdit) return displayMessage('Error', 'Registro no encontrado.', 'error');
    
    document.getElementById('input-sex-admin').value = recordToEdit.sexo;
    document.getElementById('input-userid').value = recordToEdit.cip;
    document.getElementById('input-role').value = recordToEdit.grado;
    document.getElementById('input-age-admin').value = recordToEdit.edad;
    document.getElementById('input-lastname').value = recordToEdit.apellido;
    document.getElementById('input-firstname').value = recordToEdit.nombre;
    document.getElementById('input-weight-admin').value = recordToEdit.peso;
    document.getElementById('input-height-admin').value = recordToEdit.altura;
    
    const submitButton = document.querySelector('#admin-record-form button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-save mr-2"></i> ACTUALIZAR REGISTRO';
    document.querySelector('#admin-record-form h3').innerHTML = '<i class="fas fa-pencil-alt mr-2 text-color-accent-lime"></i> EDITANDO REGISTRO DE PERSONAL';
    
    isEditMode = true;
    currentEditingRecordId = id;
    document.getElementById('admin-record-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    isEditMode = false;
    currentEditingRecordId = null;
    document.getElementById('admin-record-form').reset();
    const submitButton = document.querySelector('#admin-record-form button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-database mr-2"></i> GUARDAR Y CALCULAR APTITUD';
    document.querySelector('#admin-record-form h3').innerHTML = '<i class="fas fa-user-plus mr-2 text-color-accent-lime"></i> REGISTRO DE NUEVO PERSONAL';
    document.getElementById('admin-result-box').classList.add('hidden');
}

async function updateRecord(id, recordData) {
    try {
        const response = await fetch(`/api/records/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recordData)
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Error al actualizar.');
        displayMessage('ACTUALIZACIÓN EXITOSA', 'El registro ha sido actualizado.', 'success');
        cancelEdit();
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error updating record:', error);
        displayMessage('Error al Actualizar', error.message, 'error');
    }
}

// --- 6. Lógica de la Tabla de Registros ---

function populateMonthFilter() { /* ... Tu código existente ... */ }
function filterTable() { /* ... Tu código existente ... */ }
function renderTable(records) { /* ... Tu código existente ... */ }
function exportToWord() { /* ... Tu código existente ... */ }

// --- 7. Event Listeners ---

document.getElementById('bmi-form').addEventListener('submit', function(e) { /* ... Tu código existente ... */ });
document.getElementById('admin-record-form').addEventListener('submit', function(e) { /* ... Tu código existente ... */ });
document.getElementById('admin-login-button').addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button').addEventListener('click', logoutAdmin);
document.getElementById('export-word-button').addEventListener('click', exportToWord);
document.getElementById('name-filter').addEventListener('input', filterTable);
document.getElementById('age-filter').addEventListener('input', filterTable);
document.getElementById('month-filter').addEventListener('change', filterTable);
document.getElementById('add-user-form').addEventListener('submit', handleAddUser);

// [NUEVO] Listener para el enlace de "Olvidó su contraseña"
document.getElementById('forgot-password-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const cip = prompt("Por favor, ingrese su CIP para iniciar la recuperación de contraseña:");
    if (!cip) return;
    try {
        displayMessage('Procesando...', 'Enviando solicitud de recuperación.', 'warning');
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cip: cip.trim() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        displayMessage('Verifique su Correo', data.message, 'success');
    } catch (error) {
        displayMessage('Error', error.message, 'error');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});