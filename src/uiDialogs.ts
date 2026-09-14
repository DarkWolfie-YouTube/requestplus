import type { BrowserWindow } from 'electron';

const pendingModals = new Map<string, (response: number) => void>();

/** Send a modal to the renderer and resolve with the index of the button clicked. */
export function sendModal(window: BrowserWindow | null, title: string, message: string, buttons: string[]): Promise<number> {
    return new Promise((resolve) => {
        if (!window || window.isDestroyed()) {
            resolve(-1);
            return;
        }
        const id = Math.random().toString(36).substring(2);
        const onClosed = () => finish(-1);
        const finish = (response: number) => {
            pendingModals.delete(id);
            window.removeListener('closed', onClosed);
            resolve(response);
        };
        pendingModals.set(id, finish);
        window.once('closed', onClosed);
        window.webContents.send('show-modal', { id, title, message, buttons });
    });
}

/** Called from main.ts when the renderer sends back a modal-response event. */
export function resolveModal(id: string, response: number): void {
    const resolver = pendingModals.get(id);
    if (resolver) {
        resolver(response);
        pendingModals.delete(id);
    }
}

