// =================================================================================================
// Archivo: server.js (COMPLETO Y ACTUALIZADO PARA FLY.IO CON VOLUMEN PERSISTENTE)
// =================================================================================================

// --- 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = process.env.PORT || 3000; 

// --- 2. MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '/'))); 

// --- 3. CONEXIÓN A LA BASE DE DATOS SQLITE (MODIFICADO PARA VOLUMEN PERSISTENTE) ---
// La ruta ahora apunta a la carpeta /data donde el volumen está montado en Fly.io.
const dbPath = '/data/simcep';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos en el volumen:", err.message);
    } else {
        console.log("Conexión a la base de datos SQLite en el volumen '/data' establecida con éxito.");
        // Opcional: Asegurarse de que las tablas existan al iniciar el servidor
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                cip TEXT PRIMARY KEY,
                fullName TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sexo TEXT,
                cip TEXT,
                grado TEXT,
                apellido TEXT,
                nombre TEXT,
                edad INTEGER,
                peso REAL,
                altura REAL,
                imc REAL,
                fecha TEXT,
                registradoPor TEXT,
                UNIQUE(cip, fecha)
            );
        `, (err) => {
            if (err) {
                console.error("Error al asegurar las tablas en la base de datos:", err.message);
            } else {
                console.log("Tablas 'users' y 'records' verificadas/creadas en el volumen.");
            }
        });
    }
});


// --- 4. RUTAS DE LA API ---

// == RUTAS EXISTENTES PARA LOS REGISTROS DE IMC ==

// [GET] /api/records - Obtiene todos los registros de IMC
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY fecha DESC, id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// [POST] /api/records - Guarda un nuevo registro de IMC
app.post('/api/records', (req, res) => {
    const { sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor } = req.body;
    // He corregido un pequeño error en tu diseño original: El CIP no puede ser UNIQUE por sí solo
    // si quieres registrar el mismo personal en diferentes fechas. La combinación de CIP y Fecha debe ser única.
    // La sentencia CREATE TABLE de arriba ya lo refleja con UNIQUE(cip, fecha).
    const sql = `INSERT INTO records (sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: `El CIP ${cip} ya tiene un registro en la fecha ${fecha}.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Registro guardado exitosamente", id: this.lastID });
    });
});

// [DELETE] /api/records/:cip - Elimina un registro por su CIP
app.delete('/api/records/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM records WHERE cip = ?";

    db.run(sql, cip, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Registro no encontrado para el CIP proporcionado." });
        }
        res.json({ message: `Registro con CIP ${cip} eliminado.` });
    });
});


// == RUTA DE LOGIN ==

// [POST] /api/login - Maneja el inicio de sesión de forma segura
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) {
        return res.status(400).json({ message: "CIP y contraseña son requeridos." });
    }

    const sql = "SELECT * FROM users WHERE cip = ?";
    db.get(sql, [cip], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ message: "Credenciales de Usuario o Clave incorrectas." });
        }

        bcrypt.compare(password, user.password, (bcryptErr, result) => {
            if (bcryptErr) {
                return res.status(500).json({ message: "Error del servidor al verificar la contraseña." });
            }
            
            if (result) {
                res.json({
                    message: "Login exitoso",
                    user: { cip: user.cip, fullName: user.fullName, role: user.role }
                });
            } else {
                res.status(401).json({ message: "Credenciales de Usuario o Clave incorrectas." });
            }
        });
    });
});

// == RUTAS PARA GESTIÓN DE USUARIOS ==

// [GET] /api/users - Obtiene todos los usuarios (de forma segura, sin contraseñas)
app.get('/api/users', (req, res) => {
    const sql = "SELECT cip, fullName, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// [POST] /api/users - Crea un nuevo usuario con contraseña encriptada
app.post('/api/users', (req, res) => {
    const { cip, fullName, password } = req.body;
    if (!cip || !fullName || !password) {
        return res.status(400).json({ message: "Todos los campos son requeridos." });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ message: "Error al encriptar la contraseña." });
        }

        const sql = "INSERT INTO users (cip, fullName, password, role) VALUES (?, ?, ?, ?)";
        db.run(sql, [cip, fullName, hash, 'admin'], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: `El CIP ${cip} ya está registrado.` });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Usuario creado exitosamente", cip: cip });
        });
    });
});

// [DELETE] /api/users/:cip - Elimina un usuario por su CIP
app.delete('/api/users/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM users WHERE cip = ?";

    db.run(sql, cip, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        res.json({ message: `Usuario con CIP ${cip} eliminado.` });
    });
});


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor SIMCEP corriendo en http://localhost:${PORT}`);
});