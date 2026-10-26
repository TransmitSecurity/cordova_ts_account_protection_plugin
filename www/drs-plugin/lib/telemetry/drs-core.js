var events = require('cordova-plugin-drs.drs-events');
var bridge = require('cordova-plugin-drs.drs-telemetry-bridge');

function startConfigurationListener() {
    bridge.collectorConfigurationUpdates(events.applyCollectorConfig);
}

module.exports = {
    startConfigurationListener: startConfigurationListener,
    applyCollectorConfig: events.applyCollectorConfig,
};
