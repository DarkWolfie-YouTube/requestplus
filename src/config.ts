import { app } from 'electron';

const isDev = !app.isPackaged;

export const API_URL = isDev
  ? 'https://api.requestplus.xyz'
  : 'https://api.requestplus.xyz';

export const WS_URL = isDev
  ? 'wss://api.requestplus.xyz'
  : 'wss://api.requestplus.xyz';

export const WEBSITE_URL = isDev
  ? 'https://requestplus.xyz'
  : 'https://requestplus.xyz';
