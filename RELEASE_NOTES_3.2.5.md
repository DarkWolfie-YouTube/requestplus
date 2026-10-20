# Request+ 3.2.5

## Stable update

Request+ 3.2.5 improves update reliability and playback stability for the
stable release channel.

### What's new

- Improved Windows update branch switching and helper startup reliability.
- Remembered the last installed update branch to prevent repeated branch
  selection prompts.
- Added support for safely switching update channels without requiring a
  newer version.
- Added a safety net for stalled YouTube auto-advance.
- Improved Pear startup and playback synchronization.
- Added fallback ports for local Linux services.
- Reduced idle GPU and CPU usage and improved close/restart behavior.

### Fixes

- Improved updater preflight checks and native update handling.
- Prevented update helpers from being treated as started when they exit before
  completing their startup handshake.
- Updated localized About dialogs to report version 3.2.5.
