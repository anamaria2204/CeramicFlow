import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { storage } from './storage';

const startApp = () => {
    const container = document.getElementById('root');
    const root = createRoot(container!);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

storage.create()
    .then(() => {
        console.log('Storage-ul este inițializat și gata de folosit.');
        startApp();
    })
    .catch(error => {
        console.error('Eroare la inițializarea storage-ului:', error);
        console.warn('Funcționalitatea offline ar putea fi compromisă.');
        startApp();
    });