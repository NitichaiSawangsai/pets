# Security Notes

## Current posture

- No remote code execution paths are exposed.
- Renderer access to Node.js is disabled.
- Electron uses a preload bridge with an allowlisted IPC API.
- Pet state is stored as JSON and validated before use.
- File writes are atomic to reduce corruption risk.
- iCloud mirroring stores only gameplay state, not secrets.

## Recommended checks

```bash
npm test
npm run security:audit
```

For packaged builds, also run:

```bash
npx @electron/fuses read --app path/to/PocketPals.app
```

Recommended hardening for release builds:

- Enable macOS hardened runtime and notarization.
- Keep Electron updated.
- Add code signing before distribution.
- Add SAST with Semgrep rules for JavaScript/Electron.
- Add dependency scanning in CI.
