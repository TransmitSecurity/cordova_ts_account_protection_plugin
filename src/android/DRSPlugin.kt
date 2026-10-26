package com.transmitsecurity.drs

import com.transmit.accountprotection.ITransmitSecurityTriggerActionEventCallback
import com.transmit.accountprotection.TSAccountProtection
import com.transmit.accountprotection.TSCollectorConfigurationListener
import com.transmit.accountprotection.TSClaimedUserIdType
import com.transmit.accountprotection.TSInitSDKConfiguration
import com.transmit.accountprotection.TransmitSecurityTriggerActionResponse
import com.transmit.accountprotection.api.ActionEventOptions
import com.transmit.accountprotection.api.PayeeData
import com.transmit.accountprotection.api.PayerData
import com.transmit.accountprotection.api.TransactionData
import com.transmit.accountprotection.collection.datamanagement.location.TSLocationCollectionMode
import com.transmit.accountprotection.collection.datamanagement.location.TSLocationConfig
import com.transmit.accountprotection.errors.TransmitSecurityAccountProtectionError
import com.transmit.accountprotection.errors.exceptions.TSAccountProtectionInitializeException
import com.transmit.accountprotection.userdetails.ISessionTokenCallback
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

class DRSPlugin : CordovaPlugin() {

    private fun CallbackContext.ok() = success(1)

    private fun CallbackContext.fail(code: String, message: String?) {
        error(JSONObject().apply {
            put("code", code)
            put("message", message ?: "")
        })
    }

    // breaks the SDK. Written on init, read on the telemetry path (different threads).
    @Volatile private var isInitialized = false

    private var configUpdateCallback: CallbackContext? = null
    private val configListener = TSCollectorConfigurationListener { snapshot ->
        val cb = configUpdateCallback ?: return@TSCollectorConfigurationListener
        cordova.activity.runOnUiThread {
            val result = PluginResult(PluginResult.Status.OK, snapshot.toJson())
            result.keepCallback = true
            cb.sendPluginResult(result)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        TSAccountProtection.removeCollectorConfigurationListener(configListener)
        configUpdateCallback = null
    }

    override fun execute(action: String, args: JSONArray, callback: CallbackContext): Boolean {
        when (action) {
            "initializeSDK"               -> initializeSDK(callback)
            "initialize"                  -> initialize(args, callback)
            "setAuthenticatedUser"        -> setAuthenticatedUser(args, callback)
            "triggerAction"               -> triggerAction(args, callback)
            "clearUser"                   -> clearUser(callback)
            "getSessionToken"             -> getSessionToken(callback)
            "setLogLevel"                 -> setLogLevel(args, callback)
            "logPageLoad"                 -> logPageLoad(args, callback)
            "reportDrsEvent"              -> reportDrsEvent(args, callback)
            "collectorConfigurationUpdates" -> collectorConfigurationUpdates(callback)
            "reportInput"                 -> reportInput(args, callback)
            else                          -> return false
        }
        return true
    }

    private fun initializeSDK(callback: CallbackContext) {
        val app = cordova.activity.application
        try {
            TSAccountProtection.initializeSDK(app)
            isInitialized = true
            callback.ok()
        } catch (e: TSAccountProtectionInitializeException) {
            callback.fail("MISSING_INIT_PARAMS", e.toString())
        } catch (e: Exception) {
            callback.fail("INIT_ERROR", e.message)
        }
    }

    private fun initialize(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val clientId = opts.optString("clientId", "").takeIf { it.isNotEmpty() }
        val baseUrl = opts.optString("baseUrl", "").takeIf { it.isNotEmpty() }
        if (clientId == null || baseUrl == null) {
            callback.fail("INVALID_ARGS", "clientId and baseUrl are required"); return
        }
        val configuration = opts.optJSONObject("configuration")
        val userId = opts.optString("userId", "").takeIf { it.isNotEmpty() }
        val enableLocationEvents = configuration?.optBoolean("enableLocationEvents", false) ?: false

        cordova.activity.runOnUiThread {
            try {
                TSAccountProtection.initialize(
                    cordova.activity.application,
                    baseUrl,
                    clientId,
                    userId,
                    TSInitSDKConfiguration(enableLocationEvents)
                )
                isInitialized = true
                callback.ok()
            } catch (e: TSAccountProtectionInitializeException) {
                callback.fail("MISSING_INIT_PARAMS", e.toString())
            } catch (e: Exception) {
                callback.fail("INIT_ERROR", e.message)
            }
        }
    }

    private fun setAuthenticatedUser(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val userId = opts.optString("userId", "").takeIf { it.isNotEmpty() } ?: run {
            callback.fail("INVALID_ARGS", "userId is required"); return
        }
        val options = opts.optJSONObject("options")?.toStringMap() ?: emptyMap()
        cordova.activity.runOnUiThread {
            TSAccountProtection.setAuthenticatedUser(userId, options)
            callback.ok()
        }
    }

    private fun triggerAction(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val action = opts.optString("action", "").takeIf { it.isNotEmpty() } ?: run {
            callback.fail("INVALID_ARGS", "action is required"); return
        }
        val actionOptions = opts.optJSONObject("options")
        val locationConfig = opts.optJSONObject("locationConfig")
        val customAttributes = opts.optJSONObject("customAttributes")?.toStringMap() ?: emptyMap()

        cordova.activity.runOnUiThread {
            TSAccountProtection.triggerAction(
                action,
                convertActionEventOptions(actionOptions),
                convertTransactionData(actionOptions),
                customAttributes,
                convertLocationConfig(locationConfig),
                object : ITransmitSecurityTriggerActionEventCallback {
                    override fun onResponse(r: TransmitSecurityTriggerActionResponse) {
                        callback.success(JSONObject().apply {
                            put("success", true)
                            put("actionToken", r.token())
                        })
                    }
                    override fun onFailed(e: TransmitSecurityAccountProtectionError) {
                        callback.fail("ACTION_ERROR", e.errorMessage)
                    }
                }
            )
        }
    }

    private fun clearUser(callback: CallbackContext) {
        cordova.activity.runOnUiThread {
            TSAccountProtection.clearUser()
            callback.ok()
        }
    }

    private fun getSessionToken(callback: CallbackContext) {
        cordova.activity.runOnUiThread {
            TSAccountProtection.getSessionToken(object : ISessionTokenCallback {
                override fun onSessionToken(token: String) { callback.success(token) }
                override fun onFailed(e: TransmitSecurityAccountProtectionError) {
                    callback.fail("SESSION_ERROR", e.errorMessage)
                }
            })
        }
    }

    private fun setLogLevel(args: JSONArray, callback: CallbackContext) {
        val isLogEnabled = args.optJSONObject(0)?.optBoolean("isLogEnabled", false) ?: false
        cordova.activity.runOnUiThread {
            TSAccountProtection.setLoggingEnabled(isLogEnabled)
            callback.ok()
        }
    }

    private fun logPageLoad(args: JSONArray, callback: CallbackContext) {
        val pageName = args.optJSONObject(0)?.optString("pageName", "")?.takeIf { it.isNotEmpty() }
            ?: run { callback.fail("INVALID_ARGS", "pageName is required"); return }
        cordova.activity.runOnUiThread {
            TSAccountProtection.logPageLoad(pageName)
            callback.ok()
        }
    }

    private fun reportDrsEvent(args: JSONArray, callback: CallbackContext) {
        if (!isInitialized) return  // drop telemetry until SDK init
        val wrapper = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val eventObj = wrapper.optJSONObject("event") ?: run {
            callback.fail("INVALID_ARGS", "event required"); return
        }
        val event: Map<String, Any> = eventObj.toNestedMap()
            .filterValues { it != null }
            .mapValues { it.value as Any }
        if (TSAccountProtection.logInteractionEvent(event)) callback.ok()
        else callback.fail("REPORT_DRS_EVENT_ERROR", "Failed to enqueue DRS event")
    }

    private fun collectorConfigurationUpdates(callback: CallbackContext) {
        configUpdateCallback = callback
        TSAccountProtection.addCollectorConfigurationListener(configListener, true)
    }

    private fun reportInput(args: JSONArray, callback: CallbackContext) {
        if (!isInitialized) return  // drop telemetry until SDK init
        val fieldId = args.optString(0, "").takeIf { it.isNotEmpty() }
            ?: run { callback.fail("INVALID_ARGS", "fieldId required"); return }
        val length = args.optInt(1, 0)
        TSAccountProtection.logInteractionEvent(mapOf(
            "interaction_type" to "input",
            "location" to fieldId,
            "length" to length
        ))
        callback.ok()
    }

    private fun Map<String, *>.toJson(): JSONObject = JSONObject().also { obj ->
        forEach { (k, v) -> obj.put(k, v) }
    }

    private fun convertActionEventOptions(options: JSONObject?): ActionEventOptions {
        if (options == null) return DefaultActionEventOptions()
        return CustomActionEventOptions(
            correlationId = options.optString("correlationId", "").takeIf { it.isNotEmpty() },
            claimedUserId = options.optString("claimedUserId", "").takeIf { it.isNotEmpty() },
            claimedUserIdType = convertClaimedUserIdType(options.optString("claimedUserIdType", "")),
            referenceUserId = options.optString("referenceUserId", "").takeIf { it.isNotEmpty() }
        )
    }

    private fun convertClaimedUserIdType(type: String): TSClaimedUserIdType? = when (type) {
        "email" -> TSClaimedUserIdType.Email
        "username" -> TSClaimedUserIdType.Username
        "phoneNumber" -> TSClaimedUserIdType.PhoneNumber
        "accountId" -> TSClaimedUserIdType.AccountId
        "ssn" -> TSClaimedUserIdType.Ssn
        "nationalId" -> TSClaimedUserIdType.NationalId
        "passportNumber" -> TSClaimedUserIdType.PassportNumber
        "driversLicenseNumber" -> TSClaimedUserIdType.DriversLicenseNumber
        "other" -> TSClaimedUserIdType.Other
        else -> null
    }

    private fun convertTransactionData(options: JSONObject?): TransactionData {
        val tx = options?.optJSONObject("transactionData") ?: return DefaultTransactionData()
        val payee = tx.optJSONObject("payee")
        val payer = tx.optJSONObject("payer")
        return CustomTransactionData(
            amount = if (tx.has("amount")) tx.optDouble("amount") else null,
            currency = tx.optString("currency", "").takeIf { it.isNotEmpty() },
            reason = tx.optString("reason", "").takeIf { it.isNotEmpty() },
            transactionDate = if (tx.has("transactionDate")) tx.optLong("transactionDate") else null,
            payee = PayeeData(
                payee?.optString("name", null),
                payee?.optString("bankIdentifier", null),
                payee?.optString("branchIdentifier", null),
                payee?.optString("accountNumber", null)
            ),
            payer = PayerData(
                payer?.optString("name", null),
                payer?.optString("branchIdentifier", null),
                payer?.optString("accountNumber", null)
            )
        )
    }

    private fun convertLocationConfig(config: JSONObject?): TSLocationConfig? {
        if (config == null) return null
        val mode = config.optString("mode", "")
        val validFor = config.optInt("validFor", 300)
        return when (mode) {
            "disabled" -> TSLocationConfig(TSLocationCollectionMode.Disable)
            "default" -> TSLocationConfig(TSLocationCollectionMode.Default)
            "forceCurrent" -> TSLocationConfig(TSLocationCollectionMode.ForceCurrent)
            "forceLastKnown" -> TSLocationConfig(TSLocationCollectionMode.ForceLastKnown)
            "lastKnown" -> TSLocationConfig(TSLocationCollectionMode.LastKnown(validFor))
            else -> TSLocationConfig(TSLocationCollectionMode.Default)
        }
    }

    private fun JSONObject.toStringMap(): Map<String, Any> = buildMap {
        keys().forEach { k ->
            val v = opt(k)
            if (v != null && v != JSONObject.NULL) put(k, v)
        }
    }

    private fun JSONObject.toNestedMap(): Map<String, Any?> = buildMap {
        keys().forEach { k ->
            put(k, when (val v = opt(k)) {
                is JSONObject -> v.toNestedMap()
                is JSONArray -> v.toList()
                else -> v
            })
        }
    }

    private fun JSONArray.toList(): List<Any?> = (0 until length()).map { i ->
        when (val v = opt(i)) {
            is JSONObject -> v.toNestedMap()
            is JSONArray -> v.toList()
            else -> v
        }
    }

    private class DefaultActionEventOptions : ActionEventOptions {
        override val correlationId: String? = null
        override val claimUserId: String? = null
        override val claimedUserId: String? = null
        override val claimedUserIdType: TSClaimedUserIdType? = null
        override val referenceUserId: String? = null
    }

    private class CustomActionEventOptions(
        override val correlationId: String?,
        override val claimedUserId: String?,
        override val claimedUserIdType: TSClaimedUserIdType?,
        override val referenceUserId: String?
    ) : ActionEventOptions {
        override val claimUserId: String? = null
    }

    private class DefaultTransactionData : TransactionData {
        override val amount: Double? = null
        override val currency: String? = null
        override val reason: String? = null
        override val transactionDate: Long? = null
        override val payee: PayeeData = PayeeData(null, null, null, null)
        override val payer: PayerData = PayerData(null, null, null)
    }

    private class CustomTransactionData(
        override val amount: Double?,
        override val currency: String?,
        override val reason: String?,
        override val transactionDate: Long?,
        override val payee: PayeeData,
        override val payer: PayerData
    ) : TransactionData
}
