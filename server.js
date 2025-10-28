// =================================================================================================
// Archivo: server.js (COMPLETO Y ACTUALIZADO CON ROLES DE USUARIO)
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

app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY fecha DESC, id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/records', (req, res) => {
    const { sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha, registradoPor } = req.body;
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


// == RUTA DE LOGIN (MODIFICADA PARA INCLUIR EL ROL) ==

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
                // [MODIFICACIÓN CLAVE]
                // Ahora la respuesta incluye el 'role' del usuario.
                // El frontend usará esto para decidir si muestra o no la sección de gestión de usuarios.
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

app.get('/api/users', (req, res) => {
    const sql = "SELECT cip, fullName, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
    const { cip, fullName, password } = req.body;
    if (!cip || !fullName || !password) {
        return res.status(400).json({ message: "Todos los campos son requeridos." });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ message: "Error al encriptar la contraseña." });
        }

        // Todos los nuevos usuarios creados desde la web tendrán el rol 'admin' por defecto.
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