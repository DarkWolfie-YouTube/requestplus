# Request+ Snap Build

Build the snap from the repository root on Ubuntu:

```bash
sudo snap install snapcraft --classic
snapcraft --use-lxd
```

Install the local build:

```bash
sudo snap install --dangerous requestplus_2.2.0_amd64.snap
```

Run it:

```bash
requestplus
```

Check the custom URL handler:

```bash
xdg-mime query default x-scheme-handler/requestplus
xdg-open 'requestplus://auth?test=1'
```

If the desktop does not refresh the handler right away, log out and back in, or run:

```bash
update-desktop-database ~/.local/share/applications 2>/dev/null || true
```

Notes:

- The snap uses strict confinement.
- `password-manager-service` is included for Electron safe storage on Linux.
- `network-bind` is included because Request+ opens local WebSocket/API listeners.
