import { Network, ConnectionStatus } from '@capacitor/network';
import { storage } from '../storage';
import { toastController } from '@ionic/core';

const API_BASE_URL = 'http://localhost:3000';

interface SyncItem {
    id?: string | number;
    pendingSync?: boolean;
    [key: string]: any;
}

type SyncActionType = 'save' | 'delete';
interface SyncAction {
    id: string; // ID-ul unic al acțiunii
    type: SyncActionType;
    payload: SyncItem; // Item-ul (programarea)
}

const SYNC_QUEUE_KEY = 'sync_queue';
let isSyncing = false;

async function showToast(message: string, color: string = 'medium'): Promise<void> {
    const toast = await toastController.create({
        message: message,
        duration: 3000,
        position: 'bottom',
        color: color,
    });
    await toast.present();
}

async function sendSaveActionToServer(item: SyncItem): Promise<any> {
    delete item.pendingSync;

    const url = `${API_BASE_URL}/schedules`;

    const isUpdate = (typeof item.id === 'number');
    const method = isUpdate ? 'PUT' : 'POST';
    const finalUrl = isUpdate ? `${url}/${item.id}` : url;

    if (!isUpdate && typeof item.id === 'string' && item.id.startsWith('local_')) {
        delete item.id;
    }

    const token = localStorage.getItem('authToken');
    const response = await fetch(finalUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(item)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error: ${response.status} ${errorText}`);
    }
    return response.json();
}

async function sendDeleteActionToServer(item: SyncItem): Promise<any> {
    if (typeof item.id === 'string' && item.id.startsWith('local_')) {
        console.log(`Item-ul ${item.id} a fost șters local înainte de a fi sincronizat.`);
        return { success: true, message: 'Item removed from local queue.' };
    }

    const url = `${API_BASE_URL}/schedules/${item.id}`;
    const token = localStorage.getItem('authToken');
    const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error: ${response.status} ${errorText}`);
    }
    return response.json();
}


async function addActionToQueue(type: SyncActionType, item: SyncItem, reason: 'offline' | 'server_down'): Promise<void> {
    if (type === 'save' && !item.id) {
        item.id = `local_${new Date().getTime()}`;
    }

    const newAction: SyncAction = {
        id: crypto.randomUUID(), // ID unic pentru ACȚIUNE
        type: type,
        payload: item
    };

    const queue: SyncAction[] = (await storage.get(SYNC_QUEUE_KEY)) || [];

    if (type === 'delete') {
        const actionsForThisItem = queue.filter(a => a.payload.id === item.id);
        if (actionsForThisItem.length > 0) {
            const wasCreatedOffline = actionsForThisItem.some(a => a.type === 'save' && typeof a.payload.id === 'string');
            if (wasCreatedOffline) {
                const remainingQueue = queue.filter(a => a.payload.id !== item.id);
                await storage.set(SYNC_QUEUE_KEY, remainingQueue);
                await showToast('Schedule removed from local queue.', 'warning');
                return;
            }
        }
    }

    queue.push(newAction);
    await storage.set(SYNC_QUEUE_KEY, queue);

    let actionText = type === 'save' ? 'changes' : 'deletion';
    if (reason === 'offline') {
        await showToast(`You are offline. The ${actionText} has been saved locally.`, 'warning');
    } else {
        await showToast(`The server is not responding. The ${actionText} has been saved locally.`, 'warning');
    }
}
export async function saveData(item: SyncItem): Promise<boolean> {
    const status: ConnectionStatus = await Network.getStatus();
    if (status.connected) {
        try {
            await sendSaveActionToServer(item);
            console.log('Date (Save/Update) trimise direct la server.');
            await showToast('Successfully saved the schedule!', 'success');
            return true;
        } catch (error) {
            console.warn('The server is not responding. The data has been saved locally.', error);
            await addActionToQueue('save', item, 'server_down');
            return false;
        }
    } else {
        console.log('You are offline. Schedule saved locally.');
        await addActionToQueue('save', item, 'offline');
        return false;
    }
}

export async function deleteData(item: SyncItem): Promise<boolean> {
    const status: ConnectionStatus = await Network.getStatus();
    if (status.connected) {
        try {
            await sendDeleteActionToServer(item);
            console.log('Date (Delete) trimise direct la server.');
            await showToast('Successfully deleted the schedule!', 'success');
            return true;
        } catch (error) {
            console.warn('The server is not responding. The deletion has been saved locally.', error);
            await addActionToQueue('delete', item, 'server_down');
            return false;
        }
    } else {
        console.log('You are offline. Deletion saved locally.');
        await addActionToQueue('delete', item, 'offline');
        return false;
    }
}
export async function syncOfflineData(): Promise<void> {
    if (isSyncing) {
        console.log('Sincronizarea este deja în desfășurare. Se anulează noul apel.');
        return;
    }
    isSyncing = true;

    const queue: SyncAction[] = (await storage.get(SYNC_QUEUE_KEY)) || [];
    if (queue.length === 0) {
        console.log('Coada de sincronizare este goală (syncOfflineData).');
        isSyncing = false;
        return;
    }

    console.log(`Încep sincronizarea pentru ${queue.length} acțiune(i).`);
    const remainingActions: SyncAction[] = [];
    let itemsSynced: number = 0;

    for (const action of queue) {
        try {
            switch (action.type) {
                case 'save':
                    await sendSaveActionToServer(action.payload);
                    break;
                case 'delete':
                    await sendDeleteActionToServer(action.payload);
                    break;
                default:
                    console.warn(`Tip de acțiune necunoscut: ${action.type}`);
            }
            console.log(`Acțiunea ${action.type} pentru item-ul ${action.payload.id} a fost sincronizată cu succes.`);
            itemsSynced++;
        } catch (error) {
            console.error(`Eroare la sincronizarea acțiunii ${action.type} pentru ${action.payload.id}. Rămâne în coadă.`, error);
            remainingActions.push(action);
        }
    }

    await storage.set(SYNC_QUEUE_KEY, remainingActions);
    console.log('Sincronizarea s-a încheiat.');

    if (itemsSynced > 0) {
        await showToast(`Successfully synced ${itemsSynced} ${itemsSynced === 1 ? 'change' : 'changes'}.`, 'success');
        window.dispatchEvent(new CustomEvent('dataSynced'));
    }

    isSyncing = false;
}