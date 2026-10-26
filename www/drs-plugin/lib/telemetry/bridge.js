var exec = require('cordova/exec');

// This is an internal API. Do not use it directly.

module.exports = {
    reportDrsEvent: function (event) {
        exec(null, null, 'DRSPlugin', 'reportDrsEvent', [{ event: event }]);
    },
    collectorConfigurationUpdates: function (callback) {
        exec(callback, null, 'DRSPlugin', 'collectorConfigurationUpdates', []);
    },
    reportInput: function (fieldId, length) {
        exec(null, null, 'DRSPlugin', 'reportInput', [fieldId, length]);
    },
    logPageLoad: function (pageName) {
        exec(null, null, 'DRSPlugin', 'logPageLoad', [{ pageName: pageName }]);
    },
};
