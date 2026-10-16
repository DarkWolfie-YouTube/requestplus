# Request+ setup

The active setup entry point is `src/oobe.tsx`, rendering
`src/components/redesign/Onboarding.tsx`. The six steps cover introduction,
account/chat links, music connection, request rules, the stream overlay, and a
real chat-request test. Settings includes **Open setup guide** to reopen it.

## First launch

Startup opens OOBE whenever local `settings.json` does not contain the boolean
`oobeCompleted: true`. A missing file, legacy settings without the marker, or
unreadable settings all require setup. Completing setup persists the marker;
saving for later leaves setup required on the next launch. Reinstalling while
retaining completed user data preserves completion.

## Completion and persistence

- Setup loads saved desktop settings. It sends only changed, allowlisted fields;
  it does not replace unrelated preferences or write tokens to browser storage.
- Next and step navigation save changes. **Save & continue later** opens the
  client and leaves an unfinished installation unfinished. Setup returns on the
  next launch. Reopening an already completed setup does not undo its marker.
- Finish requires a linked, unexpired streaming account, an authenticated cloud
  connection, fresh music information, an external overlay polling for data,
  reviewed rules, and an accepted chat request. The user also confirms seeing
  the song in OBS/Streamlabs and hearing/seeing the requested track.
- Backend checks run again at completion. Failed writes or client-window loads
  keep setup open. Settings writes use a temporary file and rename so a partial
  write does not truncate existing preferences.
- Queue management is available for every music platform. The queue can advance
  automatically; this control does not enforce manual approval.

## Connections

No API server changes or deployment are needed. The client uses the existing
authenticated `GET /me/connections` endpoint with its desktop token and device
ID. Tokens remain in the Electron main process for this request. Linked-account
status does not claim to prove bot connectivity: the real chat test checks
delivery through the normal request pipeline. Twitch and Kick are always shown.
YouTube and Velora are shown and count toward readiness only when the API
returns `experimentalAccess: true` (eligible Patreon or manual experimental access).

Local playback and overlay services start during setup and are reused by the
main window. Pear authorization starts only when YouTube Music is selected.
Cider 4 uses the existing scoped-token authorization flow; setup stores its
result only after the user connects it.

Signed-in setup follows the account locale, refreshing after authentication and
on account refresh. Language selection is available before sign-in.

The overlay step includes the same localized theme choices as Settings. Selecting
a theme saves it immediately and reloads the live preview; a failed save keeps
the previous selection. Changing themes clears the visual confirmation.

The preview scales the actual theme to fit both dimensions, including legacy
artwork extending outside its container. OBS sizing is unaffected.

The local overlay file exists before the overlay step. `/overlay/overlay.html`
serves that same file for the embedded preview. Its `preview=1` query tells the
overlay to identify its `/info` requests as `setup-preview`. Only `source=overlay`
updates the external-overlay heartbeat, which expires after ten seconds. This
is evidence of an external overlay, not identification of OBS itself; the user
confirms the scene visually.

The request test listens for five minutes. It correlates actual request IDs with
outbound queued/rejected responses; a search result alone is not a passed test.
Changing setup preferences or accounts resets that evidence. Setup sends no
synthetic chat messages and does not automatically inject a test song.

## Validation

Run `npm run test:oobe` for regression tests. They cover settings preservation,
failed/partial writes, completion checks, account expiry, request correlation,
translation parity, and the local overlay HTTP server.

For UI work, start Vite with `npx vite --config vite.renderer.config.ts` and open
`/tests/oobe-preview.html`. This fixture has no real account or playback actions
and is not a production entry point. Optional `scenario` query values include
`offline`, `expired`, `connections-fail`, `load-fail`, `save-fail`, `finish-fail`,
`clipboard-fail`, `request-fail`, `experimental`, and `velora` (Velora-only account).

Browser checks were performed at 960×800 and 480×480, including German text,
Cider selection, successful completion, failed saves/copy, load retry, and
offline deferral. Live player authorization and a real OBS/chat session still
require testing with those applications and accounts.
