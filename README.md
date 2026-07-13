# Account Protection (DRS) Plugin for Cordova

Cordova plugin for Transmit Security Account Protection (iOS + Android).

- **Integrating into your app** → [UserGuide.md](UserGuide.md)
- **Developing this plugin** → read on

## Quick start (example app)

One script stages the plugin, reinstalls it in the demo app, syncs iOS SPM, and runs `cordova prepare` for both platforms:

```bash
git clone https://github.com/transmitsecurity-dev/cordova_ts_account_protection
cd cordova_ts_account_protection

bash scripts/prepare_example_app.sh --fresh              # first time
# edit example/resources/ios/TransmitSecurity.plist (+ Android strings) with real credentials

bash scripts/prepare_example_app.sh                      # after every plugin edit
```

Then open **`example/platforms/ios/App.xcworkspace`** (Xcode) or **`example/platforms/android`** (Android Studio) and run.

Details: [example/README.md](example/README.md).

## Prerequisites

- Node.js (LTS), Cordova CLI (`npx cordova …`)
- **iOS:** Xcode 16+ with network access for Swift Package Manager (AccountProtection SDK from GitHub)
- **Android:** Android Studio / SDK API 24+; SDK AAR from Transmit Maven (see `src/android/cordova-plugin-drs.gradle`)

## iOS native SDK

The plugin's `Package.swift` resolves the Account Protection SDK from GitHub:

- Repository: [TransmitSecurity/accountprotection-ios-sdk](https://github.com/TransmitSecurity/accountprotection-ios-sdk)
- Version: `3.0.2` (latest public SPM release; `3.0.3` not yet published there)
- Product: `AccountProtection` (pulls `TSCoreSDK` transitively)

Xcode downloads this on first build. No local SDK build step in this repo.

Android has no local SDK build step.

## Add the plugin to an external Cordova app

**Customers and integrators** should install from the published plugin repo:

```bash
cd /path/to/your/cordova/app

# Latest from main
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git

# Pinned to a release tag (recommended for production)
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git#v0.1.0

cordova platform add ios android   # first time
cordova prepare ios android
```

Then add credentials (`TransmitSecurity.plist` on iOS, `strings.xml` on Android) and call `cordova.drs.initializeSDK()` or `cordova.drs.initialize(...)`. Full setup, API, and error handling: **[UserGuide.md](UserGuide.md)**.

### Local path (plugin developers only)

To test unpublished changes from **this dev repo**, stage first — do not `cordova plugin add` the repo root (the bundled `example/` app breaks iOS SPM):

```bash
bash scripts/stage-plugin-copy-excluding-example-app.sh
cd /path/to/your/cordova/app
cordova plugin add /path/to/cordova_ts_account_protection/.cordova-plugin-staging
cordova prepare ios android
```

Or use the bundled demo: `bash scripts/prepare_example_app.sh` (see [example/README.md](example/README.md)).

## Publishing (`scripts/build_plugin.sh`)

This dev repo is **not** what customers clone. It contains the example app and dev scripts. Before each public release, run **`scripts/build_plugin.sh`** to build a customer-ready package and push it to:

**https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin**

### What the script produces

The output is a self-contained Cordova plugin directory (`./cordova-plugin-drs/` locally) that:

| Included | Excluded |
|----------|----------|
| `plugin.xml`, `package.json`, `Package.swift` | `example/` demo app |
| `www/`, `src/ios/`, `src/android/` | Dev scripts (`prepare_example_app.sh`, `stage-*`, `build_plugin.sh`) |
| Cordova hooks (`enable-android-kotlin.js`, etc.) | `.cordova-plugin-staging/` |
| `README.md`, `UserGuide.md` (+ optional `UserGuide.pdf`) | |

Customers can `cordova plugin add` the GitHub URL; Xcode resolves the iOS SDK via SPM on first build.

### Commands

```bash
# 1. Inspect the package locally (no git push)
bash scripts/build_plugin.sh --pack-only

# 2. Push to a test branch on the public repo (no GitHub release)
bash scripts/build_plugin.sh --push_branch develop

# 3. Production release → force-push main + GitHub release v<plugin.xml version>
bash scripts/build_plugin.sh release
```

**Prerequisites:** `plugin.xml` version bumped, SSH access to the public repo, and `gh` CLI for `release` mode.

**Version source:** `plugin.xml` `version="…"` (also synced into dist `package.json`). Release tag is `v` + that version (e.g. `v0.1.0`).

**Optional env overrides** (defaults already target `TransmitSecurity/cordova_ts_account_protection_plugin`):

| Variable | Purpose |
|----------|---------|
| `PLUGIN_DIST_REPO_URL` | Git remote for push (default: `git@github.com:TransmitSecurity/cordova_ts_account_protection_plugin.git`) |
| `PLUGIN_DIST_GH_REPO` | `owner/repo` for `gh release create` |
| `PLUGIN_SOURCE_REPO` | Label in release notes / `PLUGIN_INFO.md` only |

### Typical release workflow

```bash
# bump version in plugin.xml (+ package.json if you keep them in sync)
bash scripts/build_plugin.sh --pack-only          # verify ./cordova-plugin-drs/
bash scripts/build_plugin.sh --push_branch develop   # QA install from develop branch
bash scripts/build_plugin.sh release              # ship main + tag
```

Integrators then pin: `cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git#v0.1.0`


## Project layout

```
plugin.xml / Package.swift          Cordova manifest + iOS SPM
www/drs-plugin/                     JavaScript API (cordova.drs) + web telemetry
src/ios/DRSPlugin.swift             iOS bridge
src/android/DRSPlugin.kt            Android bridge
scripts/prepare_example_app.sh      Main dev loop for the example app
example/                            Cordova demo app
```

## When `prepare_example_app.sh` is not enough

| Change | Extra step |
|--------|------------|
| `Package.swift` or `plugin.xml` platform config | Usually covered by prepare (reinstalls plugin); use `--fresh` if stuck |
| Stale Xcode Swift modules after SDK update | Product → Clean Build Folder (⇧⌘K); File → Packages → Reset Package Caches |

## Scripts

| Script | Purpose |
|--------|---------|
| **`scripts/prepare_example_app.sh`** | **Main loop** — stage, reinstall plugin, sync iOS SPM, prepare iOS + Android |
| `scripts/prepare_example_app.sh --fresh` | Same, but wipes `example/platforms` and `example/plugins` first |
| `scripts/stage-plugin-copy-excluding-example-app.sh` | Copy plugin to `.cordova-plugin-staging/` for local `cordova plugin add` |
| `scripts/sync-example-ios-spm.sh` | Internal — used by prepare |
| `scripts/enable-android-kotlin.js` | Cordova hook — Kotlin on each prepare |
| `scripts/pin-android-gradle-wrapper.js` | Cordova hook — keeps Gradle on cordova-android’s pinned version |
| `scripts/remove-unused-ios-cocoapods.js` | Cordova hook — strips empty CocoaPods scaffolding (SPM-only iOS) |
| **`scripts/build_plugin.sh`** | **Customer distribution** — package plugin, push to dist repo |

Generated (gitignored): `.cordova-plugin-staging/`, `example/platforms/`, `example/plugins/`, `cordova-plugin-drs/`.

## Further reading

- [UserGuide.md](UserGuide.md) — app integration
- [Transmit Account Protection docs](https://developer.transmitsecurity.com/guides/risk/overview)
