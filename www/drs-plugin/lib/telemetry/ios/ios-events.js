var ctx = null;

var _gTouchId = null;
var _gDownX = 0;
var _gDownY = 0;
var _gMaxDist = 0;
var _gTrail = [];
var _gScrolled = false;
var _touchInstalled = false;

var EDITABLE_SELECTOR =
    'input:not([type="button"]):not([type="submit"]):not([type="reset"])' +
    ':not([type="checkbox"]):not([type="radio"]), ' +
    'textarea, select, [contenteditable=""], [contenteditable="true"]';

function init(context) { ctx = context; }

function isEditable(el) {
    return !!(el && el.closest && el.closest(EDITABLE_SELECTOR));
}

function gestureReset() {
    _gTouchId = null;
    _gMaxDist = 0;
    _gTrail = [];
}

function touchPoint(t) {
    return {
        clientX: t.clientX,
        clientY: t.clientY,
        screenX: t.screenX,
        screenY: t.screenY,
        pressure: t.force || 0,
        size: 2 * Math.max(t.radiusX || 0, t.radiusY || 0),
    };
}

function addTrailPoint(p) {
    _gTrail.push({
        pId: 0,
        x: ctx.toDevicePx(p.clientX),
        y: ctx.toDevicePx(p.clientY),
        timestamp: Date.now(),
        pressure: p.pressure || 0,
        size: ctx.toDevicePx(p.size || 0),
        toolType: 1,
    });
}

function activeTouch(e) {
    var list = e.changedTouches;
    for (var i = 0; i < list.length; i++) {
        if (list[i].identifier === _gTouchId) return list[i];
    }
    return null;
}

function onTouchStart(e) {
    if (_gTouchId !== null) return;
    var t = e.changedTouches[0];
    if (!t) return;
    _gTouchId = t.identifier;
    _gDownX = t.clientX;
    _gDownY = t.clientY;
    _gMaxDist = 0;
    _gTrail = [];
    _gScrolled = false;
    if (ctx.collectFirstTouchPoints()) addTrailPoint(touchPoint(t));
}

function onTouchMove(e) {
    var t = activeTouch(e);
    if (!t) return;
    var dx = t.clientX - _gDownX;
    var dy = t.clientY - _gDownY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > _gMaxDist) _gMaxDist = dist;
    addTrailPoint(touchPoint(t));
}

function onTouchEnd(e) {
    var t = activeTouch(e);
    if (!t) return;
    var p = touchPoint(t);
    addTrailPoint(p);
    classifyAndEmit(p);
    gestureReset();
}

function onTouchCancel(e) {
    var t = activeTouch(e);
    if (!t) return;
    if (_gTrail.length > 1) emitTouch(true);
    else if (_gTrail.length > 0) emitTouch(_gScrolled);
    gestureReset();
}

function onGestureScroll() {
    if (_gTouchId !== null) _gScrolled = true;
}

function emitTouch(scrolled) {
    if (!ctx.isTouchEnabled()) return;
    ctx.reportDrsEvent({
        interaction_type: 'touch',
        scrolled: !!scrolled,
        isOverlayDetected: false,
        keyboardHeight: 0,
        trail: _gTrail.slice(),
    });
}

function emitClick(target, p) {
    if (!ctx.isClickEnabled()) return;
    var rect = target.getBoundingClientRect();
    ctx.reportDrsEvent({
        interaction_type: 'click',
        target_id: target.id || target.getAttribute('data-drs-track') || target.tagName.toLowerCase(),
        target_type: target.tagName.toLowerCase(),
        x: ctx.toDevicePx(p.screenX),
        y: ctx.toDevicePx(p.screenY),
        offsetX: ctx.toDevicePx(p.clientX - rect.left),
        offsetY: ctx.toDevicePx(p.clientY - rect.top),
        pressure: p.pressure || 0,
        size: ctx.toDevicePx(p.size || 0),
    });
}

function classifyAndEmit(p) {
    if (_gScrolled || _gMaxDist > ctx.tapDistancePx) {
        emitTouch(true);
        return;
    }
    var hit = document.elementFromPoint(p.clientX, p.clientY);
    var target = ctx.resolvePressable(hit);
    if (target) emitClick(target, p);
    else if (isEditable(hit)) return;
    else emitTouch(false);
}

function installGestureTracker() {
    if (_touchInstalled) return;
    _touchInstalled = true;
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchCancel, true);
    document.addEventListener('scroll', onGestureScroll, true);
}

function removeGestureTracker() {
    if (!_touchInstalled) return;
    _touchInstalled = false;
    document.removeEventListener('touchstart', onTouchStart, true);
    document.removeEventListener('touchmove', onTouchMove, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchCancel, true);
    document.removeEventListener('scroll', onGestureScroll, true);
    gestureReset();
}

module.exports = {
    init: init,
    installGestureTracker: installGestureTracker,
    removeGestureTracker: removeGestureTracker,
};
