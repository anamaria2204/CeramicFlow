import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { storage } from './storage';

defineCustomElements(window);

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
        startApp();
    });