// =================================================================================================
// Archivo: sistema-imc.js (VERSIÓN FINAL Y COMPLETA)
// =================================================================================================

// --- 1. Variables de Estado Globales ---
let isAuthenticated = false;
let currentAdminUser = null; 
let currentAdminFullName = null; 
let currentUserRole = null;
let allRecordsFromDB = [];
let currentFilteredRecords = [];

// ... (El resto de tus funciones: displayMessage, updateUI, calculateIMC, getAptitude, etc., están bien y no necesitan cambios) ...
// ... (Las funciones attemptAdminLogin, logoutAdmin, fetchAndDisplayRecords, saveRecord, deleteRecord, etc., también están bien) ...
// ... (Las funciones fetchAndDisplayUsers, handleAddUser, handleDeleteUser, etc., también están bien) ...
// ... (Las funciones populateMonthFilter, filterTable, renderTable, exportToWord, también están bien) ...

// [PEGA AQUÍ TODAS LAS FUNCIONES DESDE displayMessage HASTA exportToWord SIN CAMBIOS]
// (Para evitar un bloque de código gigante, solo te mostraré la parte que cambia)


// --- 7. Event Listeners ---

// [CORREGIDO] - Se restauró la lógica del formulario público de IMC
document.getElementById('bmi-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('input-weight').value);
    const height = parseFloat(document.getElementById('input-height').value);
    
    if (weight > 0 && height > 0) {
        const imc = calculateIMC(weight, height);
        const { resultado, detalle } = getAptitude(imc);

        const badgeClass = resultado.includes('INAPTO') ? 'bg-red-600 text-white' : 'bg-green-600 text-white';

        document.getElementById('bmi-value').textContent = imc;
        const aptitudeBadge = document.getElementById('aptitude-badge');
        aptitudeBadge.textContent = resultado;
        aptitudeBadge.className = `px-5 py-2 font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('aptitude-detail').textContent = detalle;

        document.getElementById('result-box').classList.remove('hidden');
    } else {
        displayMessage('Datos Inválidos', 'Por favor, ingrese un peso y altura válidos.', 'error');
    }
});

// Formularios de administración
document.getElementById('admin-record-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!isAuthenticated) {
        displayMessage('Acceso Denegado', 'Debe iniciar sesión para registrar personal.', 'error');
        return;
    }
    const form = e.target;
    const sexo = form.elements['input-sex-admin'].value;
    const cip = form.elements['input-userid'].value;
    const grado = form.elements['input-role'].value;
    const apellido = form.elements['input-lastname'].value;
    const nombre = form.elements['input-firstname'].value;
    const edad = parseInt(form.elements['input-age-admin'].value);
    const peso = parseFloat(form.elements['input-weight-admin'].value);
    const altura = parseFloat(form.elements['input-height-admin'].value);
    if (peso > 0 && altura > 0 && cip && grado && apellido && nombre && edad > 0) {
        const imc = calculateIMC(peso, altura);
        const { resultado, detalle } = getAptitude(imc);
        const badgeClass = getSimplifiedAptitudeStyle(resultado);
        document.getElementById('admin-bmi-value').textContent = imc;
        document.getElementById('admin-aptitude-badge').textContent = resultado;
        document.getElementById('admin-aptitude-badge').className = `aptitude-badge px-3 py-1 text-sm font-bold rounded-full shadow-lg uppercase ${badgeClass}`;
        document.getElementById('admin-aptitude-detail').textContent = detalle;
        document.getElementById('admin-result-box').classList.remove('hidden');
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        const newRecord = { sexo, cip, grado, apellido, nombre, edad, peso, altura, imc, fecha: formattedDate, registradoPor: currentAdminUser };
        saveRecord(newRecord);
    } else {
        displayMessage('Error de Entrada', 'Por favor, complete todos los campos obligatorios.', 'error');
        document.getElementById('admin-result-box').classList.add('hidden');
    }
});

// Botones y filtros existentes
document.getElementById('admin-login-button').addEventListener('click', attemptAdminLogin);
document.getElementById('logout-button').addEventListener('click', logoutAdmin);
document.getElementById('export-word-button').addEventListener('click', exportToWord);
document.getElementById('name-filter').addEventListener('input', filterTable);
document.getElementById('age-filter').addEventListener('input', filterTable);
document.getElementById('month-filter').addEventListener('change', filterTable);

// Event Listener para el formulario de gestión de usuarios
document.getElementById('add-user-form').addEventListener('submit', handleAddUser);

// Listener de carga inicial
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});