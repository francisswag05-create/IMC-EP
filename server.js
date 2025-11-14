// server.js (Versión Final con Relleno de Registros Faltantes)

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
            CREATE TABLE IF NOT EXISTS records (
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

        const insertUserSql = `INSERT INTO users (cip, fullName, password, role, email) 
                               VALUES ($1, $2, $3, $4, $5) 
                               ON CONFLICT (cip) 
                               DO UPDATE SET fullName = EXCLUDED.fullName;`;
        
        const result = await client.query(insertUserSql, ¡Excelente! Ahora sí, con tu `server.js` también, puedo implementar la lógica de rellenado de "NO ASISTIÓ" para los reportes (Excel/Word), asegurando que se incluyan todos los meses faltantes.

Aquí está el código **FINAL** de tu `server.js`, con la lógica central de relleno y la actualización de la ruta de exportación.

### `server.js` (Versión Final con Relleno de Registros para Exportación)

```javascript
// server.js (Versión Final con Relleno de Registros para Exportación)

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
                role
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
    if (!dobString || !referenceDateString || dobString.length < 10 || referenceDateString.length < 10) return 0;
    
    // Asumimos dobString es VARCHAR(50) NOT NULL,
                email VARCHAR(255) UNIQUE,
                resetPasswordToken VARCHAR(255),
                resetPasswordExpires BIGINT 
            );
        `);
        
        // COMANDO 2: Crear la tabla RECORDS (Completa con todos los campos)
        await client.query(`
            CREATE TABLE IF NOT EXISTS records (
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


// FUNCIÓN: Cálculo de edad a partir de la fecha de nacimiento (DOB)
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
// *** FUNCIÓN CRÍTICA: RELLENAR MESES FALTANTES (BACKEND) ***
// ***************************************************************
function generateMissingRecords(records, endMonthYear) {
    if (records.length === 0) return [];
    
    // Convertir registros a un mapa de meses ya registrados
    const recordsByMonth = records.reduce((acc, r YYYY-MM-DD y referenceDateString es DD/MM/YYYY
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
        acc[r.fecha.substring(3)] = r;
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
    
    let allRecordsMap = { ...recordsByMonth };
    let checkDate = new Date(startYear, startMonth - 1, 1);
    let endDate = new Date(endYear, endMonth - 1, 1);
    
    // 3. Iterar y rellenar
    while (checkDate.getTime() <= endDate.getTime()) {
        const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
        const checkYear = checkDate.getFullYear();
        const checkMonthYear = `${checkMonth}/${checkYear}`;
        const checkDateFormatted = `01/${checkMonth}/${checkYear}`;

        if (!recordedMonths.has(checkMonthYear)) {
            // Asumimos que dob está en formato YYYY-MM-DD
            const ageAtMissingDate = calculateAgeFromDOB(firstRecord.dob, checkDateFormatted); 
            
            const missingRecord = {
                ...firstRecord,
                id: null, // Evitar conflicto de ID al momento del mapeo/exportación
                fecha: checkDateFormatted, 
                peso: 0, altura: 0.01, imc: 0, pab: 0, 
                pa: 'N) => {
        acc[r.fecha.substring(3)] = r; // Clave: MM/YYYY
        return acc;
    }, {});
    
    // Ordenar los registros existentes por fecha más antigua primero (ASC)
    const sortedRecords = [...records].sort((a, b) => {
        const [dA, mA, yA] = a.fecha.split('/').map(Number);
        const [dB, mB, yB] = b.fecha.split('/').map(Number);
        return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB/A', paClasificacion: 'N/A', riesgoAEnf: 'N/A',
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


// --- 4).getTime();
    });

    const firstRecord = sortedRecords[0];
    if (!firstRecord) return [];

    let [startMonth, startYear] = firstRecord.fecha.substring(3).split('/').map(Number);
    let [endMonth, endYear] = endMonthYear.split('/').map(Number);
    
    let allRecordsMap = { ...recordsByMonth };
    let checkDate = new Date(startYear, startMonth - 1, 1);
    let endDate = new Date(endYear, endMonth - 1, 1);
    
    // Rellenar desde el primer registro hasta la fecha de corte (endMonthYear)
    while (checkDate.getTime() <= endDate.getTime()) {
        const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
        const checkYear = checkDate.getFullYear();
        const checkMonthYear = `${checkMonth}/${checkYear}`;
        const checkDateFormatted = `01/${checkMonth}/${checkYear}`;

        if (!allRecordsMap[checkMonthYear]) { // Si no existe en el mapa
            const ageAtMissingDate = calculateAgeFromDOB(firstRecord.dob, checkDateFormatted); 
            
            const missingRecord = {
                ...firstRecord,
                id: null, // No tiene. RUTAS DE LA API PARA REGISTROS ---

// [GET] /api/stats (Postgres): Consulta con filtros para la tabla de registros
app.get('/api/stats', (req, res) => {
    const { cip, gguu, unidad, sexo, monthYear, apellidoNombre, edad, aptitud } = req.query; 

    let sql = "SELECT * FROM records WHERE 1=1"; 
    let params = [];

    if (cip) { sql += ` AND cip = $${params.length + 1}`; params.push(cip); }
    if (gguu) { sql += ` AND gguu = $${params.length + 1}`; params.push(gguu); }
    if (unidad) { sql += ` AND unidad = $${params.length + 1}`; params.push(unidad); }
    if (sexo) { sql += ` AND sexo = $${params.length + 1}`; params.push(sexo); }
    
    if (apellidoNombre) {
        const searchPattern = `%${apellidoNombre}%`;
        sql += ` AND (apellido ILIKE $${params.length + 1} OR nombre ILIKE $${params.length + 2})`; 
        params.push(searchPattern, searchPattern);
    }
    
    if (edad) { 
        sql += ` AND edad = $${params.length + 1}`; 
        params.push(parseInt(edad)); 
    }
    
    if (aptitud && aptitud !== 'Todas las Aptitudes') { 
        sql += ` AND (paClasificacion = $${params.length + 1} OR riesgoAEnf = $${params.length + 2})`; 
        params.push(aptitud, aptitud); 
    }
    
    if (monthYear && monthYear !== 'Todos los Meses') {
        const pattern = `%/${monthYear}`; 
        sql += ` AND fecha LIKE $${params.length + 1}`; 
        params.push(pattern);
    }

    sql += " ORDER BY id DESC"; // Muestra los más recientes primero

    pool.query(sql, params)
        .then(result => {
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

                while (checkDate.getTime() < target ID de DB
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
    
    // Devolver un array con todos los registros, ordenado descendentemente por fecha (Más reciente al inicio para la tabla/exportación)
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
    if (apellidoNombre)Date.getTime()) {
                    const missingMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
                    const missingYear = checkDate.getFullYear();
                    const missingDate = `01/${missingMonth}/${missingYear}`;
                    
                    const ageAtMissingDate = calculateAgeFromDOB(lastRecord.dob, missingDate); 
                    
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
                    const insertSql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, {
        // Uso de ILIKE para búsqueda insensible a mayúsculas/minúsculas en Postgres
        const searchPattern = `%${apellidoNombre}%`;
        sql += ` AND (apellido ILIKE $${params.length + 1} OR nombre ILIKE $${params.length + 2})`; 
        params.push(searchPattern, searchPattern);
    }
    
    // Filtro por Edad
    if (edad) { 
        // Se asume que edad puede ser un rango o un valor exacto (aquí se trata como exacto o mínimo)
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

 $17, $18, $19, $20)`;
                    
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
    const sql = "SELECT * FROM records ORDER BY id DESC";    sql += " ORDER BY id DESC"; // Muestra los más recientes primero

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
    // ... (Tu código de relleno de registros es correcto y queda igual, no necesita cambios) ...
    const { cip } = req.params;
    const { targetMonthYear } = req.query; 

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();
    const targetMonthYearValue = targetMonthYear || `${currentMonth}/${currentYear}`; // MM/YYYY
    
    const [targetMonth, targetYear] = targetMonthYearValue.split('/').map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, 1); 

    // --- 1. BUSCAR EL REGIST
    pool.query(sql)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/records (Postgres): GUARDAR REGISTRO
app.post('/api/records', (req, res) => {
    // Desestructurar todos los campos del body
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob } = req.body;
    
    // SQL con todos los 20 campos para inserción
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`;
    
    // El array de valores tiene que coincidir exactamente en orden
    const values = [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob];
    
    pool.query(sql, values)
        .then(result => res.status(201).json({ message: "Registro guardado exitosamente", id: result.rows[0].id }))
        .catch(err => {
             // LOG DE DEBUG CRÍTICO: Muestra el error exacto de Postgres
             console.error("ERROR DE POSTGRES EN /api/records:", err.message, "Detalles:", err.detail);
             // Si es un error de claveRO MÁS RECIENTE (Postgres) ---
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
                    const missingMonth = String(checkDate.getMonth() + 1). foránea o dato no permitido, ayuda a debuggear
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
    constpadStart(2, '0');
                    const missingYear = checkDate.getFullYear();
                    const missingDate = `01/${missingMonth}/${missingYear}`;
                    
                    const ageAtMissingDate = calculateAgeFromDOB(lastRecord.dob, missingDate); 
                    
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
                            missingRecord.nombre, missing { id } = req.params;
    const sql = "DELETE FROM records WHERE id = $1";
    pool.query(sql, [id])
        .then(result => {
            if (result.rowCount === 0) return res.status(404).json({ message: "Registro no encontrado." });
            res.json({ message: `Registro con ID ${id} eliminado.` });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});


// [POST] /api/export-excel (Postgres)
app.post('/api/export-excel', async (req, res) => {
    try {
        const { records, reportMonth } = req.body; 
        
        // ****************************************************
        // *** MODIFICACIÓN CRÍTICA: RELLENO DE REGISTROS PARA EXPORTACIÓN ***
        // ****************************************************
        let finalRecordsToExport = records;
        
        // Solo aplicar la lógica de relleno si tenemos un paciente individual
        if (records.length > 0 && records.every(r => r.cip === records[0].cip)) {
            const targetCip = records[0].cip;
            
            // 1. OBTENER TODOS LOS REGISTROS HISTÓRICOS DEL PACIENTE DESDE LA BASE DE DATOS
            const allPatientRecords = await pool.query("SELECT * FROM records WHERE cip = $1 ORDER BY id DESC", [targetCip]);

            // 2. DetermRecord.edad, missingRecord.peso, missingRecord.altura, 
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
inar la fecha de corte (Mes más reciente registrado en el filtro o mes actual)
            const now = new Date();
            const endMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            
            // 3. RELLENAR LOS MESES FALTANTES
            // La función generateMissingRecords devolverá el historial completo, rellenando vacíos
            finalRecordsToExport = generateMissingRecords(allPatientRecords.rows, endMonthYear);
        }
        // ****************************************************
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; 
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL            if (!row) return res.status(404).json({ message: "Paciente no encontrado." });
            
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
    
    // SQL con todos_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        const HEADERS = [
            "N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", 
            "SEXO", "EDAD", "PESO", "TALLA", "PA", "CLASIFICACION PA", 
            "PAB", "RIESGO A ENF SEGUN PABD", "IMC", "CLASIFICACION DE IMC", "MOTIVO", "DIGITADOR"
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
            
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase(); 
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase(); 
            
            let digitadorDisplay = record.registradoPor || '';
            if (digitadorDisplay) {
                const adminFullName = digitadorDisplay.replace(/\s*\([^)]*\)/g, '').trim(); 
                const adminNameParts = adminFullName.split(' ').filter(p => p.length > 0);
                
                 los 20 campos para inserción
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`;
    
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

// [PUT] /api/records/:id (Postgres)if (digitadorDisplay.includes('SUPERADMIN')) {
                    const match = digitadorDisplay.match(/([^\s]+)\s+\(([^)]+)\)/);
                    digitadorDisplay = match ? `${match[1]} (${match[2]})` : 'SUPERADMIN';
                } else {
                    if (adminNameParts.length >= 2) {
                        digitadorDisplay = `${adminNameParts[0]} ${adminNameParts[1]}`.trim();
                    } else {
                        digitadorDisplay = adminNameParts.join(' ').trim() || record.cip; 
                    }
                }
            }
            
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
                record.motivo || 'N/A', 
                digitadorDisplay 
            ];
            
            dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.fill = DATA_FILL_STANDARD; 
                cell.border = BORDER_THIN;
                cell.font = FONT_NORMAL;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
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
        worksheet.mergeCells('A1:S2');
        worksheet.getCell('A1').value = 'CONSOLIDADO DEL IMC DE LA III DE AF 2025';
        worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.mergeCells('A4:S4');
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 14, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
        res.setHeader('Content-
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


// [POST] /api/export-excel (Postgres)
app.post('/api/export-excel', async (req, res) => {
    try {Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
    if (!newPassword) return res.status(40
        const { records, reportMonth } = req.body; 
        
        // ****************************************************
        // *** MODIFICACIÓN: LÓGICA DE RELLENO DE REGISTROS ***
        // ****************************************************
        if (records.length === 0) {
            return res.status(400).json({ message: "No hay registros filtrados para exportar." });
        }
        
        const targetCip = records[0].cip;
        
        // 1. OBTENER TODOS LOS REGISTROS HISTÓRICOS DEL PACIENTE DESDE LA BASE DE DATOS
        // Ordenar ASC por fecha para que generateMissingRecords funcione correctamente.
        const allPatientRecordsResult = await pool.query("SELECT * FROM records WHERE cip = $1 ORDER BY fecha", [targetCip]);
        const allPatientRecords = allPatientRecordsResult.rows;

        // 2. Determinar la fecha de corte (si no es el mes actual)
        const now = new Date();
        const endMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        
        // 3. RELLENAR LOS MESES FALTANTES
        // Se asume que generateMissingRecords devuelve los registros completos (con NO ASISTIÓ)
        // y ordenados DESCendentemente (más reciente al inicio).
        const finalRecordsToExport = generateMissingRecords(allPatientRecords, endMonthYear);
        
        // ****************************************************
        // A PARTIR DE AQUÍ, USAR 'finalRecordsToExport' EN LUGAR DE 'records'
        // ****************************************************

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const BORDER_THIN = { top: { style: 'thin' },0).json({ message: "Nueva contraseña requerida." });
    
    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(50 left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; 
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        const HEADERS = [
            "N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", 
            "SEXO", "EDAD", "PESO", "TALLA", "PA", "CLASIFICACION0).json({ message: "Error al encriptar la contraseña." });
        
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
    pool.query( PA", 
            "PAB", "RIESGO A ENF SEGUN PABD", "IMC", "CLASIFICACION DE IMC", "MOTIVO", "DIGITADOR"
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
        
        finalRecordsToExport.forEach((record, index) => {
            const rowNumber = 7 + index; 
            const dataRow = worksheet.getRow(rowNumber);
            
            // Asumo que tu objeto 'record' en el frontend tiene la propiedad 'clasificacionMINSA'
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase(); 
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase(); 
            
            let digitadorDisplay = record.registradoPor || '';
            if (digitadorDisplay) {
                const adminFullName = digitadorDisplay.replace(/\s*\([^)]*\)/g, '').trim(); 
                const adminNameParts = adminFullName.split(' ').filter(p => p.length > 0);
                
                if (digitadorDisplay.includes('SUPERADMIN')) {
                    const match = digitadorDisplay.match(/([^\s]+)\s+\sql)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/users (Postgres)
app.post('/api/users', (req, res) => {
    const { cip, fullName, password, email } = req.body;
    if (!cip || !fullName || !password) return res.status(400).json({ message: "CIP, Nombre y Contraseña requeridos." });
    
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error al encriptar." });
        
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
                if (result.rowCount === 0) {
                    return res.status(409).json({ message: `El CIP ya está registrado y no se pudo actualizar.` });
                }
                
                res.status(201).json({ message: "Usuario creado/actualizado correctamente.", cip: cip });
            })
            .catch(err => {
                if (err.code === '23505') { 
                    return res.status(409).json({ message: `El CIP o Email ya está registrado.` });
                }
                return res.status(500).json({ error: err.message });
            });
    });
});

// [DELETE] /api/users/:cip (Postgres)
app.delete('/api/users/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM users WHERE cip = $1";
    pool.query(sql, [cip])
        .then(result => {
            if (result.rowCount(([^)]+)\)/);
                    digitadorDisplay = match ? `${match[1]} (${match[2]})` : 'SUPERADMIN';
                } else {
                    if (adminNameParts.length >= 2 === 0) return res.status(404).json({ message: "Usuario no encontrado." });
            res.json({ message: `Usuario con CIP ${cip} eliminado.` }); 
        })
        .) {
                        digitadorDisplay = `${adminNameParts[0]} ${adminNameParts[1]}`.trim();
                    } else {
                        digitadorDisplay = adminNameParts.join(' ').trim() || record.cip; 
                    }
                }
            }
            
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
                record.motivo || 'N/A', 
                digitadorDisplay 
            ];
            
            dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.fill = DATA_FILL_STANDARD; 
                cell.border = BORDER_THIN;
                cell.font = FONT_NORMAL;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
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
        worksheet.mergeCells('A1:S2');
        worksheet.getCell('A1').value = 'CONSOLIDADO DEL IMC DE LA IIIcatch(err => res.status(500).json({ error: err.message }));
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
                    try DE AF 2025';
        worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.mergeCells('A4:S4');
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 14, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
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
            if (!user) return res.status( {
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
                
                const updateSql = `UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = $2`;
                pool.query(updateSql, [hash, user.cip])
                    .then(() => res.json({ message: "¡Contraseña actualizada con éxito! Ahora puede iniciar sesión." }))
                    .catch(err => res.status(500).json({ message: "Error al actualizar la contraseña.", error: err.message }));
            });
        })
        .catch(err401).json({ message: "Credenciales incorrectas." });
            
            bcrypt.compare(password, user.password, (bcryptErr, result) => {
                if (bcryptErr) {
                    console.error("Error en bcrypt.compare (Login):", bcryptErr);
                    return res.status(500).json({ message: "Error del servidor." });
                }
                if (result) {
                     => res.status(500).json({ error: err.message }));
});


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});
res.json({ message: "Login exitoso", user: { cip: user.cip, fullName: user.fullName, role: user.role } });
                } else {
                    res.status(401).```