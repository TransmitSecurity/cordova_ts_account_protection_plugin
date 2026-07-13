// swift-tools-version:5.9
import PackageDescription

// Account Protection iOS SDK via Swift Package Manager.
// AccountProtection pulls TSCoreSDK transitively from the SDK package manifest.
let package = Package(
    name: "cordova-plugin-drs",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-plugin-drs", targets: ["DRSPlugin"])
    ],
    dependencies: [
        .package(name: "cordova-ios", path: "../cordova-ios"),
        .package(url: "https://github.com/TransmitSecurity/accountprotection-ios-sdk.git", exact: "3.0.4")
    ],
    targets: [
        .target(
            name: "DRSPlugin",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "AccountProtection", package: "accountprotection-ios-sdk")
            ],
            path: "src/ios"
        )
    ]
)
