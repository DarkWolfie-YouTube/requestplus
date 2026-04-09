# Changelog

All notable changes to Request+ will be documented in this file.

---

## [2.1.1] - 2026-04-09

### Bug Fixes
- **YouTube Music Toggle** - This toggle to switch the platform was left under the experminetal tag. This was not meant to be. Updating this as a hotfix.


### API Changes, YouTube Chat Support.

- **YouTube Chat Support** - THIS IS A PAID FEAUTRE, This is the only paid feature you will encounter. YouTube API will charge me money for how many requests we use. I can't pay this cost out of pocket.



---

## [2.1.0] - 2026-04-08 

### New Features
- **Internationalization (i18n)** — Full i18n system added with a `t()` helper and locale files for English, Spanish, French, and Portuguese. Locale is fetched from the API on login and streamed to all components.
- **Web-UI Modals** — Replaced all native Electron `dialog.showMessageBox` calls with an in-app modal system (show-modal IPC + modal-response + renderer UI). Terms of Service flow and update dialogs now use this system.
- **YouTube Song Requests** — Full YouTube request handling implemented. Previously returned `ERR_YT_UNSUPPORTED`; now extracts video ID, fetches song title/author from Pear, and queues or adds directly depending on moderation queue setting.
- **YouTube Auto-Queue** — Auto-queue now supports YouTube via `ytManager.addItemToQueueById()`.
- **YouTube Skip Improvement** — Skip now pre-queues the next moderation queue item in Pear before calling `.next()`.
- **YouTube Real-Time State** — `ytManager` emits a `state-update` event on WebSocket ticks, pushing song info to the renderer in real time without waiting for the poll interval.
- **System Tray** — App now minimizes to the system tray instead of closing. Tray icon shows a context menu (Show / Quit); single click focuses or shows the window.
- **Apple Music Search** — Added `onSearchRequest()` in `AMHandler` and a new `song-search-request` WebSocket handler in `main.ts`. Returns song name, artist, and link from the Cider API catalog search.

### Improvements
- **Settings Auto-Save** — Settings now save automatically on change; the manual Save button has been removed.
- **MusicPlayer Volume Slider** — Volume slider no longer snaps back to the server value during adjustment. A 2-second lock (`isAdjustingVolume` ref) blocks incoming song-info pushes while the user is dragging.
- **MusicPlayer YouTube Skip Delay** — YouTube skip uses a 1000ms delay (vs 50ms for other platforms) to account for Pear latency.
- **Queue Clear Fix** — `clearQueue` is now `async`; resets queue to the correct empty object shape `{ items: [], currentCount: 0, currentlyPlayingIndex: -1 }` instead of `[]`.
- **Navigation Queue Tab** — Queue tab is now visible for all platforms (previously hidden for YouTube).
- **Auth Flow URL** — Auth initiation now redirects to `WEBSITE_URL/desktop-auth` instead of the old API endpoint.
- **Playback Handler** — YouTube playback now prefers the cached WebSocket state over a REST fetch, reducing latency on song-info updates.
- **Duplicate Queue Listener Removed** — `api.updateQueuePage(handleQueueUpdate)` was accidentally registered three times in the renderer; now registered once.
- **Tray Icon** — Updated tray icon asset from `the_letter.png` to `tray.png`.

### Bug Fixes
- Fixed settings being saved on initial page load; auto-save now only triggers after the first render when settings actually change.

### Internal / Testing
- Version bumped to `2.1.0` in `package.json`.
- All API endpoints temporarily pointing to `testapi.requestplus.xyz` / `testdev.requestplus.xyz` for the testing phase.

---

## [2.0.1] - 2026-03-10

### Improvements
- **Apple Music — Cider WebSocket RPC** — Song information is now delivered via Cider's Socket.io RPC instead of HTTP polling, resulting in near-instant song change detection and significantly reduced CPU/network overhead.
- **Apple Music — Playback State** — Play/pause state is now updated in real-time from WebSocket events rather than polled HTTP requests.
- **Apple Music — Volume/Shuffle/Repeat Polling** — Volume, shuffle, and repeat mode are now fetched via HTTP on a separate 2500ms cycle, independent of the 500ms song info tick.
- **Apple Music — Cold Start** — Song info is now seeded from the `playbackStateDidChange` event on startup if a song is already playing before a track change event fires.
- **Song Info Polling** — All platforms now poll at 500ms; Apple Music no longer has a slower separate interval since it reads from the WebSocket cache.

### Bug Fixes
- Fixed Apple Music `likeSong` checking for `'success'` instead of `'ok'` in the API response status.
- Fixed Spotify song request link parsing not handling locale/market path segments (e.g. `open.spotify.com/intl-es/track/...`).


 - 2026-03-11


 ## Changes & Fixes
 - Fixed an issue where other regions of Spotify or Apple Music wouldn't work for song requests.
 - Mitigated issues with timeouts in Apple Music (Cider) using the ACTUAL RTC connection. (Sockets)
 - Made the Queue page not show if the moderation queue isn't enabled.
 - Removed some settings for now due to lack of code in the application layer supporting them at this time. Will be fixed in 2.0.2
 - Removed the notificaion settings option as it wasn't used for anything in the application layer.
 - Songs now properly skip to the next song in the moderation queue on apple instead of playing the next one in the playlist.
 - Added manual popup boxes for me to show without having to use the update checker.


 ## API changes
 - Added a URL checker to the API, if there isn't a URL or a URL that it can't accept, it will return a message without sending a websocket packet to your client.
 - Fixed a bug where the Twitch Bot would disconnect and not reconnect properly.
 - Added more code that kept getting removed in copy pasting attempts.
 - Updated the admin endpoints.
 - Overall bug fixes to certain responses and requests.
 - Added the Mods only and Sub only checks and their respective messages.



---

## [2.0.0] - 2026-03-04

> [!IMPORTANT]
> Spotify queue/chat command integration requires a separate OAuth application setup. Full instructions coming in a future update.

### New Features
- **Request+ Account System** — New OAuth-based authentication via the Request+ client portal. Log in once and your session persists across restarts.
- **SoundCloud Support** — Experimental SoundCloud playback integration (requires Experimental User access — join the Discord to request it: https://requestplus.xyz/discord).
- **Experimental User Program** — Early access features for selected users, detected automatically on login.
- **Overlay System** — Browser-source overlay for OBS/streaming software with customizable styles.

### Improvements
- Auth callback now correctly notifies the main window after OAuth login completes.
- Logger initializes before all other subsystems and is no longer created during auth callback processes.
- WebSocket no longer attempts to reconnect after an intentional logout.
- Navigation bar hides the Queue tab when platform is set to YouTube.

### Bug Fixes
- Fixed Cider (Apple Music) not responding in chat properly.
- Fixed Twitch auth reporting failure when no Kick account was linked.
- Fixed crash on startup when the update checker ran before the logger was ready.
- Fixed auth deep link (`requestplus://`) not notifying the main window after login.
- Fixed WebSocket reconnect loop after pressing Logout.
- Fixed Kick authentication token handling.

---

## [1.2.3] - Prior Release

- Experimental SoundCloud support (v1)
- Various stability and playback fixes for Spotify, Apple Music, and YouTube

---

Thanks for choosing Request+ for your song request needs!
