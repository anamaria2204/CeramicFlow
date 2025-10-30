import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonIcon, IonModal, IonButton,
    IonDatetime, IonList, IonItem, IonLabel, useIonToast, IonSelect, IonSelectOption, IonFab,
    IonFabButton, IonBadge, IonSegment, IonSegmentButton
} from '@ionic/react';
import React, { useEffect, useState, useRef } from 'react';
import ScheduleItem from './ScheduleItem';
import { Schedule } from './Schedule';
import { CeramicObject } from '../object/CeramicObject';
import { calendarOutline, notificationsOutline, wifiOutline, warningOutline, logOutOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const ScheduleList: React.FC = () => {
    const history = useHistory();

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showObjectSelector, setShowObjectSelector] = useState(false);
    const [selectedObjectType, setSelectedObjectType] = useState<string>('');
    const [presentToast] = useIonToast();
    const wsRef = useRef<WebSocket | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [ceramicObjectDetails, setCeramicObjectDetails] = useState<CeramicObject | null>(null);
    const [editableReminders, setEditableReminders] = useState<boolean>(false);

    const [allCeramicObjects, setAllCeramicObjects] = useState<CeramicObject[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const [activeSegment, setActiveSegment] = useState<'pending' | 'active'>('pending');
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [loggedInUsername, setLoggedInUsername] = useState<string>('');

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        wsRef.current?.close();
        history.push('/login');
    };

    const fetchAllSchedules = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();

        try {
            const res = await fetch(`http://localhost:3000/schedules`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch schedules");

            const data: Schedule[] = await res.json();
            data.sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());
            setSchedules(data);
        } catch (err) { console.error('Error fetching schedules:', err); }
    };

    const fetchAllCeramicObjects = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();

        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch ceramic objects");

            const data: CeramicObject[] = await res.json();
            setAllCeramicObjects(data);
        } catch (err) { console.error('Error fetching all ceramic objects:', err); }
    };

    const fetchNotifications = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();

        try {
            const res = await fetch(`http://localhost:3000/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch notifications");

            const newNotifications: any[] = await res.json();
            if (newNotifications.length > 0) {
                setNotifications(prevNotifications => [...prevNotifications, ...newNotifications]);
            }
        } catch (err) { console.error('Error fetching notifications:', err); }
    };

    const fetchAvailability = async (date: string) => {
        try {
            const res = await fetch(`http://localhost:3000/availability?date=${date}`);
            const data: string[] = await res.json();
            setAvailableSlots(data);
        } catch (err) { console.error('Error fetching availability:', err); }
    };

    useEffect(() => {
        fetchAllSchedules();
        fetchAllCeramicObjects();
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];

                const decodedPayload = atob(payloadBase64);

                const parsedPayload = JSON.parse(decodedPayload);

                if (parsedPayload.username) {
                    setLoggedInUsername(parsedPayload.username);
                }
            } catch (error) {
                console.error('Failed to parse auth token:', error);
                handleLogout();
            }
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            handleLogout();
            return;
        }

        const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => console.log("WebSocket connected");
        ws.onmessage = (event) => {
            console.log("Received update from server", event.data);
            fetchAllSchedules();
            fetchAllCeramicObjects();
            fetchNotifications();
        };
        ws.onclose = () => console.log("WebSocket closed");
        return () => {
            ws.close();
        };
    }, []);

    useEffect(() => {
        if (showDatePicker) {
            fetchAvailability(selectedDate);
        }
    }, [showDatePicker]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            presentToast({ message: 'You are back online!', duration: 2000, color: 'success', position: 'top' });
        };
        const handleOffline = () => {
            setIsOnline(false);
            presentToast({ message: 'You are now offline.', duration: 2000, color: 'danger', position: 'top' });
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [presentToast]);

    const handleOpenNotifications = () => {
        setShowNotificationsModal(true);
    };

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        fetchAvailability(date);
    };

    const handleSlotSelect = (slot: string) => {
        setSelectedSlot(slot);
        setShowObjectSelector(true);
    };

    const handleSchedule = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();

        if (!selectedSlot || !selectedObjectType) {
            alert('Please select a time and an object type.');
            return;
        }
        const newSchedule = {
            name: `Schedule for ${selectedObjectType}`,
            date: selectedDate,
            hour: new Date(`${selectedDate}T${selectedSlot}`).toISOString(),
            objectType: selectedObjectType,
            status: 'Scheduled',
        };
        try {
            const response = await fetch('http://localhost:3000/schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newSchedule),
            });

            if (response.status === 401 || response.status === 403) return handleLogout();
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'An error occurred.');
            }

            presentToast({ message: 'Schedule created successfully!', duration: 3000, color: 'success', position: 'top' });
            fetchAllSchedules();
            setShowDatePicker(false);
            setShowObjectSelector(false);
            setSelectedSlot(null);
            setSelectedObjectType('');
        } catch (error: any) {
            presentToast({ message: `Error: ${error.message}`, duration: 3000, color: 'danger', position: 'top' });
        }
    };

    const handleShowDetails = async (schedule: Schedule) => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        if (!schedule.id) return;

        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects/${schedule.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Could not fetch object details");

            const data: CeramicObject = await res.json();
            setCeramicObjectDetails(data);
            setEditableReminders(data.remindersScheduled);
            setShowDetailsModal(true);
        } catch (error: any) {
            presentToast({ message: error.message, duration: 3000, color: 'danger' });
        }
    };

    const handleUpdateDetails = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        if (!ceramicObjectDetails) return;

        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects/${ceramicObjectDetails.scheduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    remindersScheduled: editableReminders
                })
            });

            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Could not save changes");

            presentToast({ message: 'Settings saved successfully!', duration: 2000, color: 'success' });
            setShowDetailsModal(false);
            fetchAllCeramicObjects();
        } catch (error: any) {
            presentToast({ message: `Save failed: ${error.message}`, duration: 3000, color: 'danger' });
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButton slot="start" fill="clear" color={isOnline ? 'success' : 'danger'}>
                        <IonIcon icon={isOnline ? wifiOutline : warningOutline} />
                    </IonButton>
                    <IonTitle>
                        CeramicFlow
                        <span style={{ fontSize: '0.6em', fontWeight: 'normal', display: 'block', opacity: 0.9 }}>
                            Hello, {loggedInUsername}
                        </span>
                    </IonTitle>
                    <IonButton slot="end" fill="clear" onClick={handleOpenNotifications}>
                        <IonIcon icon={notificationsOutline} />
                        {notifications.length > 0 && <IonBadge color="danger">{notifications.length}</IonBadge>}
                    </IonButton>

                    <IonButton slot="end" onClick={handleLogout} color="danger" fill="clear">
                        <IonIcon icon={logOutOutline} />
                    </IonButton>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" fullscreen>

                <IonSegment
                    value={activeSegment}
                    onIonChange={e => setActiveSegment(e.detail.value as any)}
                    style={{ marginBottom: '10px' }}
                >
                    <IonSegmentButton value="pending">
                        <IonLabel>Scheduled</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="active">
                        <IonLabel>Next Stage</IonLabel>
                    </IonSegmentButton>
                </IonSegment>

                {activeSegment === 'pending' && schedules.filter(s => s.status === 'Scheduled').map(schedule => {
                    const ceramicObject = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);
                    return (
                        <ScheduleItem
                            key={schedule.id}
                            schedule={schedule}
                            onClick={() => handleShowDetails(schedule)}
                            currentStage={ceramicObject?.currentStage}
                        />
                    );
                })}

                {activeSegment === 'active' && schedules.filter(s => s.status !== 'Scheduled').map(schedule => {
                    const ceramicObject = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);
                    return (
                        <ScheduleItem
                            key={schedule.id}
                            schedule={schedule}
                            onClick={() => handleShowDetails(schedule)}
                            currentStage={ceramicObject?.currentStage}
                        />
                    );
                })}

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton onClick={() => setShowDatePicker(true)}>
                        <IonIcon icon={calendarOutline} />
                    </IonFabButton>
                </IonFab>

                <IonModal isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Select date and time</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setShowDatePicker(false)}>Close</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <IonDatetime
                            value={selectedDate}
                            onIonChange={e => handleDateChange(e.detail.value as string)}
                            presentation="date"
                            min={new Date().toISOString().split('T')[0]}
                            showDefaultTitle={false}
                        />
                        <h3 style={{ marginTop: '20px' }}>Available hours:</h3>
                        <IonList>
                            {(() => {
                                const isToday = selectedDate === new Date().toISOString().split('T')[0];
                                const currentHour = new Date().getHours();
                                const filteredSlots = availableSlots.filter(slot => {
                                    if (!isToday) return true;
                                    const slotHour = parseInt(slot.split(':')[0]);
                                    return slotHour > currentHour;
                                });
                                if (filteredSlots.length > 0) {
                                    return filteredSlots.map(slot => (
                                        <IonItem button key={slot} onClick={() => handleSlotSelect(slot)}>
                                            <IonLabel>{slot}</IonLabel>
                                        </IonItem>
                                    ));
                                } else {
                                    return <IonItem><IonLabel>No available slots</IonLabel></IonItem>;
                                }
                            })()}
                        </IonList>
                    </IonContent>
                </IonModal>

                <IonModal isOpen={showObjectSelector} onDidDismiss={() => setShowObjectSelector(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Finalize schedule</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setShowObjectSelector(false)}>Cancel</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <p>You selected <strong>{new Date(selectedDate).toLocaleDateString()}</strong> at <strong>{selectedSlot}</strong>.</p>
                        <IonList>
                            <IonItem>
                                <IonLabel position="stacked">Choose the object type</IonLabel>
                                <IonSelect
                                    value={selectedObjectType}
                                    placeholder="Select one"
                                    onIonChange={e => setSelectedObjectType(e.detail.value)}
                                >
                                    <IonSelectOption value="Mug">Mug</IonSelectOption>
                                    <IonSelectOption value="Vase">Vase</IonSelectOption>
                                    <IonSelectOption value="Plate">Plate</IonSelectOption>
                                </IonSelect>
                            </IonItem>
                        </IonList>
                        <IonButton
                            expand="block"
                            onClick={handleSchedule}
                            disabled={!selectedObjectType}
                            style={{ marginTop: '20px' }}
                        >
                            Confirm Schedule
                        </IonButton>
                    </IonContent>
                </IonModal>

                <IonModal isOpen={showDetailsModal} onDidDismiss={() => setShowDetailsModal(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Object Details</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setShowDetailsModal(false)}>Close</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        {ceramicObjectDetails ? (
                            <>
                                <IonList>
                                    <IonItem>
                                        <IonLabel position="stacked">Object Name</IonLabel>
                                        <p style={{ textTransform: 'capitalize' }}>{ceramicObjectDetails.name}</p>
                                    </IonItem>
                                    <IonItem>
                                        <IonLabel>Current Stage:</IonLabel>
                                        <p style={{ textTransform: 'capitalize' }}>{ceramicObjectDetails.currentStage}</p>
                                    </IonItem>
                                    <IonItem>
                                        <IonLabel>Reminders On</IonLabel>
                                        <IonSelect
                                            value={editableReminders}
                                            onIonChange={e => setEditableReminders(e.detail.value)}
                                        >
                                            <IonSelectOption value={true}>Yes</IonSelectOption>
                                            <IonSelectOption value={false}>No</IonSelectOption>
                                        </IonSelect>
                                    </IonItem>
                                </IonList>
                                <IonButton expand="block" onClick={handleUpdateDetails} style={{ marginTop: '20px' }}>
                                    Save Changes
                                </IonButton>
                            </>
                        ) : <p>Loading details...</p>}
                    </IonContent>
                </IonModal>

                <IonModal isOpen={showNotificationsModal} onDidDismiss={() => {
                    setShowNotificationsModal(false);
                    setNotifications([]);
                }}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Notifications</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setShowNotificationsModal(false)}>Close</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        {notifications.length > 0 ? (
                            <IonList>
                                {notifications.map((notif: any, index) => (
                                    <IonItem key={`${notif.id}-${index}`}>
                                        <IonLabel>
                                            <h2>{notif.name}</h2>
                                            <p>{notif.message}</p>
                                        </IonLabel>
                                    </IonItem>
                                ))}
                            </IonList>
                        ) : (
                            <p>No new updates.</p>
                        )}
                    </IonContent>
                </IonModal>

            </IonContent>
        </IonPage>
    );
};

export default ScheduleList;