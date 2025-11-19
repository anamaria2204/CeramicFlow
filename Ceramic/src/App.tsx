import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import React, { useEffect } from 'react'; // <-- NOU: Importăm useEffect
import { Network } from '@capacitor/network'; // <-- NOU: Importăm Network
import { syncOfflineData } from './services/SyncService'; // <-- NOU: Importăm funcția de sync

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';


import { ScheduleList } from './schedule';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

setupIonicReact();

const PrivateRoute: React.FC<any> = ({ component: Component, ...rest }) => {
    const isAuthenticated = !!localStorage.getItem('authToken');

    return (
        <Route
            {...rest}
            render={props =>
                isAuthenticated ? (
                    <Component {...props} /> // Dacă e logat, arată componenta
                ) : (
                    <Redirect to="/login" /> // Dacă nu, trimite la login
                )
            }
        />
    );
};

const App: React.FC = () => {
        useEffect(() => {
            const networkListenerPromise = Network.addListener('networkStatusChange', async (status) => {
                if (status.connected) {
                    console.log('Am revenit ONLINE! Încep sincronizarea...');
                    await syncOfflineData();
                } else {
                    console.log('Am intrat în modul OFFLINE.');
                }
            });

            // 2. Facem o verificare inițială la pornire
            const checkInitialStatus = async () => {
                const status = await Network.getStatus();
                if (status.connected) {
                    console.log('Verificare inițială: Suntem online. Încep sincronizarea...');
                    await syncOfflineData();
                }
            };

            checkInitialStatus(); // Apelăm verificarea

            // 3. Curățăm ascultătorul (am eliminat timer-ul)
            return () => {
                // Folosim metoda corectă de a șterge listener-ul
                networkListenerPromise.then(listener => listener.remove());
            };
        }, []);
    return (
        <IonApp>
            <IonReactRouter>
                <IonRouterOutlet>
                    <Route path="/login" component={LoginPage} exact={true} />
                    <Route path="/register" component={RegisterPage} exact={true} />
                    <PrivateRoute path="/schedules" component={ScheduleList} exact={true} />
                    <Route exact path="/" render={() =>
                        !!localStorage.getItem('authToken') ? <Redirect to="/schedules" /> : <Redirect to="/login" />
                    } />

                </IonRouterOutlet>
            </IonReactRouter>
        </IonApp>
    );
}; // <-- NOU: Acolada de închidere

export default App;