const EventEmitter = require('events').EventEmitter;
const { createEventBus } = require('./factory');

/**
 * @template T
 * @typedef {import('./').ConstructorOf<T>} ConstructorOf<T>
 */

/**
 * @template Data
 * @typedef {object} IEvent
 * @prop {Date} timestamp
 * @prop {Data} data
 */

// The static API below is a thin wrapper over this one default bus.
//
// `@tryghost/logging` builds its process-wide logger when it is first required,
// so it is only loaded when there is an error to log. Requiring this package
// therefore does not create the logger, which leaves an application free to
// register its own with `@tryghost/logging/factory` after this file has loaded.
const defaultBus = createEventBus({
    logging: {
        error(...args) {
            return require('@tryghost/logging').error(...args);
        },
    },
});

class DomainEvents {
    /**
     * @private
     * @type EventEmitter
     */
    static ee = new EventEmitter();

    /**
     * Build an event bus that is independent of the static one and takes its
     * logger as an argument.
     */
    static createEventBus = createEventBus;

    /**
     * @template Data
     * @template {IEvent<Data>} EventClass
     * @param {ConstructorOf<EventClass>} Event
     * @param {(event: EventClass) => Promise<void> | void} handler
     *
     * @returns {void}
     */
    static subscribe(Event, handler) {
        defaultBus.subscribe(Event, handler);
    }

    /**
     * @template Data
     * @param {IEvent<Data>} event
     * @returns {void}
     */
    static dispatch(event) {
        defaultBus.dispatch(event);
    }

    /**
     * Dispatch an event in case you don't have an instance of the event class, but you do have the event name and event data.
     * @template Data
     * @param {string} name
     * @param {Data} data
     * @returns {void}
     */
    static dispatchRaw(name, data) {
        defaultBus.dispatchRaw(name, data);
    }

    // Methods below are only for testing purposes

    /**
     * Waits for all the events in the queue to be dispatched and fully processed (async).
     */
    static allSettled() {
        return defaultBus.allSettled();
    }

    /**
     * Enable or disable dispatch/processed tracking. Test-only.
     * @param {boolean} enabled
     */
    static setTrackingEnabledForTest(enabled) {
        defaultBus.setTrackingEnabledForTest(enabled);
    }

    /**
     * Clear the await queue and reset dispatch/processed counts. Test-only.
     */
    static resetTrackingStateForTest() {
        defaultBus.resetTrackingStateForTest();
    }
}

// `DomainEvents.ee` stays the emitter of record, as it was when the class owned
// the listeners: the default bus reads it on every call, so replacing it still
// takes effect.
Object.defineProperty(defaultBus, 'ee', {
    get() {
        return DomainEvents.ee;
    },
});

module.exports = DomainEvents;
