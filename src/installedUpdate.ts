import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Installation { channel: string; version: string; fingerprint: string }
interface InstallState { installed?: Installation; pending?: Installation }
const validChannel = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,29}$/.test(value);

// Include the app bundle, not just Electron's executable (which may be identical across releases).
function fingerprint(): string {
    const bundle = fs.statSync(app.getAppPath());
    return `${app.getAppPath()}:${bundle.size}:${bundle.mtimeMs}:${bundle.birthtimeMs}`;
}
function statePath(): string { return path.join(app.getPath('userData'), 'installed-update.json'); }
function read(): InstallState {
    try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')) || {}; } catch { return {}; }
}
function write(state: InstallState): void {
    const target = statePath();
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state), 'utf8');
    fs.renameSync(temporary, target);
}

export function resolveInstalledChannel(state: InstallState, current: Omit<Installation, 'channel'>, compiled: string): Installation {
    const pending = state.pending;
    if (pending && validChannel(pending.channel) && pending.version === current.version && pending.fingerprint !== current.fingerprint) {
        return { ...current, channel: pending.channel };
    }
    const installed = state.installed;
    if (installed && validChannel(installed.channel) && installed.version === current.version && installed.fingerprint === current.fingerprint) return installed;
    return { ...current, channel: compiled };
}

export function installedUpdateChannel(compiled: string): string {
    if (!app.isPackaged) return compiled;
    const state = read();
    const installed = resolveInstalledChannel(state, { version: app.getVersion(), fingerprint: fingerprint() }, compiled);
    const confirmed = state.pending?.version === installed.version && state.pending.fingerprint !== installed.fingerprint && state.pending.channel === installed.channel;
    write({ installed, ...(confirmed ? {} : { pending: state.pending }) });
    return installed.channel;
}

export function recordPendingUpdate(channel: string, version: string): void {
    if (!app.isPackaged) return;
    if (!validChannel(channel)) throw new Error('Invalid update channel');
    write({ ...read(), pending: { channel, version, fingerprint: fingerprint() } });
}

export function clearPendingUpdate(): void {
    if (!app.isPackaged) return;
    const state = read();
    delete state.pending;
    write(state);
}
