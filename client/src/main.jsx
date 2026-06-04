/** @file Punto de entrada de la aplicacion. Monta el componente raiz App en el nodo #root del DOM. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
