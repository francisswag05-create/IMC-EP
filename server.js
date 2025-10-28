// =================================================================================================
// Archivo: server.js (VERSIÓN FINAL CON RECUPERACIÓN DE CONTRASEÑA)
// =================================================================================================

// --- 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors'); 
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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
        console.error("Error al conectar con la base de datos en el volumen:", err.message);
    } else {
        console.log("Conexión a la base de datos SQLite en el volumen '/data' establecida con éxito.");
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
                id INTEGER PRIMARY KEY AUTOINCREMENT, sexo TEXT, cip TEXT, grado TEXT, apellido TEXT,
                nombre TEXT, edad INTEGER, peso REAL, altura REAL, imc REAL, fecha TEXT,
                registradoPor TEXT, UNIQUE(cip, fecha)
            );
        `, (err) => {
            if (err) console.error("Error al asegurar las tablas:", err.message);
        });
    }
});


// --- 4. RUTAS DE LA API (CRUD DE REGISTROS, LOGIN, GESTIÓN DE USUARIOS) ---
// [Esta sección no cambia, la incluyo para que el archivo esté completo]

// [GET] /api/records
app.get('/api/records', (req, res) => { /* ... Tu código existente ... */ });
// [POST] /api/records
app.post('/api/records', (req, res) => { /* ... Tu código existente ... */ });
// [PUT] /api/records/:id
app.put('/api/records/:id', (req, res) => { /* ... Tu código existente ... */ });
// [DELETE] /api/records/:id
app.delete('/api/records/:id', (req, res) => { /* ... Tu código existente ... */ });
// [POST] /api/login
app.post('/api/login', (req, res) => { /* ... Tu código existente ... */ });
// [GET] /api/users
app.get('/api/users', (req, res) => { /* ... Tu código existente ... */ });
// [POST] /api/users
app.post('/api/users', (req, res) => { /* ... Tu código existente ... */ });
// [DELETE] /api/users/:cip
app.delete('/api/users/:cip', (req, res) => { /* ... Tu código existente ... */ });


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

            // --- IMPORTANTE: CONFIGURACIÓN DE CORREO PERSONALIZADA ---
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'francis.swag.05@gmail.com',
                    pass: 'itgoxxnazoxgutxm' // Tu contraseña de aplicación sin espacios
                }
            });
            const mailOptions = {
                from: '"SIMCEP Admin" <francis.swag.05@gmail.com>',
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
app.listen(PORT, () => {
    console.log(`Servidor SIMCEP corriendo en http://localhost:${PORT}`);
});