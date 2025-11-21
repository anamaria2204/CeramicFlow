import { useEffect, useState } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';

interface MyLocation {
    position?: Position | null;
    error?: Error;
}

export const useMyLocation = () => {
    const [state, setState] = useState<MyLocation>({});

    useEffect(() => {
        let cancelled = false;
        let callbackId: string | undefined;

        const startWatching = async () => {
            // 1. Încercăm să obținem poziția curentă imediat
            try {
                const position = await Geolocation.getCurrentPosition();
                if (!cancelled) {
                    setState({ position });
                }
            } catch (error: any) {
                if (!cancelled) {
                    setState({ error });
                }
            }

            // 2. Pornim urmărirea continuă (Watch)
            try {
                callbackId = await Geolocation.watchPosition({}, (position, error) => {
                    if (!cancelled) {
                        setState({
                            position: position || null,
                            error: error || undefined
                        });
                    }
                });
            } catch (error: any) {
                if (!cancelled) {
                    setState({ error });
                }
            }
        };

        startWatching();

        return () => {
            cancelled = true;
            if (callbackId) {
                Geolocation.clearWatch({ id: callbackId });
            }
        };
    }, []);

    return state;
};