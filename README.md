# Pocket Pals

Pocket Pals is a small Tamagotchi-style pet for macOS. It runs as a tiny transparent overlay, can be dragged around the screen, supports a focus mode, and stores pet state in a tiny JSON file that can be mirrored to iCloud Drive when available.

<img width="284" height="373" alt="image" src="https://github.com/user-attachments/assets/d15d58d6-ee50-4668-861a-faf64e055d06" />


## Run on macOS

```bash
npm install
npm start
```

## Run tests

```bash
npm test
npm run security:audit
```

## Data location

The desktop app stores the canonical state in Electron `userData` and attempts to mirror it to:

```text
~/Library/Mobile Documents/com~apple~CloudDocs/PocketPals/pet-state.json
```

If iCloud Drive is unavailable, the app continues locally. Removing that `PocketPals` folder only removes the iCloud mirror, not the Electron app itself.

## Uninstall

1. Quit Pocket Pals from the tray menu.
2. Remove the app bundle if packaged, or delete this project folder if running from source.
3. Remove app data from Electron userData if desired.
4. Remove the iCloud mirror folder:

```bash
rm -rf "$HOME/Library/Mobile Documents/com~apple~CloudDocs/PocketPals"
```

## Mobile PWA

The `mobile/` folder is a lightweight PWA shell that shares the same game shape. True automatic iPhone/iPad sync through iCloud requires an Apple Developer CloudKit container or a native iOS app entitlement. This project keeps a CloudKit-ready data contract while using the local/iCloud-file adapter on macOS.
