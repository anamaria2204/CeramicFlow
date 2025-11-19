import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonIcon, IonModal, IonButton,
    IonDatetime, IonList, IonItem, IonLabel, useIonToast, IonSelect, IonSelectOption, IonFab,
    IonFabButton, IonBadge, IonSegment, IonSegmentButton,
    useIonAlert,
    IonGrid, IonRow, IonCol,
    IonFooter,
    IonSearchbar,
    IonButtons,
} from '@ionic/react';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ScheduleItem from './ScheduleItem';
import { Schedule } from './Schedule';
import { CeramicObject } from '../object/CeramicObject';
import {
    calendarOutline, notificationsOutline, wifiOutline, warningOutline, logOutOutline,
    chevronBackOutline, chevronForwardOutline,
    filterOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

import { saveData, deleteData } from '../services/SyncService';
import { storage } from '../storage'; // Importăm storage-ul local

const API_BASE_URL = 'http://localhost:3000';
const ITEMS_PER_PAGE = 3;

const ScheduleList: React.FC = () => {
    const history = useHistory();
    const [presentToast] = useIonToast();
    const wsRef = useRef<WebSocket | null>(null);

    // --- MODIFICARE AICI: Am adăugat un ref pentru modalul de dată ---
    const filterDateModal = useRef<HTMLIonModalElement>(null);
    // --- SFÂRȘIT MODIFICARE ---

    const [presentDeleteAlert] = useIonAlert();
    const [scheduleToManage, setScheduleToManage] = useState<Schedule | null>(null);

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showObjectSelector, setShowObjectSelector] = useState(false);
    const [selectedObjectType, setSelectedObjectType] = useState<string>('');

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [ceramicObjectDetails, setCeramicObjectDetails] = useState<CeramicObject | null>(null);
    const [editableReminders, setEditableReminders] = useState<boolean>(false);

    const [allCeramicObjects, setAllCeramicObjects] = useState<CeramicObject[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const [activeSegment, setActiveSegment] = useState<'pending' | 'active'>('pending');
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [loggedInUsername, setLoggedInUsername] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
    const [filterObjectType, setFilterObjectType] = useState<string | null>(null);
    const [filterDate, setFilterDate] = useState<string | null>(null);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        wsRef.current?.close();
        history.push('/login');
    }, [history, wsRef]);

    // Caching pentru fetchAllSchedules
    const fetchAllSchedules = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        console.log(">>> (2a) fetchAllSchedules... se execută");
        const cacheKey = 'schedules_cache';
        try {
            const res = await fetch(`${API_BASE_URL}/schedules`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch schedules");
            const data: Schedule[] = await res.json();
            data.sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());
            setSchedules(data);
            await storage.set(cacheKey, data); // Salvăm în cache
        } catch (err: any) {
            console.warn('Eroare fetch schedules (probabil offline), încerc cache-ul.', err.message);
            const cachedData = await storage.get(cacheKey);
            if (cachedData) {
                console.log('Am încărcat programările din cache.');
                setSchedules(cachedData);
            } else {
                console.error('Error fetching schedules:', err);
            }
        }
    }, [handleLogout]);

    // Caching pentru fetchAllCeramicObjects
    const fetchAllCeramicObjects = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        console.log(">>> (2b) fetchAllCeramicObjects... se execută");
        const cacheKey = 'ceramic_objects_cache';
        try {
            const res = await fetch(`${API_BASE_URL}/ceramic-objects`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch ceramic objects");
            const data: CeramicObject[] = await res.json();
            console.log("<<< (3) Date obiecte primite:", data);
            setAllCeramicObjects(data);
            await storage.set(cacheKey, data); // Salvăm în cache
        } catch (err: any) {
            console.warn('Eroare fetch ceramic objects (probabil offline), încerc cache-ul.', err.message);
            const cachedData = await storage.get(cacheKey);
            if (cachedData) {
                console.log('Am încărcat obiectele din cache.');
                setAllCeramicObjects(cachedData);
            } else {
                console.error('Error fetching all ceramic objects:', err);
            }
        }
    }, [handleLogout]);

    const fetchNotifications = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        console.log(">>> (2c) fetchNotifications... se execută");
        try {
            const res = await fetch(`${API_BASE_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch notifications");
            const newNotifications: any[] = await res.json();
            if (newNotifications.length > 0) {
                console.log("<<< (4) Notificări noi:", newNotifications);
                setNotifications(prevNotifications => [...prevNotifications, ...newNotifications]);
            }
        } catch (err) { console.error('Error fetching notifications:', err); }
    }, [handleLogout]);

    const fetchAvailability = async (date: string) => {
        const token = localStorage.getItem('authToken');
        if (!token) return handleLogout();
        const formattedDate = new Date(date).toISOString().split('T')[0];
        const cacheKey = `availability_${formattedDate}`;
        console.log(`>>> (Fetching availability) pentru data: ${formattedDate}`);
        try {
            const res = await fetch(`${API_BASE_URL}/availability?date=${formattedDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Failed to fetch availability");
            const data: string[] = await res.json();
            console.log("<<< (Availability) Ore primite de pe SERVER:", data);
            setAvailableSlots(data);
            await storage.set(cacheKey, data);
            console.log(`Orele pentru ${formattedDate} au fost salvate în cache.`);
        } catch (err: any) {
            console.warn('Eroare la fetch availability (probabil offline). Încerc cache-ul.', err.message);
            const cachedData: string[] | null = await storage.get(cacheKey);
            if (cachedData) {
                console.log("<<< (Availability) Ore primite din CACHE:", cachedData);
                setAvailableSlots(cachedData);
            } else {
                console.error('Nu s-a găsit nimic în cache pentru', cacheKey);
                presentToast({ message: `Could not load hours: ${err.message}`, duration: 2000, color: 'danger' });
                setAvailableSlots([]);
            }
        }
    };

    // Efect pentru fetch-ul inițial
    useEffect(() => {
        fetchAllSchedules();
        fetchAllCeramicObjects();
        fetchNotifications();
    }, [fetchAllSchedules, fetchAllCeramicObjects, fetchNotifications]);

    // Efect pentru ascultătorul de sincronizare (refresh)
    useEffect(() => {
        const handleSync = () => {
            console.log('Eveniment "dataSynced" primit! Reîmprospătare listă...');
            fetchAllSchedules();
            fetchAllCeramicObjects();
        };
        window.addEventListener('dataSynced', handleSync);
        return () => {
            window.removeEventListener('dataSynced', handleSync);
        };
    }, [fetchAllSchedules, fetchAllCeramicObjects]);

    // Efect pentru username
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = atob(payloadBase64);
                const parsedPayload = JSON.parse(decodedPayload);
                if (parsedPayload.username) setLoggedInUsername(parsedPayload.username);
            } catch (error) { console.error('Failed to parse auth token:', error); handleLogout(); }
        } else { handleLogout(); }
    }, [handleLogout]);

    // Efect pentru WebSocket
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) { handleLogout(); return; }
        const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => console.log("WebSocket connected");
        ws.onmessage = (event) => {
            console.log("<<< (1) MESAJ WEBSOCKET PRIMIT.", event.data);
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'stage_updated' && data.payload) {
                    const { object: updatedObject, schedule: updatedSchedule } = data.payload;
                    console.log("<<< (2) PROCESARE 'stage_updated'");
                    setAllCeramicObjects(prevObjects =>
                        prevObjects.map(obj =>
                            obj.id === updatedObject.id ? { ...updatedObject, remindersScheduled: !!updatedObject.remindersScheduled } : obj
                        )
                    );
                    setSchedules(prevSchedules =>
                        prevSchedules.map(sch =>
                            sch.id === updatedSchedule.id ? updatedSchedule : sch
                        )
                    );
                    if (updatedSchedule.status === 'Finished' || updatedObject.currentStage === 'painting') {
                        fetchNotifications();
                    }
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };
        ws.onclose = () => console.log("WebSocket closed");
        return () => { ws.close(); };
    }, [handleLogout, fetchNotifications]);

    // Efect pentru fetch-ul de ore disponibile
    useEffect(() => {
        if (showDatePicker) {
            fetchAvailability(selectedDate);
        }
    }, [showDatePicker, selectedDate]);

    // Efect pentru starea online/offline
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); presentToast({ message: 'You are back online!', duration: 2000, color: 'success', position: 'top' }); };
        const handleOffline = () => { setIsOnline(false); presentToast({ message: 'You are now offline.', duration: 2000, color: 'danger', position: 'top' }); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, [presentToast]);

    // Efect pentru resetarea paginii la schimbarea segmentului
    useEffect(() => {
        setCurrentPage(1);
    }, [activeSegment]);

    // Resetăm pagina la schimbarea filtrelor
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterObjectType, filterDate]);

    // --- Handlers ---
    const handleOpenNotifications = () => setShowNotificationsModal(true);
    const handleDateChange = (date: string) => { setSelectedDate(date); fetchAvailability(date); };
    const handleSlotSelect = (slot: string) => { setSelectedSlot(slot); setShowObjectSelector(true); };

    // Handlers noi pentru filtru
    const handleOpenFilter = () => setShowFilterModal(true);
    const handleCloseFilter = () => setShowFilterModal(false);

    const applyFilters = () => {
        handleCloseFilter();
    };

    const clearFilters = () => {
        setFilterObjectType(null);
        setFilterDate(null);
        handleCloseFilter();
    };

    // Funcția de salvare programare (folosește SyncService)
    const handleSchedule = async () => {
        if (!selectedSlot || !selectedObjectType) return;
        const newSchedule = {
            name: `Schedule for ${selectedObjectType}`,
            date: selectedDate,
            hour: new Date(`${selectedDate}T${selectedSlot}`).toISOString(),
            objectType: selectedObjectType,
            status: 'Scheduled',
        };
        try {
            const savedOnline = await saveData(newSchedule);
            if (savedOnline) {
                fetchAllSchedules();
            }
            setShowDatePicker(false);
            setShowObjectSelector(false);
            setSelectedSlot(null);
            setSelectedObjectType('');
        } catch (error: any) {
            console.error('Eroare neașteptată în handleSchedule:', error);
            presentToast({ message: `An unexpected error occurred: ${error.message}`, duration: 3000, color: 'danger', position: 'top' });
        }
    };

    // Caching pentru handleShowDetails
    const handleShowDetails = async (schedule: Schedule) => {
        const token = localStorage.getItem('authToken');
        if (!token || !schedule.id) return handleLogout();

        const cacheKey = `object_details_${schedule.id}`;
        const existingObject = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);

        if (existingObject && existingObject.remindersScheduled !== undefined) {
            console.log('Am încărcat detaliile obiectului din lista principală (cache).');
            setScheduleToManage(schedule);
            setCeramicObjectDetails(existingObject);
            setEditableReminders(existingObject.remindersScheduled);
            setShowDetailsModal(true);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/ceramic-objects/${schedule.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Could not fetch object details");
            const data: CeramicObject = await res.json();
            await storage.set(cacheKey, data);
            setScheduleToManage(schedule);
            setCeramicObjectDetails(data);
            setEditableReminders(data.remindersScheduled);
            setShowDetailsModal(true);
        } catch (error: any) {
            console.warn(`Eroare la fetch detaliile obiectului (probabil offline). Încerc cache-ul ${cacheKey}`, error.message);
            const cachedData: CeramicObject | null = await storage.get(cacheKey);
            if (cachedData) {
                console.log('Am încărcat detaliile obiectului din cache-ul individual.');
                setScheduleToManage(schedule);
                setCeramicObjectDetails(cachedData);
                setEditableReminders(cachedData.remindersScheduled);
                setShowDetailsModal(true);
            } else {
                console.error('Nu s-au găsit detaliile obiectului în niciun cache.', cacheKey);
                presentToast({ message: "Failed to fetch details and no offline data available.", duration: 3000, color: 'danger' });
            }
        }
    };

    const handleUpdateDetails = async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !ceramicObjectDetails) return handleLogout();
        try {
            // NOTĂ: Acest apel NU va funcționa offline încă
            const res = await fetch(`${API_BASE_URL}/ceramic-objects/${ceramicObjectDetails.scheduleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ remindersScheduled: editableReminders })
            });
            if (res.status === 401 || res.status === 403) return handleLogout();
            if (!res.ok) throw new Error("Could not save changes");
            presentToast({ message: 'Reminder settings saved.', duration: 2000, color: 'success', position: 'top' });
            fetchAllCeramicObjects();
        } catch (error: any) { presentToast({ message: `Save failed: ${error.message}`, duration: 3000, color: 'danger' }); }
    };

    // Funcția de anulare (folosește SyncService)
    const handleCancelSchedule = async () => {
        if (!scheduleToManage) return;
        const scheduleToCancel = { ...scheduleToManage };
        setSchedules(prevSchedules =>
            prevSchedules.filter(s => s.id !== scheduleToCancel.id)
        );
        setAllCeramicObjects(prevObjects =>
            prevObjects.filter(obj => obj.scheduleId !== scheduleToCancel.id)
        );
        setShowDetailsModal(false);
        setScheduleToManage(null);
        try {
            const deletedOnline = await deleteData(scheduleToCancel);
            if (deletedOnline) {
                // S-a șters online
            }
        } catch (error: any) {
            console.error('Eroare neașteptată în handleCancelSchedule:', error);
            presentToast({ message: `An unexpected error occurred: ${error.message}`, duration: 3000, color: 'danger', position: 'top' });
            fetchAllSchedules();
            fetchAllCeramicObjects();
        }
    };

    const showDeleteConfirm = () => {
        presentDeleteAlert({
            header: 'Cancel Schedule',
            message: 'Are you sure you want to cancel this schedule? This action cannot be undone.',
            buttons: [
                { text: 'Back', role: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    role: 'confirm',
                    handler: () => { handleCancelSchedule(); },
                },
            ],
        });
    };

    // Logica de filtrare și paginare
    const filteredSchedules = useMemo(() => {
        let filtered = [...schedules];
        if (searchTerm) {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (filterObjectType) {
            filtered = filtered.filter(s => s.objectType === filterObjectType);
        }
        if (filterDate) {
            const selected = new Date(filterDate).toLocaleDateString();
            filtered = filtered.filter(s =>
                new Date(s.date).toLocaleDateString() === selected
            );
        }
        return filtered;
    }, [schedules, searchTerm, filterObjectType, filterDate]);

    const pendingSchedules = filteredSchedules.filter(s => s.status === 'Scheduled');
    const activeSchedules = filteredSchedules.filter(s => s.status !== 'Scheduled');

    const listToPaginate = activeSegment === 'pending' ? pendingSchedules : activeSchedules;
    const totalPages = Math.ceil(listToPaginate.length / ITEMS_PER_PAGE);

    const paginatedList = listToPaginate.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };
    const goToPrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };


    // --- JSX (Partea vizuală) ---
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
                    <IonButtons slot="end">
                        <IonButton fill="clear" onClick={handleOpenFilter}>
                            <IonIcon icon={filterOutline} />
                        </IonButton>
                        <IonButton fill="clear" onClick={handleOpenNotifications}>
                            <IonIcon icon={notificationsOutline} />
                            {notifications.length > 0 && <IonBadge color="danger">{notifications.length}</IonBadge>}
                        </IonButton>
                        <IonButton onClick={handleLogout} color="danger" fill="clear">
                            <IonIcon icon={logOutOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" fullscreen>

                <style>{`
                    ion-content {
                        --padding-start: 16px;
                        --padding-end: 16px;
                    }
                    @media (min-width: 768px) {
                        .schedule-grid-container {
                            max-width: 1200px;
                            margin-left: auto;
                            margin-right: auto;
                        }
                    }
                    @media (max-width: 380px) {
                        .schedule-list-col {
                           --ion-padding: 8px;
                        }
                        .schedule-list-col ion-card {
                            padding: 8px;
                        }
                        .schedule-list-col ion-card-title {
                            font-size: 1.1rem;
                            margin-bottom: 4px;
                        }
                        .schedule-list-col p {
                            font-size: 0.85rem;
                            line-height: 1.3;
                            margin: 2px 0;
                        }
                    }
                `}</style>

                <IonSegment value={activeSegment} onIonChange={e => setActiveSegment(e.detail.value as any)} style={{ marginBottom: '10px' }}>
                    <IonSegmentButton value="pending"><IonLabel>Scheduled</IonLabel></IonSegmentButton>
                    <IonSegmentButton value="active"><IonLabel>Next Stage</IonLabel></IonSegmentButton>
                </IonSegment>

                <IonSearchbar
                    value={searchTerm}
                    onIonChange={e => setSearchTerm(e.detail.value || '')}
                    placeholder="Search by object name..."
                    debounce={300}
                    animated={true}
                />

                <IonGrid className="schedule-grid-container">
                    <IonRow>
                        {paginatedList.map(schedule => {
                            const ceramicObject = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);
                            return (
                                <IonCol size="12" size-sm="6" size-md="4" key={schedule.id} className="schedule-list-col">
                                    <ScheduleItem
                                        schedule={schedule}
                                        onClick={() => handleShowDetails(schedule)}
                                        currentStage={ceramicObject?.currentStage}
                                    />
                                </IonCol>
                            );
                        })}
                    </IonRow>
                </IonGrid>

                {paginatedList.length === 0 && (
                    <IonItem lines="none" className="ion-text-center">
                        <IonLabel color="medium">
                            {searchTerm || filterObjectType || filterDate
                                ? "No schedules match your filters."
                                : "No schedules found for this category."
                            }
                        </IonLabel>
                    </IonItem>
                )}

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton onClick={() => setShowDatePicker(true)}><IonIcon icon={calendarOutline} /></IonFabButton>
                </IonFab>

                {/* Modalul 1: Creare Programare (Dată) */}
                <IonModal isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Select date and time</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setShowDatePicker(false)}>Close</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <IonDatetime value={selectedDate} onIonChange={e => handleDateChange(e.detail.value as string)} presentation="date" min={new Date().toISOString().split('T')[0]} showDefaultTitle={false} />
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
                                } else if (availableSlots.length > 0) {
                                    return <IonItem><IonLabel>No more slots available for today.</IonLabel></IonItem>;
                                } else {
                                    return <IonItem><IonLabel>No available slots.</IonLabel></IonItem>;
                                }
                            })()}
                        </IonList>
                    </IonContent>
                </IonModal>

                {/* Modalul 2: Creare Programare (Obiect) */}
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
                                <IonSelect value={selectedObjectType} placeholder="Select one" onIonChange={e => setSelectedObjectType(e.detail.value)}>
                                    <IonSelectOption value="Mug">Mug</IonSelectOption>
                                    <IonSelectOption value="Vase">Vase</IonSelectOption>
                                    <IonSelectOption value="Plate">Plate</IonSelectOption>
                                </IonSelect>
                            </IonItem>
                        </IonList>
                        <IonButton expand="block" onClick={handleSchedule} disabled={!selectedObjectType} style={{ marginTop: '20px' }}>
                            Confirm Schedule
                        </IonButton>
                    </IonContent>
                </IonModal>

                {/* Modalul 3: DETALII */}
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
                                </IonList>
                                <IonButton expand="block" fill="outline" onClick={handleUpdateDetails} style={{ marginTop: '10px' }}>
                                    Save Reminder Settings
                                </IonButton>

                                {scheduleToManage && scheduleToManage.status === 'Scheduled' && (
                                    <IonButton expand="block" color="danger" onClick={showDeleteConfirm} style={{ marginTop: '20px' }}>
                                        Cancel Schedule
                                    </IonButton>
                                )}
                            </>
                        ) : <p>Loading details...</p>}
                    </IonContent>
                </IonModal>

                {/* Modalul 4: Notificări */}
                <IonModal isOpen={showNotificationsModal} onDidDismiss={() => { setShowNotificationsModal(false); setNotifications([]); }}>
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

                {/* Modalul 5: Filtru */}
                <IonModal isOpen={showFilterModal} onDidDismiss={handleCloseFilter}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Filter Schedules</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={handleCloseFilter}>Close</IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <IonList>
                            <IonItem>
                                <IonLabel>Filter by Object Type</IonLabel>
                                <IonSelect
                                    value={filterObjectType}
                                    placeholder="All"
                                    onIonChange={e => setFilterObjectType(e.detail.value)}
                                >
                                    <IonSelectOption value={null}>All</IonSelectOption>
                                    <IonSelectOption value="Mug">Mug</IonSelectOption>
                                    <IonSelectOption value="Vase">Vase</IonSelectOption>
                                    <IonSelectOption value="Plate">Plate</IonSelectOption>
                                </IonSelect>
                            </IonItem>
                            <IonItem>
                                <IonLabel>Filter by Date</IonLabel>
                                <IonButton fill="clear" id="filter-date-picker">
                                    {filterDate ? new Date(filterDate).toLocaleDateString() : 'Select Date'}
                                </IonButton>
                                {/* --- MODIFICARE AICI: Am adăugat ref-ul și am modificat onIonChange --- */}
                                <IonModal trigger="filter-date-picker" ref={filterDateModal}>
                                    <IonDatetime
                                        presentation="date"
                                        onIonChange={e => {
                                            setFilterDate(e.detail.value as string);
                                            filterDateModal.current?.dismiss(); // Închide modalul la selecție
                                        }}
                                    />
                                </IonModal>
                                {/* --- SFÂRȘIT MODIFICARE --- */}
                            </IonItem>
                        </IonList>
                    </IonContent>
                    <IonFooter>
                        <IonToolbar>
                            <IonButtons slot="start">
                                <IonButton color="danger" onClick={clearFilters}>
                                    Clear
                                </IonButton>
                            </IonButtons>
                            <IonButtons slot="end">
                                <IonButton strong={true} onClick={applyFilters}>
                                    Apply
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonFooter>
                </IonModal>

            </IonContent>

            {/* Paginarea rămâne în IonFooter */}
            {listToPaginate.length > 0 && totalPages > 1 && (
                <IonFooter>
                    <IonToolbar>
                        <div className="pagination-controls ion-text-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <IonButton onClick={goToPrevPage} disabled={currentPage === 1} fill="clear">
                                <IonIcon icon={chevronBackOutline} slot="icon-only" />
                            </IonButton>
                            <span className="ion-padding-horizontal">
                                Page {currentPage} of {totalPages}
                            </span>
                            <IonButton onClick={goToNextPage} disabled={currentPage === totalPages} fill="clear">
                                <IonIcon icon={chevronForwardOutline} slot="icon-only" />
                            </IonButton>
                        </div>
                    </IonToolbar>
                </IonFooter>
            )}

        </IonPage>
    );
};

export default ScheduleList;