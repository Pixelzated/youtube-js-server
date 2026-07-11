var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CustomEvent_detail, _EventEmitterLike_legacyListeners;
// See https://github.com/nodejs/node/issues/40678#issuecomment-1126944677
class CustomEvent extends Event {
    constructor(type, options) {
        super(type, options);
        _CustomEvent_detail.set(this, void 0);
        __classPrivateFieldSet(this, _CustomEvent_detail, options?.detail ?? null, "f");
    }
    get detail() {
        return __classPrivateFieldGet(this, _CustomEvent_detail, "f");
    }
}
_CustomEvent_detail = new WeakMap();
export class SabrAdapterError extends Error {
    constructor(message, code) {
        super(`[SabrStreamingAdapter] ${message}`);
        this.code = code;
        this.name = 'SabrAdapterError';
    }
}
export class EventEmitterLike extends EventTarget {
    constructor() {
        super();
        _EventEmitterLike_legacyListeners.set(this, new Map());
    }
    emit(type, ...args) {
        const event = new CustomEvent(type, { detail: args });
        this.dispatchEvent(event);
    }
    on(type, listener) {
        const wrapper = (ev) => {
            if (ev instanceof CustomEvent) {
                listener(...ev.detail);
            }
            else {
                listener(ev);
            }
        };
        __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").set(listener, { type, wrapper });
        this.addEventListener(type, wrapper);
    }
    once(type, listener) {
        const wrapper = (ev) => {
            if (ev instanceof CustomEvent) {
                listener(...ev.detail);
            }
            else {
                listener(ev);
            }
            this.off(type, listener);
        };
        __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").set(listener, { type, wrapper });
        this.addEventListener(type, wrapper);
    }
    off(type, listener) {
        const listenerData = __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").get(listener);
        if (listenerData && listenerData.type === type) {
            this.removeEventListener(type, listenerData.wrapper);
            __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").delete(listener);
        }
    }
    removeAllListeners(type) {
        if (type) {
            for (const [listener, listenerData] of __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").entries()) {
                if (listenerData.type === type) {
                    this.removeEventListener(type, listenerData.wrapper);
                    __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").delete(listener);
                }
            }
        }
        else {
            for (const [listener, listenerData] of __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").entries()) {
                this.removeEventListener(listenerData.type, listenerData.wrapper);
                __classPrivateFieldGet(this, _EventEmitterLike_legacyListeners, "f").delete(listener);
            }
        }
    }
}
_EventEmitterLike_legacyListeners = new WeakMap();
//# sourceMappingURL=EventEmitterLike.js.map