import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonIcon, IonModal, IonButton,
    IonDatetime, IonList, IonItem, IonLabel, useIonToast, IonSelect, IonSelectOption, IonFab, IonFabButton, IonBadge, IonInput
} from '@ionic/react';
import React, { useEffect, useState, useRef } from 'react';
import { calendarOutline, notificationsOutline } from 'ionicons/icons';
import ScheduleItem from './ScheduleItem';
import { Schedule } from './Schedule';
import { CeramicObject } from '../object/CeramicObject';

const ScheduleList: React.FC = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showObjectSelector, setShowObjectSelector] = useState(false);
    const [selectedObjectType, setSelectedObjectType] = useState<string>('');
    const [presentToast] = useIonToast();
    const clientId = '123';
    const wsRef = useRef<WebSocket | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [ceramicObjectDetails, setCeramicObjectDetails] = useState<CeramicObject | null>(null);
    const [editableReminders, setEditableReminders] = useState<boolean>(false);

    const [allCeramicObjects, setAllCeramicObjects] = useState<CeramicObject[]>([]);
    const [notifications, setNotifications] = useState<CeramicObject[]>([]);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const fetchAllSchedules = async () => {
        try {
            // Preluăm TOATE programările, fără a specifica o dată
            const res = await fetch(`http://localhost:3000/schedules?clientId=${clientId}`);
            if (!res.ok) throw new Error("Failed to fetch schedules");
            const data: Schedule[] = await res.json();
            data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());            setSchedules(data);
        } catch (err) { console.error('Error fetching schedules:', err); }
    };

    const fetchAllCeramicObjects = async () => {
        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects`);
            if (!res.ok) throw new Error("Failed to fetch ceramic objects");
            const data: CeramicObject[] = await res.json();
            setAllCeramicObjects(data);
        } catch (err) { console.error('Error fetching all ceramic objects:', err); }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch(`http://localhost:3000/notifications`);
            if (!res.ok) throw new Error("Failed to fetch notifications");
            const data: CeramicObject[] = await res.json();
            setNotifications(data);
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
        fetchNotifications();
    }, []); // Se execută o singură dată, la încărcarea componentei

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000');
        wsRef.current = ws;
        ws.onopen = () => console.log("WebSocket connected");
        ws.onmessage = () => {
            console.log("Received update from server");
            fetchAllSchedules();
            fetchAllCeramicObjects();
            fetchNotifications();
        };
        ws.onclose = () => console.log("WebSocket closed");
        return () => ws.close();
    }, []);

    const handleOpenNotifications = () => {
        setShowNotificationsModal(true);
    };

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        fetchAvailability(date); // Actualizăm disponibilitatea pentru noua dată selectată
    };

    const handleSlotSelect = (slot: string) => {
        setSelectedSlot(slot);
        setShowObjectSelector(true);
    };

    const handleSchedule = async () => {
        if (!selectedSlot || !selectedObjectType) {
            alert('Please select a time and an object type.');
            return;
        }
        const newSchedule = {
            clientId,
            name: `Schedule for ${selectedObjectType}`,
            date: selectedDate,
            hour: new Date(`${selectedDate}T${selectedSlot}`).toISOString(),
            objectType: selectedObjectType,
            status: 'Scheduled',
        };
        try {
            const response = await fetch('http://localhost:3000/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSchedule),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'An error occurred.');
            }
            presentToast({ message: 'Schedule created successfully!', duration: 3000, color: 'success', position: 'top' });

            fetchAllSchedules(); // Reîncărcăm întreaga listă

            setShowDatePicker(false);
            setShowObjectSelector(false);
            setSelectedSlot(null);
            setSelectedObjectType('');
        } catch (error: any) {
            presentToast({ message: `Error: ${error.message}`, duration: 3000, color: 'danger', position: 'top' });
        }
    };

    const handleShowDetails = async (schedule: Schedule) => {
        if (!schedule.id) return;
        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects/${schedule.id}`);
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
        if (!ceramicObjectDetails) return;
        try {
            const res = await fetch(`http://localhost:3000/ceramic-objects/${ceramicObjectDetails.scheduleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    remindersScheduled: editableReminders
                })
            });
            if (!res.ok) throw new Error("Could not save changes");
            presentToast({ message: 'Settings saved successfully!', duration: 2000, color: 'success' });
            setShowDetailsModal(false);
        } catch (error: any) {
            presentToast({ message: `Save failed: ${error.message}`, duration: 3000, color: 'danger' });
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>CeramicFlow</IonTitle>
                    <IonButton slot="end" fill="clear" onClick={handleOpenNotifications}>
                        <IonIcon icon={notificationsOutline} />
                        {notifications.length > 0 && <IonBadge color="danger">{notifications.length}</IonBadge>}
                    </IonButton>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" fullscreen>
                {schedules.map(schedule => {
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
                                {notifications.map(notif => (
                                    <IonItem key={notif.id}>
                                        <IonLabel>
                                            <h2>{notif.name}</h2>
                                            <p>Your object has progressed to the <strong>{notif.currentStage}</strong> stage.</p>
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