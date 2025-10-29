// migrate.js
const sqlite3 = require('sqlite3').verbose();
const dbPath = '/data/simcep';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
        return;
    }
    console.log("Conexión a la base de datos establecida. Iniciando migración...");

    const migrationCommands = [
        "ALTER TABLE records ADD COLUMN gguu TEXT",
        "ALTER TABLE records ADD COLUMN unidad TEXT",
        "ALTER TABLE records ADD COLUMN dni TEXT",
        "ALTER TABLE records ADD COLUMN pa TEXT",
        "ALTER TABLE records ADD COLUMN pab REAL",
        "ALTER TABLE records ADD COLUMN paClasificacion TEXT",
        "ALTER TABLE records ADD COLUMN riesgoAEnf TEXT"
    ];

    db.serialize(() => {
        let successful = true;
        migrationCommands.forEach((cmd) => {
            db.run(cmd, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error(`❌ ERROR al ejecutar: ${cmd}. Mensaje: ${err.message}`);
                    successful = false;
                } else if (err && err.message.includes('duplicate column name')) {
                    console.log(`✅ Columna ya existe (ignorando): ${cmd.split(' ')[4]}`);
                } else {
                    console.log(`✅ ÉXITO: ${cmd}`);
                }
            });
        });

        db.close((err) => {
            if (err) {
                console.error("Error al cerrar la conexión:", err.message);
            }
            if (successful) {
                console.log("\n🎉 MIGACIÓN COMPLETADA. Las nuevas columnas están en la BD.");
            } else {
                console.log("\n⚠️ MIGACIÓN COMPLETADA CON ALGUNOS ERRORES (Revisar logs).");
            }
        });
    });
});