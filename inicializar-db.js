// =================================================================================================
// Archivo: inicializar-db.js (VERSIÓN FINAL Y CORREGIDA PARA FLY.IO)
// =================================================================================================

const sqlite3 = require('sqlite3').verbose();

// [CORREGIDO] Conexión a la base de datos en el volumen persistente de Fly.io
const dbPath = '/data/simcep';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        return console.error("Error al conectar con la base de datos en el volumen:", err.message);
    }
    console.log("Conectado a la base de datos persistente 'simcep' para inicializar.");
});

// Usamos db.serialize para asegurar que los comandos se ejecutan en orden
db.serialize(() => {
    // Comando 1: Crear la tabla de usuarios
    const createUserTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            cip TEXT PRIMARY KEY,
            fullName TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        );
    `;
    db.run(createUserTableSql, (err) => {
        if (err) return console.error("Error al crear la tabla 'users':", err.message);
        console.log("Tabla 'users' verificada/creada exitosamente.");
    });

    // Comando 2: Crear la tabla de registros de IMC (con UNIQUE(cip, fecha))
    const createRecordsTableSql = `
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
    `;
    db.run(createRecordsTableSql, (err) => {
        if (err) return console.error("Error al crear la tabla 'records':", err.message);
        console.log("Tabla 'records' verificada/creada exitosamente.");
    });
});

// Cerrar la conexión
db.close((err) => {
    if (err) return console.error("Error al cerrar la base de datos:", err.message);
    console.log("Base de datos inicializada y conexión cerrada.");
});