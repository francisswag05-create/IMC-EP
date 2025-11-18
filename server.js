// server.js (Versión Final con Gestión Masiva de Inasistencia)

// --- 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL ---
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors'); 
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const ExcelJS = require('exceljs'); 

const app = express();
const PORT = process.env.PORT || 3000; 

// --- 2. MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 
// Servir la carpeta raíz como estática
app.use(express.static(path.join(__dirname, '/'))); 

// --- 3. CONEXIÓN A LA BASE DE DATOS POSTGRESQL (Railway) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// Función auxiliar para las consultas
function dbQueryPromise(sql, params = []) {
    if (!process.env.DATABASE_URL) {
        console.error("La variable DATABASE_URL de Railway no está configurada.");
        return Promise.reject(new Error("La variable DATABASE_URL no está configurada."));
    }
    return pool.query(sql, params)
        .then(res => res.rows)
        .catch(err => {
            console.error("Error en consulta DB:", err.message);
            throw err;
        });
}

// Función para inicializar la base de datos (Postgres)
async function initializeDatabase() {
    console.log("Intentando conectar a la base de datos PostgreSQL de Railway...");
    const client = await pool.connect();
    try {
        
        // COMANDO 1: Crear la tabla USERS
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                cip VARCHAR(50) PRIMARY KEY,
                fullName VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                email VARCHAR(255) UNIQUE,
                resetPasswordToken VARCHAR(255),
                resetPasswordExpires BIGINT 
            );
        `);
        
        // COMANDO 2: Crear la tabla RECORDS (Completa con todos los campos)
        await client.query(`
¡Absolutamente! Entendido. Solo hay que ajustar esa cadena de texto en la clasificación de IMC en tu `sistema-imc.js`.

Aquí tienes el código **FINAL y COMPLETO** de tu `sistema-imc.js` con el ajuste de **"SOBREPESO"** aplicado:

```javascript
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
    if (type === 'error' || type === 'alert') bgColor = 'bg-red-600            CREATE TABLE IF NOT EXISTS records (
                id SERIAL PRIMARY KEY, 
                gguu VARCHAR(50), 
                unidad VARCHAR(100), 
                dni VARCHAR(50), 
                pa VARCHAR(50), 
                pab REAL, 
                paClasificacion VARCHAR(50), 
                riesgoAEnf VARCHAR(50), 
                sexo VARCHAR(50), 
                cip VARCHAR(50) NOT NULL, 
                grado VARCHAR(50), 
                apellido VARCHAR(100),
                nombre VARCHAR(100), 
                edad INTEGER, 
                peso REAL, 
                altura REAL, 
                imc REAL, 
                fecha VARCHAR(50),
                registradoPor VARCHAR(255),
                motivo VARCHAR(50),
                dob VARCHAR(50) -- Fecha de Nacimiento
            );
        `);
        
        console.log("✅ Tablas de base de datos verificadas/creadas.");
        
        // *** CÓDIGO TEMPORAL: INSERCIÓN DE USUARIO SUPERADMIN POR DEFECTO ***
        const defaultPassword = 'superadmin'; 
        const hash = await bcrypt.hash(defaultPassword, 10);

        // NOTA: Usamos ON CONFLICT DO UPDATE en este caso para asegurar que si se reinicia, 
        // el nombre de SUPERADMIN no se pierda si lo borraron y lo vuelven a intentar crear
        const insertUserSql = `INSERT INTO users (cip, fullName, password, role, email) 
                               VALUES ($1, $2, $3, $4, $5) 
                               ON CONFLICT (cip) 
                               DO UPDATE SET fullName = EXCLUDED.fullName;`;
        
        const result = await client.query(insertUserSql, 
            ['ADMIN001', 'Super Administrador SIMCEP', hash, 'superadmin', 'admin@simcep.com']
        );
        
        if (result.rowCount > 0) {
            console.log("✅ Usuario Super Admin Inicial verificado/creado (CIP: ADMIN001 | CLAVE: superadmin)");
        }
        // *** FIN DEL CÓDIGO TEMPORAL ***
        
    } catch (err) {
        console.error("Error FATAL al inicializar la base de datos:", err.message);
        throw err; 
    } finally {
        client.release();
    }
}

// Ejecutar la inicialización
initializeDatabase();


// FUNCIÓN DE UTILIDAD: Cálculo de edad a partir de la fecha de nacimiento (DOB)
function calculateAgeFromDOB(dobString, referenceDateString) {
    if (!dobString || !referenceDateString || dobString.length < 10) return 0;
    
    // Asumimos dobString es YYYY-MM-DD y referenceDateString es DD/MM/YYYY
    const [dobYear, dobMonth, dobDay] = dobString.split('-').map(Number);
    const [refDay, refMonth, refYear] = referenceDateString.split('/').map(Number);
    
    let age = refYear - dobYear;
    
    // Ajuste por el mes y día
    if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
        age--;
    }
    return age;
}

// ***************************************************************
// *** FUNCIÓN CLAVE: RELLENAR MESES FALTANTES EN EL BACKEND ***
// ***************************************************************
function generateMissingRecords(records, endMonthYear) {
    if (records.length === 0) return [];
    
    // 1. Mapeo inicial
    const recordedMonths = new Set(records.map(r => r.fecha.substring(3))); // MM/YYYY
    const recordsByMonth = records.reduce((acc, r) => {
        acc[r.fecha.substring(3)] = r; // Clave: MM/YYYY
        return acc;
    }, {});
    
    // 2. Ordenar por fecha real para encontrar el primer registro (ASC)
    const sortedRecords = [...records].sort((a, b) => {
        const [dA, mA, yA] = a.fecha.split('/').map(Number);
        const [dB, mB, yB] = b.fecha.split('/').map(Number);
        return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    });

    const firstRecord = sortedRecords[0];
    if (!firstRecord) return [];

    let [startMonth, startYear] = firstRecord.fecha.substring(3).split('/').map(Number);
    let [endMonth, endYear] = endMonthYear.split('/').map(Number);
    
    let all';
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
        document.getElementById('add-user-form').reset();RecordsMap = { ...recordsByMonth };
    let checkDate = new Date(startYear, startMonth - 1, 1);
    let endDate = new Date(endYear, endMonth - 1, 1);
    
    // 3. Iterar y rellenar
    while (checkDate.getTime() <= endDate.getTime()) {
        const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
        const checkYear = checkDate.getFullYear();
        const checkMonthYear = `${checkMonth}/${checkYear}`;
        const checkDateFormatted = `01/${checkMonth}/${checkYear}`;

        if (!allRecordsMap[checkMonthYear]) { // Si no existe en el mapa
            const ageAtMissingDate = calculateAgeFromDOB(firstRecord.dob, checkDateFormatted); 
            
            const missingRecord = {
                ...firstRecord,
                id: null, // No tiene ID de DB
                fecha: checkDateFormatted, 
                peso: 0, altura: 0.01, imc: 0, pab: 0, 
                pa: 'N/A', paClasificacion: 'N/A', riesgoAEnf: 'N/A',
                motivo: 'NO ASISTIÓ', 
                registradoPor: 'SISTEMA (NO ASISTIÓ)', 
                edad: ageAtMissingDate 
            };
            allRecordsMap[checkMonthYear] = missingRecord;
        }

        // Avanzar al siguiente mes
        checkDate.setMonth(checkDate.getMonth() + 1);
    }
    
    // 4. Devolver un array con todos los registros, ordenado DESCENDENTE por fecha
    return Object.values(allRecordsMap).sort((a, b) => {
        const [dA, mA, yA] = a.fecha.split('/').map(Number);
        const [dB, mB, yB] = b.fecha.split('/').map(Number);
        return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
    });
}


// --- 4. RUTAS DE LA API PARA REGISTROS ---

// [GET] /api/stats (Postgres): Consulta con filtros para la tabla de registros
app.get('/api/stats', (req, res) => {
    const { cip, gguu, unidad, sexo, monthYear, apellidoNombre, edad, aptitud } = req.query; 

    // Ajuste: Ordenar por ID descendente para mostrar los más recientes primero
    let sql = "SELECT * FROM records WHERE 1=1"; 
    let params = [];

    // Nota: La sintaxis de los parámetros se ajusta a Postgres ($1, $2, etc.)
    if (cip) { sql += ` AND cip = $${params.length + 1}`; params.push(cip); }
    if (gguu) { sql += ` AND gguu = $${params.length + 1}`; params.push(gguu); }
    if (unidad) { sql += ` AND unidad = $${params.length + 1}`; params.push(unidad); }
    if (sexo) { sql += ` AND sexo = $${params.length + 1}`; params.push(sexo); }
    
    // Filtro por Apellido/Nombre (busca en ambas columnas)
    if (apellidoNombre) {
        // Uso de ILIKE para búsqueda insensible a mayúsculas/minúsculas en Postgres
        const searchPattern = `%${apellidoNombre}%`;
        sql += ` AND (apellido ILIKE $${params.length + 1} OR nombre ILIKE $${params.length + 2})`; 
        params.push(searchPattern, searchPattern);
    }
    
    // Filtro por Edad
    if (edad) { 
        // Se asume que edad puede ser un rango o un valor exacto (aquí
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
                Monitoreo Activo: <span class="text-color-accent-lime">${currentAdminFullName se trata como exacto o mínimo)
        sql += ` AND edad = $${params.length + 1}`; 
        params.push(parseInt(edad)); 
    }
    
    // Filtro por Aptitud (asumimos que busca en paClasificacion o riesgoAEnf)
    if (aptitud && aptitud !== 'Todas las Aptitudes') { 
        sql += ` AND (paClasificacion = $${params.length + 1} OR riesgoAEnf = $${params.length + 2})`; 
        params.push(aptitud, aptitud); 
    }
    
    // Filtro por Mes/Año (asume formato MM/YYYY)
    if (monthYear && monthYear !== 'Todos los Meses') {
        const pattern = `%/${monthYear}`; 
        sql += ` AND fecha LIKE $${params.length + 1}`; 
        params.push(pattern);
    }

    sql += " ORDER BY id DESC"; // Muestra los más recientes primero

    pool.query(sql, params)
        .then(result => {
            // No devolver 404 si la lista está vacía, solo devolver un array vacío.
            res.json(result.rows);
        })
        .catch(err => {
            console.error("Error en GET /api/stats:", err.message);
            res.status(500).json({ error: "Error interno al obtener los registros." });
        });
});


// [GET] /api/records/check-monthly/:cip (Postgres) - Lógica de relleno de registros
app.get('/api/records/check-monthly/:cip', (req, res) => {
    const { cip } = req.params;
    const { targetMonthYear } = req.query; 

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();
    const targetMonthYearValue = targetMonthYear || `${currentMonth}/${currentYear}`; // MM/YYYY
    
    const [targetMonth, targetYear] = targetMonthYearValue.split('/').map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, 1); 

    // --- 1. BUSCAR EL REGISTRO MÁS RECIENTE (Postgres) ---
    const selectSql = "SELECT * FROM records WHERE cip = $1 ORDER BY id DESC LIMIT 1";
    pool.query(selectSql, [cip])
        .then(async result => {
            const lastRecord = result.rows[0];
            let missingMonthsCount = 0;

            // --- 2. VERIFICAR SI HAY REGISTROS EN EL MES OBJETIVO ---
            // Asume que lastRecord.fecha es DD/MM/YYYY
            if (lastRecord && lastRecord.fecha && lastRecord.fecha.includes(targetMonthYearValue)) {
                return res.json({ alreadyRecorded: true, message: `El CIP ${cip} ya tiene un registro para el mes de ${targetMonthYearValue}.` });
            }
            
            // --- 3. RELLENO DE REGISTROS FALTANTES ---
            if (lastRecord) {
                // Obtiene el mes y año del último registro
                const lastDateParts = lastRecord.fecha.split('/');
                let lastMonth = parseInt(lastDateParts[1]); // 1-12
                let lastYear = parseInt(lastDateParts[2]);

                // Empezar a chequear desde el mes siguiente al último registro
                let checkDate = new Date(lastYear, lastMonth, 1); 

                while (checkDate.getTime() < targetDate.getTime()) {
                    const missingMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
                    const missingYear = checkDate.getFullYear();
                    const missingDate = `01/${missingMonth}/${missingYear}`;
                    
                    const ageAtMissingDate}</span>`;
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

// Función que aplica la lógica de colores de la caja de resultados (Del pulido anterior = calculateAgeFromDOB(lastRecord.dob, missingDate); 
                    
                    const missingRecord = {
                        ...lastRecord,
                        fecha: missingDate, 
                        peso: 0, altura: 0.01, imc: 0, pab: 0, 
                        pa: 'N/A', paClasificacion: 'N/A', riesgoAEnf: 'N/A',
                        motivo: 'NO ASISTIÓ', 
                        registradoPor: 'SISTEMA (NO ASISTIÓ)', 
                        edad: ageAtMissingDate 
                    };
                    
                    // LÍNEA DE INSERCIÓN (Postgres usa $1, $2, etc.)
                    const insertSql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`;
                    
                    try {
                        await pool.query(insertSql, [
                            missingRecord.gguu, missingRecord.unidad, missingRecord.dni, missingRecord.pa, 
                            missingRecord.pab, missingRecord.paClasificacion, missingRecord.riesgoAEnf, 
                            missingRecord.sexo, missingRecord.cip, missingRecord.grado, missingRecord.apellido, 
                            missingRecord.nombre, missingRecord.edad, missingRecord.peso, missingRecord.altura, 
                            missingRecord.imc, missingRecord.fecha, missingRecord.registradoPor, missingRecord.motivo, missingRecord.dob
                        ]);
                        missingMonthsCount++;
                    } catch (error) {
                        console.error("Error al insertar registro faltante:", error);
                        break;
                    }
                    
                    // Avanzar al siguiente mes
                    checkDate.setMonth(checkDate.getMonth() + 1);
                }
            }
            
            // --- 4. RESPUESTA FINAL (Permitir el Guardado) ---
            return res.json({ 
                alreadyRecorded: false, 
                missingRecordsCreated: missingMonthsCount > 0, 
                count: missingMonthsCount 
            });
        })
        .catch(err => res.status(500).json({ error: "Error interno al buscar registros: " + err.message }));
});


// [GET] /api/patient/:dni (Postgres)
app.get('/api/patient/:dni', (req, res) => {
    // Busca el registro más reciente del paciente por DNI o CIP
    const { dni } = req.params;
    const sql = "SELECT * FROM records WHERE dni = $1 OR cip = $2 ORDER BY id DESC LIMIT 1";
    pool.query(sql, [dni, dni])
        .then(result => {
            const row = result.rows[0];
            if (!row) return res.status(404).json({ message: "Paciente no encontrado." });
            
            // Devolvemos todos los campos necesarios para autocompletar
            res.json({
                gguu: row.gguu,
                unidad: row.unidad,
                cip: row.cip,
                sexo: row.sexo,
                apellido: row.apellido,
                nombre: row.nombre,
                edad: row.edad, 
                fechaNacimiento: row.dob, // Mapeado de dob a fechaNacimiento para el frontend
                grado: row.grado          
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// [GET] /api/records (Postgres): Obtiene TODOS los records (Solo para debug/admin)
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY id DESC";
    pool.query(sql)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/records (Postgres): GUARDAR REGISTRO
app.post('/api/records', (req, res) => {
    // Desestructurar todos los campos del body
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob } = req.body;
    
    // SQL con todos los 20 campos para inserción
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf)
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
        if (pabFloat < 102) return 'RIES, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`;
    
    // El array de valores tiene que coincidir exactamente en orden
    const values = [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob];
    
    pool.query(sql, values)
        .then(result => res.status(201).json({ message: "Registro guardado exitosamente", id: result.rows[0].id }))
        .catch(err => {
             // LOG DE DEBUG CRÍTICO: Muestra el error exacto de Postgres
             console.error("ERROR DE POSTGRES EN /api/records:", err.message, "Detalles:", err.detail);
             // Si es un error de clave foránea o dato no permitido, ayuda a debuggear
             res.status(500).json({ error: "Error al guardar el registro: " + err.message });
        });
});

// [PUT] /api/records/:id (Postgres)
app.put('/api/records/:id', (req, res) => {
    const { id } = req.params;
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo, dob, fecha } = req.body;
    
    // SQL con todos los 19 campos para actualización
    const sql = `UPDATE records SET 
                    gguu = $1, unidad = $2, dni = $3, pa = $4, pab = $5, paClasificacion = $6, riesgoAEnf = $7,
                    sexo = $8, cip = $9, grado = $10, apellido = $11, nombre = $12, 
                    edad = $13, peso = $14, altura = $15, imc = $16, motivo = $17, dob = $18, fecha = $19
                 WHERE id = $20`;
                 
    const values = [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo, dob, fecha, id];
    
    pool.query(sql, values)
        .then(result => {
            if (result.rowCount === 0) return res.status(404).json({ message: "Registro no encontrado." });
            res.json({ message: "Registro actualizado." });
        })
        .catch(err => res.status(500).json({ message: "Error al actualizar.", error: err.message }));
});

// [DELETE] /api/records/:id (Postgres)
app.delete('/api/records/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM records WHERE id = $1";
    pool.query(sql, [id])
        .then(result => {
            if (result.rowCount === 0) return res.status(404).json({ message: "Registro no encontrado." });
            res.json({ message: `Registro con ID ${id} eliminado.` });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// ***************************************************************
// *** RUTA AÑADIDA: GESTIÓN MASIVA DE INASISTENCIA ***
// ***************************************************************
// [POST] /api/records/mass-no-show
app.post('/api/records/mass-no-show', async (req, res) => {
    const { targetMonthYear } = req.body; // Formato esperado: MM/YYYY (Ej: 10/2025)

    if (!targetMonthYear || targetMonthYear.length !== 7 || targetMonthYear.indexOf('/') !== 2) {
        return res.status(400).json({ error: "Mes de registro inválido. Use formato MM/YYYY." });
    }

    // Usaremos el día 01 del mesGO ALTO';
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
        detalle = `Clasificación MINSA: ${clasificacionMINSA}. Riesgo Abdominal: ${riesgoAEnf}. PA: ${paClasificacion}. Aptitud siguiente al de destino para establecer el límite
    const [targetMonth, targetYear] = targetMonthYear.split('/').map(Number);
    const dateLimit = new Date(targetYear, targetMonth, 1); // 1er día del mes SGT
    
    // Seguridad: No permitir registro masivo en un mes futuro o el mes actual
    if (dateLimit.getTime() > new Date().getTime() + 86400000) { // Añadimos 1 día para tolerancia
        return res.status(403).json({ error: "No se permite el registro masivo en meses futuros o el mes actual." });
    }

    try {
        // 1. Obtener la información base (el registro más reciente de CADA CIP)
        // Usamos una subconsulta para obtener el último registro por CIP
        const latestRecordsSql = `
            SELECT DISTINCT ON (cip) * 
            FROM records 
            ORDER BY cip, id DESC;
        `;
        const allLatestRecords = await pool.query(latestRecordsSql);
        const allPersonnel = allLatestRecords.rows;

        if (allPersonnel.length === 0) {
            return res.status(404).json({ message: "No hay personal registrado en la base de datos para monitorear." });
        }

        let insertedCount = 0;
        const insertSql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`;

        for (const record of allPersonnel) {
            // Verificar si YA tiene un registro en el mes objetivo
            const checkSql = "SELECT id FROM records WHERE cip = $1 AND fecha confirmada.`;
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
            <td class="px-4 py-3 whitespace-nowrap text-sm">${data.peso || 'N LIKE $2 LIMIT 1";
            const alreadyExists = await pool.query(checkSql, [record.cip, `%/${targetMonthYear}`]);

            if (alreadyExists.rowCount === 0) {
                // Si NO tiene registro en el mes objetivo, insertamos NO ASISTIÓ
                const checkDateFormatted = `01/${targetMonthYear}`;
                const ageAtMissingDate = calculateAgeFromDOB(record.dob, checkDateFormatted); 
                
                const values = [
                    record.gguu, record.unidad, record.dni, 'N/A', 0, 'N/A', 'N/A', // PA, PAB y Clasif. por defecto
                    record.sexo, record.cip, record.grado, record.apellido, record.nombre, 
                    ageAtMissingDate, 0, 0.01, 0, // Peso, Altura, IMC por defecto
                    checkDateFormatted, 'SISTEMA (INASISTENCIA MASIVA)', 'NO ASISTIÓ', record.dob
                ];
                
                await pool.query(insertSql, values);
                insertedCount++;
            }
        }

        return res.json({ 
            message: `Proceso masivo completado. Se insertaron ${insertedCount} registros de 'NO ASISTIÓ' para el mes ${targetMonthYear}.`,
            insertedCount
        });

    } catch (error) {
        console.error("Error en el proceso masivo de inasistencia:", error);
        return res.status(500).json({ error: "Error interno al ejecutar el proceso masivo: " + error.message });
    }
});



// [POST] /api/export-excel (Postgres)
app.post('/api/export-excel', async (req, res) => {
    try {
        const { records, reportMonth } = req.body; 
        
        // ****************************************************
        // *** MODIFICACIÓN: LÓGICA DE RELLENO DE REGISTROS PARA EXPORTACIÓN ***
        // ****************************************************
        let finalRecordsToExport = records;
        
        // Solo aplicar la lógica de relleno si tenemos al menos un paciente individual para la progresión
        if (records.length > 0 && records.every(r => r.cip === records[0].cip)) {
            const targetCip = records[0].cip;
            
            // 1. OBTENER TODOS LOS REGISTROS HISTÓRICOS DEL PACIENTE DESDE LA BASE DE DATOS
            const allPatientRecordsResult = await pool.query("SELECT * FROM records WHERE cip = $1 ORDER BY id DESC", [targetCip]);
            const allPatientRecords = allPatientRecordsResult.rows;

            // 2. Determinar la fecha de corte (Mes más reciente registrado en el filtro o mes actual)
            const now = new Date();
            const endMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            
            // 3. RELLENAR LOS MESES FALTANTES
            // La función generateMissingRecords devolverá el historial completo, rellenando vacíos
            finalRecordsToExport = generateMissingRecords(allPatientRecords, endMonthYear);
        }
        // ****************************************************

        // ****************************************************
        // *** CONFIGURACIÓN DE COLORES Y FILTROS EN EXCEL ***
        // ****************************************************
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        const GGUU_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E699' } }; // Similar a 'Oro, Enfasis 4, Claro 40%'
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const FONT_DARK = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } }; // Para texto negro en fondo claro
        const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; 
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        // ****************************************************
        // *** MODIFICACIÓN: ELIMINAR COLUMNA DIGITADOR ***
        // ****************************************************
        const HEADERS = [
            "N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", 
            "SEXO", "EDAD", "PESO", "TALLA", "PA", "CLASIFICACION PA", 
            "PAB", "RIESGO A ENF SEGUN PABD", "IMC", "CLASIFICACION DE IMC", "MOTIVO" // Digitador ELIMINADO
        ];
        
        const headerRow = worksheet.getRow(6);
        headerRow.values = HEADERS;
        
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            cell.fill = HEADER_FILL;
            cell.font = FONT_WHITE;
            cell.border = BORDER_THIN;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            worksheet.getColumn(colNumber).width = (colNumber === 5) ? 30 : 12; 
        });
        
        finalRecordsToExport.forEach((record, index) => { // ITERAR SOBRE finalRecordsToExport
            const rowNumber = 7 + index; 
            const dataRow = worksheet.getRow(rowNumber);
            
            // Asumo que tu objeto 'record' en el frontend tiene la propiedad 'clasificacionMINSA'
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase(); 
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase(); 
            
            // ****************************************************
            // *** MODIFICACIÓN: ASIGNACIÓN DE VALORES (SIN DIGITADOR) ***
            // ****************************************************
            dataRow.values = [
                index + 1, 
                record.gguu, 
                record.unidad, 
                record.grado, 
                `${(record.apellido || '').toUpperCase()}, ${record.nombre || ''}`, 
                record.dni, 
                record.cip, 
                record.sexo, 
                record.edad, 
                record.peso, 
                record.altura, 
                record.pa, 
                paClasificacion, 
                record.pab, 
                riesgoAEnf, 
                record.imc, 
                clasificacionIMC, 
                record.motivo || 'N/A' // Último valor: MOTIVO
            ];
            
            dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.fill = DATA_FILL_STANDARD; 
                cell.border = BORDER_THIN;
                cell.font = FONT_NORMAL;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                // Columna GGUU (Columna 2) con el color de relleno solicitado
                if (colNumber === 2) { 
                    cell.fill = GGUU_FILL;
                    cell.font = FONT_DARK;
                }
                
                if (colNumber === 17 && (resultado.includes('INAPTO') || clasificacionIMC.includes('OBESIDAD'))) {
                    cell.font = FONT_RED; 
                }
                
                if (colNumber === 13 && paClasificacion.includes('HIPERTENSION')) {
                    cell.font = FONT_RED;
                }
                if (colNumber === 15 && riesgoAEnf.includes('MUY ALTO')) {
                    cell.font = FONT_RED;
                }
            });
        });
        
        // Encabezados del reporte
        const lastColumnLetter = worksheet.getColumn(HEADERS.length).letter; // Obtener la letra de la última columna
        
        worksheet.mergeCells(`A1:${lastColumnLetter}2`); 
        worksheet.getCell('A1').value = 'CONSOLIDADO DEL IMC DE LA III DE AF 2025';
        worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.mergeCells(`A4:${lastColumnLetter}4`); 
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 14, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
        // ****************************************************
        // *** MODIFICACIÓN: AGREGAR FILTRO DE EXCEL ***
        // ****************************************************
        worksheet.autoFilter = {
            from: 'A6', // Inicia en el encabezado de la columna A (Fila 6)
            to: `${lastColumnLetter}6` // Termina en la última columna del encabezado (Fila 6)
        };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Reporte_SIMCEP_Mensual.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error al generar el archivo Excel:", error);
        res.status(500).json({ message: "Error interno al generar el reporte Excel.", error: error.message });
    }
});


// --- RUTAS DE API PARA USUARIOS Y LOGIN ---

// [POST] /api/login (Postgres)
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) return res.status(400).json({ message: "CIP y contraseña requeridos." });
    
    const sql = "SELECT * FROM users WHERE cip = $1";
    pool.query(sql, [cip])
        .then(result => {
            const user = result.rows[0];
            if (!user) return res.status(401).json({ message: "Credenciales incorrectas." });
            
            bcrypt.compare(password, user.password, (bcryptErr, result) => {
                if (bcryptErr) {
                    console.error("Error en bcrypt.compare (Login):", bcryptErr);
                    return res.status(500).json({ message: "Error del servidor." });
                }
                if (result) {
                    res.json({ message: "Login exitoso", user: { cip: user.cip, fullName: user.fullName, role: user.role } });
                } else {
                    res.status(401).json({ message: "Credenciales incorrectas." });
                }
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// [PUT] /api/users/password/:cip (Postgres)
app.put('/api/users/password/:cip', (req, res) => {
    const { cip } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Nueva contraseña requerida." });
    
    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error al encriptar la contraseña." });
        
        const sql = `UPDATE users SET password = $1 WHERE cip = $2`;
        pool.query(sql, [hash, cip])
            .then(result => {
                if (result.rowCount === 0) return res.status(404).json({ message: "Usuario no encontrado." });
                res.json({ message: "Contraseña actualizada." });
            })
            .catch(err => res.status(500).json({ message: "Error al actualizar la contraseña.", error: err.message }));
    });
});


// [GET] /api/users (Postgres)
app.get('/api/users', (req, res) => {
    const sql = "SELECT cip, fullName, role FROM users";
    pool.query(sql)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/users (Postgres)
app.post('/api/users', (req, res) => {
    const { cip, fullName, password, email } = req.body;
    if (!cip || !fullName || !password) return res.status(400).json({ message: "CIP, Nombre y Contraseña requeridos." });
    
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error al encriptar." });
        
        // *** CAMBIO CRÍTICO: Usar ON CONFLICT DO UPDATE SET ***
        // Esto permite actualizar el fullName y email si el CIP ya existe, en lugar de ignorar la solicitud.
        const sql = `INSERT INTO users (cip, fullName, password, role, email) 
                     VALUES ($1, $2, $3, $4, $5) 
                     ON CONFLICT (cip) 
                     DO UPDATE SET 
                        fullName = EXCLUDED.fullName, 
                        email = EXCLUDED.email
                     RETURNING cip`;
        
        const values = [cip, fullName, hash, 'admin', email || null];

        pool.query(sql, values)
            .then(result => {
                // Verificar si fue una inserción (rowCount = 1) o una actualización (rowCount = 1 y el CIP ya existía)
                if (result.rowCount === 0) {
                    // Esto solo debería pasar si la consulta falla de otra manera, ya que DO UPDATE asegura rowCount > 0
                    return res.status(409).json({ message: `El CIP ya está registrado y no se pudo actualizar.` });
                }
                
                // Si la consulta fue exitosa (insert o update), devolvemos 201/200
                res.status(201).json({ message: "Usuario creado/actualizado correctamente.", cip: cip });
            })
            .catch(err => {
                if (err.code === '23505') { // Código de error UNIQUE violation en Postgres (solo para el email, ya que el CIP es el conflicto principal)
                    return res.status(409).json({ message: `El CIP o Email ya está registrado.` });
                }
                return res.status(500).json({ error: err.message });
            });
    });
});
// ... (resto de las rutas: DELETE /api/users/:cip, /api/forgot-password, /api/reset-password) ...

// [DELETE] /api/users/:cip (Postgres)
app.delete('/api/users/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM users WHERE cip = $1";
    pool.query(sql, [cip])
        .then(result => {
            if (result.rowCount === 0) return res.status(404).json({ message: "Usuario no encontrado." });
            res.json({ message: `Usuario con CIP ${cip} eliminado.` }); 
        })
        .catch(err => res.status(500).json({ error: err.message }));
});


// --- RUTAS DE API PARA RECUPERACIÓN DE CONTRASEÑA ---

// [POST] /api/forgot-password (Postgres)
app.post('/api/forgot-password', (req, res) => {
    const { cip } = req.body;
    const selectSql = `SELECT * FROM users WHERE cip = $1`;
    
    pool.query(selectSql, [cip])
        .then(result => {
            const user = result.rows[0];
            if (!user || !user.email) {
                return res.json({ message: "Si existe una cuenta asociada a este CIP, se ha enviado un correo de recuperación." });
            }
            
            const token = crypto.randomBytes(20).toString('hex');
            const expires = Date.now() + 3600000; // 1 hora (Almacenado como BIGINT)
            const updateSql = `UPDATE users SET resetPasswordToken = $1, resetPasswordExpires = $2 WHERE cip = $3`;
            
            pool.query(updateSql, [token, expires, cip])
                .then(async () => {
                    const emailUser = process.env.EMAIL_USER;
                    const emailPass = process.env.EMAIL_PASS;

                    if (!emailUser || !emailPass) {
                        console.error("ERROR: Credenciales de Nodemailer no configuradas. Por favor, configure EMAIL_USER y EMAIL_PASS en Railway.");
                        return res.status(500).json({ message: "Servicio de correo no configurado." });
                    }
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: emailUser, pass: emailPass }
                    });
                    const mailOptions = {
                        from: `"SIMCEP Admin" <${emailUser}>`,
                        to: user.email,
                        subject: 'Restablecimiento de Contraseña - SIMCEP',
                        text: `Ha solicitado un restablecimiento de contraseña.\n\n` +
                              `Haga clic en el siguiente enlace para completar el proceso:\n\n` +
                              `[Tu URL de Railway]/reset.html?token=${token}\n\n` +
                              `Si no solicitó esto, ignore este correo.\n`
                    };
                    try {
                        await transporter.sendMail(mailOptions);
                        res.json({ message: "Si existe una cuenta asociada a este CIP, se ha enviado un correo de recuperación." });
                    } catch (error) {
                        console.error("Error al enviar el correo:", error);
                        res.status(500).json({ message: "Error al enviar el correo." });
                    }
                })
                .catch(err => res.status(500).json({ message: "Error al preparar la recuperación.", error: err.message }));
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/reset-password (Postgres)
app.post('/api/reset-password', (req, res) => {
    const { token, password } = req.body;
    // La comparación del token y la expiración se hace aquí
    const selectSql = `SELECT * FROM users WHERE resetPasswordToken = $1 AND resetPasswordExpires > $2`;
    
    pool.query(selectSql, [token, Date.now()])
        .then(result => {
            const user = result.rows[0];
            if (!user) {
                return res.status(400).json({ message: "El token de restablecimiento es inválido o ha expirado." });
            }
            
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) return res.status(500).json({ message: "Error al encriptar." });
                
                const update/A'} kg / ${data.altura || 'N/A'} m</td>
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
    const titleStyle = "text-align: center; color: #1e3a8a; font-size: 20px; margin-bottom: 5px; font-Sql = `UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = $2`;
                pool.query(updateSql, [hash, user.cip])
                    .thenweight: bold; font-family: 'Arial', sans-serif;";
    const subtitleStyle = "text-align: center; font-size: 14px; margin-bottom: 20px; font-family: '(() => res.json({ message: "¡Contraseña actualizada con éxito! Ahora puede iniciar sesión." }))
                    .catch(err => res.status(500).json({ message: "Error al actualizar la contraseña.",Arial', sans-serif;";
    const reportDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
     error: err.message }));
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});