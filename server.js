// =================================================================================================
// Archivo: server.js (ACTUALIZADO PARA FLY.IO Y USO LOCAL)
// =================================================================================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// --- Configuración del servidor ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '')));

// --- Conexión y configuración de la Base de Datos SQLite ---
// **[CORREGIDO]** Esta lógica elige la ruta correcta para la base de datos.
// Si está en producción (en Fly.io), usa la carpeta /data. Si no, la usa localmente.
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
    }
});

// --- Rutas de la API ---

// [GET] /api/records - Obtiene todos los registros
app.get('/api/records', (req, res) => {
    const sql = "SELECT * FROM records ORDER BY fecha DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

// [POST] /api/records - Guarda un nuevo registro
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
            res.status(500).json({ "error": err.message });
            return;
        }
        res.status(201).json({ "message": "success", "data": req.body });
    });
});

// [DELETE] /api/records/:cip - Elimina un registro por su CIP
app.delete('/api/records/:cip', (req, res) => {
    const { cip } = req.params;
    const sql = "DELETE FROM records WHERE cip = ?";

    db.run(sql, cip, function (err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "No se encontró un registro con ese CIP." });
        }
        res.json({ message: `Registro con CIP ${cip} eliminado exitosamente.`, changes: this.changes });
    });
});


// --- Iniciar el servidor ---
// **[CORREGIDO]** Se ajusta el puerto para que sea compatible con Fly.io
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`\n¡Servidor SIMCEP iniciado!`);
    console.log(`Tu aplicación está escuchando en el puerto ${port}`);
});

// ESTE ES UN CAMBIO DE PRUEBA