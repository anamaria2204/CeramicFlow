import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonIcon, IonModal, IonButton,
    IonDatetime, IonList, IonItem, IonLabel, useIonToast, IonSelect, IonSelectOption, IonFab,
    IonFabButton, IonBadge, IonSegment, IonSegmentButton,
    useIonAlert,
    IonGrid, IonRow, IonCol,
    IonSearchbar,
    IonButtons,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonFooter,
    IonSpinner,
    IonImg,
    IonCard,
    createAnimation,
    useIonViewDidEnter
} from '@ionic/react';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ScheduleItem from './ScheduleItem';
import { Schedule } from './Schedule';
import { CeramicObject } from '../object/CeramicObject';
import {
    calendarOutline, notificationsOutline, wifiOutline, warningOutline, logOutOutline,
    filterOutline, locationOutline, mapOutline, locateOutline, cameraOutline, trashOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

import { saveData, deleteData } from '../services/SyncService';
import { storage } from '../storage';

import MyMap from '../components/MyMap';
import { useMyLocation } from '../hooks/useMyLocation';
import { useCamera } from '../hooks/useCamera';
import { useFilesystem } from '../hooks/useFilesystem';
import { Geolocation } from '@capacitor/geolocation';
import { modalEnterAnimation, modalLeaveAnimation } from '../theme/modalAnimations';

const IP_CALCULATOR = 'localhost';
const API_BASE_URL = `http://${IP_CALCULATOR}:3000`;
const ITEMS_PER_PAGE = 6;

interface ExtendedCeramicObject extends CeramicObject {
    lat?: number;
    lng?: number;
    photos?: string[];
}

const ScheduleList: React.FC = () => {
    const history = useHistory();
    const [presentToast] = useIonToast();
    const wsRef = useRef<WebSocket | null>(null);

    const myLocation = useMyLocation();
    const { latitude: currentLat, longitude: currentLng } = myLocation.position?.coords || { latitude: 46.77, longitude: 23.60 };

    const { getPhoto } = useCamera();
    const { writeFile } = useFilesystem();

    const fabRef = useRef<HTMLIonFabElement>(null);
    const fabButtonRef = useRef<HTMLIonFabButtonElement>(null); // <-- Ref nou specific pentru buton
    const listRef = useRef<HTMLIonGridElement>(null);

    const filterDateModal = useRef<HTMLIonModalElement>(null);
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
    const [ceramicObjectDetails, setCeramicObjectDetails] = useState<ExtendedCeramicObject | null>(null);
    const [editableReminders, setEditableReminders] = useState<boolean>(false);

    const [allCeramicObjects, setAllCeramicObjects] = useState<ExtendedCeramicObject[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const [activeSegment, setActiveSegment] = useState<'pending' | 'active'>('pending');
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [loggedInUsername, setLoggedInUsername] = useState<string>('');

    const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
    const [filterObjectType, setFilterObjectType] = useState<string | null>(null);
    const [filterDate, setFilterDate] = useState<string | null>(null);

    const [showMapModal, setShowMapModal] = useState(false);
    const [mapMode, setMapMode] = useState<'view' | 'select'>('view');
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    // --- ANIMAȚII ---

    // 1. Animație INTRARE FAB (Rotire + Scale la load pagină)
    useIonViewDidEnter(() => {
        if (fabRef.current) {
            const animation = createAnimation()
                .addElement(fabRef.current)
                .duration(1000)
                .fromTo('transform', 'scale(0) rotate(0deg)', 'scale(1) rotate(360deg)')
                .fromTo('opacity', '0', '1');
            animation.play();
        }
    });

    // 2. Animație CLICK FAB (Rotire 360 la click)
    const handleFabClick = () => {
        if (fabButtonRef.current) {
            const animation = createAnimation()
                .addElement(fabButtonRef.current)
                .duration(500) // Durata rotației (0.5 secunde)
                .easing('ease-out')
                .fromTo('transform', 'rotate(0deg)', 'rotate(360deg)');

            animation.play();
        }
        // Deschidem datepicker-ul după o mică pauză sau imediat, cum preferi
        setShowDatePicker(true);
    };

    // 3. Animație Listă (Slide Up la încărcare)
    useEffect(() => {
        if (listRef.current) {
            const el = listRef.current;
            const animation = createAnimation()
                .addElement(el)
                .duration(500)
                .easing('ease-out')
                .fromTo('transform', 'translateY(20px)', 'translateY(0px)')
                .fromTo('opacity', '0', '1');
            animation.play();
        }
    }, [activeSegment, schedules.length]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        wsRef.current?.close();
        history.push('/login');
    }, [history, wsRef]);

    const fetchAllSchedules = useCallback(async () => {
        const token = localStorage.getItem('authToken'); if (!token) return handleLogout();
        try { const res = await fetch(`${API_BASE_URL}/schedules`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); data.sort((a: any, b: any) => new Date(a.hour).getTime() - new Date(b.hour).getTime()); setSchedules(data); await storage.set('schedules_cache', data); }
        } catch (e) { const cached = await storage.get('schedules_cache'); if(cached) setSchedules(cached); }
    }, [handleLogout]);

    const fetchAllCeramicObjects = useCallback(async () => {
        const token = localStorage.getItem('authToken'); if (!token) return handleLogout();
        try { const res = await fetch(`${API_BASE_URL}/ceramic-objects`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); setAllCeramicObjects(data); await storage.set('ceramic_objects_cache', data); }
        } catch (e) { const cached = await storage.get('ceramic_objects_cache'); if(cached) setAllCeramicObjects(cached); }
    }, [handleLogout]);

    const fetchNotifications = useCallback(async () => {
        const token = localStorage.getItem('authToken'); if (!token) return handleLogout();
        try { const res = await fetch(`${API_BASE_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); if (data.length) setNotifications(p => [...p, ...data]); } } catch (e) {}
    }, [handleLogout]);

    const fetchAvailability = async (date: string) => {
        const token = localStorage.getItem('authToken'); if (!token) return handleLogout();
        try { const res = await fetch(`${API_BASE_URL}/availability?date=${date}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json(); setAvailableSlots(data); } catch (e) { setAvailableSlots([]); }
    };

    useEffect(() => { fetchAllSchedules(); fetchAllCeramicObjects(); fetchNotifications(); }, [fetchAllSchedules, fetchAllCeramicObjects, fetchNotifications]);
    useEffect(() => { const handleSync = () => { fetchAllSchedules(); fetchAllCeramicObjects(); }; window.addEventListener('dataSynced', handleSync); return () => window.removeEventListener('dataSynced', handleSync); }, [fetchAllSchedules, fetchAllCeramicObjects]);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) { try { const p = JSON.parse(atob(token.split('.')[1])); if (p.username) setLoggedInUsername(p.username); } catch (e) { handleLogout(); } } else { handleLogout(); }
    }, [handleLogout]);

    useEffect(() => {
        const token = localStorage.getItem('authToken'); if (!token) { handleLogout(); return; }
        const ws = new WebSocket(`ws://${IP_CALCULATOR}:3000?token=${token}`); wsRef.current = ws;
        ws.onmessage = (e) => { try { const d = JSON.parse(e.data); if(d.event==='stage_updated') { fetchAllSchedules(); fetchAllCeramicObjects(); fetchNotifications(); } } catch(err){} };
        return () => ws.close();
    }, [handleLogout, fetchNotifications]);

    useEffect(() => { if(showDatePicker) fetchAvailability(selectedDate); }, [showDatePicker, selectedDate]);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); presentToast({ message: 'You are back online!', duration: 2000, color: 'success', position: 'top' }); };
        const handleOffline = () => { setIsOnline(false); presentToast({ message: 'You are now offline.', duration: 2000, color: 'danger', position: 'top' }); };
        window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, [presentToast]);

    useEffect(() => { setVisibleItemsCount(ITEMS_PER_PAGE); }, [activeSegment, searchTerm, filterObjectType, filterDate]);

    const handleTakePhoto = async () => {
        if (!ceramicObjectDetails) return;
        try {
            const photo = await getPhoto();
            const base64Data = photo.base64String;
            const fileName = new Date().getTime() + '.jpeg';

            if (base64Data) {
                await writeFile(fileName, base64Data);
                const newPhotoString = `data:image/jpeg;base64,${base64Data}`;

                const currentPhotos = ceramicObjectDetails.photos || [];
                const updatedPhotos = [...currentPhotos, newPhotoString];

                setCeramicObjectDetails({
                    ...ceramicObjectDetails,
                    photos: updatedPhotos
                });
            }
        } catch (error) {
            console.error('Camera error:', error);
        }
    };

    const handleDeletePhoto = (indexToDelete: number) => {
        if (!ceramicObjectDetails || !ceramicObjectDetails.photos) return;
        const updatedPhotos = ceramicObjectDetails.photos.filter((_, index) => index !== indexToDelete);
        setCeramicObjectDetails({ ...ceramicObjectDetails, photos: updatedPhotos });
    };

    const handleLocateMe = async () => {
        setIsLocating(true);
        try {
            const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
            const { latitude, longitude } = position.coords;
            setSelectedLocation({ lat: latitude, lng: longitude });
            presentToast({ message: 'Location found!', duration: 1500, color: 'success' });
        } catch (error) {
            presentToast({ message: 'GPS Error.', duration: 2000, color: 'danger' });
        } finally {
            setIsLocating(false);
        }
    };

    const openMapForSelection = () => {
        setMapMode('select');
        if (ceramicObjectDetails?.lat && ceramicObjectDetails?.lng) {
            setSelectedLocation({ lat: ceramicObjectDetails.lat, lng: ceramicObjectDetails.lng });
        } else {
            setSelectedLocation({ lat: currentLat, lng: currentLng });
        }
        setShowMapModal(true);
    };

    const openMapForViewing = () => {
        if (ceramicObjectDetails?.lat && ceramicObjectDetails?.lng) {
            setMapMode('view');
            setSelectedLocation({ lat: ceramicObjectDetails.lat, lng: ceramicObjectDetails.lng });
            setShowMapModal(true);
        } else {
            presentToast({ message: 'No location set.', duration: 2000, color: 'warning' });
        }
    };

    const handleMapClick = (e: { latitude: number, longitude: number }) => {
        if (mapMode === 'select') {
            setSelectedLocation({ lat: e.latitude, lng: e.longitude });
        }
    };

    const confirmLocationSelection = () => {
        if (selectedLocation && ceramicObjectDetails) {
            setCeramicObjectDetails({ ...ceramicObjectDetails, lat: selectedLocation.lat, lng: selectedLocation.lng });
            setShowMapModal(false);
            presentToast({ message: 'Location selected. Press Save!', duration: 2000, color: 'success' });
        }
    };

    const handleOpenNotifications = () => setShowNotificationsModal(true);
    const handleDateChange = (date: string) => { setSelectedDate(date); fetchAvailability(date); };
    const handleSlotSelect = (slot: string) => { setSelectedSlot(slot); setShowObjectSelector(true); };
    const handleOpenFilter = () => setShowFilterModal(true);
    const handleCloseFilter = () => setShowFilterModal(false);
    const applyFilters = () => { handleCloseFilter(); };
    const clearFilters = () => { setFilterObjectType(null); setFilterDate(null); handleCloseFilter(); };

    const handleSchedule = async () => {
        if (!selectedSlot || !selectedObjectType) return;
        const newSchedule = { name: `Schedule for ${selectedObjectType}`, date: selectedDate, hour: new Date(`${selectedDate}T${selectedSlot}`).toISOString(), objectType: selectedObjectType, status: 'Scheduled' };
        try { await saveData(newSchedule); fetchAllSchedules(); setShowDatePicker(false); setShowObjectSelector(false); setSelectedSlot(null); setSelectedObjectType(''); }
        catch (error: any) { presentToast({ message: `Error: ${error.message}`, duration: 3000, color: 'danger' }); }
    };

    const handleShowDetails = async (schedule: Schedule) => {
        const token = localStorage.getItem('authToken'); if (!token || !schedule.id) return handleLogout();
        try {
            const res = await fetch(`${API_BASE_URL}/ceramic-objects/${schedule.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();
            setScheduleToManage(schedule); setCeramicObjectDetails(data); setEditableReminders(data.remindersScheduled); setShowDetailsModal(true);
        } catch (e) {
            const existing = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);
            if (existing) { setScheduleToManage(schedule); setCeramicObjectDetails(existing); setShowDetailsModal(true); }
        }
    };

    const handleUpdateDetails = async () => {
        const token = localStorage.getItem('authToken'); if (!token || !ceramicObjectDetails) return handleLogout();
        try {
            const body = {
                remindersScheduled: editableReminders,
                lat: ceramicObjectDetails.lat,
                lng: ceramicObjectDetails.lng,
                photos: ceramicObjectDetails.photos || []
            };

            const res = await fetch(`${API_BASE_URL}/ceramic-objects/${ceramicObjectDetails.scheduleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error("Error");

            presentToast({ message: 'Saved successfully!', duration: 2000, color: 'success' });
            fetchAllCeramicObjects();
        } catch (error: any) { presentToast({ message: 'Save failed', duration: 2000, color: 'danger' }); }
    };

    const handleCancelSchedule = async () => {
        if (!scheduleToManage) return;
        try { await deleteData(scheduleToManage); setSchedules(p => p.filter(s => s.id !== scheduleToManage.id)); setShowDetailsModal(false); } catch (e) {}
    };

    const showDeleteConfirm = () => { presentDeleteAlert({ header: 'Cancel Schedule', message: 'Are you sure you want to cancel?', buttons: [{ text: 'No', role: 'cancel' }, { text: 'Yes', role: 'confirm', handler: handleCancelSchedule }] }); };

    const filteredSchedules = useMemo(() => {
        let filtered = [...schedules];
        if (searchTerm) filtered = filtered.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filterObjectType) filtered = filtered.filter(s => s.objectType === filterObjectType);
        if (filterDate) filtered = filtered.filter(s => new Date(s.date).toLocaleDateString() === new Date(filterDate).toLocaleDateString());
        return filtered;
    }, [schedules, searchTerm, filterObjectType, filterDate]);
    const displayedList = (activeSegment === 'pending' ? filteredSchedules.filter(s => s.status === 'Scheduled') : filteredSchedules.filter(s => s.status !== 'Scheduled')).slice(0, visibleItemsCount);

    const getFilteredSlots = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const isToday = selectedDate === todayStr;
        const currentHour = today.getHours();
        return availableSlots.filter(slot => { if (!isToday) return true; return parseInt(slot.split(':')[0], 10) > currentHour; });
    };
    const finalSlots = getFilteredSlots();

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButton slot="start" fill="clear" color={isOnline ? 'success' : 'danger'}><IonIcon icon={isOnline ? wifiOutline : warningOutline} /></IonButton>
                    <IonTitle>CeramicFlow <span style={{fontSize:'0.6em', display:'block'}}>Hello, {loggedInUsername}</span></IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleOpenFilter}><IonIcon icon={filterOutline} /></IonButton>
                        <IonButton onClick={handleOpenNotifications}><IonIcon icon={notificationsOutline} />{notifications.length > 0 && <IonBadge color="danger">{notifications.length}</IonBadge>}</IonButton>
                        <IonButton onClick={handleLogout} color="danger"><IonIcon icon={logOutOutline} /></IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding" fullscreen>
                <IonSegment value={activeSegment} onIonChange={e => setActiveSegment(e.detail.value as any)} style={{ marginBottom: '10px' }}>
                    <IonSegmentButton value="pending"><IonLabel>Scheduled</IonLabel></IonSegmentButton>
                    <IonSegmentButton value="active"><IonLabel>Next Stage</IonLabel></IonSegmentButton>
                </IonSegment>

                <IonSearchbar value={searchTerm} onIonChange={e => setSearchTerm(e.detail.value || '')} placeholder="Search..." />

                <IonGrid className="schedule-grid-container" ref={listRef}>
                    <IonRow>
                        {displayedList.map(schedule => {
                            const ceramicObject = allCeramicObjects.find(obj => obj.scheduleId === schedule.id);
                            const thumb = ceramicObject?.photos && ceramicObject.photos.length > 0 ? ceramicObject.photos[0] : undefined;
                            return <IonCol size="12" size-sm="6" size-md="4" key={schedule.id}>
                                <ScheduleItem
                                    schedule={schedule}
                                    onClick={() => handleShowDetails(schedule)}
                                    currentStage={ceramicObject?.currentStage}
                                    photo={thumb}
                                />
                            </IonCol>
                        })}
                    </IonRow>
                </IonGrid>

                <IonInfiniteScroll onIonInfinite={(ev) => { setTimeout(() => { setVisibleItemsCount(p => p + 6); ev.target.complete(); }, 500); }}><IonInfiniteScrollContent /></IonInfiniteScroll>

                {/* --- FAB CU ANIMAȚIE LA CLICK --- */}
                <IonFab ref={fabRef} vertical="bottom" horizontal="end" slot="fixed">
                    {/* Adăugat ref și handler pentru animație */}
                    <IonFabButton ref={fabButtonRef} onClick={handleFabClick}>
                        <IonIcon icon={calendarOutline} />
                    </IonFabButton>
                </IonFab>

                {/* --- 3. Animație Custom pentru Modal (Zoom In) --- */}
                <IonModal
                    isOpen={showDetailsModal}
                    onDidDismiss={() => setShowDetailsModal(false)}
                    enterAnimation={modalEnterAnimation}
                    leaveAnimation={modalLeaveAnimation}
                >
                    <IonHeader><IonToolbar><IonTitle>Details</IonTitle><IonButton slot="end" onClick={() => setShowDetailsModal(false)}>Close</IonButton></IonToolbar></IonHeader>
                    <IonContent className="ion-padding">
                        {ceramicObjectDetails && (
                            <>
                                {ceramicObjectDetails.photos && ceramicObjectDetails.photos.length > 0 && (
                                    <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', paddingBottom: '10px', marginBottom: '10px', scrollSnapType: 'x mandatory' }}>
                                        {ceramicObjectDetails.photos.map((photo, index) => (
                                            <div key={index} style={{ position: 'relative', minWidth: '150px', scrollSnapAlign: 'start' }}>
                                                <IonImg src={photo} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd' }} />
                                                <IonButton fill="clear" color="danger" size="small" style={{ position: 'absolute', top: 0, right: 0 }} onClick={() => handleDeletePhoto(index)}>
                                                    <IonIcon icon={trashOutline} />
                                                </IonButton>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <IonList>
                                    <IonItem><IonLabel position="stacked">Object Name</IonLabel><p>{ceramicObjectDetails.name}</p></IonItem>
                                    <IonItem><IonLabel>Stage:</IonLabel><p>{ceramicObjectDetails.currentStage}</p></IonItem>

                                    <IonItem lines="none" style={{marginTop: '10px'}}>
                                        <IonLabel>
                                            <h3>Location</h3>
                                            <p style={{fontSize:'0.8em', color:'gray'}}>
                                                {ceramicObjectDetails.lat
                                                    ? `Lat: ${ceramicObjectDetails.lat.toFixed(4)}, Lng: ${ceramicObjectDetails.lng?.toFixed(4)}`
                                                    : "None"}
                                            </p>
                                        </IonLabel>
                                        <IonButtons slot="end">
                                            <IonButton onClick={openMapForSelection} color="primary"><IonIcon slot="icon-only" icon={locationOutline} /></IonButton>
                                            <IonButton onClick={openMapForViewing} disabled={!ceramicObjectDetails.lat} color="secondary"><IonIcon slot="icon-only" icon={mapOutline} /></IonButton>
                                        </IonButtons>
                                    </IonItem>

                                    <IonItem lines="none">
                                        <IonLabel><h3>Add Photo</h3></IonLabel>
                                        <IonButton slot="end" onClick={handleTakePhoto}>
                                            <IonIcon slot="icon-only" icon={cameraOutline} />
                                        </IonButton>
                                    </IonItem>
                                </IonList>

                                <IonButton expand="block" fill="outline" onClick={handleUpdateDetails} style={{ marginTop: '10px' }}>Save All</IonButton>
                                {scheduleToManage?.status === 'Scheduled' && <IonButton color="danger" expand="block" onClick={showDeleteConfirm} style={{ marginTop: '20px' }}>Cancel Schedule</IonButton>}
                            </>
                        )}
                    </IonContent>
                </IonModal>

                <IonModal isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}><IonContent className="ion-padding"><IonDatetime value={selectedDate} onIonChange={e => {setSelectedDate(e.detail.value as string); fetchAvailability(e.detail.value as string)}} presentation="date" /><IonList>{finalSlots.length > 0 ? finalSlots.map(slot => <IonItem button key={slot} onClick={() => {setSelectedSlot(slot); setShowObjectSelector(true)}}><IonLabel>{slot}</IonLabel></IonItem>) : <IonItem><IonLabel>Unavailable</IonLabel></IonItem>}</IonList></IonContent></IonModal>
                <IonModal isOpen={showObjectSelector} onDidDismiss={() => setShowObjectSelector(false)}><IonContent className="ion-padding"><IonList><IonItem><IonLabel>Object Type</IonLabel><IonSelect value={selectedObjectType} onIonChange={e => setSelectedObjectType(e.detail.value)}><IonSelectOption value="Mug">Mug</IonSelectOption><IonSelectOption value="Vase">Vase</IonSelectOption><IonSelectOption value="Plate">Plate</IonSelectOption></IonSelect></IonItem></IonList><IonButton expand="block" onClick={handleSchedule} disabled={!selectedObjectType}>Confirm</IonButton></IonContent></IonModal>
                <IonModal isOpen={showNotificationsModal} onDidDismiss={() => setShowNotificationsModal(false)}><IonContent className="ion-padding">{notifications.length ? notifications.map((n, i) => <IonItem key={i}><IonLabel><h2>{n.name}</h2><p>{n.message}</p></IonLabel></IonItem>) : <p>No notifications.</p>}</IonContent></IonModal>
                <IonModal isOpen={showFilterModal} onDidDismiss={handleCloseFilter}><IonContent className="ion-padding"><IonList><IonItem><IonLabel>Type</IonLabel><IonSelect value={filterObjectType} onIonChange={e => setFilterObjectType(e.detail.value)}><IonSelectOption value="Mug">Mug</IonSelectOption><IonSelectOption value="Vase">Vase</IonSelectOption><IonSelectOption value="Plate">Plate</IonSelectOption></IonSelect></IonItem><IonItem><IonLabel>Date</IonLabel><IonButton id="fdate">{filterDate ? new Date(filterDate).toLocaleDateString() : 'Select'}</IonButton><IonModal trigger="fdate"><IonDatetime presentation="date" onIonChange={e => setFilterDate(e.detail.value as string)} /></IonModal></IonItem></IonList><IonButton color="danger" onClick={clearFilters}>Reset</IonButton><IonButton onClick={applyFilters}>Apply</IonButton></IonContent></IonModal>

                <IonModal isOpen={showMapModal} onDidDismiss={() => setShowMapModal(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>{mapMode === 'select' ? 'Select Location' : 'View Location'}</IonTitle>
                            <IonButtons slot="end">
                                {mapMode === 'select' && <IonButton onClick={handleLocateMe} disabled={isLocating}>{isLocating ? <IonSpinner name="crescent" style={{width:'20px'}} /> : <IonIcon icon={locateOutline} />}</IonButton>}
                                <IonButton onClick={() => setShowMapModal(false)}>Close</IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        {selectedLocation && <MyMap lat={selectedLocation.lat} lng={selectedLocation.lng} onMapClick={handleMapClick} onMarkerClick={() => {}} />}
                        {mapMode === 'select' && <div className="ion-padding"><IonButton expand="block" onClick={confirmLocationSelection}>Confirm Location</IonButton></div>}
                    </IonContent>
                </IonModal>

            </IonContent>
        </IonPage>
    );
};

export default ScheduleList;