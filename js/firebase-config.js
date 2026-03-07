// js/firebase-config.js
// Exporta las variables globales de Firebase (inicializadas en index.html)

// Verificar que Firebase se inicializó correctamente
if (!window.db || !window.auth || !window.provider) {
  console.warn('⚠️ Firebase no se inicializó en index.html. Verifica el script modular.');
}

// Exportar variables globales para que app.js pueda importarlas
export const db = window.db;
export const auth = window.auth;
export const provider = window.provider;