/**
 * A simple in-process event bus for domain events. Events are keyed by their
 * class name, so subscribers pass the event class and dispatchers pass an
 * instance of it.
 */
declare class DomainEvents {
    /**
     * Subscribe to an event class. Errors thrown by the handler are logged,
     * not rethrown.
     */
    static subscribe<EventClass extends DomainEvents.IEvent<unknown>>(
        Event: DomainEvents.ConstructorOf<EventClass>,
        handler: (event: EventClass) => Promise<void> | void,
    ): void;

    /**
     * Dispatch an event instance to all subscribers of its class.
     */
    static dispatch<Data>(event: DomainEvents.IEvent<Data>): void;

    /**
     * Dispatch an event when you have its name and data, but no instance of
     * the event class.
     */
    static dispatchRaw<Data>(name: string, data: Data): void;

    /**
     * Wait until every tracked dispatched event has been fully processed.
     * Tracking is only enabled when `NODE_ENV` starts with `test`.
     */
    static allSettled(): Promise<void>;

    /**
     * Enable or disable dispatch/processed tracking. Test-only.
     */
    static setTrackingEnabledForTest(enabled: boolean): void;

    /**
     * Clear the await queue and reset dispatch/processed counts. Test-only.
     */
    static resetTrackingStateForTest(): void;
}

declare namespace DomainEvents {
    type ConstructorOf<T> = import('./index').ConstructorOf<T>;

    /**
     * Shape every domain event is expected to follow.
     */
    interface IEvent<Data = unknown> {
        timestamp: Date;
        data: Data;
    }
}

export = DomainEvents;
