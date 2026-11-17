/**
 * An in-process event bus for domain events. Events are keyed by their class
 * name, so subscribers pass the event class and dispatchers pass an instance
 * of it. Each bus has its own subscribers and tracking state.
 */
declare class EventBus {
    constructor(options: EventBus.EventBusOptions);

    /**
     * Subscribe to an event class. Errors thrown by the handler are logged to
     * the bus's logger, not rethrown.
     */
    subscribe<EventClass extends EventBus.IEvent<unknown>>(
        Event: EventBus.ConstructorOf<EventClass>,
        handler: (event: EventClass) => Promise<void> | void,
    ): void;

    /**
     * Remove a handler added with `subscribe()`. A handler subscribed more
     * than once is removed one subscription per call, most recent first.
     * Returns whether a subscription was removed.
     */
    unsubscribe<EventClass extends EventBus.IEvent<unknown>>(
        Event: EventBus.ConstructorOf<EventClass>,
        handler: (event: EventClass) => Promise<void> | void,
    ): boolean;

    /**
     * Dispatch an event instance to all subscribers of its class.
     */
    dispatch<Data>(event: EventBus.IEvent<Data>): void;

    /**
     * Dispatch an event when you have its name and data, but no instance of
     * the event class.
     */
    dispatchRaw<Data>(name: string, data: Data): void;

    /**
     * Wait until every tracked dispatched event has been fully processed.
     * Tracking is only enabled when `NODE_ENV` starts with `test`.
     */
    allSettled(): Promise<void>;

    /**
     * Enable or disable dispatch/processed tracking. Test-only.
     */
    setTrackingEnabledForTest(enabled: boolean): void;

    /**
     * Clear the await queue and reset dispatch/processed counts. Test-only.
     */
    resetTrackingStateForTest(): void;
}

declare namespace EventBus {
    type ConstructorOf<T> = import('./index').ConstructorOf<T>;

    /**
     * Shape every domain event is expected to follow.
     */
    interface IEvent<Data = unknown> {
        timestamp: Date;
        data: Data;
    }

    /**
     * The part of a logger the bus uses, e.g. a `@tryghost/logging` instance.
     */
    interface Logger {
        error(...args: any[]): unknown;
    }

    interface EventBusOptions {
        /** Logger used to report errors thrown by handlers. */
        logging: Logger;
    }
}

export = EventBus;
