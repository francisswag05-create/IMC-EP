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


// --- FUNCIONES PARA GESTIÓN DE USUARIOS (CORREGIDA: SOLUCIONA EL 'undefined') ---

async function fetchAndDisplayUsers() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return; // Salir si no estamos en la vista de administración

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
            // *** INICIO DE CORRECCIÓN PARA EL 'undefined' ***
            // Usar 'user.fullName' pero con un fallback (||) si es nulo o indefinido.
            let userFullNameDisplay = user.fullName || 'Nombre Desconocido'; 
            let roleDisplay = '';

            if (user.role === 'admin') {
                roleDisplay = `(ADMINISTRADOR)`;
            } else if (user.role === 'superadmin') {
                roleDisplay = `(SUPERADMIN)`;
            }
            
            let finalDisplay = `${userFullNameDisplay} ${roleDisplay}`;

            // *** FIN DE CORRECCIÓN ***

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

    if (!publicView || !adminView || !userInfo) return; // Salir si no estamos en la página principal

    if (isAuthenticated) {
        publicView.classList.add('hidden-view');
        adminView.classList.remove('hidden-view');
        userInfo.textContent = `Usuario: ${currentAdminUser.toUpperCase()}`;
        userInfo.classList.remove('text-color-accent-lime', 'border-gray-600');
        userInfo.classList.add('bg-color-accent-gold', 'border-color-accent-gold', 'text-color-green-darker');

        if (monitoringTextEl && currentAdminFullName) {
            // Se usa Katherin Giuiliana Ponce Canahuiere en el ejemplo, asumimos que este campo es correcto al loguear
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
        // Llamar a la función de carga de registros
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
    }
}

function updateAdminTableHeaders() {
    const tableHeaderRow = document.querySelector('#admin-dashboard-view thead tr');
    if (tableHeaderRow) {
        // AJUSTADO A 12 COLUMNAS (AÑADIDA CLASIFICACIÓN IMC)
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


// --- 3. Funciones de Cálculo de IMC y Clasificación (MODIFICADA) ---

function calculateIMC(weight, height) {
    if (height > 0) {
        const imc = weight / (height * height);
        return imc.toFixed(1);
    }
    return 0; 
}

// NUEVA FUNCIÓN PARA CALCULAR EDAD A PARTIR DE DOB
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


// --- NUEVA FUNCIÓN PARA CLASIFICAR PRESIÓN ARTERIAL (CLASIFICACION) ---
function getClassificacionPA(paString) {
    if (!paString || !paString.includes('/')) return 'N/A';
    if (paString.toUpperCase() === 'N/A') return 'N/A';

    const [sistolicaStr, diastolicaStr] = paString.split('/');
    const sistolica = parseInt(sistolicaStr);
    const diastolica = parseInt(diastolicaStr);

    if (isNaN(sistolica) || isNaN(diastolica)) return 'N/A';
    
    if (sistolica >= 140 || diastolica >= 90) return 'HIPERTENSION';
    if (sistolica >= 120 || diastolica >= 80) return 'PRE-HIPERTENSION';
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


// --- Función getAptitude (SIMPLIFICADA: SOLO APTO/INAPTO + REGLAS DE EXCEPCIÓN) ---
function getAptitude(imc, sexo, pab, paString) {
    const imcFloat = parseFloat(imc);
    const pabFloat = parseFloat(pab); 
    let clasificacionMINSA, resultado, detalle;
    
    // *** MODIFICACIÓN PRINCIPAL: Manejo de NO ASISTIÓ/Registro Vacío ***
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
    let umbralExcepcion;

    if (sexo === 'Masculino') {
        umbralExcepcion = 94;
        if (pabFloat < 94) { // PAB < 94 -> APTO
            aplicaExcepcion = true;
        }
    } else { // Femenino
        umbralExcepcion = 80;
        if (pabFloat < 80) { // PAB < 80 -> APTO
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
    
    if (resultado.startsWith('APTO') && (paClasificacion === 'HIPERTENSION' || paClasificacion === 'PRE-HIPERTENSION')) {
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

// --- FUNCIONES PARA RECUPERACIÓN DE CONTRASEÑA ---

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
        // Enviar la solicitud de recuperación
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


// --- 5. Funciones CRUD para Registros de IMC ---

async function fetchAndDisplayRecords() {
    try {
        const response = await fetch('/api/records');
        if (!response.ok) throw new Error('Error al obtener los registros del servidor.');
        allRecordsFromDB = await response.json();
        
        // ** CORRECCIÓN: La función `populateMonthFilter` ahora establecerá el filtro por defecto. **
        populateMonthFilter();
        
        // Aplicar los filtros para llenar la tabla.
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
        
        // ** CORRECCIÓN: Volver a cargar y filtrar la tabla **
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
    form.elements['input-dob'].value = recordToEdit.dob || ''; 
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
    form.scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    isEditMode = false;
    currentEditingRecordId = null;

    document.getElementById('admin-record-form').reset();
    const submitButton = document.querySelector('#admin-record-form button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-database mr-2"></i> GUARDAR Y CALCULAR APTITUD';
    document.querySelector('#admin-record-form h3').innerHTML = '<i class="fas fa-user-plus mr-2 text-color-accent-lime"></i> REGISTRO DE NUEVO PERSONAL';
    
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

function populateMonthFilter() {
    const filterSelect = document.getElementById('month-filter');
    if (!filterSelect) return; 
    
    const monthCounts = allRecordsFromDB.reduce((acc, record) => {
        if (!record.fecha) return acc;
        // La fecha es DD/MM/YYYY, substring(3) es MM/YYYY
        const monthYear = record.fecha.substring(3); 
        acc[monthYear] = (acc[monthYear] || 0) + 1;
        return acc;
    }, {});
    
    // ** CORRECCIÓN: Asegurar que "Todos los Meses" sea la primera opción (value="") **
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
    
    // ** CORRECCIÓN: NO FORZAR EL MES ACTUAL AQUÍ. El DOMContentLoaded se encargará del estado inicial. **
    // Si el filtro ya tiene un valor (ej: después de un filterTable), mantenerlo. Si no, se queda en "" (Todos los Meses).
    const currentFilterValue = filterSelect.getAttribute('data-current-value') || "";
    if (currentFilterValue) {
        filterSelect.value = currentFilterValue;
    } else {
        filterSelect.selectedIndex = 0; // Por defecto "Todos los Meses"
    }
}

// --- 6. Lógica de la Tabla de Registros (Filtros, Renderizado, Exportación) ---

function filterTable() {
    const nameSearchTerm = document.getElementById('name-filter').value.toLowerCase().trim();
    const ageFilterValue = document.getElementById('age-filter').value;
    const monthFilter = document.getElementById('month-filter').value; // value="" para "Todos los Meses"
    const aptitudeFilterValue = (document.getElementById('aptitude-filter').value || '').toUpperCase(); 

    // Guardar el valor actual del filtro para persistencia al recargar
    document.getElementById('month-filter').setAttribute('data-current-value', monthFilter);


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
    
    // Aplicar Filtro de Mes (SOLO si no es la cadena vacía)
    if (monthFilter) { 
        recordsToDisplay = recordsToDisplay.filter(record => 
            record.fecha && record.fecha.substring(3) === monthFilter
        );
    }
    
    // Aplicar Filtro de Aptitud
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
    
    const chartRecordsAsc = [...records].reverse(); 
    
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
        const { resultado, paClasificacion, riesgoAEnf, clasificacionMINSA } = getAptitude(data.imc, data.sexo, data.pab, data.pa);
        
        const badgeClass = getSimplifiedAptitudeStyle(resultado); 
        const rowBgClass = resultado.startsWith('INAPTO') ? 'bg-red-900/10' : '';
        const row = tableBody.insertRow();
        row.className = `hover:bg-gray-800 transition duration-150 ease-in-out ${rowBgClass}`;
        
        const clasificacionDisplay = clasificacionMINSA === 'NO ASISTIÓ' ? data.motivo.toUpperCase() : clasificacionMINSA.toUpperCase();
        
        const riesgoAbdominalClass = riesgoAEnf === 'RIESGO MUY ALTO' ? 'text-red-500 font-bold' : (riesgoAEnf === 'RIESGO ALTO' ? 'text-color-accent-gold' : 'text-color-primary-green');
        const paClasificacionClass = paClasificacion === 'HIPERTENSION' ? 'text-red-500 font-bold' : (paClasificacion === 'PRE-HIPERTENSION' ? 'text-yellow-500' : 'text-color-primary-green');
        
        let actionButtons = '<span>N/A</span>';
        
        const isSuperadmin = currentUserRole === 'superadmin';
        const isAdmin = currentUserRole === 'admin' || isSuperadmin; 

        if (isAdmin) {
            const isNoAsistio = data.motivo === 'NO ASISTIÓ';
            const editButton = isNoAsistio ? 
                '<button class="text-gray-500 text-lg mr-4" title="No se puede editar NO ASISTIÓ" disabled><i class="fas fa-pencil-alt"></i></button>' :
                `<button onclick="handleEditRecord(${data.id})" class="text-blue-500 hover:text-blue-400 text-lg mr-4" title="Editar Registro"><i class="fas fa-pencil-alt"></i></button>`;
                
            actionButtons = editButton; 
            
            if (isSuperadmin) {
                 actionButtons += `
                    <button onclick="deleteRecord(${data.id})" class="text-red-500 hover:text-red-400 text-lg" title="Eliminar Registro">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                 `;
            }
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
        
        let clasificacionDisplay = clasificacionMINSA === 'NO ASISTIÓ' ? record.motivo.toUpperCase() : clasificacionMINSA.toUpperCase();
        
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


// --- FUNCIÓN PARA PROCESAR Y EXPORTAR DATOS ESTADÍSTICOS ---
async function exportStatsToWord() {
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para operar.', 'error');
        return;
    }
    
    // Obtener registros de la tabla (ya filtrados por el usuario)
    const records = currentFilteredRecords;
    
    if (records.length === 0) {
        displayMessage('Sin Datos', 'No hay registros visibles en la tabla para generar estadística. Ajuste los filtros.', 'warning');
        return;
    }

    // 1. OBTENER INFORMACIÓN BASE
    const cipList = records.map(r => r.cip);
    const isIndividual = records.every((val, i, arr) => val === arr[0]);
    
    const reportTitle = isIndividual 
        ? `REPORTE DE PROGRESIÓN DE IMC DEL PERSONAL: ${records[0].apellido}, ${records[0].nombre}`
        : "REPORTE ESTADÍSTICO CONSOLIDADO DE PESADA";
    
    const subtitleText = isIndividual ? `CIP: ${records[0].cip} | UNIDAD: ${records[0].unidad}` : `Registros Analizados: ${records.length}`;

    // 2. GENERACIÓN DE LA TABLA DE PROGRESIÓN INDIVIDUAL
    let progressionTableHtml = '';
    
    if (isIndividual) {
         progressionTableHtml = `
            <h3 style="font-size: 16px; margin-top: 20px; font-weight: bold; color: #008744;">NOTA: VER GRÁFICO DE PROGRESIÓN EN PANTALLA</h3>
            <p style="font-size: 12px; margin-top: 5px; color: #555;">Este reporte de Word solo incluye la tabla de resumen estadístico por ser un formato no compatible con gráficos dinámicos.</p>
        `;
    }
    
    // 3. RESUMEN ESTADÍSTICO CONSOLIDADO (Aplica para Individual y Grupo)
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

    // 4. GENERACIÓN DEL DOCUMENTO WORD FINAL
    const reportDate = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte SIMCEP Estadístico</title><style>body { font-family: Arial, sans-serif; }</style></head><body>`;
    
    htmlContent += `<div style="text-align: center; font-family: 'Arial', sans-serif;">
        <h1 style="color: #FFD700; font-size: 20px; margin-bottom: 5px;">${reportTitle}</h1>
        <p style="font-size: 12px; margin-bottom: 20px;">${subtitleText} | Generado el: ${reportDate}</p>
    </div>`;

    htmlContent += progressionTableHtml;
    htmlContent += statsSummaryHtml;
    
    htmlContent += `</body></html>`;

    // LÓGICA DE DESCARGA
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

// --- FUNCIÓN PARA DESCARGAR GRÁFICA COMO IMAGEN ---
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


// --- FUNCIÓN PARA EXPORTAR A EXCEL (LLAMA AL SERVIDOR) ---
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
        const imc = calculateIMC(weight, height);
        
        const { resultado, detalle } = getAptitude(imc, sex, pab, pa); 

        const badgeClass = resultado.startsWith('INAPTO') ? 'bg-red-600 text-white' : 'bg-green-600 text-white';
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
    const dob = form.elements['input-dob']?.value || '';
    const edad = calculateAge(dob); 
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

    // VALIDACIÓN DE CAMPOS CLAVE
    if (peso > 0 && altura > 0 && pab > 0 && cip && grado && apellido && nombre && edad >= 0 && gguu && unidad && dni && pa) {
        
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
        
        const imc = calculateIMC(peso, altura);
        const { resultado, detalle, paClasificacion, riesgoAEnf, motivoInapto } = getAptitude(imc, sexo, pab, pa); 
        
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        document.getElementById('admin-bmi-value').textContent = imc;
        document.getElementById('admin-aptitude-badge').textContent = resultado;
        document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('admin-aptitude-detail').textContent = detalle;
        document.getElementById('admin-result-box').classList.remove('hidden');
        
        const primerApellido = currentAdminFullName?.split(' ')[0] || ''; 
        const adminRoleText = currentAdminFullName?.includes('MD') || currentAdminFullName?.includes('DR') ? 'DR/MD' : (currentUserRole === 'superadmin' ? 'SUPERADMIN' : 'ADMIN');
        const digitadorFinal = `${currentAdminUser} (${adminRoleText} ${primerApellido})`;

        if (isEditMode) {
            const updatedRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo: motivoInapto, dob: dob, fecha: formattedDate }; 
            updateRecord(currentEditingRecordId, updatedRecord);
        } else {
            const newRecord = { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha: formattedDate, registradoPor: digitadorFinal, motivo: motivoInapto, dob: dob }; 
            saveRecord(newRecord);
        }
    } else {
        displayMessage('Error de Entrada', 'Por favor, complete todos los campos obligatorios y revise valores numéricos (Peso, Altura, PAB).', 'error');
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
        
        document.getElementById('input-age-admin').value = patientData.edad || '';
        if (patientData.fechaNacimiento) {
            document.getElementById('input-dob').value = patientData.fechaNacimiento; 
            const edadCalculada = calculateAge(patientData.fechaNacimiento);
            document.getElementById('input-age-admin').value = edadCalculada;
        } else {
             document.getElementById('input-dob').value = '';
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

    // ** SOLUCIÓN CRÍTICA PARA VISIBILIDAD DE REGISTROS VIEJOS **
    // Forzar el filtro de la tabla a "Todos los Meses" al cargar
    const filterSelect = document.getElementById('month-filter');
    if (filterSelect) {
        filterSelect.value = ""; // Valor de "Todos los Meses"
        filterSelect.setAttribute('data-current-value', ""); // Resetear el estado guardado
    }
    // ** FIN SOLUCIÓN CRÍTICA **

    updateUI();
});