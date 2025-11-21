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

// --- FUNCIONES DE UTILIDAD ---
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

function generateMissingRecords(records, endMonthYear) {
    if (records.length === 0) return [];
    const recordsByMonth = records.reduce((acc, r) => {
        acc[r.fecha.substring(3)] = r; 
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
                ...firstRecord, id: null, fecha: checkDateFormatted, peso: 0, altura: 0.01, imc: 0, pab: 0, pa: 'N/A', paClasificacion: 'N/A', riesgoAEnf: 'N/A', motivo: 'NO ASISTIÓ', registradoPor: 'SISTEMA (NO ASISTIÓ)', edad: ageAtMissingDate 
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

// --- RUTAS API ---

// GET /api/stats (Aplica Ordenamiento + Filtros)
app.get('/api/stats', (req, res) => {
    const { cip, gguu, unidad, sexo, monthYear, apellidoNombre, edad, aptitud } = req.query; 
    let sql = "SELECT * FROM records WHERE 1=1"; 
    let params = [];

    if (cip) { sql += ` AND cip = $${params.length + 1}`; params.push(cip); }
    if (gguu) { sql += ` AND gguu = $${params.length + 1}`; params.push(gguu); }
    if (unidad) { sql += ` AND unidad = $${params.length + 1}`; params.push(unidad); } // Filtro Unidad
    if (sexo) { sql += ` AND sexo = $${params.length + 1}`; params.push(sexo); }
    if (apellidoNombre) {
        const searchPattern = `%${apellidoNombre}%`;
        sql += ` AND (apellido ILIKE $${params.length + 1} OR nombre ILIKE $${params.length + 2})`; 
        params.push(searchPattern, searchPattern);
    }
    if (edad) { sql += ` AND edad = $${params.length + 1}`; params.push(parseInt(edad)); }
    if (aptitud && aptitud !== 'Todas las Aptitudes') { 
        sql += ` AND (paClasificacion = $${params.length + 1} OR riesgoAEnf = $${params.length + 2})`; 
        params.push(aptitud, aptitud); 
    }
    if (monthYear && monthYear !== 'Todos los Meses') {
        const pattern = `%/${monthYear}`; 
        sql += ` AND fecha LIKE $${params.length + 1}`; 
        params.push(pattern);
    }

    pool.query(sql, params).then(result => {
        const sorted = sortRecordsByMilitaryHierarchy(result.rows);
        res.json(sorted);
    }).catch(err => res.status(500).json({ error: "Error interno al obtener los registros." }));
});

// POST /api/export-excel
app.post('/api/export-excel', async (req, res) => {
    try {
        const { records, reportMonth } = req.body; 
        let exportData = records;

        if (records.length > 0 && records.every(r => r.cip === records[0].cip)) {
            const targetCip = records[0].cip;
            const histRes = await pool.query("SELECT * FROM records WHERE cip = $1 ORDER BY id DESC", [targetCip]);
            const now = new Date();
            const eMY = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            exportData = generateMissingRecords(histRes.rows, eMY);
        } else {
            // ASEGURAR ORDENAMIENTO MILITAR EN EXCEL MASIVO
            exportData = sortRecordsByMilitaryHierarchy(exportData);
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('CONSOLIDADO IMC');
        
        const hFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; 
        const gguuFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E699' } }; 
        const errFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; 
        const wFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const bFont = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
        const rFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } };
        const nFont = { name: 'Calibri', size: 11 };
        const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const HEADERS = ["N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", "SEXO", "EDAD", "PA", "CLASIFICACION PA", "PAB", "RIESGO A ENF SEGUN PABD", "PESO", "TALLA", "IMC", "CLASIFICACION DE IMC", "MOTIVO"];
        
        const r6 = ws.getRow(6);
        r6.values = HEADERS;
        r6.eachCell((cell, col) => {
            cell.fill = hFill; cell.font = wFont; cell.border = border;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: col !== 17 };
            ws.getColumn(col).width = col === 5 ? 35 : (col === 17 ? 20 : 12);
        });

        exportData.forEach((rec, i) => {
            const r = ws.getRow(7 + i);
            const clasIMC = (rec.clasificacionMINSA || 'N/A').toUpperCase();
            const res = (rec.resultado || 'N/A').toUpperCase();
            const showPeso = rec.peso > 0 ? rec.peso : ' ';
            const showTalla = rec.altura > 0.1 ? rec.altura : ' ';
            const showIMC = rec.imc > 0 ? rec.imc : ' ';
            const showClas = rec.imc > 0 ? clasIMC : 'SIN DATOS';

            r.values = [i + 1, rec.gguu, rec.unidad, rec.grado, `${(rec.apellido||'').toUpperCase()}, ${rec.nombre||''}`, rec.dni, rec.cip, rec.sexo, rec.edad, rec.pa, rec.paClasificacion, rec.pab, rec.riesgoAEnf, showPeso, showTalla, showIMC, showClas, rec.motivo];
            
            r.eachCell((cell, col) => {
                cell.border = border; cell.font = nFont; cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (col === 2) { cell.fill = gguuFill; cell.font = bFont; }
                if (col === 17 && (res.includes('INAPTO') || clasIMC.includes('OBESIDAD'))) { cell.font = rFont; }
                if (col === HEADERS.length) { 
                     if (rec.motivo.includes('NO ASISTIÓ')) { cell.fill = errFill; }
                     cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        const lastCol = ws.getColumn(HEADERS.length).letter;
        ws.mergeCells(`A1:${lastCol}2`);
        const title = ws.getCell('A1');
        title.value = `CONSOLIDADO DEL IMC DE LA III DE AF ${new Date().getFullYear()}`;
        title.font = { name: 'Calibri', size: 26, bold: true, underline: 'single' }; 
        title.alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(`A4:${lastCol}4`);
        const sub = ws.getCell('A4');
        sub.value = `PESADA MENSUAL - ${reportMonth}`; 
        sub.font = { name: 'Calibri', size: 22, bold: true }; 
        sub.alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getColumn(HEADERS.length).hidden = true; 
        ws.mergeCells('S1:U4'); 
        const infoBoxCell = worksheet.getCell('S1'); 
        infoBoxCell.value = 'III DE\nCIA CMDO Nº113\nIPRESS\nAREQUIPA';
        infoBoxCell.font = { name: 'Calibri', size: 11, bold: true };
        infoBoxCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        
        ws.autoFilter = { from: 'A6', to: `${lastCol}6` };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Reporte_SIMCEP_Mensual.xlsx');
        await wb.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error Excel:", error);
        res.status(500).json({ message: "Error interno al generar el reporte Excel.", error: error.message });
    }
});

// --- CRUD STANDARDS ---
app.get('/api/records/check-monthly/:cip', (req, res) => { 
    const { cip } = req.params; const { targetMonthYear } = req.query; 
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();
    const targetMonthYearValue = targetMonthYear || `${currentMonth}/${currentYear}`;
    const [targetMonth, targetYear] = targetMonthYearValue.split('/').map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, 1); 

    const selectSql = "SELECT * FROM records WHERE cip = $1 ORDER BY id DESC LIMIT 1";
    pool.query(selectSql, [cip]).then(async result => {
        const lastRecord = result.rows[0];
        let missingMonthsCount = 0;
        if (lastRecord && lastRecord.fecha && lastRecord.fecha.includes(targetMonthYearValue)) {
            return res.json({ alreadyRecorded: true, message: `El CIP ${cip} ya tiene un registro para el mes de ${targetMonthYearValue}.` });
        }
        if (lastRecord) {
            const lastDateParts = lastRecord.fecha.split('/');
            let lastMonth = parseInt(lastDateParts[1]); let lastYear = parseInt(lastDateParts[2]);
            let checkDate = new Date(lastYear, lastMonth, 1); 
            while (checkDate.getTime() < targetDate.getTime()) {
                const missingMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
                const missingYear = checkDate.getFullYear();
                const missingDate = `01/${missingMonth}/${missingYear}`;
                const ageAtMissingDate = calculateAgeFromDOB(lastRecord.dob, missingDate); 
                const insertSql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`;
                try {
                    await pool.query(insertSql, [lastRecord.gguu, lastRecord.unidad, lastRecord.dni, 'N/A', 0, 'N/A', 'N/A', lastRecord.sexo, lastRecord.cip, lastRecord.grado, lastRecord.apellido, lastRecord.nombre, ageAtMissingDate, 0, 0.01, 0, missingDate, 'SISTEMA (NO ASISTIÓ)', 'NO ASISTIÓ', lastRecord.dob]);
                    missingMonthsCount++;
                } catch (error) { break; }
                checkDate.setMonth(checkDate.getMonth() + 1);
            }
        }
        return res.json({ alreadyRecorded: false, missingRecordsCreated: missingMonthsCount > 0 });
    }).catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    pool.query("SELECT * FROM users WHERE cip = $1", [cip]).then(r => {
        const u = r.rows[0];
        if (!u) return res.status(401).json({msg:"Error"});
        bcrypt.compare(password, u.password, (e,ok) => {
             if(ok) res.json({message:"Login", user:{cip:u.cip, fullName:u.fullName, role:u.role}});
             else res.status(401).json({msg:"Error"});
        });
    });
});
app.put('/api/users/password/:cip', (req, res) => {
    bcrypt.hash(req.body.newPassword, 10, (e,h) => { pool.query(`UPDATE users SET password=$1 WHERE cip=$2`,[h, req.params.cip]).then(()=>res.json({msg:"OK"})); });
});
app.get('/api/users', (req, res) => { pool.query("SELECT cip, fullName, role FROM users").then(r=>res.json(r.rows)); });
app.post('/api/users', (req, res) => {
    bcrypt.hash(req.body.password, 10, (e,h) => { pool.query(`INSERT INTO users (cip, fullName, password, role, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (cip) DO UPDATE SET fullName=EXCLUDED.fullName`, [req.body.cip, req.body.fullName, h, 'admin', req.body.email]).then(()=>res.status(201).json({msg:"OK"})); });
});
app.get('/api/records', (req, res) => { pool.query("SELECT * FROM records").then(r=>res.json(r.rows)); });
app.post('/api/records', (req, res) => {
    const b=req.body;
    pool.query(`INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`, [b.gguu, b.unidad, b.dni, b.pa, b.pab, b.paClasificacion, b.riesgoAEnf, b.sexo, b.cip, b.grado, b.apellido, b.nombre, b.edad, b.peso, b.altura, b.imc, b.fecha, b.registradoPor, b.motivo, b.dob]).then(r=>res.status(201).json({id:r.rows[0].id}));
});
app.put('/api/records/:id', (req, res) => {
    const b=req.body; pool.query(`UPDATE records SET gguu=$1, unidad=$2, dni=$3, pa=$4, pab=$5, paClasificacion=$6, riesgoAEnf=$7, sexo=$8, cip=$9, grado=$10, apellido=$11, nombre=$12, edad=$13, peso=$14, altura=$15, imc=$16, motivo=$17, dob=$18, fecha=$19 WHERE id=$20`, [b.gguu, b.unidad, b.dni, b.pa, b.pab, b.paClasificacion, b.riesgoAEnf, b.sexo, b.cip, b.grado, b.apellido, b.nombre, b.edad, b.peso, b.altura, b.imc, b.motivo, b.dob, b.fecha, req.params.id]).then(()=>res.json({msg:"OK"}));
});
app.delete('/api/records/:id', (req, res) => { pool.query("DELETE FROM records WHERE id=$1",[req.params.id]).then(()=>res.json({msg:"DEL"})); });
app.get('/api/patient/:dni', (req, res) => {
    pool.query("SELECT * FROM records WHERE dni=$1 OR cip=$2 ORDER BY id DESC LIMIT 1", [req.params.dni, req.params.dni]).then(r => {
        if(!r.rows[0]) return res.status(404).json({msg:"404"});
        const d=r.rows[0]; res.json({gguu:d.gguu, unidad:d.unidad, cip:d.cip, sexo:d.sexo, apellido:d.apellido, nombre:d.nombre, edad:d.edad, fechaNacimiento:d.dob, grado:d.grado});
    });
});
app.post('/api/records/mass-no-show', async (req, res) => {
    const { targetMonthYear } = req.body;
    const [tm, ty] = targetMonthYear.split('/').map(Number);
    if(new Date(ty, tm, 1) > new Date().getTime() + 86400000) return res.status(403).json({error:"Futuro"});
    try {
        const recs = await pool.query("SELECT DISTINCT ON (cip) * FROM records ORDER BY cip, id DESC");
        let count = 0;
        for(const r of recs.rows) {
            const ex = await pool.query("SELECT id FROM records WHERE cip=$1 AND fecha LIKE $2", [r.cip, `%/${targetMonthYear}`]);
            if(ex.rowCount===0) {
                const d = `01/${targetMonthYear}`;
                await pool.query(`INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES ($1,$2,$3,'N/A',0,'N/A','N/A',$4,$5,$6,$7,$8,$9,0,0.01,0,$10,'SISTEMA','NO ASISTIÓ',$11)`,[r.gguu, r.unidad, r.dni, r.sexo, r.cip, r.grado, r.apellido, r.nombre, calculateAgeFromDOB(r.dob, d), d, r.dob]);
                count++;
            }
        }
        res.json({insertedCount:count});
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/forgot-password', (req, res) => {
    const { cip } = req.body;
    pool.query(`SELECT * FROM users WHERE cip = $1`, [cip]).then(result => {
        const user = result.rows[0];
        if (!user || !user.email) return res.json({ message: "Correo enviado si existe." });
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; 
        pool.query(`UPDATE users SET resetPasswordToken = $1, resetPasswordExpires = $2 WHERE cip = $3`, [token, expires, cip])
            .then(async () => {
                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
                try {
                    await transporter.sendMail({ from: `SIMCEP`, to: user.email, subject: 'Reset Password', text: `Token: ${token}` });
                    res.json({ message: "Correo enviado." });
                } catch (e) { res.status(500).json({ message: "Error correo." }); }
            });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { token, password } = req.body;
    pool.query(`SELECT * FROM users WHERE resetPasswordToken = $1 AND resetPasswordExpires > $2`, [token, Date.now()]).then(result => {
        const user = result.rows[0];
        if (!user) return res.status(400).json({ message: "Token inválido." });
        bcrypt.hash(password, 10, (err, hash) => {
            pool.query(`UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = $2`, [hash, user.cip])
                .then(() => res.json({ message: "Clave actualizada." }));
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});