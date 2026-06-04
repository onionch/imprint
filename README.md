# Imprint

A lightweight desktop application for event check-in and badge printing, built with Tauri 2. Fully offline — no server required.

## Features

- **Attendee Management** — Import attendees from Excel/CSV, add walk-ins on site, search by name/ID/phone/badge code
- **Fast Check-in** — Real-time fuzzy search, one-click confirm with visual and audio feedback
- **Badge Printing** — Auto-print badges on check-in, with manual reprint support
- **Template Editor** — 5 built-in badge templates (Standard, Minimal, VIP, Speaker, A4), customizable via JSON schema with text, QR code, image, and shape elements
- **Multi-Meeting** — Manage multiple events with independent attendee lists and check-in records
- **Statistics** — Real-time check-in progress and exportable records
- **Auto Update** — In-app update checking and installation via GitHub Releases

## Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/onionch/imprint/releases).

| Platform | File |
|---|---|
| Windows | `.msi` or `.exe` installer |
| macOS | `.dmg` (Apple Silicon) |
| Linux | `.AppImage` or `.deb` |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Platform-specific build tools:
  - **Windows**: Visual Studio 2022 Build Tools with "C++ Desktop Development" workload
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

### Setup

```bash
git clone https://github.com/onionch/imprint.git
cd imprint
npm install
```

### Run in Development

```bash
npx tauri dev
```

### Build for Production

```bash
npx tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | [Tauri 2](https://v2.tauri.app/) |
| Backend | Rust, SQLite (rusqlite), calamine, qrcode |
| Frontend | React 19, TypeScript, Ant Design, Zustand |
| Build | Vite, Cargo |

## Project Structure

```
checkin-tauri/
├── src/                          # React frontend
│   ├── app/layout/AppShell.tsx   # Main layout
│   ├── features/
│   │   ├── attendee/             # Attendee management
│   │   ├── checkin/              # Check-in & records
│   │   ├── meeting/              # Meeting CRUD
│   │   ├── printing/             # Printer settings
│   │   ├── template/             # Badge template editor
│   │   └── update/               # Auto-update UI
│   └── shared/api/               # Tauri IPC wrappers
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC command handlers
│   │   ├── db/                   # SQLite schema, models, CRUD
│   │   ├── badge/                # Template parsing & HTML rendering
│   │   ├── import/               # Excel/CSV reader
│   │   └── print/                # Printer enumeration
│   ├── builtin_templates/        # 5 built-in badge templates
│   ├── tauri.conf.json           # Tauri configuration
│   └── Cargo.toml
├── .github/workflows/release.yml # CI/CD: build & publish on tag push
└── package.json
```

## Release

Releases are automated via GitHub Actions. To publish a new version:

1. Update the version in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
2. Commit and tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. GitHub Actions will build for Windows, macOS, and Linux, then create a draft release with all installers and a `latest.json` updater manifest for in-app updates.

### Signing Key

The auto-updater uses Ed25519 signatures. To regenerate the signing key pair:

```bash
npx tauri signer generate
```

- Public key goes into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
- Private key goes into GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`

## License

MIT
