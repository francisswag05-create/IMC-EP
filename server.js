// =================================================================================================
// Archivo: server.js (COMPLETO Y ACTUALIZADO)
// =================================================================================================

// --- 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors'); // Se recomienda para flexibilidad en el desarrollo

const app = express();
const PORT = process.env.PORT || 3000; // Puerto para el servidor

// --- 2. MIDDLEWARE ---
app.use(cors()); // Habilita CORS para todas las rutas
app.use(express.json()); // Permite al servidor entender y procesar JSON
// Sirve los archivos estáticos (HTML, CSS, JS del cliente) desde el directorio raíz
app.use(express.static(path.join(__dirname, '/'))); 

// --- 3. CONEXIÓN A LA BASE DE DATOS SQLITE ---
// Asegúrate de que tu archivo de base de datos se llame 'simcep' y esté en la misma carpeta
const db = new sqlite3.Database('./simcep', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
    } else {
        console.log("Conexión a la base de datos SQLite establecida con éxito.");
    }
});


// --- 4. RUTAS DE LA API ---

// == RUTAS EXISTENTES PARA LOS REGISTROS DE IMC ==

// [GET] /api/records - Obtiene todos los registros de IMC
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY fecha DESC"; // Asumiendo que tu tabla se llama 'records'
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


// == RUTA DE LOGIN (TU CÓDIGO) ==

// [POST] /api/login - Maneja el inicio de sesión de forma segura
app.post('/api/login', (req, res) => {
    const { cip, password } = req.body;
    if (!cip || !password) {
        return res.status(400).json({ message: "CIP y contraseña son requeridos." });
    }

    const sql = "SELECT * FROM users WHERE cip = ?"; // Asumiendo que tu tabla de usuarios se llama 'users'
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

// =========== INICIO DE LAS NUEVAS RUTAS PARA GESTIÓN DE USUARIOS ===========

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

    // Encriptamos la nueva contraseña antes de guardarla
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ message: "Error al encriptar la contraseña." });
        }

        const sql = "INSERT INTO users (cip, fullName, password, role) VALUES (?, ?, ?, ?)";
        // Por defecto, creamos usuarios con el rol 'admin'
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

// =========== FIN DE LAS NUEVAS RUTAS PARA GESTIÓN DE USUARIOS ===========


// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor SIMCEP corriendo en http://localhost:${PORT}`);
});