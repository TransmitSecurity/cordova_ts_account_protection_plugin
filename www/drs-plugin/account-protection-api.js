var impl = require('cordova-plugin-drs.drs-bridge');

/** Init from TransmitSecurity.plist / Android resources. */
function initializeSDK() { return impl.initializeSDK(); }

/** Init with clientId, baseUrl. configuration: { enableLocationEvents? }, userId optional. */
function initialize(clientId, baseUrl, configuration, userId) {
    return impl.initialize(clientId, baseUrl, configuration, userId);
}

/** Bind session to userId. options optional. */
function setAuthenticatedUser(userId, options) { return impl.setAuthenticatedUser(userId, options); }

/** Report action. Returns { success, actionToken }. */
function triggerAction(action, options, locationConfig, customAttributes) {
    return impl.triggerAction(action, options, locationConfig, customAttributes);
}

function clearUser() { return impl.clearUser(); }

function getSessionToken() { return impl.getSessionToken(); }

function setLogLevel(isLogEnabled) { return impl.setLogLevel(isLogEnabled); }

function logPageLoad(pageName) { return impl.logPageLoad(pageName); }

module.exports = {
    initializeSDK: initializeSDK,
    initialize: initialize,
    setAuthenticatedUser: setAuthenticatedUser,
    triggerAction: triggerAction,
    clearUser: clearUser,
    getSessionToken: getSessionToken,
    setLogLevel: setLogLevel,
    logPageLoad: logPageLoad,
};
