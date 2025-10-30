// --- 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
app.use(express.static(path.join(__dirname, '/'))); 

// --- 3. CONEXIÓN A LA BASE DE DATOS SQLITE ---
const dbPath = '/data/simcep';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("Error FATAL al conectar con la base de datos:", err.message);
        process.exit(1); 
    } else {
        console.log("Conexión a la base de datos SQLite establecida con éxito.");
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                cip TEXT PRIMARY KEY,
                fullName TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                email TEXT UNIQUE,
                resetPasswordToken TEXT,
                resetPasswordExpires INTEGER
            );
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                gguu TEXT, unidad TEXT, dni TEXT, pa TEXT, pab REAL, paClasificacion TEXT, riesgoAEnf TEXT, 
                sexo TEXT, cip TEXT, grado TEXT, apellido TEXT,
                nombre TEXT, edad INTEGER, peso REAL, altura REAL, 
                imc REAL, fecha TEXT,
                registradoPor TEXT,
                motivo TEXT,               -- <<-- CAMBIO 1: AÑADIDO MOTIVO INAPTO
                dob TEXT                   -- <<-- CAMBIO 2: AÑADIDO FECHA DE NACIMIENTO (DOB)
            );
        `, (err) => {
            if (err) {
                console.error("Error al asegurar las tablas:", err.message);
                process.exit(1);
            }
            console.log("Tablas de base de datos listas. El servidor está listo para iniciar.");
        });
    }
});


// --- 4. RUTAS DE LA API PARA REGISTROS ---

// [GET] /api/patient/:dni (MODIFICADA: Autocompleta Grado y DOB)
app.get('/api/patient/:dni', (req, res) => {
    const { dni } = req.params;
    // Busca el registro más reciente del paciente por DNI o CIP
    const sql = "SELECT * FROM records WHERE dni = ? OR cip = ? ORDER BY id DESC LIMIT 1";
    db.get(sql, [dni, dni], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
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
            fechaNacimiento: row.dob, // <<-- CORREGIDO: Usar row.dob (Fecha de Nacimiento)
            grado: row.grado          // <<-- AÑADIDO: Devolver el Grado
        });
    });
});

// [GET] /api/records
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [POST] /api/records (MODIFICADA: incluye Motivo y DOB)
app.post('/api/records', (req, res) => {
    // CAPTURA DE TODOS LOS CAMPOS (Ahora son 20)
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob } = req.body;
    
    // SQL con todos los 20 campos para inserción
    const sql = `INSERT INTO records (gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor, motivo, dob], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Registro guardado exitosamente", id: this.lastID });
    });
});

// [PUT] /api/records/:id (MODIFICADA: incluye Motivo y DOB)
app.put('/api/records/:id', (req, res) => {
    const { id } = req.params;
    // CAPTURA DE TODOS LOS CAMPOS (Ahora incluye motivo y dob)
    const { gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo, dob } = req.body;
    
    // SQL con todos los 17 campos para actualización
    const sql = `UPDATE records SET 
                    gguu = ?, unidad = ?, dni = ?, pa = ?, pab = ?, paClasificacion = ?, riesgoAEnf = ?,
                    sexo = ?, cip = ?, grado = ?, apellido = ?, nombre = ?, 
                    edad = ?, peso = ?, altura = ?, imc = ?, motivo = ?, dob = ?
                 WHERE id = ?`;
                 
    db.run(sql, [gguu, unidad, dni, pa, pab, paClasificacion, riesgoAEnf, sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, motivo, dob, id], function(err) {
        if (err) return res.status(500).json({ message: "Error al actualizar.", error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Registro no encontrado." });
        res.json({ message: "Registro actualizado." });
    });
});

// [DELETE] /api/records/:id
app.delete('/api/records/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM records WHERE id = ?";
    db.run(sql, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Registro no encontrado." });
        res.json({ message: `Registro con ID ${id} eliminado.` });
    });
});


// [POST] /api/export-excel (CORREGIDA: usa record.motivo para el Excel)
app.post('/api/export-excel', async (req, res) => {
    try {
        // RECIBIMOS EL OBJETO CON RECORDS Y REPORTMONTH
        const { records, reportMonth } = req.body; 

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CONSOLIDADO IMC');
        
        // --- 1. Definición de Estilos (Solución para styles.xml) ---
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365F37' } }; // Verde Oscuro
        const FONT_WHITE = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const FONT_RED = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } }; // Rojo para INAPTO/Riesgo
        const FONT_NORMAL = { name: 'Calibri', size: 11 };
        const DATA_FILL_STANDARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; 

        // --- 2. Encabezados (19 Columnas) ---
        const HEADERS = [
            "N", "GGUU", "UNIDAD", "GRADO", "APELLIDOS Y NOMBRES", "DNI", "CIP", 
            "SEXO", "EDAD", "PESO", "TALLA", "PA", "CLASIFICACION PA", 
            "PAB", "RIESGO A ENF SEGUN PABD", "IMC", "CLASIFICACION DE IMC", "MOTIVO", "DIGITADOR"
        ];
        
        // --- 3. Aplicar Formato a la Fila de Encabezados (Fila 6, desde A6) ---
        const headerRow = worksheet.getRow(6);
        headerRow.values = HEADERS;
        
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            cell.fill = HEADER_FILL;
            cell.font = FONT_WHITE;
            cell.border = BORDER_THIN;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            // Establecer anchos de columna predeterminados
            worksheet.getColumn(colNumber).width = (colNumber === 5) ? 30 : 12; 
        });
        
        // --- 4. Rellenar Filas de Datos ---
        records.forEach((record, index) => {
            const rowNumber = 7 + index; // Empieza en la fila 7
            const dataRow = worksheet.getRow(rowNumber);
            
            // Los campos que vienen calculados del cliente (sistema-imc.js)
            const clasificacionIMC = (record.clasificacionMINSA || 'N/A').toUpperCase();
            const paClasificacion = (record.paClasificacion || 'N/A').toUpperCase();
            const riesgoAEnf = (record.riesgoAEnf || 'N/A').toUpperCase();
            const resultado = (record.resultado || 'N/A').toUpperCase();
            
            // --- LÓGICA DE DIGITADOR SIMPLIFICADA (CORRECCIÓN FINAL) ---
            let digitadorDisplay = record.registradoPor || '';
            if (digitadorDisplay) {
                // 1. Quita el CIP y el rol entre paréntesis
                const adminFullName = digitadorDisplay.replace(/\s*\([^)]*\)/g, '').trim(); 
                const adminNameParts = adminFullName.split(' ').filter(p => p.length > 0);
                
                if (digitadorDisplay.includes('SUPERADMIN')) {
                    // SUPERADMIN: Mantiene el CIP y (SUPERADMIN)
                    const match = digitadorDisplay.match(/([^\s]+)\s+\(([^)]+)\)/);
                    digitadorDisplay = match ? `${match[1]} (${match[2]})` : 'SUPERADMIN';
                } else {
                    // ADMIN NORMAL: Toma las dos primeras palabras del nombre (Ej: Katherin Giuliana)
                    if (adminNameParts.length >= 2) {
                        digitadorDisplay = `${adminNameParts[0]} ${adminNameParts[1]}`.trim();
                    } else {
                        digitadorDisplay = adminNameParts.join(' ').trim() || record.cip; // Fallback al cip
                    }
                }
            }
            
            // Datos en el orden de los encabezados (19 campos)
            dataRow.values = [
                index + 1, // N
                record.gguu, // GGUU
                record.unidad, // UNIDAD
                record.grado, // GRADO
                `${(record.apellido || '').toUpperCase()}, ${record.nombre || ''}`, // APELLIDOS Y NOMBRES
                record.dni, // DNI
                record.cip, // CIP
                record.sexo, // SEXO
                record.edad, // EDAD
                record.peso, // PESO
                record.altura, // TALLA
                record.pa, // PA
                paClasificacion, // CLASIFICACION (PA)
                record.pab, // PBA
                riesgoAEnf, // RIESGO A ENF SEGUN PABD
                record.imc, // IMC
                clasificacionIMC, // CLASIFICACION DE IMC
                record.motivo || 'N/A', // MOTIVO <<-- USAR record.motivo
                digitadorDisplay // DIGITADOR
            ];
            
            // Aplicar formato a la fila (Solución para styles.xml)
            dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                // Aplicar estilos base
                cell.fill = DATA_FILL_STANDARD; 
                cell.border = BORDER_THIN;
                cell.font = FONT_NORMAL;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                // Col 17 (CLASIFICACION DE IMC)
                if (colNumber === 17 && (resultado.includes('INAPTO') || clasificacionIMC.includes('OBESIDAD'))) {
                    cell.font = FONT_RED; 
                }
                
                // Col 13 (CLASIFICACION PA)
                if (colNumber === 13 && paClasificacion.includes('HIPERTENSION')) {
                    cell.font = FONT_RED;
                }
                // Col 15 (RIESGO A ENF SEGUN PABD)
                if (colNumber === 15 && riesgoAEnf.includes('MUY ALTO')) {
                    cell.font = FONT_RED;
                }
            });
        });
        
        // --- 5. Títulos y Metadatos Adicionales ---
        worksheet.mergeCells('A1:S2');
        worksheet.getCell('A1').value = 'CONSOLIDADO DEL IMC DE LA III DE AF 2025';
        worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.mergeCells('A4:S4');
        // USAR reportMonth RECIBIDO DEL CLIENTE
        worksheet.getCell('A4').value = `PESADA MENSUAL - ${reportMonth}`; 
        worksheet.getCell('A4').font = { name: 'Calibri', size: 14, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
        
        // --- 6. Configuración de Respuesta ---
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Reporte_SIMCEP_Mensual.xlsx');
        
        // Escribir el archivo y enviarlo
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error al generar el archivo Excel:", error);
        res.status(500).json({ message: "Error interno al generar el reporte Excel.", error: error.message });
    }
});


// --- RUTAS DE API PARA USUARIOS Y LOGIN ---

// [POST] /api/login
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) return res.status(400).json({ message: "CIP y contraseña requeridos." });
    const sql = "SELECT * FROM users WHERE cip = ?";
    db.get(sql, [cip], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ message: "Credenciales incorrectas." });
        bcrypt.compare(password, user.password, (bcryptErr, result) => {
            if (bcryptErr) return res.status(500).json({ message: "Error del servidor." });
            if (result) {
                res.json({ message: "Login exitoso", user: { cip: user.cip, fullName: user.fullName, role: user.role } });
            } else {
                res.status(401).json({ message: "Credenciales incorrectas." });
            }
        });
    });
});

// [PUT] /api/users/password/:cip (Ruta faltante para edición)
app.put('/api/users/password/:cip', (req, res) => {
    const { cip } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Nueva contraseña requerida." });
    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error al encriptar la contraseña." });
        const sql = `UPDATE users SET password = ? WHERE cip = ?`;
        db.run(sql, [hash, cip], function(err) {
            if (err) return res.status(500).json({ message: "Error al actualizar la contraseña.", error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: "Usuario no encontrado." });
            res.json({ message: "Contraseña actualizada." });
        });
    });
});


// [GET] /api/users
app.get('/api/users', (req, res) => {
    const sql = "SELECT cip, fullName, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [POST] /api/users
app.post('/api/users', (req, res) => {
    const { cip, fullName, password, email } = req.body;
    if (!cip || !fullName || !password) return res.status(400).json({ message: "CIP, Nombre y Contraseña requeridos." });
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: "Error al encriptar." });
        const sql = "INSERT INTO users (cip, fullName, password, role, email) VALUES (?, ?, ?, ?, ?)";
        db.run(sql, [cip, fullName, hash, 'admin', email || null], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ message: `El CIP o Email ya está registrado.` });
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Usuario creado.", cip: cip });
        });
    });
});

// [DELETE] /api/users/:cip
app.delete('/api/users/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM users WHERE cip = ?";
    db.run(sql, cip, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        res.json({ message: `Usuario con CIP ${cip} eliminado.` });
    });
});


// --- NUEVAS RUTAS PARA RECUPERACIÓN DE CONTRASEÑA ---

// [POST] /api/forgot-password
app.post('/api/forgot-password', (req, res) => {
    const { cip } = req.body;
    const sql = `SELECT * FROM users WHERE cip = ?`;
    db.get(sql, [cip], (err, user) => {
        if (err || !user || !user.email) {
            return res.json({ message: "Si existe una cuenta asociada a este CIP, se ha enviado un correo de recuperación." });
        }
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hora
        const updateSql = `UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE cip = ?`;
        db.run(updateSql, [token, expires, cip], async function(err) {
            if (err) return res.status(500).json({ message: "Error al preparar la recuperación." });

            const emailUser = 'francis.swag.05@gmail.com';
            const emailPass = 'itgoxxnazoxgutxm';

            if (!emailUser || !emailPass || emailUser.includes('TU_CORREO')) {
                console.error("ERROR: Credenciales de Nodemailer no configuradas.");
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
                      `https://imc-ep.fly.dev/reset.html?token=${token}\n\n` +
                      `Si no solicitó esto, ignore este correo.\n`
            };
            try {
                await transporter.sendMail(mailOptions);
                res.json({ message: "Si existe una cuenta asociada a este CIP, se ha enviado un correo de recuperación." });
            } catch (error) {
                console.error("Error al enviar el correo:", error);
                res.status(500).json({ message: "Error al enviar el correo." });
            }
        });
    });
});

// [POST] /api/reset-password
app.post('/api/reset-password', (req, res) => {
    const { token, password } = req.body;
    const sql = `SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?`;
    db.get(sql, [token, Date.now()], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ message: "El token de restablecimiento es inválido o ha expirado." });
        }
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "Error al encriptar." });
            const updateSql = `UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE cip = ?`;
            db.run(updateSql, [hash, user.cip], function(err) {
                if (err) return res.status(500).json({ message: "Error al actualizar la contraseña." });
                res.json({ message: "¡Contraseña actualizada con éxito! Ahora puede iniciar sesión." });
            });
        });
    });
});


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor SIMCEP corriendo en http://0.0.0.0:${PORT}`);
});