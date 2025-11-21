import { GoogleMap } from '@capacitor/google-maps';
import { useEffect, useRef, useState } from 'react';
import { mapsApiKey } from '../mapsApiKey'; // Importă cheia API din src

interface MyMapProps {
    lat: number;
    lng: number;
    onMapClick: (e: { latitude: number; longitude: number }) => void;
    onMarkerClick: (e: { markerId: string; latitude: number; longitude: number }) => void;
}

const MyMap: React.FC<MyMapProps> = ({ lat, lng, onMapClick, onMarkerClick }) => {
    const mapRef = useRef<HTMLElement>(null);

    // Folosim state pentru a păstra referința la obiectul Google Map și la Marker
    // Astfel le putem accesa ulterior pentru a face update-uri
    const [gMap, setGMap] = useState<GoogleMap | null>(null);
    const [markerId, setMarkerId] = useState<string | null>(null);

    // 1. EFECTUL DE INIȚIALIZARE (Se execută o singură dată la pornire)
    useEffect(() => {
        let canceled = false;

        const initMap = async () => {
            if (!mapRef.current) return;

            try {
                // Creăm harta
                const googleMap = await GoogleMap.create({
                    id: 'my-cool-map', // ID unic al hărții
                    element: mapRef.current,
                    apiKey: mapsApiKey,
                    config: {
                        center: { lat, lng },
                        zoom: 15, // Zoom destul de apropiat
                    },
                });

                if (canceled) return;

                // Salvăm harta în state
                setGMap(googleMap);

                // Adăugăm markerul inițial
                const initialMarkerId = await googleMap.addMarker({
                    coordinate: { lat, lng },
                    title: 'Locație selectată',
                    draggable: false // Setăm true dacă vrei să poți trage de el
                });
                setMarkerId(initialMarkerId);

                // Setăm funcțiile care se apelează la click
                await googleMap.setOnMapClickListener((event) => {
                    onMapClick(event);
                });

                await googleMap.setOnMarkerClickListener((event) => {
                    onMarkerClick(event);
                });

                console.log('Map initialized successfully');

            } catch (error) {
                console.error('Error initializing map:', error);
            }
        };

        initMap();

        // Cleanup: Se execută când componenta dispare de pe ecran
        return () => {
            canceled = true;
            if (gMap) {
                gMap.removeAllMapListeners();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Array gol = doar la montare

    // 2. EFECTUL DE ACTUALIZARE (Se execută când se schimbă lat/lng)
    useEffect(() => {
        const updateMapPosition = async () => {
            // Facem update doar dacă harta există deja
            if (gMap && markerId) {
                try {
                    // Ștergem markerul vechi
                    await gMap.removeMarker(markerId);

                    // Punem unul nou la noile coordonate
                    const newId = await gMap.addMarker({
                        coordinate: { lat, lng },
                        title: 'Locație nouă',
                    });
                    setMarkerId(newId);

                    // Mutăm și "camera" (centrul hărții)
                    await gMap.setCamera({
                        coordinate: { lat, lng },
                        animate: true,
                        zoom: 15
                    });

                } catch (error) {
                    console.error('Error updating map position:', error);
                }
            }
        };

        updateMapPosition();
    }, [lat, lng, gMap]);

    return (
        <div className="component-wrapper">
            <capacitor-google-map ref={mapRef} style={{
                display: 'block',
                width: 300,
                height: 400
            }}></capacitor-google-map>
        </div>
    );
};

export default MyMap;