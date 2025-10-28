// =================================================================================================
// Archivo: sistema-imc.js (ACTUALIZADO CON LÓGICA DE ROLES 'superadmin' y 'admin')
// =================================================================================================

// --- 1. Variables de Estado Globales ---
let isAuthenticated = false;
let currentAdminUser = null; 
let currentAdminFullName = null; 
let currentUserRole = null; // <-- AÑADIDO: Guardará el rol del usuario ('admin' o 'superadmin')
let allRecordsFromDB = [];
let currentFilteredRecords = [];


// --- 2. Funciones de Utilidad y UI ---

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

// [MODIFICADO] - Ahora oculta/muestra la sección de gestión de usuarios según el rol
async function updateUI() {
    const publicView = document.getElementById('public-access-view');
    const adminView = document.getElementById('admin-dashboard-view');
    const userInfo = document.getElementById('current-user-info');
    const monitoringTextEl = document.getElementById('monitoring-status-text');
    const userManagementSection = document.getElementById('user-management-section'); // Referencia a la sección de admin de usuarios

    if (isAuthenticated) {
        publicView.classList.add('hidden-view');
        adminView.classList.remove('hidden-view');
        userInfo.textContent = `Usuario: ${currentAdminUser.toUpperCase()}`;
        userInfo.classList.remove('text-color-accent-lime', 'border-gray-600');
        userInfo.classList.add('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');

        if (monitoringTextEl && currentAdminFullName) {
            monitoringTextEl.innerHTML = `
                <i class="fas fa-check-double mr-3 text-color-accent-gold"></i>
                Monitoreo Activo: <span class="text-color-accent-lime">${currentAdminFullName}</span>`;
        }
        
        // --- LÓGICA DE ROLES ---
        if (userManagementSection) {
            if (currentUserRole === 'superadmin') {
                userManagementSection.style.display = 'grid'; // Muestra la sección si es superadmin
            } else {
                userManagementSection.style.display = 'none'; // Oculta la sección para otros roles
            }
        }
        
        updateAdminTableHeaders();
        await fetchAndDisplayRecords();
        
        // Solo el superadmin necesita ver la lista de usuarios
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
        
        // Asegurarse de que la sección esté oculta al cerrar sesión
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

// --- 4. Funciones de Autenticación y Administración ---

// [MODIFICADO] - Ahora guarda el rol del usuario al iniciar sesión
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
        currentUserRole = data.user.role; // <-- AÑADIDO: Guarda el rol
        
        displayMessage('ACCESO CONCEDIDO', `Bienvenido, ${currentAdminFullName}.`, 'success');
        updateUI();

    } catch (error) {
        displayMessage('ACCESO DENEGADO', error.message, 'error');
        console.error("Detalle del error de login:", error);
    }
}

// [MODIFICADO] - Ahora limpia el rol del usuario al cerrar sesión
function logoutAdmin() {
    isAuthenticated = false;
    currentAdminUser = null;
    currentAdminFullName = null;
    currentUserRole = null; // <-- AÑADIDO: Limpia el rol
    allRecordsFromDB = [];
    currentFilteredRecords = [];
    displayMessage('SESIÓN CERRADA', 'Has salido del módulo de administración.', 'warning');
    const adminResultBox = document.getElementById('admin-result-box');
    if (adminResultBox) adminResultBox.classList.add('hidden');
    updateUI();
}

// --- 5. Funciones CRUD para Registros de IMC ---

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
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente el registro con CIP ${cip}?`)) return;
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

// =========== INICIO DE NUEVAS FUNCIONES PARA GESTIÓN DE USUARIOS ===========

async function fetchAndDisplayUsers() {
    const tableBody = document.getElementById('users-table-body');
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('No se pudieron cargar los usuarios.');
        
        const users = await response.json();
        tableBody.innerHTML = ''; 

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-6">No hay administradores registrados.</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${user.cip}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">${user.fullName}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <button onclick="handleDeleteUser('${user.cip}')" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar Usuario">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
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
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al crear el usuario.');

        displayMessage('ÉXITO', `Usuario ${cip} creado correctamente.`, 'success');
        document.getElementById('add-user-form').reset();
        await fetchAndDisplayUsers();

    } catch (error) {
        displayMessage('ERROR', error.message, 'error');
    }
}

async function handleDeleteUser(cip) {
    if (cip === currentAdminUser) {
        displayMessage('ACCIÓN DENEGADA', 'No puedes eliminar tu propio usuario mientras estás en sesión.', 'warning');
        return;
    }
    if (!confirm(`¿Estás seguro de que quieres eliminar al administrador con CIP ${cip}? Esta acción es irreversible.`)) return;

    try {
        const response = await fetch(`/api/users/${cip}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al eliminar el usuario.');
        
        displayMessage('USUARIO ELIMINADO', `El usuario con CIP ${cip} ha sido eliminado.`, 'warning');
        await fetchAndDisplayUsers();

    } catch (error) {
        displayMessage('ERROR', error.message, 'error');
    }
}

// =========== FIN DE NUEVAS FUNCIONES PARA GESTIÓN DE USUARIOS ===========


// --- 6. Lógica de la Tabla de Registros (Filtros, Renderizado, Exportación) ---

function populateMonthFilter() {
    // ... (El código de esta función no necesita cambios)
}

function filterTable() {
    // ... (El código de esta función no necesita cambios)
}

function renderTable(records) {
    // ... (El código de esta función no necesita cambios)
}

function exportToWord() {
    // ... (El código de esta función no necesita cambios)
}


// --- 7. Event Listeners ---
// ... (El código de esta sección no necesita cambios)