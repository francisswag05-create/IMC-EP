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


// --- FUNCIONES PARA GESTIÓN DE USUARIOS (MEJORADAS) ---

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
            // Lógica para mostrar rol en paréntesis
            const userRoleText = user.role === 'superadmin' ? 'SUPERADMIN' : 'ADMINISTRADOR'; 
            const userFullNameDisplay = `${user.fullName} (${userRoleText})`;

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${user.cip}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">${userFullNameDisplay}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <!-- BOTÓN DE EDICIÓN/CAMBIO DE CLAVE -->
                    <button onclick="handleEditUser('${user.cip}')" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Cambiar Contraseña">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <!-- BOTÓN DE ELIMINAR -->
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
    const email = document.getElementById('input-new-email').value; // <-- CAPTURA DE EMAIL
    const password = document.getElementById('input-new-password').value;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ENVIAR EMAIL
            body: JSON.stringify({ cip, fullName, email, password })
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

function handleEditUser(cip) {
    const newPassword = prompt(`Ingrese la NUEVA CONTRASEÑA para el usuario ${cip}.`);
    
    if (newPassword === null || newPassword.trim() === "") {
        displayMessage('CANCELADO', 'Cambio de contraseña cancelado.', 'warning');
        return;
    }
    
    if (!confirm(`¿Confirma que desea cambiar la contraseña para el usuario ${cip}?`)) return;

    updateUserPassword(cip, newPassword);
}

async function updateUserPassword(cip, newPassword) {
    try {
        // Llama a la nueva ruta en el servidor
        const response = await fetch(`/api/users/password/${cip}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPassword }) 
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al cambiar la contraseña.');

        displayMessage('ÉXITO', `La contraseña para el usuario ${cip} ha sido actualizada.`, 'success');
        
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        displayMessage('ERROR', `Fallo al actualizar clave: ${error.message}.`, 'error');
    }
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
            monitoringTextEl.innerHTML = `
                <i class="fas fa-check-double mr-3 text-color-accent-gold"></i>
                Monitoreo Activo: <span class="text-color-accent-lime">${currentAdminFullName}</span>`;
        }
        
        if (userManagementSection) {
            if (currentUserRole === 'superadmin') {
                userManagementSection.style.display = 'grid';
            } else {
                userManagementSection.style.display = 'none';
            }
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
        // ACTUALIZADO CON NUEVAS COLUMNAS (P.A. y PBA)
        tableHeaderRow.innerHTML = `
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">CIP</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">GRADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">APELLIDO/NOMBRE</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PA / CLASIFICACION</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PBA / RIESGO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PESO/ALTURA</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">EDAD</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">RESULTADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">FECHA</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-color-accent-lime">ACCIÓN</th>
        `;
    }
}

function getSimplifiedAptitudeStyle(resultado) {
    if (resultado.includes('INAPTO')) return 'bg-red-700 text-white';
    // Si incluye APTO (EXCEPCIÓN PAB), usa el verde de apto
    return 'bg-green-700 text-white'; 
}


// --- 3. Funciones de Cálculo de IMC y Clasificación (MODIFICADA) ---

function calculateIMC(weight, height) {
    if (height > 0) {
        const imc = weight / (height * height);
        return imc.toFixed(1);
    }
    return 0;
}

// --- NUEVA FUNCIÓN PARA CLASIFICAR PRESIÓN ARTERIAL (CLASIFICACION) ---
function getClassificacionPA(paString) {
    if (!paString || !paString.includes('/')) return 'N/A';
    const [sistolicaStr, diastolicaStr] = paString.split('/');
    const sistolica = parseInt(sistolicaStr);
    const diastolica = parseInt(diastolicaStr);

    if (isNaN(sistolica) || isNaN(diastolica)) return 'N/A';
    
    if (sistolica >= 140 || diastolica >= 90) return 'HIPERTENSION';
    if (sistolica >= 120 || diastolica >= 80) return 'PRE-HIPERTENSION';
    return 'NORMAL';
}


// --- Función getRiskByWaist (RIESGO A ENF SEGUN PABD - AJUSTADO A TABLAS OMS) ---
function getRiskByWaist(sexo, pab) {
    const pabFloat = parseFloat(pab);
    if (sexo === 'Masculino') {
        // Normal: 94 o menos (<= 94). Riesgo Alto: 95-102 (> 94 y <= 102). Riesgo Muy Alto: Más de 102 (> 102).
        if (pabFloat <= 94) return 'RIESGO BAJO'; 
        if (pabFloat <= 102) return 'RIESGO ALTO';
        return 'RIESGO MUY ALTO'; 
    } 
    // Femenino: Normal: 80 o menos (<= 80). Riesgo Alto: 81-88 (> 80 y <= 88). Riesgo Muy Alto: Más de 88 (> 88).
    if (sexo === 'Femenino') {
        if (pabFloat <= 80) return 'RIESGO BAJO';
        if (pabFloat <= 88) return 'RIESGO ALTO';
        return 'RIESGO MUY ALTO';
    }
    return 'INDETERMINADO'; 
}


// --- Función getAptitude (CON REGLA DE EXCEPCIÓN FINAL: PAB <= 94 ANULA INAPTO) ---
function getAptitude(imc, sexo, pab, paString) {
    const imcFloat = parseFloat(imc);
    const pabFloat = parseFloat(pab); 
    let clasificacionMINSA, resultado, detalle;
    
    // 1. Clasificación MINSA (Clasificación de IMC - FIEL A LA TABLA OMS)
    if (imcFloat < 18.5) clasificacionMINSA = "BAJO PESO";
    else if (imcFloat <= 24.9) clasificacionMINSA = "NORMAL";
    else if (imcFloat <= 29.9) clasificacionMINSA = "SOBREPESO";
    else if (imcFloat <= 34.9) clasificacionMINSA = "OBESIDAD I";
    else if (imcFloat <= 39.9) clasificacionMINSA = "OBESIDAD II";
    else clasificacionMINSA = "OBESIDAD III";
    
    // 2. Clasificación de Riesgo Abdominal (RIESGO A ENF)
    const riesgoAEnf = getRiskByWaist(sexo, pab);
    
    // 3. Clasificación de Presión Arterial (CLASIFICACION)
    const paClasificacion = getClassificacionPA(paString);
    
    // 4. Determinación de Aptitud (Regla Combinada - Estándar)
    
    // INAPTO por Obesidad Extrema o Riesgo Abdominal Muy Alto
    // Usamos imcFloat >= 30.0 para incluir Obesidad I, II y III 
    if (imcFloat >= 30.0) {
        resultado = "INAPTO (Obesidad)";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. INAPTO.`;
    } else if (riesgoAEnf === 'RIESGO MUY ALTO') {
        resultado = "INAPTO (Riesgo Abdominal)";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. INAPTO.`;
    }
    // APTO con Monitoreo (Sobrepeso o Riesgo Abdominal Alto o Hipertensión)
    else if (imcFloat >= 25.0 || riesgoAEnf === 'RIESGO ALTO' || paClasificacion === 'HIPERTENSION' || paClasificacion === 'PRE-HIPERTENSION') {
        resultado = "APTO (MONITOREO)";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. PA: ${paClasificacion}. APTO. Requiere monitoreo.`;
    }
    // APTO ÓPTIMO
    else { 
        resultado = "APTO";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. PA: ${paClasificacion}. Aptitud confirmada.`;
    }

    // 5. REGLA DE EXCEPCIÓN DEL CENTRO MÉDICO (PAB <= 94 anula INAPTO)
    if (resultado.startsWith('INAPTO') && pabFloat <= 94) {
        // La regla se cumple si el resultado inicial es INAPTO Y PAB es 94.0 o menos.
        resultado = "APTO (EXCEPCIÓN PAB)";
        detalle = `Resultado original: ${clasificacionMINSA}. Sobrescrito por Regla Médica: PAB <= 94, se considera APTO.`;
    }
    
    return { resultado, detalle, clasificacionMINSA, paClasificacion, riesgoAEnf };
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
    displayMessage('SESIÓN CERRADA', 'Has salido del módulo de administración.', 'warning');
    const adminResultBox = document.getElementById('admin-result-box');
    if (adminResultBox) adminResultBox.classList.add('hidden');
    updateUI();
}

// --- FUNCIONES PARA RECUPERACIÓN DE CONTRASEÑA ---

async function handleForgotPassword() {
    const cip = prompt("Por favor, ingrese su CIP para iniciar el proceso de recuperación de contraseña:");
    
    if (!cip || cip.trim() === "") {
        displayMessage('CANCELADO', 'El proceso de recuperación fue cancelado.', 'warning');
        return;
    }
    
    const link = document.getElementById('forgot-password-link');
    link.textContent = 'Enviando Solicitud...';
    link.classList.add('pointer-events-none', 'opacity-50');

    try {
        await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cip: cip.trim() })
        });

        displayMessage(
            'CORREO ENVIADO', 
            'Si el CIP está registrado y tiene un correo asociado, se ha enviado un enlace de restablecimiento.', 
            'success'
        );

    } catch (error) {
        console.error("Error en solicitud de recuperación:", error);
        displayMessage('ERROR', 'Ocurrió un error de conexión al solicitar la recuperación.', 'error');

    } finally {
        link.textContent = '¿Olvidó su contraseña?';
        link.classList.remove('pointer-events-none', 'opacity-50');
    }
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
        // COLSPAN_VALUE AUMENTADO A 11
        tableBody.innerHTML = `<tr><td colspan="11" class="text-center py-10">Error al cargar datos. Verifique la consola.</td></tr>`;
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

async function deleteRecord(id) {
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente este registro?`)) return;
    try {
        const response = await fetch(`/api/records/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar el registro.');
        }
        displayMessage('ELIMINADO', `El registro ha sido eliminado.`, 'warning');
        await fetchAndDisplayRecords();
    } catch (error) {
        console.error('Error deleting record:', error);
        displayMessage('Error al Eliminar', error.message, 'error');
    }
}

// --- FUNCIONES DE EDICIÓN DE REGISTROS (ACTUALIZADAS) ---

function handleEditRecord(id) {
    const recordToEdit = allRecordsFromDB.find(record => record.id === id);
    if (!recordToEdit) {
        displayMessage('Error', 'No se pudo encontrar el registro para editar.', 'error');
        return;
    }
    
    // CARGAR NUEVOS CAMPOS
    document.getElementById('input-gguu').value = recordToEdit.gguu || '';
    document.getElementById('input-unidad').value = recordToEdit.unidad || '';
    document.getElementById('input-dni').value = recordToEdit.dni || '';
    document.getElementById('input-pa').value = recordToEdit.pa || '';
    document.getElementById('input-pab').value = recordToEdit.pab || '';

    // CARGAR CAMPOS EXISTENTES
    document.getElementById('input-sex-admin').value = recordToEdit.sexo;
    document.getElementById('input-userid').value = recordToEdit.cip;
    document.getElementById('input-role').value = recordToEdit.grado;
    document.getElementById('input-age-admin').value = recordToEdit.edad;
    document.getElementById('input-lastname').value = recordToEdit.apellido;
    document.getElementById('input-firstname').value = recordToEdit.nombre;
    document.getElementById('input-weight-admin').value = recordToEdit.peso;
    document.getElementById('input-height-admin').value = recordToEdit.altura;

    // FORZAR RECALCULO Y VISUALIZACIÓN al abrir el formulario (SOLUCIÓN UX)
    const imc = calculateIMC(recordToEdit.peso, recordToEdit.altura);
    const { resultado, detalle } = getAptitude(imc, recordToEdit.sexo, recordToEdit.pab, recordToEdit.pa);
    const badgeClass = getSimplifiedAptitudeStyle(resultado);

    document.getElementById('admin-bmi-value').textContent = imc;
    document.getElementById('admin-aptitude-badge').textContent = resultado;
    document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
    document.getElementById('admin-aptitude-detail').textContent = detalle;
    document.getElementById('admin-result-box').classList.remove('hidden');


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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al actualizar el registro.');
        }

        displayMessage('ACTUALIZACIÓN EXITOSA', `El registro ha sido actualizado.`, 'success');
        cancelEdit();
        await fetchAndDisplayRecords();

    } catch (error) {
        console.error('Error updating record:', error);
        displayMessage('Error al Actualizar', error.message, 'error');
    }
}


// --- 6. Lógica de la Tabla de Registros (Filtros, Renderizado, Exportación) ---

function populateMonthFilter() {
    const filterSelect = document.getElementById('month-filter');
    const monthCounts = allRecordsFromDB.reduce((acc, record) => {
        if (!record.fecha) return acc;
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
    // MEJORA: Garantizar que el valor sea una cadena vacía si no hay selección
    const aptitudeFilterValue = (document.getElementById('aptitude-filter').value || '').toUpperCase(); 

    let recordsToDisplay = allRecordsFromDB;
    
    // Aplicar Filtro de Nombre
    if (nameSearchTerm) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            `${record.apellido} ${record.nombre}`.toLowerCase().includes(nameSearchTerm)
        );
    }
    
    // Aplicar Filtro de Edad
    if (ageFilterValue && !isNaN(parseInt(ageFilterValue))) {
        const ageToMatch = parseInt(ageFilterValue);
        recordsToDisplay = recordsToDisplay.filter(record => record.edad === ageToMatch);
    }
    
    // Aplicar Filtro de Mes
    if (monthFilter) {
        recordsToDisplay = recordsToDisplay.filter(record => 
            record.fecha && record.fecha.substring(3) === monthFilter
        );
    }
    
    // Aplicar NUEVO Filtro de Aptitud
    if (aptitudeFilterValue) {
        recordsToDisplay = recordsToDisplay.filter(record => {
            // Recalcula la aptitud para asegurar que la nueva lógica (EXCEPCIÓN PAB) se aplique.
            const { resultado } = getAptitude(record.imc, record.sexo, record.pab, record.pa);
            
            // Lógica de filtrado de Aptitud
            if (aptitudeFilterValue === 'APTO') {
                // Filtra por APTO, incluyendo APTO (EXCEPCIÓN PAB), pero excluyendo APTO (MONITOREO)
                // Se usa startsWith('APTO') para capturar 'APTO' y 'APTO (EXCEPCIÓN PAB)'
                return resultado.startsWith('APTO') && !resultado.includes('MONITOREO');
            } else if (aptitudeFilterValue === 'MONITOREO') {
                return resultado.includes('MONITOREO');
            } else if (aptitudeFilterValue === 'INAPTO') {
                return resultado.startsWith('INAPTO');
            }
            return true;
        });
    }

    currentFilteredRecords = recordsToDisplay;
    renderTable(currentFilteredRecords);
}


function renderTable(records) {
    const tableBody = document.getElementById('admin-table-body');
    tableBody.innerHTML = '';
    // COLSPAN_VALUE AUMENTADO DE 10 A 11
    const COLSPAN_VALUE = 11; 
    if (!isAuthenticated) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-4">No está autenticado.</td></tr>`;
        return;
    }
    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN_VALUE}" class="text-center py-10">No hay registros que coincidan con los filtros.</td></tr>`;
        return;
    }
    records.forEach(data => {
        // LLAMADA ACTUALIZADA PARA OBTENER TODAS LAS CLASIFICACIONES
        // El recalculo aquí asegura que el resultado se muestre correctamente con la nueva lógica de excepción
        const { resultado, paClasificacion, riesgoAEnf } = getAptitude(data.imc, data.sexo, data.pab, data.pa);
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        const rowBgClass = resultado.includes('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        const riesgoAbdominalClass = riesgoAEnf === 'RIESGO MUY ALTO' ? 'text-red-500 font-bold' : (riesgoAEnf === 'RIESGO ALTO' ? 'text-color-accent-gold' : 'text-color-primary-green');
        const paClasificacionClass = paClasificacion === 'HIPERTENSION' ? 'text-red-500 font-bold' : (paClasificacion === 'PRE-HIPERTENSION' ? 'text-yellow-500' : 'text-color-primary-green');
        
        let actionButtons = '<span>N/A</span>';
        if (currentUserRole === 'superadmin') {
            actionButtons = `
                <button onclick="handleEditRecord(${data.id})" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Editar Registro">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button onclick="deleteRecord(${data.id})" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar Registro">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        }
        
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${data.cip || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold">${data.grado || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">${(data.apellido || 'N/A').toUpperCase()}, ${data.nombre || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm ${paClasificacionClass}">${data.pa || 'N/A'} (${paClasificacion})</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm ${riesgoAbdominalClass}">${data.pab || 'N/A'} cm (${riesgoAEnf})</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${data.peso || 'N/A'} kg / ${data.altura || 'N/A'} m</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-gold">${data.edad || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-lg font-extrabold ${resultado.includes('INAPTO') ? 'text-red-500' : 'text-color-accent-gold'}">${data.imc || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="inline-flex px-3 py-1 text-xs font-bold rounded-full ${badgeClass}">${resultado}</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-color-text-muted">${data.fecha || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center">${actionButtons}</td>
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
    
    // ENCABEZADOS DE WORD (Actualizado para mostrar más datos clínicos)
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte SIMCEP</title><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 95%; margin: 20px auto; } td, th { border-collapse: collapse; }</style></head><body><div style="text-align: center; width: 100%;"><h1 style="${titleStyle}">REPORTE DE ÍNDICE DE MASA CORPORAL (SIMCEP)</h1><p style="${subtitleStyle}">Fecha: ${reportDate} | Registros Filtrados: ${currentFilteredRecords.length}</p></div><table border="1"><thead><tr><th style="${tableHeaderStyle}; width: 10%;">GRADO</th><th style="${tableHeaderStyle}; width: 25%;">APELLIDO, NOMBRE</th><th style="${tableHeaderStyle}; width: 10%;">PBA (cm)</th><th style="${tableHeaderStyle}; width: 10%;">RIESGO ABD.</th><th style="${tableHeaderStyle}; width: 10%;">PA</th><th style="${tableHeaderStyle}; width: 10%;">IMC</th><th style="${tableHeaderStyle}; width: 15%;">RESULTADO</th><th style="${tableHeaderStyle}; width: 10%;">FECHA</th></tr></thead><tbody>`;
    
    currentFilteredRecords.forEach(record => {
        const { resultado, riesgoAEnf, paClasificacion } = getAptitude(record.imc, record.sexo, record.pab, record.pa); 
        const textStyleTag = resultado.includes('INAPTO') ? inaptoTextStyle : aptoTextStyle;
        const nameCellStyle = `${cellStyle} text-align: left; font-weight: bold;`;
        const riesgoAbdominalColor = riesgoAEnf.includes('MUY ALTO') ? 'style="color: #991b1b; font-weight: bold;"' : '';
        
        htmlContent += `<tr>
            <td style="${cellStyle}">${record.grado || 'N/A'}</td>
            <td style="${nameCellStyle}">${(record.apellido || 'N/A').toUpperCase()}, ${record.nombre || 'N/A'}</td>
            <td style="${cellStyle}">${record.pab || 'N/A'}</td>
            <td style="${cellStyle}" ${riesgoAbdominalColor}>${riesgoAEnf || 'N/A'}</td>
            <td style="${cellStyle}">${record.pa || 'N/A'} (${paClasificacion || 'N/A'})</td>
            <td style="${cellStyle} font-weight: bold;">${record.imc || 'N/A'}</td>
            <td style="${cellStyle}" ${textStyleTag}>${resultado}</td>
            <td style="${cellStyle}">${record.fecha || 'N/A'}</td>
        </tr>`;
    });
    
    htmlContent += `</tbody></table><div style="margin: 40px auto 0 auto; width: 95%; text-align: center; border: none; font-family: 'Arial', sans-serif;"><h4 style="font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #1e3a8a;">LEYES DE CLASIFICACIÓN CLÍNICA (SIMCEP)</h4><p style="font-size: 10px; margin: 5px 0; text-align: left; padding-left: 10%;">*La aptitud INAPTO se define por un IMC ≥ 30.0 o un riesgo de enfermedad abdominal MUY ALTO (OMS).</p></div></body></html>`;

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


// --- FUNCIÓN PARA EXPORTAR A EXCEL (LLAMA AL SERVIDOR) ---
function exportToExcel() {
    if (!isAuthenticated || currentFilteredRecords.length === 0) {
        displayMessage('Error', 'No se puede exportar sin registros o sin autenticación.', 'error');
        return;
    }
    
    // CAPTURAR EL MES DEL REPORTE DEL NUEVO INPUT
    const reportMonth = document.getElementById('input-report-month').value.toUpperCase();
    
    // Cambiar el texto del botón
    const btn = document.getElementById('export-excel-button');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> GENERANDO...';
    btn.disabled = true;

    fetch('/api/export-excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Enviamos los datos filtrados Y el mes del reporte al servidor
        body: JSON.stringify({
            records: currentFilteredRecords,
            reportMonth: reportMonth 
        })
    })
    .then(response => {
        if (!response.ok) {
            // Manejar errores del servidor (404, 500)
            return response.json().then(error => { throw new Error(error.message || 'Error desconocido del servidor.'); });
        }
        // El servidor devuelve el archivo como un blob binario
        return response.blob(); 
    })
    .then(blob => {
        // Crear la URL del objeto y simular la descarga
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
        a.href = url;
        a.download = `Reporte_SIMCEP_Mensual_${date}.xlsx`; // <-- Extension XLSX
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        displayMessage('Exportación Exitosa', `Se ha generado el archivo .xlsx con formato.`, 'success');
    })
    .catch(error => {
        console.error('Error en la descarga de Excel:', error);
        displayMessage('Error de Exportación', `No se pudo generar el archivo: ${error.message}`, 'error');
    })
    .finally(() => {
        // Restaurar el botón
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });
}


// --- 7. Event Listeners ---

document.getElementById('bmi-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('input-weight').value);
    const height = parseFloat(document.getElementById('input-height').value);
    const pab = parseFloat(document.getElementById('input-pab-public').value); // <-- NUEVO
    const sex = document.getElementById('input-sex').value;
    
    // NOTA: Para el formulario público, no pedimos PA, usaremos N/A o un valor neutral.
    const pa = 'N/A'; 
    
    if (weight > 0 && height > 0 && pab > 0) { // <-- VALIDACIÓN PAB
        const imc = calculateIMC(weight, height);
        
        // LLAMADA A LA LÓGICA CLÍNICA COMPLETA
        const { resultado, detalle } = getAptitude(imc, sex, pab, pa); 

        const badgeClass = resultado.includes('INAPTO') ? 'bg-red-600 text-white' : 'bg-green-600 text-white';
        document.getElementById('bmi-value').textContent = imc;
        const aptitudeBadge = document.getElementById('aptitude-badge');
        aptitudeBadge.textContent = resultado;
        aptitudeBadge.className = `px-5 py-2 font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('aptitude-detail').textContent = detalle;
        document.getElementById('result-box').classList.remove('hidden');
    } else {
        displayMessage('Datos Inválidos', 'Por favor, ingrese Peso, Altura y Perímetro Abdominal válidos.', 'error');
    }
});

document.getElementById('admin-record-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para operar.', 'error');
        return;
    }
    const form = e.target;
    
    // CAPTURA DE DATOS DE LOS 11 INPUTS
    const gguu = form.elements['input-gguu'].value;
    const unidad = form.elements['input-unidad'].value;
    const dni = form.elements['input-dni'].value;
    const pa = form.elements['input-pa'].value;
    const sexo = form.elements['input-sex-admin'].value;
    const cip = form.elements['input-userid'].value;
    const grado = form.elements['input-role'].value;
    const apellido = form.elements['input-lastname'].value;
    const nombre = form.elements['input-firstname'].value;
    const edad = parseInt(form.elements['input-age-admin'].value);
    const peso = parseFloat(form.elements['input-weight-admin'].value);
    const altura = parseFloat(form.elements['input-height-admin'].value);
    const pab = parseFloat(form.elements['input-pab'].value); 

    // VALIDACIÓN DE CAMPOS CLAVE
    if (peso > 0 && altura > 0 && pab > 0 && cip && grado && apellido && nombre && edad > 0 && gguu && unidad && dni && pa) {
        const imc = calculateIMC(peso, altura);
        // LLAMADA A LA LÓGICA CLÍNICA COMPLETA
        const { resultado, detalle, paClasificacion, riesgoAEnf } = getAptitude(imc, sexo, pab, pa); 
        
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        document.getElementById('admin-bmi-value').textContent = imc;
        document.getElementById('admin-aptitude-badge').textContent = resultado;
        document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('admin-aptitude-detail').textContent = detalle;
        document.getElementById('admin-result-box').classList.remove('hidden');
        
        // Preparar el campo Digitador: [CIP/Nombre] ([Cargo] [Primer Apellido])
        const primerApellido = currentAdminFullName.split(' ')[0] || ''; 
        const adminRoleText = currentAdminFullName.includes('MD') || currentAdminFullName.includes('DR') ? 'DR/MD' : (currentUserRole === 'superadmin' ? 'SUPERADMIN' : 'ADMIN');
        const digitadorFinal = `${currentAdminUser} (${adminRoleText} ${primerApellido})`; // <-- CORREGIDO

        if (isEditMode) {
            // AÑADIR TODOS LOS CAMPOS
            const updatedRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc };
            updateRecord(currentEditingRecordId, updatedRecord);
        } else {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;
            
            // AÑADIR TODOS LOS CAMPOS
            const newRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha: formattedDate, registradoPor: digitadorFinal };
            saveRecord(newRecord);
        }
    } else {
        displayMessage('Error de Entrada', 'Por favor, complete todos los campos obligatorios y revise valores numéricos (Peso, Altura, PBA).', 'error');
        document.getElementById('admin-result-box').classList.add('hidden');
    }
});

document.getElementById('admin-login-button').addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button').addEventListener('click', logoutAdmin);
document.getElementById('export-word-button').addEventListener('click', exportToWord);
// CONEXIÓN DEL BOTÓN EXCEL
document.getElementById('export-excel-button').addEventListener('click', exportToExcel); 
document.getElementById('forgot-password-link').addEventListener('click', function(e) {
    e.preventDefault(); 
    handleForgotPassword();
});
document.getElementById('name-filter').addEventListener('input', filterTable);
document.getElementById('age-filter').addEventListener('input', filterTable);
document.getElementById('month-filter').addEventListener('change', filterTable);
document.getElementById('aptitude-filter').addEventListener('change', filterTable); // <-- CONEXIÓN DEL NUEVO FILTRO
document.getElementById('add-user-form').addEventListener('submit', handleAddUser);

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});