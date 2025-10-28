// [POST] /api/login - Maneja el inicio de sesión de forma segura (VERSIÓN CORREGIDA)
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

        // Comparamos la contraseña enviada con la encriptada en la BD
        bcrypt.compare(password, user.password, (bcryptErr, result) => {
            if (bcryptErr) {
                // Si hay un error en el proceso de bcrypt
                return res.status(500).json({ message: "Error del servidor al verificar la contraseña." });
            }
            
            if (result) {
                // Contraseña correcta: enviamos los datos del usuario (SIN la contraseña)
                res.json({
                    message: "Login exitoso",
                    user: { cip: user.cip, fullName: user.fullName, role: user.role }
                });
            } else {
                // Contraseña incorrecta
                res.status(401).json({ message: "Credenciales de Usuario o Clave incorrectas." });
            }
        });
    });
});