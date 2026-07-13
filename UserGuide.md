# Cordova TS Account Protection - User Guide

## Overview

The Cordova Transmit Security Account Protection plugin adds behavioral analytics and fraud detection to your Cordova app using Transmit Security's Account Protection platform.

## Requirements

- **Cordova**: CLI 12+ (tested with cordova-ios 8.x, cordova-android 14.x)
- **iOS**: 13.0 or higher, Xcode 16+
- **Android**: API level 24 (Android 7.0) or higher
- **Node.js**: LTS recommended

## Native SDK Documentation

- [Account Protection Guides](https://developer.transmitsecurity.com/guides/risk/overview)

## Installation

Install from the **published plugin repository** (recommended):

```bash
cd /path/to/your/cordova/app

# Pinned to a release (recommended for production)
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin.git#v1.0.0

cordova platform add ios android
cordova prepare ios android
```

The published repo resolves the iOS Account Protection SDK via Swift Package Manager — you do not build native SDK sources in your app project.

### iOS setup

- Deployment target **13.0** or higher.
- The plugin is a Swift Package Manager plugin (`plugin.xml` `package="swift"`). `Package.swift` declares a remote SPM dependency on [TransmitSecurity/accountprotection-ios-sdk](https://github.com/TransmitSecurity/accountprotection-ios-sdk) (`VERSION_NAME`). Xcode resolves it on first build.
- Add **TransmitSecurity.plist** to the iOS app (see [Configuration](#configuration-files)).

Optional in `config.xml`:

```xml
<platform name="ios">
    <preference name="deployment-target" value="13.0" />
    <resource-file src="resources/ios/TransmitSecurity.plist" target="TransmitSecurity.plist" />
</platform>
```

### Android setup

The plugin adds `INTERNET`, `ACCESS_NETWORK_STATE`, and `ACCESS_FINE_LOCATION` to the manifest and pulls the Account Protection SDK from Transmit's Maven repository via `cordova-plugin-drs.gradle`.

Ensure your app-level Gradle can resolve the repository (usually inherited from the Cordova Android project). Minimum SDK **24**.

Add Transmit credentials to `res/values/strings.xml` (see [Configuration](#configuration-files)).

## Configuration files

### iOS — TransmitSecurity.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>credentials</key>
    <dict>
        <key>clientId</key>
        <string>your-client-id</string>
        <key>baseUrl</key>
        <string>https://api.transmitsecurity.io/risk-collect/</string>
    </dict>
</dict>
</plist>
```

### Android — strings.xml

```xml
<resources>
    <string name="transmit_security_client_id">your-client-id</string>
    <string name="transmit_security_base_url">https://api.transmitsecurity.io/risk-collect/</string>
</resources>
```

Replace `your-client-id` with your Transmit Security client ID.

## Quick start

The plugin exposes **`cordova.drs`** after `deviceready`.

### 1. Initialize the SDK

```javascript
document.addEventListener('deviceready', function () {
    cordova.drs.initializeSDK()
        .then(function () {
            console.log('Account Protection SDK initialized');
        })
        .catch(function (err) {
            console.error('Init failed', err);
        });
});
```

Optional explicit initialization:

```javascript
cordova.drs.initialize(
    'your-client-id',
    'https://api.transmitsecurity.io/risk-collect/',
    { enableLocationEvents: true },
    null  // optional userId
);
```

### 2. Web telemetry (automatic)

The plugin loads web telemetry on startup (`events.js`). It maps DOM widgets, tracks taps/touches, and reports navigation changes in the WebView. No extra wiring is required for basic HTML apps.

Call **`cordova.drs.logPageLoad(pageName)`** when you use a custom SPA router and want explicit page names.

### 3. Set authenticated user

```javascript
cordova.drs.setAuthenticatedUser('user-123', {
    loginMethod: 'password',
    email: 'user@example.com',
});
```

On **Android**, call this after the WebView activity is visible.

### 4. Trigger security actions

```javascript
cordova.drs.triggerAction(
    'login',
    {
        correlationId: 'login-' + Date.now(),
        claimedUserId: 'user@example.com',
        claimedUserIdType: 'email',
    },
    { mode: 'default' },
    { loginMethod: 'password', appVersion: '1.0.0' }
).then(function (result) {
    if (result.success) {
        console.log('Action token:', result.actionToken);
    } else {
        console.log('Action failed or flagged');
    }
});
```

Transaction example:

```javascript
cordova.drs.triggerAction('transaction', {
    correlationId: 'txn-' + Date.now(),
    transactionData: {
        amount: 1500.00,
        currency: 'USD',
        reason: 'Money Transfer',
        payee: { name: 'Jane Smith', accountNumber: '****1234' },
        payer: { name: 'John Doe', accountNumber: '****5678' },
    },
}, { mode: 'default' });
```

`triggerAction` resolves with `{ success, actionToken }`. It does not throw on SDK rejection; check `success`.

**`claimedUserIdType`**: `email`, `username`, `phoneNumber`, `accountId`, `ssn`, `nationalId`, `passportNumber`, `driversLicenseNumber`, `other`.

**`locationConfig.mode`**: `disabled`, `default`, `forceCurrent`, `forceLastKnown`, or `lastKnown` (optional `validFor` seconds).

### 5. Other API methods

```javascript
cordova.drs.getSessionToken();   // resolves with token string
cordova.drs.clearUser();
cordova.drs.setLogLevel(true);   // debug on/off
cordova.drs.logPageLoad('Dashboard');
```

## Error handling

### Initialization

`initializeSDK()` and `initialize()` reject the promise on failure (missing config, SDK error). Example:

```javascript
cordova.drs.initializeSDK().catch(function (err) {
    console.error(err.code, err.message);
});
```

On **Android**, missing `transmit_security_client_id` or `transmit_security_base_url` returns `MISSING_INIT_PARAMS`.

### triggerAction

Failures return `{ success: false }` without throwing. Use `actionToken` only when `success` is true.

### Other calls

`setAuthenticatedUser`, `clearUser`, `getSessionToken`, and `logPageLoad` reject on native errors. On **Android**, some calls fail with `NO_ACTIVITY` if invoked before the activity is ready.

## Local development

This repository includes an `example/` Cordova app. Plugin contributors should use **`scripts/prepare_example_app.sh`** — see [README.md](README.md#quick-start-example-app).

```bash
bash scripts/prepare_example_app.sh --fresh              # first time
bash scripts/prepare_example_app.sh                      # after each plugin edit
```

Use `--fresh` if the example is in a bad state (SPM conflicts, missing web assets). Edit credentials under `example/resources/` before testing login.

## iOS SDK dependency

The plugin's `Package.swift` pulls AccountProtection from [TransmitSecurity/accountprotection-ios-sdk](https://github.com/TransmitSecurity/accountprotection-ios-sdk) (`3.0.2`). After SDK updates, clean Xcode's build folder and reset package caches if you see stale Swift module errors.

## Logging

Use `cordova.drs.setLogLevel(true)`. The plugin calls `TSAccountProtection.setLogLevel` on iOS.
