var logger = require('cordova-plugin-drs.drs-logger');

var MAX_TRAIL_COUNT = 50;   // parity: TSGestureMonitor.maxTrailCount

var _collectFirstTouchPointsEnabled = false;

function updateCollectFirstTouchPointsEnabled(enabled) {
    _collectFirstTouchPointsEnabled = enabled === true;
}

function ratio() {
    return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

function compensate(value, dpr) {
    if (typeof value !== 'number') return value;
    return Math.round(value / dpr);
}

function compensateTrail(trail, dpr) {
    if (dpr === 1) return trail;
    return trail.map(function (p) {
        return {
            pId: p.pId,
            x: compensate(p.x, dpr),
            y: compensate(p.y, dpr),
            timestamp: p.timestamp,
            pressure: p.pressure,
            size: p.size,
            toolType: p.toolType,
        };
    });
}

function removeFollowingDuplicates(trail) {
    if (!trail.length) return trail;
    var out = [trail[0]];
    for (var i = 1; i < trail.length; i++) {
        var prev = out[out.length - 1];
        var cur = trail[i];
        if (cur.x !== prev.x || cur.y !== prev.y) out.push(cur);
    }
    return out;
}

function removeSubPixelSteps(trail) {
    if (trail.length <= 1) return trail;
    var out = [trail[0]];
    for (var i = 1; i < trail.length; i++) {
        var prev = out[out.length - 1];
        var cur = trail[i];
        var dx = cur.x - prev.x;
        var dy = cur.y - prev.y;
        if (dx * dx + dy * dy >= 1) out.push(cur);
    }
    return out;
}

function prefixUnique(trail, max) {
    if (!trail.length) return trail;
    var out = [trail[0]];
    for (var i = 1; i < trail.length && out.length < max; i++) {
        var prev = out[out.length - 1];
        var cur = trail[i];
        if (cur.x !== prev.x || cur.y !== prev.y) out.push(cur);
    }
    return out;
}

function removeFollowingDuplicatesPayload(trail, dpr) {
    if (!trail.length) return trail;
    var out = [trail[0]];
    for (var i = 1; i < trail.length; i++) {
        var prev = out[out.length - 1];
        var cur = trail[i];
        if (Math.round(cur.x * dpr) !== Math.round(prev.x * dpr) ||
            Math.round(cur.y * dpr) !== Math.round(prev.y * dpr)) {
            out.push(cur);
        }
    }
    return out;
}

function reduce(trail, max) {
    var count = trail.length;
    if (count <= max) return trail;
    var step = Math.ceil(count / max);
    var out = [];
    for (var i = 0; i < count; i++) {
        if (i % step === 0 || i === count - 1) out.push(trail[i]);
    }
    return out;
}

function fmtCoord(n) {
    return typeof n === 'number' ? n.toFixed(1) : n;
}

function logSwipePoints(trail) {
    if (trail.length <= 1) return;
    var count = trail.length;
    for (var i = 0; i < count; i++) {
        var point = trail[i];
        logger.debug('Swipe point: ' + (i + 1) + ' from ' + count +
            ': (' + fmtCoord(point.x) + ',' + fmtCoord(point.y) + ')');
    }
}

function serializeSwipe(trail, dpr) {
    if (!trail.length) return trail;
    if (trail.length <= 1) return compensateTrail(trail, dpr);

    var deduped = removeFollowingDuplicates(trail);
    var prepared = _collectFirstTouchPointsEnabled
        ? removeSubPixelSteps(deduped)
        : deduped;
    var capped = _collectFirstTouchPointsEnabled
        ? prefixUnique(prepared, MAX_TRAIL_COUNT)
        : reduce(deduped, MAX_TRAIL_COUNT);
    var payload = removeFollowingDuplicatesPayload(compensateTrail(capped, dpr), dpr);
    logSwipePoints(payload);
    return payload;
}

function format(event) {
    if (!event) return event;
    var dpr = ratio();

    if (event.interaction_type === 'touch') {
        if (!event.trail) return event;
        event.trail = event.scrolled
            ? serializeSwipe(event.trail, dpr)
            : compensateTrail(event.trail, dpr);
        return event;
    }

    if (event.interaction_type === 'click') {
        if (dpr === 1) return event;
        event.x = compensate(event.x, dpr);
        event.y = compensate(event.y, dpr);
        event.offsetX = compensate(event.offsetX, dpr);
        event.offsetY = compensate(event.offsetY, dpr);
        return event;
    }

    return event;
}

module.exports = {
    format: format,
    updateCollectFirstTouchPointsEnabled: updateCollectFirstTouchPointsEnabled,
};
