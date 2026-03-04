# Changelog

All notable changes to Request+ will be documented in this file.

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
