// =================================================================================================
// Archivo: inicializar-db.js (Ejecutar SOLO UNA VEZ para crear las tablas)
// =================================================================================================

const sqlite3 = require('sqlite3').verbose();

// Conectarse a la base de datos (la creará si no existe)
const db = new sqlite3.Database('./simcep', (err) => {
    if (err) {
        return console.error("Error al conectar con la base de datos:", err.message);
    }
    console.log("Conectado a la base de datos SQLite 'simcep'.");
});

// Usamos db.serialize para asegurar que los comandos se ejecutan en orden
db.serialize(() => {
    // Comando SQL para crear la tabla de usuarios
    // IF NOT EXISTS es una medida de seguridad para no borrar la tabla si ya existe
    const createUserTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            cip TEXT PRIMARY KEY,
            fullName TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        );
    `;

    // Ejecutar el comando
    db.run(createUserTableSql, (err) => {
        if (err) {
            return console.error("Error al crear la tabla 'users':", err.message);
        }
        console.log("Tabla 'users' verificada/creada exitosamente.");
    });
});

// Cerrar la conexión a la base de datos
db.close((err) => {
    if (err) {
        return console.error("Error al cerrar la base de datos:", err.message);
    }
    console.log("Base de datos inicializada y conexión cerrada.");
});