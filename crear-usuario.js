// =================================================================================================
// Archivo: crear-usuario.js (VERSIÓN FINAL Y CORREGIDA)
// =================================================================================================

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const readline = require('readline');

// Configuración para la entrada de datos en la terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Conexión a la base de datos
const db = new sqlite3.Database('./simcep', (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
        return;
    }
    console.log("Conectado a la base de datos para crear usuario.");
});

// Función principal para crear el usuario
function crearUsuario() {
    rl.question('Ingrese el CIP del nuevo administrador: ', (cip) => {
        // AQUÍ ESTABA EL ERROR: El parámetro debe ser una sola palabra, como "fullName"
        rl.question('Ingrese el Nombre Completo del nuevo administrador: ', (fullName) => {
            rl.question('Ingrese la contraseña para el nuevo administrador: ', (password) => {
                
                if (!cip || !fullName || !password) {
                    console.error("\n[ERROR] Todos los campos son obligatorios. Proceso cancelado.");
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

                    const sql = "INSERT INTO users (cip, fullName, password, role) VALUES (?, ?, ?, ?)";
                    
                    db.run(sql, [cip, fullName, hash, 'admin'], function(err) {
                        if (err) {
                             if (err.message.includes('UNIQUE constraint failed')) {
                                console.error(`\n[ERROR] El CIP '${cip}' ya existe en la base de datos.`);
                            } else {
                                console.error("\n[ERROR] Error al guardar en la base de datos:", err.message);
                            }
                        } else {
                            console.log(`\n¡ÉXITO! Usuario administrador '${fullName}' (CIP: ${cip}) creado correctamente.`);
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
}

// Inicia el proceso
crearUsuario();