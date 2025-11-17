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
    const titleEl = box.querySelector('p:nth-child(1)');
    const textEl = box.querySelector('p:nth-child(2)');

    // Manejo de null/undefined si la caja no existe (ej: en la página reset.html)
    if (!box) {
        console.warn(`[DisplayMessage] ${title}: ${text}`);
        return; 
    }

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


// --- FUNCIONES PARA GESTIÓN DE USUARIOS ---

async function fetchAndDisplayUsers() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return; 

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
            let userFullNameDisplay = user.fullName || ''; 
            let roleDisplay = '';

            if (user.role === 'admin') {
                roleDisplay = `(ADMINISTRADOR)`;
            } else if (user.role === 'superadmin') {
                roleDisplay = `(SUPERADMIN)`;
            }
            
            let finalDisplay = userFullNameDisplay.trim() ? `${userFullNameDisplay} ${roleDisplay}` : roleDisplay;

            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-color-accent-lime">${user.cip}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">${finalDisplay}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <button onclick="handleEditUser('${user.cip}')" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Cambiar Contraseña">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
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
    const email = document.getElementById('input-new-email').value;
    const password = document.getElementById('input-new-password').value;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    // Nuevo elemento para la gestión masiva (solo visible para superadmin)
    const massNoShowCard = document.getElementById('mass-no-show-card'); 

    if (!publicView || !adminView || !userInfo) return; 

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
                if (massNoShowCard) massNoShowCard.style.display = 'block'; // Mostrar Gestión Masiva
            } else {
                userManagementSection.style.display = 'none';
                if (massNoShowCard) massNoShowCard.style.display = 'none'; // Ocultar Gestión Masiva
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
        
        const adminUsernameEl = document.getElementById('admin-username');
        const adminPasswordEl = document.getElementById('admin-password');

        if (adminUsernameEl) adminUsernameEl.value = '';
        if (adminPasswordEl) adminPasswordEl.value = '';

        if (monitoringTextEl) {
            monitoringTextEl.innerHTML = '¡Sistema en espera! Inicie sesión para activar el monitoreo.';
        }
        
        if (userManagementSection) {
            userManagementSection.style.display = 'none';
        }
        if (massNoShowCard) massNoShowCard.style.display = 'none';
    }
}

function updateAdminTableHeaders() {
    const tableHeaderRow = document.querySelector('#admin-dashboard-view thead tr');
    if (tableHeaderRow) {
        tableHeaderRow.innerHTML = `
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">CIP</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">GRADO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">APELLIDO/NOMBRE</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PA / CLASIFICACION</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PAB / RIESGO</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">PESO/ALTURA</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">EDAD</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">CLASIFICACIÓN IMC</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">APTITUD</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-color-accent-lime">FECHA</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-color-accent-lime">ACCIÓN</th>
        `;
    }
}

// SIMPLIFICADA PARA SOLO APTO/INAPTO
function getSimplifiedAptitudeStyle(resultado) {
    if (resultado.startsWith('INAPTO')) return 'bg-red-700 text-white';
    return 'bg-green-700 text-white'; 
}

// Función que aplica la lógica de colores de la caja de resultados (Del pulido anterior)
function getAptitudeUI(resultado) {
    if (resultado.startsWith('INAPTO')) {
        return {
            badgeClass: 'bg-red-700 text-white',
            boxBorderClass: 'border-l-4 border-red-600 bg-red-900/10',
            boxColor: 'text-red-500' 
        };
    }
    // Para APTO y APTO (EXCEPCIÓN PAB)
    return { 
        badgeClass: 'bg-green-700 text-white',
        boxBorderClass: 'border-l-4 border-color-accent-lime bg-color-green-darker',
        boxColor: 'text-color-accent-lime'
    }; 
}

// --- 3. Funciones de Cálculo de IMC y Clasificación (MODIFICADA) ---

function calculateIMC(weight, height) {
    if (height > 0) {
        const imc = weight / (height * height);
        return imc.toFixed(1);
    }
    return 0; 
}

// Se mantiene la función, pero NO se llama en el formulario de Admin
function calculateAge(dateOfBirth) { 
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}


// ***************************************************************
// *** MODIFICACIÓN: CLASIFICACIÓN DE PRESIÓN ARTERIAL (AHA 2025)***
// ***************************************************************
function getClassificacionPA(paString) {
    if (!paString || !paString.includes('/')) return 'N/A';
    if (paString.toUpperCase() === 'N/A') return 'N/A';

    const [sistolicaStr, diastolicaStr] = paString.split('/');
    const PAS = parseInt(sistolicaStr); // Presión Arterial Sistólica
    const PAD = parseInt(diastolicaStr); // Presión Arterial Diastólica

    if (isNaN(PAS) || isNaN(PAD)) return 'N/A';
    
    // ESTADIO 2: PAS >= 140 O PAD >= 90
    if (PAS >= 140 || PAD >= 90) return 'HIPERTENSION (ESTADIO 2)';
    
    // ESTADIO 1: PAS 130-139 O PAD 80-89
    if (PAS >= 130 || PAD >= 80) return 'HIPERTENSION (ESTADIO 1)';
    
    // ELEVADA: PAS 120-129 Y PAD < 80
    if (PAS >= 120 && PAD < 80) return 'ELEVADA';

    // NORMAL: PAS < 120 Y PAD < 80
    return 'NORMAL';
}


// --- Función getRiskByWaist (RIESGO A ENF SEGUN PAB - AJUSTADO A CUADRO 2 OMS) ---
function getRiskByWaist(sexo, pab) {
    const pabFloat = parseFloat(pab);
    if (pabFloat === 0) return 'N/A';

    if (sexo === 'Masculino') {
        if (pabFloat < 94) return 'RIESGO BAJO'; 
        if (pabFloat < 102) return 'RIESGO ALTO';
        return 'RIESGO MUY ALTO'; 
    } 
    
    if (sexo === 'Femenino') {
        if (pabFloat < 80) return 'RIESGO BAJO';
        if (pabFloat < 88) return 'RIESGO ALTO'; 
        return 'RIESGO MUY ALTO';
    }
    return 'INDETERMINADO'; 
}

// ***************************************************************
// *** FUNCIÓN CLAVE: SOBRESCRITURA DE IMC (DIRECTIVA MILITAR) ***
// ***************************************************************
function applyMilitaryIMCException(imcReal, sexo, pab) {
    const imcFloat = parseFloat(imcReal);
    const pabFloat = parseFloat(pab);
    
    let sobrescribeIMC = false;

    // Regla: IMC > 29.9 (es decir, Obesidad I o superior)
    if (imcFloat > 29.9) { 
        
        // Excepción HOMBRE: PAB < 94 cm
        if (sexo === 'Masculino' && pabFloat < 94) {
            sobrescribeIMC = true;
        }
        // Excepción MUJER: PAB < 84 cm (Directiva del Doctor)
        else if (sexo === 'Femenino' && pabFloat < 84) { 
            sobrescribeIMC = true;
        }
    }
    
    // Aplicar la corrección
    if (sobrescribeIMC) {
        return { 
            imc: 29.9, // Valor sobrescrito (29.9)
            sobrescrito: true,
            motivo: "APTO (EXCEPCIÓN MASA MUSCULAR)"
        };
    }
    
    // Si no aplica, devuelve el valor real
    return {
        imc: imcFloat, // Valor Real
        sobrescrito: false,
        motivo: ""
    };
}


// --- Función getAptitude (SIMPLIFICADA: SOLO APTO/INAPTO + REGLAS DE EXCEPCIÓN) ---
function getAptitude(imc, sexo, pab, paString) {
    const imcFloat = parseFloat(imc);
    const pabFloat = parseFloat(pab); 
    let clasificacionMINSA, resultado, detalle;
    
    // *** Manejo de NO ASISTIÓ/Registro Vacío ***
    if (imcFloat === 0 && pabFloat === 0 && paString === 'N/A') {
        clasificacionMINSA = "NO ASISTIÓ";
        resultado = "INAPTO (NO ASISTIÓ)";
        detalle = "Registro generado automáticamente por inasistencia mensual.";
        const resultadoSimplificado = 'INAPTO';
        return { 
            resultado: resultadoSimplificado, 
            detalle, 
            clasificacionMINSA, 
            paClasificacion: 'N/A', 
            riesgoAEnf: 'N/A',
            motivoInapto: 'NO ASISTIÓ'
        };
    }
    
    // ***************************************************************
    // *** MODIFICACIÓN: CLASIFICACIÓN DE IMC (CUADRO 1) - CORRECCIÓN DE 'SOBREPESO' ***
    // ***************************************************************
    if (imcFloat < 16) clasificacionMINSA = "DELGADEZ GRADO III";
    else if (imcFloat < 17) clasificacionMINSA = "DELGADEZ GRADO II";
    else if (imcFloat < 18.5) clasificacionMINSA = "DELGADEZ GRADO I";
    else if (imcFloat < 25) clasificacionMINSA = "NORMAL";
    else if (imcFloat < 30) clasificacionMINSA = "SOBREPESO"; // <-- CORRECCIÓN APLICADA AQUÍ
    else if (imcFloat < 35) clasificacionMINSA = "OBESIDAD GRADO I";
    else if (imcFloat < 40) clasificacionMINSA = "OBESIDAD GRADO II";
    else clasificacionMINSA = "OBESIDAD GRADO III";
    
    // 2. Clasificación de Riesgo Abdominal (RIESGO A ENF)
    const riesgoAEnf = getRiskByWaist(sexo, pab);
    
    // 3. Clasificación de Presión Arterial (CLASIFICACION)
    const paClasificacion = getClassificacionPA(paString);
    
    // 4. Determinación de Aptitud (Regla Estándar de INAPTO - Simplificada)
    let esAptoInicial = true;
    let motivoInapto = "";

    // REGLA 1: INAPTO por IMC >= 30.0 (Obesidad I, II, III)
    if (imcFloat >= 30.0) {
        esAptoInicial = false;
        motivoInapto = "IMC Obesidad";
    } 
    // REGLA 2: INAPTO por PAB Alto/Muy Alto (H >= 94, M >= 80)
    else if ((sexo === 'Masculino' && pabFloat >= 94) || (sexo === 'Femenino' && pabFloat >= 80)) {
        esAptoInicial = false;
        motivoInapto = "Riesgo Abdominal Alto/Muy Alto";
    }
    // REGLA 3: Si no fue INAPTO por las reglas de arriba, es APTO.
    else { 
        esAptoInicial = true;
    }

    // 5. REGLA DE EXCEPCIÓN DEL CENTRO MÉDICO (LA REGLA DEL PAB ANULADOR)
    let aplicaExcepcion = false;
    
    // La regla de anulación es: Si es INAPTO y PAB está en RIESGO BAJO (PAB < 94 H, PAB < 80 M)
    if (!esAptoInicial) {
        if (sexo === 'Masculino' && pabFloat < 94) {
            aplicaExcepcion = true;
        } else if (sexo === 'Femenino' && pabFloat < 80) { 
            aplicaExcepcion = true;
        }
    }
    
    // DETERMINACIÓN FINAL DE APTITUD
    if (aplicaExcepcion && !esAptoInicial) { // Solo aplica si es INAPTO y cumple la excepción
        resultado = "APTO (EXCEPCIÓN PAB)";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Sobrescrito por Regla Médica: PAB < ${sexo === 'Masculino' ? '94' : '80'} cm.`;
    } else if (esAptoInicial) {
        resultado = "APTO";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. PA: ${paClasificacion}. Aptitud confirmada.`;
    } else {
        resultado = "INAPTO (" + motivoInapto + ")";
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Motivo: ${motivoInapto}. INAPTO.`;
    }
    
    // Ajuste de detalle para la nueva clasificación de PA
    if (resultado.startsWith('APTO') && (paClasificacion.includes('HIPERTENSION') || paClasificacion === 'ELEVADA')) {
        detalle += ` NOTA: Vigilancia por PA: ${paClasificacion}.`;
    }

    const resultadoSimplificado = resultado.startsWith('APTO') ? 'APTO' : 'INAPTO';

    return { 
        resultado: resultadoSimplificado, 
        detalle, 
        clasificacionMINSA, 
        paClasificacion, 
        riesgoAEnf,
        motivoInapto: motivoInapto || 'APTO'
    };
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

async function handleForgotPassword() {
    const cip = prompt("Por favor, ingrese su CIP para iniciar el proceso de recuperación de contraseña:");
    
    if (!cip || cip.trim() === "") {
        displayMessage('CANCELADO', 'El proceso de recuperación fue cancelado.', 'warning');
        return;
    }
    
    const link = document.getElementById('forgot-password-link');
    if (!link) return; 

    link.textContent = 'Enviando Solicitud...';
    link.classList.add('pointer-events-none', 'opacity-50');

    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cip: cip.trim() })
        });
        
        if (!response.ok) {
             const data = await response.json();
             throw new Error(data.message || 'Error en la solicitud de recuperación.');
        }

        displayMessage(
            'CORREO ENVIADO', 
            'Si el CIP está registrado y tiene un correo asociado, se ha enviado un enlace de restablecimiento.', 
            'success'
        );

    } catch (error) {
        console.error("Error en solicitud de recuperación:", error);
        displayMessage('ERROR', error.message || 'Ocurrió un error de conexión al solicitar la recuperación.', 'error');

    } finally {
        link.textContent = '¿Olvidó su contraseña?';
        link.classList.remove('pointer-events-none', 'opacity-50');
    }
}

// ... (Funciones de CRUD y Edición: fetchAndDisplayRecords, saveRecord, deleteRecord, handleEditRecord, cancelEdit, updateRecord. Se asume que no requieren más cambios que los ya hechos) ...

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
        if (tableBody) {
             tableBody.innerHTML = `<tr><td colspan="12" class="text-center py-10">Error al cargar datos. Verifique la consola.</td></tr>`;
        }
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
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido al guardar el registro. Verifique logs del servidor.' }));
            throw new Error(errorData.error || errorData.message || 'Error al guardar el registro.');
        }
        displayMessage('REGISTRO EXITOSO', `Personal con CIP ${record.cip} ha sido guardado en la base de datos.`, 'success');
        
        // Limpiar el formulario y resetear el mes de registro
        document.getElementById('admin-record-form').reset();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('input-registro-month').value = `${year}-${month}`; 
        
        setTimeout(() => {
            const adminResultBox = document.getElementById('admin-result-box');
            if (adminResultBox) adminResultBox.classList.add('hidden');
        }, 5000);
        
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

function handleEditRecord(id) {
    const recordToEdit = allRecordsFromDB.find(record => record.id === id);
    if (!recordToEdit) {
        displayMessage('Error', 'No se pudo encontrar el registro para editar.', 'error');
        return;
    }
    
    const form = document.getElementById('admin-record-form');
    
    // CARGAR CAMPOS DE IDENTIFICACIÓN
    form.elements['input-gguu'].value = recordToEdit.gguu || '';
    form.elements['input-unidad'].value = recordToEdit.unidad || '';
    form.elements['input-dni'].value = recordToEdit.dni || '';
    form.elements['input-sex-admin'].value = recordToEdit.sexo;
    form.elements['input-userid'].value = recordToEdit.cip;
    form.elements['input-role'].value = recordToEdit.grado;
    form.elements['input-lastname'].value = recordToEdit.apellido;
    form.elements['input-firstname'].value = recordToEdit.nombre;
    // EDAD se carga directamente
    form.elements['input-age-admin'].value = recordToEdit.edad; 
    
    // CARGAR CAMPOS DE PESADA
    form.elements['input-pa'].value = recordToEdit.pa || '';
    form.elements['input-pab'].value = recordToEdit.pab || '';
    form.elements['input-weight-admin'].value = recordToEdit.peso;
    form.elements['input-height-admin'].value = recordToEdit.altura;

    // Cargar el Mes de Registro (DD/MM/YYYY -> YYYY-MM)
    if (recordToEdit.fecha && recordToEdit.fecha.includes('/')) {
        const parts = recordToEdit.fecha.split('/'); // [DD, MM, YYYY]
        form.elements['input-registro-month'].value = `${parts[2]}-${parts[1]}`; 
    } else {
        form.elements['input-registro-month'].value = ''; 
    }

    // FORZAR RECALCULO Y VISUALIZACIÓN al abrir el formulario (SOLUCIÓN UX)
    const imc = calculateIMC(recordToEdit.peso, recordToEdit.altura);
    
    const imcExceptionResult = applyMilitaryIMCException(imc, recordToEdit.sexo, recordToEdit.pab);
    const imcToDisplay = imcExceptionResult.imc.toFixed(1); 
    
    const { resultado, detalle } = getAptitude(imcToDisplay, recordToEdit.sexo, recordToEdit.pab, recordToEdit.pa);

    const badgeClass = getSimplifiedAptitudeStyle(resultado);

    document.getElementById('admin-bmi-value').textContent = imcToDisplay; 
    document.getElementById('admin-aptitude-badge').textContent = resultado;
    document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
    document.getElementById('admin-aptitude-detail').textContent = detalle;
    document.getElementById('admin-result-box').classList.remove('hidden');


    const submitButton = document.querySelector('#admin-record-form button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-save mr-2"></i> ACTUALIZAR REGISTRO';
    document.querySelector('#admin-record-form h3').innerHTML = '<i class="fas fa-pencil-alt mr-2 text-color-accent-lime"></i> EDITANDO REGISTRO DE PERSONAL';

    // MOSTRAR BOTÓN DE CANCELAR EDICIÓN
    document.getElementById('cancel-edit-button').style.display = 'block';

    isEditMode = true;
    currentEditingRecordId = id;
    form.scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    isEditMode = false;
    currentEditingRecordId = null;

    document.getElementById('admin-record-form').reset();
    const submitButton = document.querySelector('#admin-record-form button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-database mr-2"></i> GUARDAR Y CALCULAR APTITUD';
    document.querySelector('#admin-record-form h3').innerHTML = '<i class="fas fa-user-plus mr-2 text-color-accent-lime"></i> REGISTRO DE NUEVO PERSONAL';
    
    // OCULTAR BOTÓN DE CANCELAR EDICIÓN
    document.getElementById('cancel-edit-button').style.display = 'none';

    // Restablecer el campo de mes de registro al mes actual
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('input-registro-month').value = `${year}-${month}`;
    
    const adminResultBox = document.getElementById('admin-result-box');
    if (adminResultBox) adminResultBox.classList.add('hidden');
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
    if (!filterSelect) return; 
    
    const monthCounts = allRecordsFromDB.reduce((acc, record) => {
        if (!record.fecha) return acc;
        const monthYear = record.fecha.substring(3); 
        acc[monthYear] = (acc[monthYear] || 0) + 1;
        return acc;
    }, {});
    
    filterSelect.innerHTML = `<option value="">Todos los Meses (${allRecordsFromDB.length} Registros)</option>`;
    
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
    
    const currentFilterValue = filterSelect.getAttribute('data-current-value') || "";
    if (currentFilterValue) {
        filterSelect.value = currentFilterValue;
    } else {
        filterSelect.selectedIndex = 0; // Por defecto "Todos los Meses"
    }
}

function filterTable() {
    const nameSearchTerm = document.getElementById('name-filter').value.toLowerCase().trim();
    const ageFilterValue = document.getElementById('age-filter').value;
    const monthFilter = document.getElementById('month-filter').value; // value="" para "Todos los Meses"
    const aptitudeFilterValue = (document.getElementById('aptitude-filter').value || '').toUpperCase(); 

    document.getElementById('month-filter').setAttribute('data-current-value', monthFilter);


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
            record.fecha && record.fecha.substring(3) === monthFilter
        );
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

function renderProgressionChart(records) {
    const ctx = document.getElementById('bmiProgressionChart');
    const chartCard = document.getElementById('stats-chart-card');
    if (!ctx || !chartCard) return;

    const cipList = records.map(r => r.cip);
    const isIndividual = records.length > 0 && cipList.every((val, i, arr) => val === arr[0]);
    
    if (!isIndividual) {
        chartCard.style.display = 'none';
        return;
    }
    
    chartCard.style.display = 'block';

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    // ***************************************************************
    // *** SOLUCIÓN GRÁFICA: ORDEN CRONOLÓGICO ASCENDENTE ***
    // ***************************************************************
    // 1. Mapear y crear una clave de ordenación (YYYYMMDD)
    const chartRecordsAsc = [...records].map(r => {
        // r.fecha es DD/MM/YYYY
        const parts = r.fecha.split('/'); 
        const year = parseInt(parts[2]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[0]);
        // La clave de ordenación cronológica (un número grande)
        const sortKey = year * 10000 + month * 100 + day; 
        return { ...r, sortKey };
    }).sort((a, b) => a.sortKey - b.sortKey); // 2. Ordenar ascendentemente por sortKey (ASC)

    
    const labels = chartRecordsAsc.map(r => {
        const parts = r.fecha.split('/'); 
        const monthIndex = parseInt(parts[1]) - 1;
        const year = parts[2];
        const status = r.motivo === 'NO ASISTIÓ' ? ' (Ausente)' : '';
        return `${monthNames[monthIndex]} ${year}${status}`;
    });
    
    const chartTitle = `${records[0].grado} ${records[0].apellido}, ${records[0].nombre}`;

    const dataPoints = chartRecordsAsc.map(r => r.motivo === 'NO ASISTIÓ' ? null : parseFloat(r.imc));

    if (progressionChart) {
        progressionChart.destroy();
    }

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
                    if (imc >= 25) return '#E74C3C';
                    return '#008744';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#EEEEEE'
                    }
                },
                title: {
                    display: true,
                    text: chartTitle,
                    color: '#FFD700',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.raw === null) {
                                return 'NO ASISTIÓ';
                            }
                            label += context.raw;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'IMC',
                        color: '#EEEEEE'
                    },
                    min: 15,
                    max: 40,
                    ticks: {
                        color: '#A0A0A0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#A0A0A0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}


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
        // Al renderizar, usamos el IMC que está guardado (el IMC corregido o el real)
        const { resultado, paClasificacion, riesgoAEnf, clasificacionMINSA } = getAptitude(data.imc, data.sexo, data.pab, data.pa);
        
        const badgeClass = getSimplifiedAptitudeStyle(resultado); 
        const rowBgClass = resultado.startsWith('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        const clasificacionDisplay = clasificacionMINSA.includes('(EXCEPCIÓN)') ? clasificacionMINSA.toUpperCase() : (clasificacionMINSA === 'NO ASISTIÓ' ? data.motivo.toUpperCase() : clasificacionMINSA.toUpperCase());
        
        const riesgoAbdominalClass = riesgoAEnf === 'RIESGO MUY ALTO' ? 'text-red-500 font-bold' : (riesgoAEnf === 'RIESGO ALTO' ? 'text-color-accent-gold' : 'text-color-primary-green');
        const paClasificacionClass = paClasificacion.includes('HIPERTENSION') || paClasificacion === 'ELEVADA' ? 'text-red-500 font-bold' : 'text-color-primary-green';
        
        let actionButtons = '<span>N/A</span>';
        
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin'; 

        if (isAdmin) {
            const isNoAsistio = data.motivo === 'NO ASISTIÓ';
            const editButton = isNoAsistio ? 
                '<button class="text-gray-500 text-lg mr-4" title="No se puede editar NO ASISTIÓ" disabled><i class="fas fa-pencil-alt"></i></button>' :
                `<button onclick="handleEditRecord(${data.id})" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Editar Registro"><i class="fas fa-pencil-alt"></i></button>`;
                
            actionButtons = editButton; 
            
            // MODIFICACIÓN: Permitir eliminar a todos los administradores (admin y superadmin)
            actionButtons += `
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
            <td class="px-4 py-3 whitespace-nowrap text-lg font-extrabold ${resultado.startsWith('INAPTO') ? 'text-red-500' : 'text-color-accent-gold'}">${data.imc || 'N/A'}</td>
            
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">${clasificacionDisplay}</td>
            
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
    
    const tableHeaderStyle = "background-color: #2F4F4F; color: white; padding: 4px; text-align: center; font-size: 10px; border: 1px solid #111; font-weight: bold; border-collapse: collapse; white-space: nowrap; font-family: 'Arial', sans-serif;";
    const cellStyle = "padding: 4px; text-align: center; font-size: 10px; border: 1px solid #ccc; vertical-align: middle; border-collapse: collapse; font-family: 'Arial', sans-serif;";
    const inaptoTextStyle = 'style="color: #991b1b; font-weight: bold; text-align: center; font-family: \'Arial\', sans-serif;"';
    const aptoTextStyle = 'style="color: #065f46; font-weight: bold; text-align: center; font-family: \'Arial\', sans-serif;"';
    const titleStyle = "text-align: center; color: #1e3a8a; font-size: 20px; margin-bottom: 5px; font-weight: bold; font-family: 'Arial', sans-serif;";
    const subtitleStyle = "text-align: center; font-size: 14px; margin-bottom: 20px; font-family: 'Arial', sans-serif;";
    const reportDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte SIMCEP</title><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 100%; margin: 20px auto; } td, th { border-collapse: collapse; }</style></head><body>`;
    
    htmlContent += `<div style="text-align: center; width: 100%;">
        <h1 style="${titleStyle}">REPORTE DE ÍNDICE DE MASA CORPORAL (SIMCEP)</h1>
        <p style="${subtitleStyle}">Fecha de Generación: ${reportDate} | Registros Filtrados: ${currentFilteredRecords.length}</p>
    </div>`;

    htmlContent += `<table border="1" style="width: 100%;"><thead><tr>
        <th style="${tableHeaderStyle}; width: 10%;">UNIDAD</th>
        <th style="${tableHeaderStyle}; width: 10%;">GRADO</th>
        <th style="${tableHeaderStyle}; width: 25%;">APELLIDOS Y NOMBRES</th>
        <th style="${tableHeaderStyle}; width: 8%;">EDAD</th>
        <th style="${tableHeaderStyle}; width: 8%;">PESO (kg)</th>
        <th style="${tableHeaderStyle}; width: 8%;">TALLA (m)</th>
        <th style="${tableHeaderStyle}; width: 8%;">IMC</th>
        <th style="${tableHeaderStyle}; width: 23%;">CLASIFICACIÓN</th>
    </tr></thead><tbody>`;
    
    currentFilteredRecords.forEach(record => {
        const { resultado, clasificacionMINSA } = getAptitude(record.imc, record.sexo, record.pab, record.pa); 
        
        const textStyleTag = resultado.startsWith('INAPTO') ? inaptoTextStyle : aptoTextStyle;
        const nameCellStyle = `${cellStyle} text-align: left; font-weight: bold;`;
        
        let clasificacionDisplay = clasificacionMINSA.includes('(EXCEPCIÓN)') ? clasificacionMINSA.toUpperCase() : (clasificacionMINSA === 'NO ASISTIÓ' ? record.motivo.toUpperCase() : clasificacionMINSA.toUpperCase());
        
        htmlContent += `<tr>
            <td style="${cellStyle}">${record.unidad || 'N/A'}</td>
            <td style="${cellStyle}">${record.grado || 'N/A'}</td>
            <td style="${nameCellStyle}">${(record.apellido || 'N/A').toUpperCase()}, ${record.nombre || 'N/A'}</td>
            <td style="${cellStyle}">${record.edad || 'N/A'}</td>
            <td style="${cellStyle}">${record.peso || 'N/A'}</td>
            <td style="${cellStyle}">${record.altura || 'N/A'}</td>
            <td style="${cellStyle} font-weight: bold;">${record.imc || 'N/A'}</td>
            <td style="${cellStyle}" ${textStyleTag}>${clasificacionDisplay}</td>
        </tr>`;
    });
    
    htmlContent += `</tbody></table>
    <div style="margin: 40px auto 0 auto; width: 95%; text-align: center; border: none; font-family: 'Arial', sans-serif;">
        <h4 style="font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #1e3a8a;">LEYES DE CLASIFICACIÓN CLÍNICA (SIMCEP)</h4>
        <p style="font-size: 10px; margin: 5px 0; text-align: left; padding-left: 10%;">
            *La Aptitud se rige por el IMC y el Perímetro Abdominal (PAB) según directrices de la OMS/Internas. 
            El INAPTO es anulado a APTO si el PAB cae en el rango de excepción.
        </p>
    </div></body></html>`;

    const date = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    const filename = `Reporte_SIMCEP_IMC_Word_${date}.doc`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click(); // Usar .click() para la descarga
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    displayMessage('Exportación Exitosa', `Se ha generado el archivo ${filename} para Word.`, 'success');
}


function exportStatsToWord() {
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para operar.', 'error');
        return;
    }
    
    const records = currentFilteredRecords;
    
    if (records.length === 0) {
        displayMessage('Sin Datos', 'No hay registros visibles en la tabla para generar estadística. Ajuste los filtros.', 'warning');
        return;
    }

    const cipList = records.map(r => r.cip);
    const isIndividual = records.every((val, i, arr) => val === arr[0]);
    
    const reportTitle = isIndividual 
        ? `REPORTE DE PROGRESIÓN DE IMC DEL PERSONAL: ${records[0].apellido}, ${records[0].nombre}`
        : "REPORTE ESTADÍSTICO CONSOLIDADO DE PESADA";
    
    const subtitleText = isIndividual ? `CIP: ${records[0].cip} | UNIDAD: ${records[0].unidad}` : `Registros Analizados: ${records.length}`;

    let progressionTableHtml = '';
    
    if (isIndividual) {
         progressionTableHtml = `
            <h3 style="font-size: 16px; margin-top: 20px; font-weight: bold; color: #008744;">NOTA: VER GRÁFICO DE PROGRESIÓN EN PANTALLA</h3>
            <p style="font-size: 12px; margin-top: 5px; color: #555;">Este reporte de Word solo incluye la tabla de resumen estadístico por ser un formato no compatible con gráficos dinámicos.</p>
        `;
    }
    
    const totalRegistrosValidos = records.filter(r => r.motivo !== 'NO ASISTIÓ').length;
    const totalApto = records.filter(r => r.resultado && r.resultado.startsWith('APTO') && r.motivo !== 'NO ASISTIÓ').length;
    const totalInapto = records.filter(r => r.resultado && r.resultado.startsWith('INAPTO') && r.motivo !== 'NO ASISTIÓ').length;
    const totalNoAsistio = records.filter(r => r.motivo === 'NO ASISTIÓ').length;

    const porcentajeApto = totalRegistrosValidos > 0 ? ((totalApto / totalRegistrosValidos) * 100).toFixed(1) : 0;
    const porcentajeInapto = totalRegistrosValidos > 0 ? ((totalInapto / totalRegistrosValidos) * 100).toFixed(1) : 0;


    const statsSummaryHtml = `
        <h3 style="font-size: 16px; margin-top: 30px; font-weight: bold; color: #008744;">RESUMEN DE APTITUD</h3>
        <table border="1" style="width: 50%; min-width: 400px; margin-top: 10px; border-collapse: collapse; font-family: 'Arial', sans-serif;">
            <tr style="background-color: #f0f0f0;">
                <td style="padding: 6px; width: 30%;">Total Registros Válidos (con Pesada)</td>
                <td style="padding: 6px; text-align: center;">${totalRegistrosValidos}</td>
            </tr>
            <tr style="background-color: #c8e6c9;">
                <td style="padding: 6px;">Total APTO (Válido)</td>
                <td style="padding: 6px; text-align: center; font-weight: bold;">${totalApto} (${porcentajeApto}%)</td>
            </tr>
            <tr style="background-color: #ffcdd2;">
                <td style="padding: 6px;">Total INAPTO (Válido)</td>
                <td style="padding: 6px; text-align: center; font-weight: bold;">${totalInapto} (${porcentajeInapto}%)</td>
            </tr>
            <tr style="background-color: #fff3c9;">
                <td style="padding: 6px;">Total NO ASISTIÓ</td>
                <td style="padding: 6px; text-align: center; font-weight: bold;">${totalNoAsistio}</td>
            </tr>
        </table>
    `;

    const reportDate = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte SIMCEP Estadístico</title><style>body { font-family: Arial, sans-serif; }</style></head><body>`;
    
    htmlContent += `<div style="text-align: center; font-family: 'Arial', sans-serif;">
        <h1 style="color: #FFD700; font-size: 20px; margin-bottom: 5px;">${reportTitle}</h1>
        <p style="font-size: 12px; margin-bottom: 20px;">${subtitleText} | Generado el: ${reportDate}</p>
    </div>`;

    htmlContent += progressionTableHtml;
    htmlContent += statsSummaryHtml;
    
    htmlContent += `</body></html>`;

    const filename = `Reporte_Estadistico_SIMCEP_${isIndividual ? records[0].cip : 'Consolidado'}_${reportDate.replace(/\//g, '-')}.doc`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    displayMessage('Exportación Exitosa', `Se ha generado el archivo ${filename} para Word.`, 'success');
}

function downloadChartAsImage() {
    const canvas = document.getElementById('bmiProgressionChart');
    if (!canvas || !progressionChart) {
        displayMessage('Error', 'No hay gráfico para descargar. Genere un reporte individual primero.', 'error');
        return;
    }
    
    const reportDate = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    const cip = currentFilteredRecords.length > 0 && currentFilteredRecords.every(r => r.cip === currentFilteredRecords[0].cip) ? currentFilteredRecords[0].cip : 'CONSOLIDADO';

    const filename = `Progreso_IMC_${cip}_${reportDate}.png`;
    
    const imageURL = canvas.toDataURL('image/png'); 
    
    const a = document.createElement('a');
    a.href = imageURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    displayMessage('ÉXITO', `Gráfica descargada como ${filename}.`, 'success');
}


function exportToExcel() {
    if (!isAuthenticated || currentFilteredRecords.length === 0) {
        displayMessage('Error', 'No se puede exportar sin registros o sin autenticación.', 'error');
        return;
    }
    
    const reportMonthEl = document.getElementById('input-report-month');
    const reportMonth = reportMonthEl ? reportMonthEl.value.toUpperCase() : 'REPORTE CONSOLIDADO';
    
    const btn = document.getElementById('export-excel-button');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> GENERANDO...';
    btn.disabled = true;

    fetch('/api/export-excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            records: currentFilteredRecords,
            reportMonth: reportMonth 
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(error => { throw new Error(error.message || 'Error desconocido del servidor.'); });
        }
        return response.blob(); 
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
        a.href = url;
        a.download = `Reporte_SIMCEP_Mensual_${date}.xlsx`;
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
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });
}


// --- 7. Event Listeners ---

document.getElementById('bmi-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('input-weight').value);
    const height = parseFloat(document.getElementById('input-height').value);
    const pab = parseFloat(document.getElementById('input-pab-public').value);
    const sex = document.getElementById('input-sex').value;
    
    const pa = 'N/A'; 
    
    if (weight > 0 && height > 0 && pab > 0) {
        const imc = calculateIMC(weight, height); // IMC REAL
        
        // NO APLICAMOS LA EXCEPCIÓN AQUÍ (es la calculadora pública)
        const { resultado, detalle } = getAptitude(imc, sex, pab, pa); 

        const { badgeClass: newBadgeClass, boxBorderClass, boxColor } = getAptitudeUI(resultado);
        
        const resultBox = document.getElementById('result-box');
        resultBox.className = `mt-8 p-6 rounded-lg hidden ${boxBorderClass}`; 
        
        document.getElementById('bmi-value').textContent = imc;
        document.getElementById('bmi-value').style.color = `var(--${boxColor.substring(5)})`;
        const aptitudeBadge = document.getElementById('aptitude-badge');
        aptitudeBadge.textContent = resultado;
        aptitudeBadge.className = `px-5 py-2 font-bold rounded-full shadow-lg uppercase ${newBadgeClass}`;
        document.getElementById('aptitude-detail').textContent = detalle;
        resultBox.classList.remove('hidden');

    } else {
        displayMessage('Datos Inválidos', 'Por favor, ingrese Peso, Altura y Perímetro Abdominal válidos.', 'error');
    }
});

document.getElementById('admin-record-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para operar.', 'error');
        return;
    }
    const form = e.target;
    
    // CAPTURA DE DATOS
    const gguu = form.elements['input-gguu']?.value || '';
    const unidad = form.elements['input-unidad']?.value || '';
    const dni = form.elements['input-dni']?.value || '';
    const pa = form.elements['input-pa']?.value || '';
    const sexo = form.elements['input-sex-admin']?.value || '';
    const cip = form.elements['input-userid']?.value || '';
    const grado = form.elements['input-role']?.value || '';
    const apellido = form.elements['input-lastname']?.value || '';
    const nombre = form.elements['input-firstname']?.value || '';
    const dob = form.elements['input-dob']?.value || ''; // Está oculto, pero capturamos el valor (si lo tiene)
    const edad = parseInt(form.elements['input-age-admin']?.value || 0); // EDAD MANUAL
    const peso = parseFloat(form.elements['input-weight-admin']?.value || 0);
    const altura = parseFloat(form.elements['input-height-admin']?.value || 0);
    const pab = parseFloat(form.elements['input-pab']?.value || 0); 

    const registroMonthInput = form.elements['input-registro-month'];
    const registroMonthYear = registroMonthInput ? registroMonthInput.value : ''; 
    
    if (!registroMonthYear || registroMonthYear.length !== 7 || registroMonthYear.indexOf('-') !== 4) {
        displayMessage('Error de Entrada', 'El Mes de Registro es obligatorio y debe tener el formato YYYY-MM (Ej: 2025-11).', 'error');
        document.getElementById('admin-result-box')?.classList.add('hidden');
        return;
    }
    
    const [regYear, regMonth] = registroMonthYear.split('-');
    const formattedDate = `01/${regMonth}/${regYear}`; 
    const formattedMonthYear = `${regMonth}/${regYear}`; 

    // ***************************************************************
    // *** AÑADIDO: VALIDACIÓN DE MES FUTURO (UX) ***
    // ***************************************************************
    const now = new Date();
    const currentYearMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
    const selectedYearMonth = parseInt(regYear) * 100 + parseInt(regMonth);

    if (selectedYearMonth > currentYearMonth) {
        displayMessage('MES NO PERMITIDO', 'No se permite registrar datos en meses futuros. Por favor, seleccione el mes actual o uno anterior.', 'error');
        document.getElementById('admin-result-box')?.classList.add('hidden');
        return;
    }


    // VALIDACIÓN DE CAMPOS CLAVE
    if (peso > 0 && altura > 0 && pab > 0 && cip && grado && apellido && nombre && edad >= 18 && gguu && unidad && dni && pa) {
        
        if (!isEditMode) {
            try { 
                const checkResponse = await fetch(`/api/records/check-monthly/${cip}?targetMonthYear=${formattedMonthYear}`);
                
                if (!checkResponse.ok) { 
                    const errorData = await checkResponse.json().catch(() => ({ message: 'Error desconocido del servidor.' }));
                    throw new Error(errorData.message || `Error en la verificación de duplicados (${checkResponse.status}).`);
                }
                
                const checkData = await checkResponse.json(); 

                if (checkData.alreadyRecorded) {
                    displayMessage('REGISTRO DUPLICADO', checkData.message, 'warning');
                    document.getElementById('admin-result-box')?.classList.add('hidden');
                    return; 
                }
                
                if (checkData.missingRecordsCreated) {
                    displayMessage('REGISTROS CREADOS', `Se crearon ${checkData.count} registros de 'NO ASISTIÓ' para los meses faltantes.`, 'success');
                    await fetchAndDisplayRecords(); 
                }
                
            } catch (error) {
                displayMessage('ERROR DE VERIFICACIÓN', error.message, 'error');
                console.error("Error en la verificación de unicidad:", error);
                document.getElementById('admin-result-box')?.classList.add('hidden');
                return;
            }
        }
        
        const imcReal = calculateIMC(peso, altura); // IMC Real (con decimales)

        // APLICAR LA EXCEPCIÓN DE LA DIRECTIVA
        const imcExceptionResult = applyMilitaryIMCException(imcReal, sexo, pab);
        const imcToSave = imcExceptionResult.imc.toFixed(1); // 29.9 o el IMC Real (1 decimal)
        
        let finalAptitudeResult;
        
        if (imcExceptionResult.sobrescrito) {
            // Si se sobrescribió (Regla Militar):
            const paClasificacion = getClassificacionPA(pa);
            const riesgoAEnf = getRiskByWaist(sexo, pab);
            
            finalAptitudeResult = { 
                resultado: 'APTO', // Siempre APTO por excepción
                detalle: `IMC Real: ${imcReal} -> Sobrescrito a ${imcToSave} por EXCEPCIÓN MASA MUSCULAR.`,
                clasificacionMINSA: 'SOBREPESO (EXCEPCIÓN)',
                paClasificacion: paClasificacion,
                riesgoAEnf: riesgoAEnf,
                motivoInapto: imcExceptionResult.motivo
            };
        } else {
            // Si NO se sobrescribió:
            finalAptitudeResult = getAptitude(imcReal, sexo, pab, pa); 
        }

        const { resultado, detalle, paClasificacion, riesgoAEnf, motivoInapto } = finalAptitudeResult; 

        // VISUALIZACIÓN
        const { badgeClass: newBadgeClass, boxBorderClass, boxColor } = getAptitudeUI(resultado);
        
        const adminResultBox = document.getElementById('admin-result-box');
        adminResultBox.className = `mt-8 p-6 rounded-lg hidden ${boxBorderClass}`;
        
        document.getElementById('admin-bmi-value').textContent = imcToSave; // Mostrar el IMC corregido/final
        document.getElementById('admin-bmi-value').style.color = `var(--${boxColor.substring(5)})`;
        document.getElementById('admin-aptitude-badge').textContent = resultado;
        document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${newBadgeClass}`;
        document.getElementById('admin-aptitude-detail').textContent = detalle;
        adminResultBox.classList.remove('hidden');
        
        const primerApellido = currentAdminFullName?.split(' ')[0] || ''; 
        const adminRoleText = currentAdminFullName?.includes('MD') || currentAdminFullName?.includes('DR') ? 'DR/MD' : (currentUserRole === 'superadmin' ? 'SUPERADMIN' : 'ADMIN');
        const digitadorFinal = `${currentAdminUser} (${adminRoleText} ${primerApellido})`;


        // GUARDADO FINAL (Usa imcToSave como el valor de IMC)
        if (isEditMode) {
            const updatedRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc: imcToSave, motivo: motivoInapto, dob: dob, fecha: formattedDate }; 
            updateRecord(currentEditingRecordId, updatedRecord);
        } else {
            const newRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc: imcToSave, fecha: formattedDate, registradoPor: digitadorFinal, motivo: motivoInapto, dob: dob }; 
            saveRecord(newRecord);
        }
    } else {
        displayMessage('Error de Entrada', 'Por favor, complete todos los campos obligatorios y revise valores numéricos (Edad >= 18, Peso, Altura, PAB).', 'error');
        document.getElementById('admin-result-box')?.classList.add('hidden');
    }
});

document.getElementById('admin-login-button')?.addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button')?.addEventListener('click', logoutAdmin);
document.getElementById('export-word-button')?.addEventListener('click', exportToWord);
document.getElementById('export-excel-button')?.addEventListener('click', exportToExcel); 
document.getElementById('export-stats-button')?.addEventListener('click', exportStatsToWord);
document.getElementById('download-chart-button')?.addEventListener('click', downloadChartAsImage);

document.getElementById('forgot-password-link')?.addEventListener('click', function(e) {
    e.preventDefault(); 
    handleForgotPassword();
});
document.getElementById('name-filter')?.addEventListener('input', filterTable);
document.getElementById('age-filter')?.addEventListener('input', filterTable);
document.getElementById('month-filter')?.addEventListener('change', filterTable);
document.getElementById('aptitude-filter')?.addEventListener('change', filterTable); 
document.getElementById('add-user-form')?.addEventListener('submit', handleAddUser);
document.getElementById('cancel-edit-button')?.addEventListener('click', cancelEdit);


// ***************************************************************
// *** NUEVO EVENT LISTENER: GESTIÓN MASIVA DE INASISTENCIA ***
// ***************************************************************
document.getElementById('mass-no-show-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (currentUserRole !== 'superadmin') {
        displayMessage('ACCESO DENEGADO', 'Solo el Super Administrador puede ejecutar este proceso.', 'error');
        return;
    }

    const monthInput = document.getElementById('input-mass-month');
    const monthYear = monthInput.value; // YYYY-MM
    
    if (!monthYear) {
        displayMessage('Error', 'Debe seleccionar un mes.', 'warning');
        return;
    }

    const [year, month] = monthYear.split('-');
    const targetMonthYear = `${month}/${year}`; // MM/YYYY para el backend

    // Validar el mes futuro antes de confirmar
    const now = new Date();
    const currentYearMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
    const selectedYearMonth = parseInt(year) * 100 + parseInt(month);
    
    if (selectedYearMonth > currentYearMonth) {
        displayMessage('MES NO PERMITIDO', 'No se permite registrar datos masivos en meses futuros o el mes actual.', 'error');
        return;
    }

    if (!confirm(`ADVERTENCIA: ¿Está seguro de registrar "NO ASISTIÓ" para TODO el personal sin registro en ${month}/${year}?`)) {
        return;
    }
    
    const btn = document.getElementById('mass-no-show-button');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PROCESANDO...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/records/mass-no-show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetMonthYear: targetMonthYear })
        });
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Error desconocido al ejecutar el proceso masivo.');
        }

        displayMessage('PROCESO EXITOSO', data.message, 'success');
        await fetchAndDisplayRecords(); // Recargar la tabla con los nuevos registros
        
    } catch (error) {
        displayMessage('ERROR CRÍTICO', error.message, 'error');
        console.error('Error en el proceso masivo:', error);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
});


// LÓGICA DE AUTOCOMPLETADO
async function fetchAndAutoFill(queryType, queryValue) {
    if (!queryValue || queryValue.length < 5) return;
    
    const url = `/api/patient/${queryValue}`; 

    try {
        const response = await fetch(url);
        
        if (response.status === 404) {
            if (queryValue.length > 7) {
                displayMessage('ATENCIÓN', `Paciente con ${queryType} ${queryValue} no encontrado. Ingrese datos manualmente.`, 'warning');
            }
            return; 
        }
        
        if (!response.ok) throw new Error('Error al buscar paciente.');
        
        const patientData = await response.json();
        
        // Autocompletar con null-check
        document.getElementById('input-gguu').value = patientData.gguu || ''; 
        document.getElementById('input-unidad').value = patientData.unidad || ''; 
        document.getElementById('input-userid').value = patientData.cip || '';
        document.getElementById('input-role').value = patientData.grado || '';
        document.getElementById('input-sex-admin').value = patientData.sexo || 'Masculino';
        document.getElementById('input-lastname').value = patientData.apellido || '';
        document.getElementById('input-firstname').value = patientData.nombre || '';
        
        // Solo se autocompleta la edad (manual)
        document.getElementById('input-age-admin').value = patientData.edad || '';
        // El DOB no se usa, pero se mantiene para la estructura
        if (document.getElementById('input-dob')) { 
             document.getElementById('input-dob').value = patientData.fechaNacimiento || ''; 
        }


        // VACÍO DE CAMPOS VARIABLES (PESADA CLÍNICA)
        document.getElementById('input-pa').value = ''; 
        document.getElementById('input-weight-admin').value = ''; 
        document.getElementById('input-height-admin').value = ''; 
        document.getElementById('input-pab').value = ''; 
        
        displayMessage('ÉXITO', 'Datos de identificación cargados automáticamente.', 'success');

    } catch (error) {
        console.error("Error en autocompletado:", error);
    }
}

function handleDNIInput(event) {
    const dni = event.target.value;
    if (dni.length === 8 && /^\d+$/.test(dni)) {
        fetchAndAutoFill('DNI', dni);
    } 
}

document.getElementById('input-dni')?.addEventListener('blur', handleDNIInput);


document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    
    // Configuración inicial del input del Mes de Registro (YYYY-MM)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const registroMonthInput = document.getElementById('input-registro-month');
    if (registroMonthInput) {
        registroMonthInput.value = `${year}-${month}`;
    }

    // Forzar el filtro de la tabla a "Todos los Meses" al cargar
    const filterSelect = document.getElementById('month-filter');
    if (filterSelect) {
        filterSelect.value = ""; 
        filterSelect.setAttribute('data-current-value', ""); 
    }

    updateUI();
});