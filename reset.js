document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        displayMessage('Error', 'Token no proporcionado o inválido.', 'error');
        return;
    }
    document.getElementById('reset-token').value = token;

    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword.length < 6) {
            return displayMessage('Error', 'La contraseña debe tener al menos 6 caracteres.', 'error');
        }
        if (newPassword !== confirmPassword) {
            return displayMessage('Error', 'Las contraseñas no coinciden.', 'error');
        }

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: newPassword })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            displayMessage('Éxito', data.message, 'success');
            document.getElementById('reset-form').style.display = 'none'; // Oculta el formulario
            setTimeout(() => { window.location.href = '/'; }, 4000);
        } catch (error) {
            displayMessage('Error', error.message, 'error');
        }
    });
});

function displayMessage(title, text, type) {
    const box = document.getElementById('message-box');
    const color = type === 'error' ? 'bg-red-600' : 'bg-green-600';
    box.className = `p-4 rounded-lg shadow-xl text-white ${color}`;
    box.innerHTML = `<p class="font-bold">${title}</p><p class="text-sm">${text}</p>`;
    box.classList.remove('hidden');
}