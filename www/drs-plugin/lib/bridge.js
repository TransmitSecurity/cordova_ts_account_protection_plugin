var exec = require('cordova/exec');
var logger = require('cordova-plugin-drs.drs-logger');

function call(method, args) {
    args = args || [];
    return new Promise(function (resolve, reject) {
        exec(resolve, reject, 'DRSPlugin', method, args);
    });
}

function afterInit(promise) {
    return promise.then(function (result) {
        require('cordova-plugin-drs.drs-drs-core').startConfigurationListener();
        return result;
    });
}

module.exports = {
    initializeSDK: function () { return afterInit(call('initializeSDK')); },
    initialize: function (clientId, baseUrl, configuration, userId) {
        return afterInit(call('initialize', [{
            clientId: clientId,
            baseUrl: baseUrl,
            configuration: configuration || null,
            userId: userId || null,
        }]));
    },
    setAuthenticatedUser: function (userId, options) {
        return call('setAuthenticatedUser', [{ userId: userId, options: options || null }]);
    },
    triggerAction: function (action, options, locationConfig, customAttributes) {
        return call('triggerAction', [{
            action: action,
            options: options || null,
            locationConfig: locationConfig || null,
            customAttributes: customAttributes || null,
        }]);
    },
    clearUser: function () { return call('clearUser'); },
    getSessionToken: function () { return call('getSessionToken'); },
    setLogLevel: function (isLogEnabled) {
        logger.setEnabled(!!isLogEnabled);
        return call('setLogLevel', [{ isLogEnabled: !!isLogEnabled }]);
    },
    logPageLoad: function (pageName) {
        return call('logPageLoad', [{ pageName: pageName }]);
    },
};
