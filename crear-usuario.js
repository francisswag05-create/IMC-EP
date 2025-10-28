// =================================================================================================
// Archivo: crear-usuario.js (VERSIÓN FINAL CON CAMPO DE EMAIL)
// =================================================================================================

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const readline = require('readline');

// Configuración para la entrada de datos en la terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Conexión a la base de datos en el volumen persistente de Fly.io
const dbPath = '/data/simcep';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos en el volumen:", err.message);
        return;
    }
    console.log("Conectado a la base de datos persistente para crear usuario.");
});

// Función principal para crear el usuario
function crearUsuario() {
    rl.question('Ingrese el CIP del superadministrador: ', (cip) => {
        rl.question('Ingrese el Nombre Completo: ', (fullName) => {
            // [NUEVA PREGUNTA] - Pedimos el correo electrónico
            rl.question('Ingrese el Correo Electrónico (para recuperación): ', (email) => {
                rl.question('Ingrese la contraseña: ', (password) => {
                    
                    if (!cip || !fullName || !password || !email) {
                        console.error("\n[ERROR] Todos los campos (CIP, Nombre, Email, Contraseña) son obligatorios. Proceso cancelado.");
                        rl.close();
                        db.close();
                        return;
                    }

                    console.log("\nEncriptando contraseña...");

                    bcrypt.hash(password, 10, (err, hash) => {
                        if (err) {
                            console.error("\n[ERROR] Error al encriptar la contraseña:", err);
                            rl.close();
                            db.close();
                            return;
                        }

                        console.log("Contraseña encriptada. Guardando en la base de datos...");

                        // [MODIFICADO] - La consulta ahora incluye el campo 'email'
                        const sql = "INSERT INTO users (cip, fullName, password, role, email) VALUES (?, ?, ?, ?, ?)";
                        
                        // [MODIFICADO] - Añadimos el email a los parámetros de la consulta
                        db.run(sql, [cip, fullName, hash, 'superadmin', email], function(err) {
                            if (err) {
                                 if (err.message.includes('UNIQUE constraint failed')) {
                                    console.error(`\n[ERROR] El CIP o el Correo Electrónico ya existe en la base de datos.`);
                                } else {
                                    console.error("\n[ERROR] Error al guardar en la base de datos:", err.message);
                                }
                            } else {
                                console.log(`\n¡ÉXITO! Usuario SUPERADMINISTRADOR '${fullName}' (CIP: ${cip}) creado correctamente.`);
                            }
                            
                            rl.close();
                            db.close((err) => {
                                if (err) console.error("Error al cerrar la base de datos:", err.message);
                                else console.log("Desconectado de la base de datos.");
                            });
                        });
                    });
                });
            });
        });
    });
}

// Inicia el proceso
crearUsuario();