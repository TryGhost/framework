# Domain Events

## Purpose

Lightweight domain event bus for publishing and subscribing to application-level events.

## Usage

```js
const DomainEvents = require('@tryghost/domain-events');

class MyEvent {
    constructor(message) {
        this.timestamp = new Date();
        this.data = {
            message,
        };
    }
}

DomainEvents.subscribe(MyEvent, function handler(event) {
    console.log(event.data.message);
});

const event = new MyEvent('hello world');

DomainEvents.dispatch(event);
```

### Creating a separate event bus

`createEventBus({ logging })` returns an event bus of its own: its subscribers
and tracking state are separate from the static `DomainEvents` API and from
every other bus. It takes its logger as an argument (anything with an
`error()` method) and uses it to report errors thrown by handlers.

```js
const { createEventBus } = require('@tryghost/domain-events/factory');

const events = createEventBus({ logging });

function handler(event) {
    console.log(event.data.message);
}

events.subscribe(MyEvent, handler);
events.dispatch(new MyEvent('hello world'));
events.unsubscribe(MyEvent, handler); // true if a subscription was removed
```

A bus has the same methods as the static API (`subscribe`, `dispatch`,
`dispatchRaw`, `allSettled`, `setTrackingEnabledForTest`,
`resetTrackingStateForTest`) plus `unsubscribe`.

`@tryghost/domain-events/factory` exports `createEventBus` and the `EventBus`
class and never loads `@tryghost/logging`. `createEventBus` is also available
on the main entry as `DomainEvents.createEventBus`. The static `DomainEvents`
API is a wrapper over one default bus that logs through `@tryghost/logging`.
That bus only loads `@tryghost/logging` the first time a handler throws, so
requiring `@tryghost/domain-events` does not build the process-wide logger.

The package has no `exports` map, so ES modules must import the file by name:
`import factory from '@tryghost/domain-events/factory.js'`.
