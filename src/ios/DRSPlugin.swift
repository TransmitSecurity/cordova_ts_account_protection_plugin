import Foundation
import UIKit
import Cordova
import AccountProtection

@objc(DRSPlugin)
public class DRSPlugin: CDVPlugin {

    private var collectorConfigurationListenerToken: UUID?
    private var collectorConfigurationCallbackId: String?

    private var isInitialized = false

    private static func boolValue(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let value = value as? NSNumber { return value.boolValue }
        return nil
    }

   @objc func initializeSDK(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            do {
                try TSAccountProtection.initializeSDK()
                self.isInitialized = true
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "INIT_ERROR", message: error.localizedDescription)
            }
        }
    }

    @objc func initialize(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let clientId = args["clientId"] as? String,
              let baseUrl = args["baseUrl"] as? String else {
            sendError(command, code: "INVALID_ARGS", message: "clientId and baseUrl are required")
            return
        }

        DispatchQueue.main.async {
            var configuration: TSInitSDKConfiguration?
            if let config = args["configuration"] as? [String: Any] {
                let enableLocationEvents = config["enableLocationEvents"] as? Bool ?? false
                configuration = TSInitSDKConfiguration(enableLocationEvents: enableLocationEvents)
            }
            let userId = args["userId"] as? String
            TSAccountProtection.initialize(
                baseUrl: baseUrl,
                clientId: clientId,
                userId: userId,
                configuration: configuration
            )
            self.isInitialized = true
            self.sendOk(command, true)
        }
    }

    @objc func setAuthenticatedUser(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let userId = args["userId"] as? String else {
            sendError(command, code: "INVALID_ARGS", message: "userId is required")
            return
        }
        DispatchQueue.main.async {
            let options = args["options"] as? [String: Any]
            TSAccountProtection.setAuthenticatedUser(userId, options: options)
            self.sendOk(command, true)
        }
    }

    @objc func triggerAction(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let action = args["action"] as? String else {
            sendError(command, code: "INVALID_ARGS", message: "action is required")
            return
        }

        DispatchQueue.main.async {
            let options = (args["options"] as? [String: Any]).map { Self.convertActionEventOptions($0) }
            let locationConfig = Self.convertLocationConfig(args["locationConfig"] as? [String: Any])
            let customAttributes = args["customAttributes"] as? [String: Any]

            TSAccountProtection.triggerAction(
                action,
                customAttributes: customAttributes,
                options: options,
                locationConfig: locationConfig
            ) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let response):
                        self.sendOk(command, ["success": true, "actionToken": response.actionToken])
                    case .failure(let error):
                        self.sendError(command, code: "ACTION_ERROR", message: error.localizedDescription)
                    }
                }
            }
        }
    }

    @objc func clearUser(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            TSAccountProtection.clearUser()
            self.sendOk(command, true)
        }
    }

    @objc func getSessionToken(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            TSAccountProtection.getSessionToken { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let token):
                        self.sendOk(command, token)
                    case .failure(let error):
                        self.sendError(command, code: "SESSION_ERROR", message: String(describing: error))
                    }
                }
            }
        }
    }

    @objc func setLogLevel(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let isLogEnabled = Self.boolValue(args["isLogEnabled"]) else {
            sendError(command, code: "INVALID_ARGS", message: "isLogEnabled is required")
            return
        }
        DispatchQueue.main.async {
            TSAccountProtection.setLogLevel(isLogEnabled ? .debug : .off)
            self.sendOk(command, true)
        }
    }

    @objc func logPageLoad(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let pageName = args["pageName"] as? String else {
            sendError(command, code: "INVALID_ARGS", message: "pageName is required")
            return
        }
        DispatchQueue.main.async {
            do {
                try TSAccountProtection.logPageLoad(pageName)
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "PAGE_LOAD_ERROR", message: error.localizedDescription)
            }
        }
    }

    @objc func reportDrsEvent(_ command: CDVInvokedUrlCommand) {
        guard let wrapper = command.arguments.first as? [String: Any],
              let event = Self.nestedDictionary(wrapper["event"]) else {
            return
        }
        DispatchQueue.main.async {
            guard self.isInitialized else { return }  // drop telemetry until SDK init
            do {
                try TSAccountProtection.logInteractionEvent(event)
            } catch {
                // Fire-and-forget telemetry; JS registers no success/error handlers.
            }
        }
    }

    @objc func collectorConfigurationUpdates(_ command: CDVInvokedUrlCommand) {
        collectorConfigurationCallbackId = command.callbackId
        DispatchQueue.main.async {
            self.sendConfigUpdate(
                callbackId: command.callbackId,
                config: TSAccountProtection.getCollectorConfiguration()
            )
            self.registerCollectorConfigurationListener()
        }
    }

    @objc func reportInput(_ command: CDVInvokedUrlCommand) {
        guard let fieldId = command.arguments.first as? String else {
            sendError(command, code: "INVALID_ARGS", message: "missing fieldId")
            return
        }
        let length: Int
        if command.arguments.count > 1, let n = command.arguments[1] as? Int {
            length = n
        } else if command.arguments.count > 1, let n = command.arguments[1] as? NSNumber {
            length = n.intValue
        } else {
            length = 0
        }
        DispatchQueue.main.async {
            guard self.isInitialized else { return }  // drop telemetry until SDK init
            do {
                try TSAccountProtection.logInteractionEvent([
                    "interaction_type": "input",
                    "location": fieldId,
                    "length": length,
                ])
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "INPUT_ERROR", message: error.localizedDescription)
            }
        }
    }

    public override func dispose() {
        if let token = collectorConfigurationListenerToken {
            TSAccountProtection.removeCollectorConfigurationListener(token)
            collectorConfigurationListenerToken = nil
        }
        collectorConfigurationCallbackId = nil
        super.dispose()
    }

    private func registerCollectorConfigurationListener() {
        if let token = collectorConfigurationListenerToken {
            TSAccountProtection.removeCollectorConfigurationListener(token)
            collectorConfigurationListenerToken = nil
        }

        let listener: ([String: Any]) -> Void = { [weak self] snapshot in
            DispatchQueue.main.async {
                guard let self, let callbackId = self.collectorConfigurationCallbackId else { return }
                self.sendConfigUpdate(callbackId: callbackId, config: snapshot)
            }
        }

        collectorConfigurationListenerToken = TSAccountProtection.addCollectorConfigurationListener(listener)
    }

    private func sendConfigUpdate(callbackId: String, config: [String: Any]) {
        let result = CDVPluginResult(status: .ok, messageAs: Self.pluginDictionary(config))
        result.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: callbackId)
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: Bool) {
        commandDelegate.send(CDVPluginResult(status: .ok, messageAs: message), callbackId: command.callbackId)
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: String) {
        commandDelegate.send(CDVPluginResult(status: .ok, messageAs: message), callbackId: command.callbackId)
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: [String: Any]) {
        commandDelegate.send(
            CDVPluginResult(status: .ok, messageAs: Self.pluginDictionary(message)),
            callbackId: command.callbackId
        )
    }

    private func sendError(_ command: CDVInvokedUrlCommand, code: String, message: String) {
        commandDelegate.send(
            CDVPluginResult(
                status: .error,
                messageAs: Self.pluginDictionary(["code": code, "message": message])
            ),
            callbackId: command.callbackId
        )
    }

    private static func pluginDictionary(_ dict: [String: Any]) -> [AnyHashable: Any] {
        Dictionary(uniqueKeysWithValues: dict.map { (AnyHashable($0.key), nestedValue($0.value)) })
    }

    private static func nestedDictionary(_ value: Any?) -> [String: Any]? {
        switch value {
        case let dict as [String: Any]:
            return dict.mapValues { nestedValue($0) }
        case let dict as NSDictionary:
            var result: [String: Any] = [:]
            dict.forEach { key, val in
                if let key = key as? String {
                    result[key] = nestedValue(val)
                }
            }
            return result.isEmpty ? nil : result
        default:
            return nil
        }
    }

    private static func nestedValue(_ value: Any) -> Any {
        switch value {
        case let dict as [String: Any]:
            return dict.mapValues { nestedValue($0) }
        case let array as [Any]:
            return array.map { nestedValue($0) }
        case let dict as NSDictionary:
            var result: [String: Any] = [:]
            dict.forEach { key, val in
                if let key = key as? String {
                    result[key] = nestedValue(val)
                }
            }
            return result
        case let array as NSArray:
            return array.map { nestedValue($0) }
        default:
            return value
        }
    }

    private static func convertActionEventOptions(_ options: [String: Any]) -> TSActionEventOptions {
        let claimedUserIdType: TSClaimedUserIdType? = {
            guard let raw = options["claimedUserIdType"] as? String else { return nil }
            return convertClaimedUserIdType(raw)
        }()
        return TSActionEventOptions(
            correlationId: options["correlationId"] as? String,
            claimedUserId: options["claimedUserId"] as? String,
            referenceUserId: options["referenceUserId"] as? String,
            transactionData: convertTransactionData(options["transactionData"] as? [String: Any]),
            claimedUserIdType: claimedUserIdType
        )
    }

    private static func convertClaimedUserIdType(_ type: String) -> TSClaimedUserIdType? {
        switch type {
        case "email": return .email
        case "username": return .username
        case "phoneNumber": return .phoneNumber
        case "accountId": return .accountId
        case "ssn": return .ssn
        case "nationalId": return .nationalId
        case "passportNumber": return .passportNumber
        case "driversLicenseNumber": return .driversLicenseNumber
        case "other": return .other
        default: return nil
        }
    }

    private static func convertTransactionData(_ data: [String: Any]?) -> TSTransactionData? {
        guard let data,
              let amount = (data["amount"] as? NSNumber)?.doubleValue,
              let currency = data["currency"] as? String else { return nil }
        let payer = (data["payer"] as? [String: Any]).map {
            TSTransactionData.Payer(
                name: $0["name"] as? String,
                branchIdentifier: $0["branchIdentifier"] as? String,
                accountNumber: $0["accountNumber"] as? String
            )
        }
        let payee = (data["payee"] as? [String: Any]).map {
            TSTransactionData.Payee(
                name: $0["name"] as? String,
                bankIdentifier: $0["bankIdentifier"] as? String,
                branchIdentifier: $0["branchIdentifier"] as? String,
                accountNumber: $0["accountNumber"] as? String
            )
        }
        return TSTransactionData(
            amount: amount,
            currency: currency,
            reason: data["reason"] as? String,
            transactionDate: (data["transactionDate"] as? NSNumber)?.int64Value,
            payer: payer,
            payee: payee
        )
    }

    private static func convertLocationConfig(_ config: [String: Any]?) -> TSLocationConfig? {
        guard let config, let mode = config["mode"] as? String else { return nil }
        let validFor = config["validFor"] as? Int ?? 300
        switch mode {
        case "disabled": return TSLocationConfig(mode: .disabled)
        case "default": return TSLocationConfig(mode: .default)
        case "forceCurrent": return TSLocationConfig(mode: .forceCurrent)
        case "forceLastKnown": return TSLocationConfig(mode: .forceLastKnown)
        case "lastKnown": return TSLocationConfig(mode: .lastKnown(validFor: validFor))
        default: return TSLocationConfig(mode: .default)
        }
    }
}
