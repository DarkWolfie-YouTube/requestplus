# Request+ 3.2.6

## Stable update

Request+ 3.2.6 includes the 3.2.5 stable improvements plus a fix for
Windows branch-switch installation reliability.

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

- Fixed the Windows branch-switch helper being terminated when Request+ exits
  before the uninstall and installation steps complete.
- Improved updater preflight checks and native update handling.
- Prevented update helpers from being treated as started before their startup
  handshake completes.
- Updated localized About dialogs to report version 3.2.6.
