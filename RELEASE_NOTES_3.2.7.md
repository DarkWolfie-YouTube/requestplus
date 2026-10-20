# Request+ 3.2.7

## Stable update

Request+ 3.2.7 includes the 3.2.5 and 3.2.6 updater, playback, and
performance improvements, with a simpler and more reliable branch installer
flow.

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
- Recorded the selected branch before installation so the installed app can
  confirm which update channel was installed.

### Fixes

- Launch downloaded Windows branch installers directly instead of using a
  separate branch-switch helper process.
- Fixed branch installers being terminated when Request+ exits.
- Improved updater preflight checks and native update handling.
- Prevented update helpers from being treated as started before their startup
  handshake completes.
- Updated localized About dialogs to report version 3.2.7.
