# MW Error Handler

Express middleware helpers for Ghost-style API error handling.

## Install

`npm install @tryghost/mw-error-handler --save`

or

`yarn add @tryghost/mw-error-handler`

## Purpose

`@tryghost/mw-error-handler` normalizes thrown errors into `@tryghost/errors` types, applies appropriate cache-control headers for error responses, and exposes ready-to-use middleware stacks for JSON and HTML error flows.

## Usage

```js
const express = require('express');
const sentry = require('./sentry');
const errorHandler = require('@tryghost/mw-error-handler');

const app = express();

app.get('/api/example', (req, res) => {
    throw new Error('Boom');
});

app.use(errorHandler.resourceNotFound);
app.use(...errorHandler.handleJSONResponse(sentry));
```

## API

- `prepareError(err, req, res, next)`: converts unknown errors to `@tryghost/errors` instances.
- `prepareStack(err, req, res, next)`: sanitizes stack traces for user output.
- `jsonErrorRenderer(err, req, res, next)`: renders `{ errors: [...] }` JSON payloads.
- `prepareErrorCacheControl([cacheControl])`: middleware factory for error cache-control headers.
- `resourceNotFound(req, res, next)`: creates a not-found error (with API version validation support).
- `pageNotFound(req, res, next)`: creates a not-found page error.
- `handleJSONResponse(sentry)`: returns middleware sequence for JSON error responses.
- `handleHTMLResponse(sentry)`: returns middleware sequence for HTML error responses.

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
