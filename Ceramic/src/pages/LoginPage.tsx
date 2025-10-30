import React, { useState } from 'react';
import {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonInput, IonButton, useIonToast, IonRouterLink
} from '@ionic/react';
import { useHistory } from 'react-router-dom';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [presentToast] = useIonToast();
    const history = useHistory();

    const handleLogin = async () => {
        try {
            const res = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Invalid credentials');
            }

            const data = await res.json();

            localStorage.setItem('authToken', data.token);
            history.push('/schedules');

        } catch (err: any) {
            presentToast({
                message: err.message,
                duration: 2000,
                color: 'danger',
                position: 'top'
            });
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Login</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" fullscreen>
                <IonList>
                    <IonItem>
                        <IonLabel position="stacked">Username</IonLabel>
                        <IonInput
                            value={username}
                            onIonInput={e => setUsername(e.detail.value!)}
                        />
                    </IonItem>
                    <IonItem>
                        <IonLabel position="stacked">Password</IonLabel>
                        <IonInput
                            type="password"
                            value={password}
                            onIonInput={e => setPassword(e.detail.value!)}
                        />
                    </IonItem>
                </IonList>
                <IonButton expand="block" onClick={handleLogin} style={{ marginTop: '20px' }}>
                    Login
                </IonButton>

                <IonButton
                    expand="block"
                    fill="clear"
                    routerLink="/register"
                    style={{ marginTop: '10px' }}
                >
                    Don't have an account? Register
                </IonButton>
            </IonContent>
        </IonPage>
    );
};

export default LoginPage;