const EventBus = require('./EventBus');

/**
 * @description Build an event bus that is independent of the static `DomainEvents` one.
 *
 * @param {object} options
 * @param {{error: (...args: any[]) => unknown}} options.logging Logger used to report errors thrown by handlers
 * @returns {EventBus}
 */
function createEventBus(options) {
    return new EventBus(options);
}

module.exports = { EventBus, createEventBus };
