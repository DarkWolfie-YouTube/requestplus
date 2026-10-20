export const overlayThemes = [
  { value: 'default', label: 'CLIENT_THEME_DEFAULT' },
  { value: 'custom', label: 'CLIENT_THEME_CUSTOM' },
  { value: 'gojo', label: 'CLIENT_THEME_GOJO' },
  { value: 'hologram', label: 'CLIENT_THEME_HOLOGRAM' },
  { value: 'mdev', label: 'CLIENT_THEME_MDEV' },
  { value: 'moonkingbean', label: 'CLIENT_THEME_MOONKINGBEAN' },
  { value: 'twinGhost', label: 'CLIENT_THEME_TWINGHOST' },
  { value: 'nowplaying-default', label: 'CLIENT_THEME_NOWPLAYING_DEFAULT' },
  { value: 'nowplaying-custom', label: 'CLIENT_THEME_NOWPLAYING_CUSTOM' },
  { value: 'nowplaying-gojo', label: 'CLIENT_THEME_NOWPLAYING_GOJO' },
  { value: 'nowplaying-hologram', label: 'CLIENT_THEME_NOWPLAYING_HOLOGRAM' },
  { value: 'nowplaying-mdev', label: 'CLIENT_THEME_NOWPLAYING_MDEV' },
  { value: 'nowplaying-moonkingbean', label: 'CLIENT_THEME_NOWPLAYING_MOONKINGBEAN' },
  { value: 'nowplaying-twinGhost', label: 'CLIENT_THEME_NOWPLAYING_TWINGHOST' },
] as const;

/** Shared setup contract. No credentials or completion flags are accepted from status checks. */
export interface SetupConnection {
  connected: boolean;
  expired?: boolean;
  username?: string;
  channelTitle?: string;
  displayName?: string;
}

export interface SetupConnections {
  twitch?: SetupConnection;
  kick?: SetupConnection;
  youtube?: SetupConnection;
  velora?: SetupConnection;
  experimentalAccess?: boolean;
}

const chatPlatforms = [
  { key: 'twitch', label: 'Twitch', experimental: false },
  { key: 'kick', label: 'Kick', experimental: false },
  { key: 'youtube', label: 'YouTube', experimental: true },
  { key: 'velora', label: 'Velora', experimental: true },
] as const;

export function setupChatPlatforms(connections: SetupConnections | null) {
  return chatPlatforms.filter(platform => !platform.experimental || connections?.experimentalAccess === true);
}

export interface SetupStatus {
  cloud: boolean;
  music: boolean;
  platform: string;
  track: { title: string; artist: string; cover: string } | null;
  overlay: boolean;
  overlayPath: string;
  previewUrl: string | null;
  request: { accepted: boolean; code: string; songName?: string } | null;
}

const booleanFields = ['enableRequests', 'modsOnly', 'subsOnly', 'requestLimitEnabled',
  'autoPlay', 'autoAcceptSearchResults', 'filterExplicit', 'telemetryEnabled', 'reducedMotion', 'oobeRulesReviewed'];
const stringFields = ['theme', 'platform', 'appleMusicAppToken', 'ciderV4AppToken', 'ciderApiVersion'];

/** Merge only controls owned by setup, preserving preferences changed elsewhere. */
export function setupPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid setup settings');
  const source = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of booleanFields) {
    if (key in source) {
      if (typeof source[key] !== 'boolean') throw new Error(`Invalid ${key}`);
      patch[key] = source[key];
    }
  }
  for (const key of stringFields) {
    if (key in source) {
      if (typeof source[key] !== 'string' || source[key].length > 8192) throw new Error(`Invalid ${key}`);
      patch[key] = source[key];
    }
  }
  if ('theme' in patch && !overlayThemes.some(theme => theme.value === patch.theme) && patch.theme !== 'ichinyan') throw new Error('Invalid overlay theme');
  if ('platform' in patch && !['spotify', 'youtube', 'apple', 'soundcloud'].includes(patch.platform as string)) throw new Error('Invalid platform');
  if ('ciderApiVersion' in patch && !['3', '4'].includes(patch.ciderApiVersion as string)) throw new Error('Invalid Cider version');
  if ('requestLimit' in source) {
    if (!Number.isSafeInteger(source.requestLimit) || Number(source.requestLimit) < 1) throw new Error('Invalid request limit');
    patch.requestLimit = source.requestLimit;
  }
  return patch;
}

export function hasLinkedChannel(connections: SetupConnections | null): boolean {
  return !!connections && setupChatPlatforms(connections).some(({ key }) => connections[key]?.connected && !connections[key]?.expired);
}

export function setupReady(status: SetupStatus | null, linked: boolean, overlayConfirmed: boolean): boolean {
  return !!(linked && status?.cloud && status.music && status.overlay && overlayConfirmed && status.request?.accepted);
}

export interface SetupFinishInput {
  patch: unknown;
  deferred?: boolean;
  overlayConfirmed?: boolean;
  requestConfirmed?: boolean;
}

/** Keep setup open on every failure, including an unsuccessful player-window launch. */
export async function finishSetup<T extends { oobeCompleted?: boolean; oobeRulesReviewed?: boolean }>(
  input: SetupFinishInput,
  dependencies: {
    persistDraft: (patch: unknown) => void;
    load: () => T;
    save: (settings: T) => void;
    status: () => SetupStatus;
    connections: () => Promise<SetupConnections>;
    openClient: () => Promise<void>;
    closeSetup: () => void;
  },
): Promise<void> {
  dependencies.persistDraft(input.patch);
  // Fetch remote links first; local readiness and settings may change during the request.
  const linked = input.deferred === true ? false : hasLinkedChannel(await dependencies.connections());
  const previous = dependencies.load();
  if (input.deferred !== true && (input.requestConfirmed !== true || !previous.oobeRulesReviewed ||
      !setupReady(dependencies.status(), linked, input.overlayConfirmed === true))) {
    throw new Error('Complete the connection and request checks, or save and continue later');
  }
  dependencies.save({ ...previous, oobeCompleted: input.deferred === true ? previous.oobeCompleted === true : true });
  try { await dependencies.openClient(); }
  catch (error) { dependencies.save(previous); throw error; }
  dependencies.closeSetup();
}

/** A response only proves delivery when it belongs to a request seen during this test. */
export class SetupRequestCheck {
  private startedAt = 0;
  private ids = new Set<string>();
  result: SetupStatus['request'] = null;
  constructor(private now: () => number = Date.now) {}
  reset(): void { this.startedAt = 0; this.ids.clear(); this.result = null; }
  start(): void { this.reset(); this.startedAt = this.now(); }
  observe(id: unknown): void {
    if (this.active() && id != null) this.ids.add(String(id));
  }
  respond(message: { type: string; msgID?: unknown; message?: unknown; songName?: string }): void {
    if (!this.active() || !this.ids.has(String(message.msgID))) return;
    if (!['song_request_response', 'song_search_response'].includes(message.type)) return;
    const code = String(message.message || '');
    this.result = { accepted: /^OKAY_.*QUEUED$/.test(code), code, songName: message.songName };
  }
  private active(): boolean { return this.startedAt > 0 && this.now() - this.startedAt < 300000; }
}
