// ============================================================
// frontend/src/main.jsx - Punto de Entrada Principal de React
// ============================================================
// Este archivo es el punto de inicio de la aplicación frontend.
// Inicializa React 18, renderiza el componente raíz <App />
// y enlaza los estilos globales index.css al DOM de la página.
// ============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Importación de la hoja de estilos global
import App from './App.jsx' // Componente principal de la aplicación

// Crea el contenedor raíz de React apuntando al 'div' con id 'root' en index.html
createRoot(document.getElementById('root')).render(
  // <StrictMode> ayuda a identificar problemas potenciales en la aplicación durante desarrollo
  <StrictMode>
    <App />
  </StrictMode>,
)
