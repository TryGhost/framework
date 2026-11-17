import EventBusClass = require('./EventBus');

/**
 * Entry point that does not load `@tryghost/logging`.
 */
declare const factory: {
    EventBus: typeof EventBusClass;
    /**
     * Build an event bus that is independent of the static `DomainEvents` one
     * and takes its logger as an argument.
     */
    createEventBus(options: EventBusClass.EventBusOptions): EventBusClass;
};

declare namespace factory {
    export type EventBus = EventBusClass;
    export type EventBusOptions = EventBusClass.EventBusOptions;
    export type Logger = EventBusClass.Logger;
    export type IEvent<Data = unknown> = EventBusClass.IEvent<Data>;
    export type ConstructorOf<T> = EventBusClass.ConstructorOf<T>;
}

export = factory;
