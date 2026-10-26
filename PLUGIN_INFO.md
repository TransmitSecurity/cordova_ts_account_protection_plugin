# cordova-plugin-drs v1.0.1

Production Cordova plugin package for Transmit Security Account Protection (iOS + Android).

## Build info

- Built: 2026-10-26 14:20:15 UTC
- Version: 1.0.1
- Source repo: transmitsecurity-dev/cordova_ts_account_protection
- Source commit: 67ffbfa (release/1.0.1)

## Installation

### From git

```bash
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git
# pinned to a release tag:
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git#v1.0.1
```

### From a local checkout of this package

```bash
cordova plugin add /path/to/cordova-plugin-drs
```

Then configure credentials and call `cordova.drs.initializeSDK()` or `cordova.drs.initialize(...)`.
See **UserGuide.md** for platform setup, API reference, and error handling.

## Contents

- JavaScript API under `www/drs-plugin/` (`cordova.drs`)
- iOS Swift Package (`Package.swift`) resolving AccountProtection from `TransmitSecurity/accountprotection-ios-sdk` (`3.0.9`) via SPM
- Android Kotlin bridge + Maven dependency (`src/android/cordova-plugin-drs.gradle`)
- Cordova hooks for Kotlin, Gradle wrapper pinning, and SPM-only iOS cleanup

Xcode resolves the native iOS SDK on first build (`File > Packages > Resolve Package Versions` if needed).
