// =================================================================================================
// Archivo: server.js (ACTUALIZADO PARA FLY.IO Y USO LOCAL)
// =================================================================================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Configuración del servidor ---
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// --- Conexión y configuración de la Base de Datos SQLite ---
const dbPath = process.env.NODE_ENV === 'production' ? '/data/simcep.db' : './simcep.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error abriendo la base de datos " + err.message);
    } else {
        console.log(`Base de datos conectada exitosamente en: ${dbPath}`);
        db.run(`CREATE TABLE IF NOT EXISTS records (
            cip TEXT PRIMARY KEY,
            grado TEXT,
            apellido TEXT,
            nombre TEXT,
            edad INTEGER,
            peso REAL,
            altura REAL,
            imc REAL,
            sexo TEXT,
            fecha TEXT,
            registradoPor TEXT
        )`, (err) => {
            if (err) console.error("Error creando la tabla: ", err.message);
            else console.log("Tabla 'records' lista para operar.");
        });
        
        // **[NUEVO]** Crear la tabla para los usuarios si no existe
        db.run(`CREATE TABLE IF NOT EXISTS users (
            cip TEXT PRIMARY KEY,
            fullName TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'medico'))
        )`, (err) => {
            if (err) console.error("Error creando la tabla 'users': ", err.message);
            else console.log("Tabla 'users' lista para operar.");
        });
    }
});

// --- Rutas de la API ---

// [GET] /api/records
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY fecha DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});

// [POST] /api/records
app.post('/api/records', (req, res) => {
    const { cip, grado, apellido, nombre, edad, peso, altura, imc, sexo, fecha, registradoPor } = req.body;
    if (!cip) return res.status(400).json({ message: "El CIP es obligatorio." });

    const sql = `INSERT INTO records (cip, grado, apellido, nombre, edad, peso, altura, imc, sexo, fecha, registradoPor) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [cip, grado, apellido, nombre, edad, peso, altura, imc, sexo, fecha, registradoPor];
    
    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: `Error: El CIP '${cip}' ya existe en la base de datos.` });
            }
            return res.status(500).json({ "error": err.message });
        }
        res.status(201).json({ "message": "success", "data": req.body });
    });
});

// [DELETE] /api/records/:cip
app.delete('/api/records/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM records WHERE cip = ?";
    db.run(sql, cip, function (err) {
        if (err) return res.status(500).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ message: "No se encontró un registro con ese CIP." });
        res.json({ message: `Registro con CIP ${cip} eliminado exitosamente.`, changes: this.changes });
    });
});

// --- **[NUEVO]** API para GESTIÓN DE USUARIOS ---

// [POST] /api/login
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) return res.status(400).json({ message: "CIP y contraseña son requeridos." });

    const sql = "SELECT * FROM users WHERE cip = ?";
    db.get(sql, [cip], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({ message: "Login exitoso", user: { cip: user.cip, fullName: user.fullName, role: user.role } });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
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
app.post('/api/users', async (req, res) => {
    const { cip, fullName, password, role } = req.body;
    if (!cip || !fullName || !password || !role) return res.status(400).json({ message: "Todos los campos son requeridos." });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (cip, fullName, password, role) VALUES (?, ?, ?, ?)`;
        
        db.run(sql, [cip, fullName, hashedPassword, role], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                     return res.status(409).json({ message: `El CIP '${cip}' ya está registrado.` });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: `Usuario '${fullName}' creado exitosamente.` });
        });
    } catch {
        res.status(500).json({ error: "Error al encriptar la contraseña." });
    }
});

// [DELETE] /api/users/:cip
app.delete('/api/users/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM users WHERE cip = ?";
    db.run(sql, [cip], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        res.json({ message: `Usuario con CIP ${cip} eliminado.` });
    });
});


// --- Iniciar el servidor ---
app.listen(port, () => {
    console.log(`\n¡Servidor SIMCEP iniciado!`);
    console.log(`Tu aplicación está escuchando en el puerto ${port}`);
});

// ESTE ES UN CAMBIO DE PRUEBA