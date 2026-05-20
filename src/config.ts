import { app } from 'electron';

const isDev = !app.isPackaged;

export const API_URL = isDev
  ? 'https://testapi.requestplus.xyz'
  : 'https://api.requestplus.xyz';

export const WS_URL = isDev
  ? 'wss://testapi.requestplus.xyz'
  : 'wss://api.requestplus.xyz';

export const WEBSITE_URL = isDev
  ? 'https://testdev.requestplus.xyz'
  : 'https://requestplus.xyz';
