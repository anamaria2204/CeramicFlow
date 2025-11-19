import { Storage, Drivers } from '@ionic/storage';
import * as CordovaSQLiteDriver from 'localforage-cordovasqlitedriver';

export const storage = new Storage({
    name: '__ceramicdb',
    driverOrder: [CordovaSQLiteDriver._driver, Drivers.IndexedDB, Drivers.LocalStorage]
});

storage.defineDriver(CordovaSQLiteDriver);
