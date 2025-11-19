// server.js (Versión Definitiva con Solución a Prueba de Fallos para Excel)

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

// FUNCIÓN DE UTILIDAD: Relleno de Registros Faltantes
function generateMissingRecords(records, endMonthYear) {
    if (records.length === 0) return [];
    
    const recordsByMonth = records.reduce((acc, r) => {
        acc[r.fecha.substring(3)] = r; // Clave: MM/YYYY
        return acc;
    }, {});
    
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
    
    while (checkDate.getTime() <= endDate.getTime()) {
        const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
        const checkYear = checkDate.getFullYear();
        const checkMonthYear = `${checkMonth}/${checkYear}`;
        const checkDateFormatted = `01/${checkMonth}/${checkYear}`;

        if (!allRecordsMap[checkMonthYear]) {
            const ageAtMissingDate = calculateAgeFromDOB(firstRecord.dob, checkDateFormatted); 
            
            const missingRecord = {
                ...firstRecord,
                id: null,
                fecha: checkDateFormatted, 
                peso: 0, altura: 0.01, imc: 0, pab: 0, 
                pa: 'N/A', paClasificacion: 'N/A', riesgoAEnf: 'N/A',
                motivo: 'NO ASISTIÓ', 
                registradoPor: 'SISTEMA (NO ASISTIÓ)', 
                edad: ageAtMissingDate 
            };
            allRecordsMap[checkMonthYear] = missingRecord;
        }

        checkDate.setMonth(checkDate.getMonth() + 1);
    }
    
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
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`;
    
    // El array de valores tiene que coincidir exactamente en orden
    const values = [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob];
    
    pool.query(sql, values)
        .then(result => res.status(201).json({ message: "Registro guardado exitosamente", id: result.rows[0].id }))
        .catch(err => {
             // LOG DE DEBUG CRÍTICO: Muestra el error exacto de Postgres
             console.error("ERROR DE POSTGRES EN /api/records:", err.message, "Detalles:", err.detail);
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

    // Usaremos el día 01 del mes siguiente al de destino para establecer el límite
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
            const checkSql = "SELECT id FROM records WHERE cip = $1 AND fecha LIKE $2 LIMIT 1";
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
            // La función generateMissingRecords devuelve el historial completo, rellenando vacíos
            finalRecordsToExport = generateMissingRecords(allPatientRecords, endMonthYear);
        }
        // ****************************************************

        // ****************************************************
        // *** CONFIGURACIÓN DE COLORES Y FILTROS EN EXCEL ***
        // ****************************************************
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        const GGUU_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E699' } }; // Similar a 'Oro, Enfasis 4, Claro 40%'
        const MOTIVO_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Amarillo puro
        const MOTIVO_CONTENT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Rojo claro de advertencia
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const FONT_DARK = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } }; // Para texto negro en fondo claro
        const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; 
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        // ****************************************************
        // *** MODIFICACIÓN 1: DEFINICIÓN DE HEADERS Y ORDEN ***
        // ****************************************************
        const HEADERS = [
            "N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", 
            "SEXO", "EDAD", "PA", "CLASIFICACION PA", "PAB", "RIESGO A ENF SEGUN PABD",
            "PESO", "TALLA", "IMC", "CLASIFICACION DE IMC", "MOTIVO" // Última columna (18)
        ];
        
        const headerRow = worksheet.getRow(6);
        headerRow.values = HEADERS;
        
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            cell.fill = HEADER_FILL;
            cell.font = FONT_WHITE;
            cell.border = BORDER_THIN;
            // Desactivar wrapText para CLASIFICACION DE IMC (Columna 17 / Q)
            const isClasificacionIMC = colNumber === 17;
            cell.alignment = { 
                vertical: 'middle', 
                horizontal: 'center', 
                wrapText: isClasificacionIMC ? false : true 
            };
            worksheet.getColumn(colNumber).width = (colNumber === 5) ? 30 : (isClasificacionIMC ? 18 : 12); // Ajuste de ancho para que entre en una línea
        });
        
        finalRecordsToExport.forEach((record, index) => { // ITERAR SOBRE finalRecordsToExport
            const rowNumber = 7 + index; 
            const dataRow = worksheet.getRow(rowNumber);
            
            // Lógica de clasificación a utilizar (asumiendo que frontend ya la ejecutó en la lista de 'records')
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase(); 
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase(); 
            const motivoTexto = record.motivo || 'N/A';
            
            // ****************************************************
            // *** MODIFICACIÓN 2: ASIGNACIÓN DE VALORES EN NUEVO ORDEN ***
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
                record.pa, 
                paClasificacion, 
                record.pab, 
                riesgoAEnf, 
                record.peso, 
                record.altura, 
                record.imc, 
                clasificacionIMC, 
                motivoTexto // Columna MOTIVO
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
                
                // Columna MOTIVO (Columna 18) - Última columna
                if (colNumber === HEADERS.length) { 
                    if (motivoTexto.includes('NO ASISTIÓ')) {
                        cell.fill = MOTIVO_CONTENT_FILL;
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
                
                // Aplicar estilos de riesgo
                if (colNumber === 11 && paClasificacion.includes('HIPERTENSION')) {
                    cell.font = FONT_RED;
                }
                if (colNumber === 13 && riesgoAEnf.includes('MUY ALTO')) {
                    cell.font = FONT_RED;
                }
            });
        });
        
        // Encabezados del reporte
        const lastColumnLetter = worksheet.getColumn(HEADERS.length).letter; // Obtener la letra de la última columna ('R' - Columna 18)
        
        // 1. Encabezados de Título (AF AÑO AUTOMÁTICO)
        // Tamaño 26 y Subrayado
        worksheet.mergeCells(`A1:${lastColumnLetter}2`); 
        worksheet.getCell('A1').value = `CONSOLIDADO DEL IMC DE LA III DE AF ${new Date().getFullYear()}`; 
        worksheet.getCell('A1').font = { name: 'Calibri', size: 26, bold: true, underline: 'single' }; 
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Título de Reporte Mensual (Tamaño 22)
        worksheet.mergeCells(`A4:${lastColumnLetter}4`); 
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 22, bold: true }; 
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
        // 2. Colorear y Ocultar la columna MOTIVO (Columna 18 / R)
        const motivoHeaderCell = worksheet.getCell(`${lastColumnLetter}6`); 
        motivoHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Amarillo puro
        motivoHeaderCell.font = FONT_DARK;
        
        // Ocultar la columna MOTIVO (Columna 18)
        worksheet.getColumn(HEADERS.length).hidden = true; 

        // 3. Agregar Cuadro de Texto Fijo (Encima de la Clasificación IMC - Columna 17)
        // Fusionamos celdas P1 a R4 (Columnas 16, 17, 18)
        worksheet.mergeCells('P1:R4'); 
        const infoBoxCell = worksheet.getCell('P1');
        infoBoxCell.value = 'III DE\nCIA CMDO Nº113\nIPRESS\nAREQUIPA';
        infoBoxCell.font = { name: 'Calibri', size: 11, bold: true };
        infoBoxCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        
        // 4. Agregar Filtro de Excel
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
                
                const updateSql = `UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = $2`;
                pool.query(updateSql, [hash, user.cip])
                    .then(() => res.json({ message: "¡Contraseña actualizada con éxito! Ahora puede iniciar sesión." }))
                    .catch(err => res.status(500).json({ message: "Error al actualizar la contraseña.", error: err.message }));
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});