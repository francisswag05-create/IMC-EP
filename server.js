// server.js (Versión Definitiva: Jerarquía Militar + Unidades Prioritarias + Soporte 50MB + Limpieza)

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

// --- 2. MIDDLEWARE (Soporte para Cargas Grandes 50MB) ---
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Servir la carpeta raíz como estática
app.use(express.static(path.join(__dirname, '/'))); 

// --- 3. CONEXIÓN A LA BASE DE DATOS POSTGRESQL (Railway) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// --- FUNCIONES AUXILIARES DE DB ---
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

// ******************************************************************
// *** LÓGICA DE ORDENAMIENTO MILITAR (CG III DE -> UNIDADES -> GRADOS) ***
// ******************************************************************
function sortRecordsByMilitaryHierarchy(records) {
    // 1. PRIORIDAD DE GRADOS (Menor número = Mayor Antigüedad)
    const rankPriority = {
        // Oficiales Generales
        "GRAL DIV": 1, "GRAL DE DIV": 1,
        "GRAL BRIG": 2, "GRAL DE BRIG": 2,
        // Oficiales Superiores
        "CRL": 3, "CORONEL": 3,
        "TTE CRL": 4, "TTE CORONEL": 4, 
        "MY": 5, "MAYOR": 5,
        // Oficiales Subalternos
        "CAP": 6, "CAPITAN": 6, "CAPITÁN": 6, 
        "TTE": 7, "TENIENTE": 7, 
        "ALFZ": 8, "ALFEREZ": 8,
        "STTE": 8, "SUB TTE": 8, "SUB TENIENTE": 8, 
        // Técnicos
        "TCO JS": 9, "TC JF SUP": 9, 
        "TCO J": 10, "TC JEFE": 10, 
        "TCO 1º": 11, "TCO 1": 11, "TCO 1°": 11,
        "TCO 2º": 12, "TCO 2": 12, "TCO 2°": 12,
        "TCO 3º": 13, "TCO 3": 13, "TCO 3°": 13,
        // Suboficiales
        "SO 1º": 14, "SO 1": 14, "SO 1°": 14,
        "SO 2º": 15, "SO 2": 15, "SO 2°": 15, 
        "SO 3º": 16, "SO 3": 16, "SO 3°": 16,
        // Tropa y Empleados
        "S/M": 17, "SGTO": 18, "CBO": 19, "SLDO": 20, "EC": 21
    };

    // 2. PRIORIDAD DE UNIDADES (CG III DE PRIMERO)
    const unitPriorityKeywords = [
        { key: "CG III DE", weight: 1 },
        { key: "CIA CMDO", weight: 2 },  // Agrupa "CIA CMDO N° 113"
        { key: "BAND MUS", weight: 3 },  // Agrupa "BAND MUS N° 103"
        { key: "CIA PM", weight: 4 }     // Agrupa "CIA PM N° 113"
    ];

    return records.sort((a, b) => {
        const unitA = (a.unidad || "").toUpperCase().trim();
        const unitB = (b.unidad || "").toUpperCase().trim();
        const rankA = (a.grado || "").toUpperCase().trim();
        const rankB = (b.grado || "").toUpperCase().trim();
        const nameA = (a.apellido || "").toUpperCase();
        const nameB = (b.apellido || "").toUpperCase();

        // --- CRITERIO 1: UNIDAD ---
        let weightUnitA = 999; 
        let weightUnitB = 999;

        for (const item of unitPriorityKeywords) {
            if (unitA.includes(item.key)) { weightUnitA = item.weight; break; }
        }
        for (const item of unitPriorityKeywords) {
            if (unitB.includes(item.key)) { weightUnitB = item.weight; break; }
        }

        if (weightUnitA !== weightUnitB) {
            return weightUnitA - weightUnitB;
        }
        
        // Si ambas son unidades "otras" (peso 999), ordenar alfabéticamente por nombre de Unidad
        if (weightUnitA === 999 && weightUnitB === 999) {
            if (unitA < unitB) return -1;
            if (unitA > unitB) return 1;
        }

        // --- CRITERIO 2: GRADO (JERARQUÍA) ---
        const cleanRankA = rankA.replace(/\./g, '');
        const cleanRankB = rankB.replace(/\./g, '');
        
        const weightRankA = rankPriority[cleanRankA] || rankPriority[rankA] || 999;
        const weightRankB = rankPriority[cleanRankB] || rankPriority[rankB] || 999;

        if (weightRankA !== weightRankB) {
            return weightRankA - weightRankB;
        }

        // --- CRITERIO 3: APELLIDO (ANTIGÜEDAD RELATIVA) ---
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        return 0;
    });
}

// --- INICIALIZACIÓN DE BASE DE DATOS Y LIMPIEZA ---
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
                dob VARCHAR(50) 
            );
        `);
        
        // *** LIMPIEZA DE DATOS HISTÓRICOS (Para Gráfico Limpio desde Noviembre) ***
        console.log("Limpiando datos históricos (pre-Noviembre 2025)...");
        await client.query(`
            UPDATE records 
            SET peso = 0, altura = 0.01, imc = 0, pab = 0, 
                pa = 'N/A', paClasificacion = 'N/A', riesgoAEnf = 'N/A', 
                motivo = 'PENDIENTE (HISTÓRICO)', registradoPor = 'SISTEMA (RESET)'
            WHERE 
                fecha NOT LIKE '%/11/2025' AND 
                fecha NOT LIKE '%/12/2025' AND 
                imc > 0;
        `);
        console.log("✅ Datos antiguos limpiados.");

        const defaultPassword = 'superadmin'; 
        const hash = await bcrypt.hash(defaultPassword, 10);
        const insertUserSql = `INSERT INTO users (cip, fullName, password, role, email) 
                               VALUES ($1, $2, $3, $4, $5) 
                               ON CONFLICT (cip) 
                               DO UPDATE SET fullName = EXCLUDED.fullName;`;
        
        await client.query(insertUserSql, ['ADMIN001', 'Super Administrador SIMCEP', hash, 'superadmin', 'admin@simcep.com']);
        console.log("✅ Usuario Super Admin Inicial verificado.");
        
    } catch (err) {
        console.error("Error FATAL al inicializar la base de datos:", err.message);
        throw err; 
    } finally {
        client.release();
    }
}
initializeDatabase();


// FUNCIÓN DE UTILIDAD: Cálculo de edad
function calculateAgeFromDOB(dobString, referenceDateString) {
    if (!dobString || !referenceDateString || dobString.length < 10) return 0;
    const [dobYear, dobMonth, dobDay] = dobString.split('-').map(Number);
    const [refDay, refMonth, refYear] = referenceDateString.split('/').map(Number);
    let age = refYear - dobYear;
    if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
        age--;
    }
    return age;
}

// FUNCIÓN DE UTILIDAD: Relleno de Registros
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

// [GET] /api/stats (Postgres): Consulta con filtros y ordenamiento militar
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

    pool.query(sql, params)
        .then(result => {
            // APLICAR ORDENAMIENTO MILITAR ANTES DE RESPONDER
            const sorted = sortRecordsByMilitaryHierarchy(result.rows);
            res.json(sorted);
        })
        .catch(err => {
            console.error("Error en GET /api/stats:", err.message);
            res.status(500).json({ error: "Error interno al obtener los registros." });
        });
});


// [GET] /api/records/check-monthly/:cip (Postgres)
app.get('/api/records/check-monthly/:cip', (req, res) => {
    const { cip } = req.params;
    const { targetMonthYear } = req.query; 

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();
    const targetMonthYearValue = targetMonthYear || `${currentMonth}/${currentYear}`;
    
    const [targetMonth, targetYear] = targetMonthYearValue.split('/').map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, 1); 

    const selectSql = "SELECT * FROM records WHERE cip = $1 ORDER BY id DESC LIMIT 1";
    pool.query(selectSql, [cip])
        .then(async result => {
            const lastRecord = result.rows[0];
            let missingMonthsCount = 0;

            if (lastRecord && lastRecord.fecha && lastRecord.fecha.includes(targetMonthYearValue)) {
                return res.json({ alreadyRecorded: true, message: `El CIP ${cip} ya tiene un registro para el mes de ${targetMonthYearValue}.` });
            }
            
            if (lastRecord) {
                const lastDateParts = lastRecord.fecha.split('/');
                let lastMonth = parseInt(lastDateParts[1]); // 1-12
                let lastYear = parseInt(lastDateParts[2]);
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
                        break;
                    }
                    checkDate.setMonth(checkDate.getMonth() + 1);
                }
            }
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
    const { dni } = req.params;
    const sql = "SELECT * FROM records WHERE dni = $1 OR cip = $2 ORDER BY id DESC LIMIT 1";
    pool.query(sql, [dni, dni])
        .then(result => {
            const row = result.rows[0];
            if (!row) return res.status(404).json({ message: "Paciente no encontrado." });
            res.json({
                gguu: row.gguu,
                unidad: row.unidad,
                cip: row.cip,
                sexo: row.sexo,
                apellido: row.apellido,
                nombre: row.nombre,
                edad: row.edad, 
                fechaNacimiento: row.dob, 
                grado: row.grado          
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// [GET] /api/records (Postgres)
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY id DESC";
    pool.query(sql)
        .then(result => {
            const sorted = sortRecordsByMilitaryHierarchy(result.rows);
            res.json(sorted);
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/records (Postgres)
app.post('/api/records', (req, res) => {
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob } = req.body;
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`;
    const values = [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob];
    
    pool.query(sql, values)
        .then(result => res.status(201).json({ message: "Registro guardado exitosamente", id: result.rows[0].id }))
        .catch(err => res.status(500).json({ error: "Error al guardar el registro: " + err.message }));
});

// [PUT] /api/records/:id (Postgres)
app.put('/api/records/:id', (req, res) => {
    const { id } = req.params;
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo, dob, fecha } = req.body;
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

// [POST] /api/records/mass-no-show
app.post('/api/records/mass-no-show', async (req, res) => {
    const { targetMonthYear } = req.body; 

    if (!targetMonthYear || targetMonthYear.length !== 7 || targetMonthYear.indexOf('/') !== 2) {
        return res.status(400).json({ error: "Mes de registro inválido. Use formato MM/YYYY." });
    }
    const [targetMonth, targetYear] = targetMonthYear.split('/').map(Number);
    const dateLimit = new Date(targetYear, targetMonth, 1); 
    if (dateLimit.getTime() > new Date().getTime() + 86400000) { 
        return res.status(403).json({ error: "No se permite el registro masivo en meses futuros o el mes actual." });
    }

    try {
        const latestRecordsSql = `SELECT DISTINCT ON (cip) * FROM records ORDER BY cip, id DESC;`;
        const allLatestRecords = await pool.query(latestRecordsSql);
        const allPersonnel = allLatestRecords.rows;
        if (allPersonnel.length === 0) return res.status(404).json({ message: "No hay personal registrado." });

        let insertedCount = 0;
        const insertSql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`;

        for (const record of allPersonnel) {
            const checkSql = "SELECT id FROM records WHERE cip = $1 AND fecha LIKE $2 LIMIT 1";
            const alreadyExists = await pool.query(checkSql, [record.cip, `%/${targetMonthYear}`]);

            if (alreadyExists.rowCount === 0) {
                const checkDateFormatted = `01/${targetMonthYear}`;
                const ageAtMissingDate = calculateAgeFromDOB(record.dob, checkDateFormatted); 
                
                const values = [
                    record.gguu, record.unidad, record.dni, 'N/A', 0, 'N/A', 'N/A', record.sexo, record.cip, record.grado, record.apellido, record.nombre, ageAtMissingDate, 0, 0.01, 0, checkDateFormatted, 'SISTEMA (INASISTENCIA MASIVA)', 'NO ASISTIÓ', record.dob
                ];
                await pool.query(insertSql, values);
                insertedCount++;
            }
        }
        return res.json({ message: `Proceso masivo completado. ${insertedCount} registros insertados.`, insertedCount });
    } catch (error) {
        return res.status(500).json({ error: "Error interno al ejecutar el proceso masivo: " + error.message });
    }
});



// [POST] /api/export-excel (Postgres)
app.post('/api/export-excel', async (req, res) => {
    try {
        const { records, reportMonth } = req.body; 
        let finalRecordsToExport = records;
        
        if (records.length > 0 && records.every(r => r.cip === records[0].cip)) {
            const targetCip = records[0].cip;
            const allPatientRecordsResult = await pool.query("SELECT * FROM records WHERE cip = $1 ORDER BY id DESC", [targetCip]);
            const allPatientRecords = allPatientRecordsResult.rows;
            const now = new Date();
            const endMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            finalRecordsToExport = generateMissingRecords(allPatientRecords, endMonthYear);
        } else {
            finalRecordsToExport = sortRecordsByMilitaryHierarchy(finalRecordsToExport);
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        const GGUU_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E699' } }; 
        const MOTIVO_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; 
        const MOTIVO_CONTENT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; 
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const FONT_DARK = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } }; 
        const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; 
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        const HEADERS = ["N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", "SEXO", "EDAD", "PA", "CLASIFICACION PA", "PAB", "RIESGO A ENF SEGUN PABD", "PESO", "TALLA", "IMC", "CLASIFICACION DE IMC", "MOTIVO"];
        
        const headerRow = worksheet.getRow(6);
        headerRow.values = HEADERS;
        
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            cell.fill = HEADER_FILL;
            cell.font = FONT_WHITE;
            cell.border = BORDER_THIN;
            const isClasificacionIMC = colNumber === 17;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: isClasificacionIMC ? false : true };
            worksheet.getColumn(colNumber).width = (colNumber === 5) ? 30 : (isClasificacionIMC ? 18 : 12); 
        });
        
        finalRecordsToExport.forEach((record, index) => { 
            const rowNumber = 7 + index; 
            const dataRow = worksheet.getRow(rowNumber);
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase(); 
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase(); 
            const motivoTexto = record.motivo || 'N/A';
            
            const showPeso = record.peso > 0 ? record.peso : ' ';
            const showTalla = record.altura > 0.1 ? record.altura : ' ';
            const showIMC = record.imc > 0 ? record.imc : ' ';
            const showClas = record.imc > 0 ? clasificacionIMC : 'SIN DATOS';

            dataRow.values = [
                index + 1, record.gguu, record.unidad, record.grado, `${(record.apellido || '').toUpperCase()}, ${record.nombre || ''}`, record.dni, record.cip, record.sexo, record.edad, record.pa, paClasificacion, record.pab, riesgoAEnf, showPeso, showTalla, showIMC, showClas, motivoTexto
            ];
            
            dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.fill = DATA_FILL_STANDARD; 
                cell.border = BORDER_THIN;
                cell.font = FONT_NORMAL;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (colNumber === 2) { cell.fill = GGUU_FILL; cell.font = FONT_DARK; }
                if (colNumber === 17 && (resultado.includes('INAPTO') || clasificacionIMC.includes('OBESIDAD'))) { cell.font = FONT_RED; }
                if (colNumber === HEADERS.length) { 
                    if (motivoTexto.includes('NO ASISTIÓ')) { cell.fill = MOTIVO_CONTENT_FILL; }
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
                if (colNumber === 11 && paClasificacion.includes('HIPERTENSION')) { cell.font = FONT_RED; }
                if (colNumber === 13 && riesgoAEnf.includes('MUY ALTO')) { cell.font = FONT_RED; }
            });
        });
        
        const lastColumnLetter = worksheet.getColumn(HEADERS.length).letter; 
        worksheet.mergeCells(`A1:${lastColumnLetter}2`); 
        worksheet.getCell('A1').value = `CONSOLIDADO DEL IMC DE LA III DE AF ${new Date().getFullYear()}`; 
        worksheet.getCell('A1').font = { name: 'Calibri', size: 26, bold: true, underline: 'single' }; 
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.mergeCells(`A4:${lastColumnLetter}4`); 
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 22, bold: true }; 
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.getColumn(HEADERS.length).hidden = true; 
        worksheet.mergeCells('S1:U4'); 
        const infoBoxCell = worksheet.getCell('S1'); 
        infoBoxCell.value = 'III DE\nCIA CMDO Nº113\nIPRESS\nAREQUIPA';
        infoBoxCell.font = { name: 'Calibri', size: 11, bold: true };
        infoBoxCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        
        // --- CÓDIGO CORREGIDO ---
        worksheet.autoFilter = { from: 'A6', to: `${lastColumnLetter}6` }; // CORRECCIÓN: ws -> worksheet
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Reporte_SIMCEP_Mensual.xlsx');
        await workbook.xlsx.write(res); // CORRECCIÓN: wb -> workbook
        res.end();
        // --- FIN CÓDIGO CORREGIDO ---

    } catch (error) {
        console.error("Error Excel:", error);
        // Si hay un error, aún enviamos la respuesta de error 500 como JSON
        // Nota: Asegúrate de que no se haya enviado ningún encabezado antes
        res.status(500).json({ message: "Error interno al generar el reporte Excel.", error: error.message });
    }
});


// --- RUTAS DE API PARA USUARIOS Y LOGIN ---

// [POST] /api/login (Postgres)
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) return res.status(400).json({ message: "CIP y contraseña requeridos." });
    const sql = "SELECT * FROM users WHERE cip = $1";
    pool.query(sql, [cip]).then(result => {
            const user = result.rows[0];
            if (!user) return res.status(401).json({ message: "Credenciales incorrectas." });
            bcrypt.compare(password, user.password, (bcryptErr, result) => {
                if (bcryptErr) { console.error("Error login:", bcryptErr); return res.status(500).json({ message: "Error." }); }
                if (result) { res.json({ message: "Login exitoso", user: { cip: user.cip, fullName: user.fullName, role: user.role } }); } 
                else { res.status(401).json({ message: "Credenciales incorrectas." }); }
            });
        }).catch(err => res.status(500).json({ error: err.message }));
});

// [PUT] /api/users/password/:cip (Postgres)
app.put('/api/users/password/:cip', (req, res) => {
    const { cip } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Nueva contraseña requerida." });
    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error." });
        pool.query(`UPDATE users SET password = $1 WHERE cip = $2`, [hash, cip]).then(result => {
                if (result.rowCount === 0) return res.status(404).json({ message: "Usuario no encontrado." });
                res.json({ message: "Contraseña actualizada." });
            }).catch(err => res.status(500).json({ message: "Error.", error: err.message }));
    });
});

// [GET] /api/users (Postgres)
app.get('/api/users', (req, res) => {
    pool.query("SELECT cip, fullName, role FROM users").then(result => res.json(result.rows)).catch(err => res.status(500).json({ error: err.message }));
});

// [POST] /api/users (Postgres)
app.post('/api/users', (req, res) => {
    const { cip, fullName, password, email } = req.body;
    if (!cip || !fullName || !password) return res.status(400).json({ message: "Datos requeridos." });
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error." });
        const sql = `INSERT INTO users (cip, fullName, password, role, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (cip) DO UPDATE SET fullName = EXCLUDED.fullName, email = EXCLUDED.email RETURNING cip`;
        pool.query(sql, [cip, fullName, hash, 'admin', email || null]).then(result => res.status(201).json({ message: "Usuario creado.", cip: cip })).catch(err => res.status(500).json({ error: err.message }));
    });
});

// [POST] /api/forgot-password (Postgres)
app.post('/api/forgot-password', (req, res) => {
    const { cip } = req.body;
    pool.query(`SELECT * FROM users WHERE cip = $1`, [cip]).then(result => {
        const user = result.rows[0];
        if (!user || !user.email) return res.json({ message: "Si existe, correo enviado." });
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; 
        pool.query(`UPDATE users SET resetPasswordToken = $1, resetPasswordExpires = $2 WHERE cip = $3`, [token, expires, cip]).then(async () => {
                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
                try { await transporter.sendMail({ from: `"SIMCEP Admin" <${process.env.EMAIL_USER}>`, to: user.email, subject: 'Reset Password', text: `Token: ${token}` }); res.json({ message: "Correo enviado." }); } catch (error) { res.status(500).json({ message: "Error correo." }); }
            });
    });
});

// [POST] /api/reset-password (Postgres)
app.post('/api/reset-password', (req, res) => {
    const { token, password } = req.body;
    pool.query(`SELECT * FROM users WHERE resetPasswordToken = $1 AND resetPasswordExpires > $2`, [token, Date.now()]).then(result => {
        const user = result.rows[0];
        if (!user) return res.status(400).json({ message: "Token inválido." });
        bcrypt.hash(password, 10, (err, hash) => {
            pool.query(`UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = $2`, [hash, user.cip]).then(() => res.json({ message: "Clave actualizada." }));
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});