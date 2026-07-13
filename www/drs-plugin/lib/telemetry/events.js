var telemetry = require('cordova-plugin-drs.drs-telemetry-bridge');

function isIOS() {
    return (typeof cordova !== 'undefined' && cordova.platformId === 'ios');
}

var iosPoints = isIOS() ? require('cordova-plugin-drs.drs-ios-points-formatter') : null;
var gestures = isIOS()
    ? require('cordova-plugin-drs.drs-ios-events')
    : require('cordova-plugin-drs.drs-android-events');

var PRESSABLE_SELECTOR =
    'button, a[href], ' +
    'input[type="button"], input[type="submit"], input[type="reset"], ' +
    'input[type="checkbox"], input[type="radio"], ' +
    '[role="button"], [role="link"], [data-drs-track], [onclick]';
var MAX_TAP_DISTANCE_PX = 10;

var _collectorConfig = {};
var _navInstalled = false;
var _inputInstalled = false;
var _clickEnabled = false;
var _touchEnabled = false;
var _inputEnabled = false;
var _lastNavLocation = '';
var _launchPageLoadSent = false;

function reportDrsEvent(event) {
    telemetry.reportDrsEvent(iosPoints ? iosPoints.format(event) : event);
}

function reportInput(e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT') return;
    var value = t.value != null ? String(t.value) : '';
    telemetry.reportInput(t.id, value.length);
}

function resolvePressable(el) {
    if (!el || !el.closest) return null;
    var hit = el.closest(PRESSABLE_SELECTOR);
    if (hit) return hit;
    var node = el;
    while (node && node.nodeType === 1) {
        try {
            if (window.getComputedStyle(node).cursor === 'pointer') return node;
        } catch (e) {}
        node = node.parentElement;
    }
    return null;
}

function toDevicePx(v) { return Math.round(v * (window.devicePixelRatio || 1)); }

function reportNavigation() {
    var loc = location.pathname + location.search + location.hash;
    if (loc === _lastNavLocation) return;
    _lastNavLocation = loc;
    // Dedicated page_load API (not reportDrsEvent's generic interaction bridge): native gates it
    // against the standard "page_load" ignore-list entry same as any other interaction type, plus
    // the SDK's own RN-specific overrides (harmless no-ops for a non-RN host). Native prefixes this
    // with the app's package name ("<packageName>.<pageName>"), so the reported location changes
    // from the previous bare URL-path form to that package-qualified form — same shape the native
    // Activity-launch page_load already uses.
    telemetry.logPageLoad(loc);
}

function onPopState() { reportNavigation(); }

function installNavListener() {
    if (_navInstalled) return;
    _navInstalled = true;
    _lastNavLocation = '';
    window.addEventListener('hashchange', onPopState);
    window.addEventListener('popstate', onPopState);
    ['pushState', 'replaceState'].forEach(function (method) {
        var orig = history[method];
        history[method] = function () {
            orig.apply(this, arguments);
            reportNavigation();
        };
    });
    if (!_launchPageLoadSent && window.cordova && window.cordova.platformId === 'android') {
        _launchPageLoadSent = true;
        reportNavigation();
    }
}

function removeNavListener() {
    if (!_navInstalled) return;
    _navInstalled = false;
    window.removeEventListener('hashchange', onPopState);
    window.removeEventListener('popstate', onPopState);
}

function installInputTracker() {
    if (_inputInstalled) return;
    _inputInstalled = true;
    document.addEventListener('input', reportInput, true);
}

function removeInputTracker() {
    if (!_inputInstalled) return;
    _inputInstalled = false;
    document.removeEventListener('input', reportInput, true);
}

function tearDownAll() {
    gestures.removeGestureTracker();
    removeNavListener();
    removeInputTracker();
}

function applyCollectorConfig(config) {
    _collectorConfig = config || {};
    if (iosPoints) {
        iosPoints.updateCollectFirstTouchPointsEnabled(_collectorConfig.collectFirstTouchPointsEnabled === true);
    }
    if (_collectorConfig.sdkEnabled === false) {
        tearDownAll();
        return;
    }
    var c = _collectorConfig.collectorsEnabled || _collectorConfig.behavior || {};
    _clickEnabled = (c.click !== false);
    _touchEnabled = (c.touch !== false);
    _inputEnabled = (c.input !== false);
    if (_clickEnabled || _touchEnabled) gestures.installGestureTracker();
    else gestures.removeGestureTracker();
    if (c.navigation !== false && c.pageLoad !== false) installNavListener();
    else removeNavListener();
    if (_inputEnabled) installInputTracker();
    else removeInputTracker();
}

gestures.init({
    reportDrsEvent: reportDrsEvent,
    resolvePressable: resolvePressable,
    toDevicePx: toDevicePx,
    tapDistancePx: MAX_TAP_DISTANCE_PX,
    isClickEnabled: function () { return _clickEnabled; },
    isTouchEnabled: function () { return _touchEnabled; },
    collectFirstTouchPoints: function () { return _collectorConfig.collectFirstTouchPointsEnabled === true; },
});

module.exports = {
    applyCollectorConfig: applyCollectorConfig,
};
