import React, { useState } from 'react';
import {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonInput, IonButton, useIonToast, IonRouterLink, IonButtons, IonBackButton
} from '@ionic/react';
import { useHistory } from 'react-router-dom';

const RegisterPage: React.FC = () => {
    // Stări pentru câmpurile de input
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Dependințele
    const [presentToast] = useIonToast();
    const history = useHistory();

    const handleRegister = async () => {
        // Verificare simplă pe client
        if (password !== confirmPassword) {
            presentToast({
                message: 'Passwords do not match.',
                duration: 2000,
                color: 'danger',
                position: 'top'
            });
            return;
        }

        if (!username || !password) {
            presentToast({
                message: 'Username and password are required.',
                duration: 2000,
                color: 'danger',
                position: 'top'
            });
            return;
        }

        try {
            // Apelăm endpoint-ul de înregistrare
            const res = await fetch('http://localhost:3000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                // Preluăm mesajul de eroare de la server (ex: "Username already taken")
                const errorData = await res.json();
                throw new Error(errorData.message || 'Registration failed');
            }

            // Înregistrare reușită!
            presentToast({
                message: 'Registration successful! Please log in.',
                duration: 2000,
                color: 'success',
                position: 'top'
            });

            // Redirecționăm utilizatorul la pagina de Login
            history.push('/login');

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
                    {/* Adăugăm un buton de "Înapoi" care duce la Login */}
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/login" />
                    </IonButtons>
                    <IonTitle>Register</IonTitle>
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
                    <IonItem>
                        <IonLabel position="stacked">Confirm Password</IonLabel>
                        <IonInput
                            type="password"
                            value={confirmPassword}
                            onIonInput={e => setConfirmPassword(e.detail.value!)}
                        />
                    </IonItem>
                </IonList>
                <IonButton expand="block" onClick={handleRegister} style={{ marginTop: '20px' }}>
                    Register
                </IonButton>
            </IonContent>
        </IonPage>
    );
};

export default RegisterPage;