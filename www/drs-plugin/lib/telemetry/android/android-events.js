var ctx = null;

var _gPointerId = null;
var _gDownX = 0;
var _gDownY = 0;
var _gMaxDist = 0;
var _gTrail = [];
var _gScrolled = false;
var _gRefEl = null;
var _gDownRect = null;
var _gDownScroll = null;
var _pointerInstalled = false;
var SCROLL_THRESHOLD_PX = 5;
var _nativeTouchOwner = !!(window.cordova && window.cordova.platformId === 'android');

function init(context) { ctx = context; }

function toolTypeOf(pointerType) {
    if (pointerType === 'touch') return 1;
    if (pointerType === 'pen') return 2;
    if (pointerType === 'mouse') return 3;
    return 0;
}

function gestureReset() {
    _gPointerId = null;
    _gMaxDist = 0;
    _gTrail = [];
}

function addPointerTrailPoint(e) {
    _gTrail.push({
        pId: 0,
        x: ctx.toDevicePx(e.screenX),
        y: ctx.toDevicePx(e.screenY),
        timestamp: Date.now(),
        pressure: e.pressure || 0,
        size: ctx.toDevicePx(Math.max(e.width || 0, e.height || 0)),
        toolType: toolTypeOf(e.pointerType),
    });
}

function docScroll() {
    var se = document.scrollingElement || document.documentElement || {};
    return {
        x: window.pageXOffset || 0,
        y: window.pageYOffset || 0,
        left: se.scrollLeft || 0,
        top: se.scrollTop || 0
    };
}

function isFixedOrSticky(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
        var pos = '';
        try { pos = window.getComputedStyle(n).position; } catch (e) {}
        if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
}

function canMeasureRef(refEl) {
    return !!(refEl && refEl.isConnected && !isFixedOrSticky(refEl));
}

function didScroll(scrolledFlag, refEl, downRect, downScroll) {
    if (scrolledFlag) return true;
    if (canMeasureRef(refEl) && downRect) {
        var r = refEl.getBoundingClientRect();
        if (Math.abs(r.top - downRect.top) > SCROLL_THRESHOLD_PX ||
            Math.abs(r.left - downRect.left) > SCROLL_THRESHOLD_PX) return true;
    }
    if (downScroll) {
        var s = docScroll();
        if (Math.abs(s.y - downScroll.y) > SCROLL_THRESHOLD_PX ||
            Math.abs(s.x - downScroll.x) > SCROLL_THRESHOLD_PX ||
            Math.abs(s.top - downScroll.top) > SCROLL_THRESHOLD_PX ||
            Math.abs(s.left - downScroll.left) > SCROLL_THRESHOLD_PX) return true;
    }
    return false;
}

function rafDouble(cb) {
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(function () { raf(cb); });
}

function onPointerDown(e) {
    if (_gPointerId !== null && !e.isPrimary) return;
    _gPointerId = e.pointerId;
    _gDownX = e.clientX;
    _gDownY = e.clientY;
    _gMaxDist = 0;
    _gTrail = [];
    _gScrolled = false;
    _gRefEl = document.elementFromPoint(e.clientX, e.clientY);
    _gDownRect = _gRefEl ? _gRefEl.getBoundingClientRect() : null;
    _gDownScroll = docScroll();
    addPointerTrailPoint(e);
}

function onGestureScroll() {
    if (_gPointerId !== null) _gScrolled = true;
}

function onPointerMove(e) {
    if (e.pointerId !== _gPointerId) return;
    var dx = e.clientX - _gDownX;
    var dy = e.clientY - _gDownY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > _gMaxDist) _gMaxDist = dist;
    addPointerTrailPoint(e);
}

function onPointerUp(e) {
    if (e.pointerId !== _gPointerId) return;
    addPointerTrailPoint(e);
    classifyAndEmit(e);
    gestureReset();
}

function onPointerCancel(e) {
    if (e.pointerId !== _gPointerId) return;
    var trail = _gTrail.slice();
    if (trail.length === 0) { gestureReset(); return; }
    var refEl = _gRefEl, downRect = _gDownRect, downScroll = _gDownScroll, scrolledFlag = _gScrolled;
    var moved = _gTrail.length > 1;
    gestureReset();
    rafDouble(function () {
        var scrolled = didScroll(scrolledFlag, refEl, downRect, downScroll);
        if (!scrolled && !canMeasureRef(refEl) && moved) scrolled = true;
        emitTouch(scrolled, trail);
    });
}

function emitTouch(scrolled, trail) {
    if (!ctx.isTouchEnabled()) return;
    if (_nativeTouchOwner) {
        if (scrolled) ctx.reportDrsEvent({ interaction_type: 'scroll', webHostScroll: true });
        return;
    }
    ctx.reportDrsEvent({
        interaction_type: 'touch',
        scrolled: !!scrolled,
        isOverlayDetected: false,
        keyboardHeight: 0,
        trail: trail || _gTrail.slice(),
    });
}

function emitClick(target, e) {
    if (!ctx.isClickEnabled()) return;
    var rect = target.getBoundingClientRect();
    ctx.reportDrsEvent({
        interaction_type: 'click',
        target_id: target.id || target.getAttribute('data-drs-track') || target.tagName.toLowerCase(),
        target_type: target.tagName.toLowerCase(),
        x: ctx.toDevicePx(e.screenX),
        y: ctx.toDevicePx(e.screenY),
        offsetX: ctx.toDevicePx(e.clientX - rect.left),
        offsetY: ctx.toDevicePx(e.clientY - rect.top),
        pressure: e.pressure || 0,
        size: ctx.toDevicePx(Math.max(e.width || 0, e.height || 0)),
        isOverlayDetected: false,
        keyboardHeight: 0,
    });
}

function classifyAndEmit(e) {
    if (didScroll(_gScrolled, _gRefEl, _gDownRect, _gDownScroll) || _gMaxDist > ctx.tapDistancePx) {
        emitTouch(true);
        return;
    }
    var hit = document.elementFromPoint(e.clientX, e.clientY);
    var target = ctx.resolvePressable(hit);
    if (target) emitClick(target, e);
    else emitTouch(false);
}

function installGestureTracker() {
    if (_pointerInstalled) return;
    _pointerInstalled = true;
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('scroll', onGestureScroll, true);
}

function removeGestureTracker() {
    if (!_pointerInstalled) return;
    _pointerInstalled = false;
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerCancel, true);
    document.removeEventListener('scroll', onGestureScroll, true);
    gestureReset();
}

module.exports = {
    init: init,
    installGestureTracker: installGestureTracker,
    removeGestureTracker: removeGestureTracker,
};
