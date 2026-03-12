# Changelog

All notable changes to Request+ will be documented in this file.

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
