# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the @tryghost/express-test package - a testing library for Express.js applications that enables rapid testing without actual HTTP requests. It provides a supertest-like API with enhanced features like snapshot testing, cookie jar support, and custom assertion chaining.

## Common Development Commands

```bash
# Run tests with coverage
yarn test

# Run only linting
yarn lint

# The test command includes both testing and linting
# Tests run with c8 coverage tool requiring 100% coverage
```

### Running Individual Tests

```bash
# Run a specific test file
NODE_ENV=testing npx mocha --require ./test/utils/overrides.js './test/path/to/specific.test.js'

# Run tests matching a pattern
NODE_ENV=testing npx mocha --require ./test/utils/overrides.js './test/**/*.test.js' --grep "pattern"
```

## Architecture and Code Structure

### Core Components

1. **Agent.js** (lib/Agent.js) - Main testing agent that wraps Express applications
   - Handles cookie jar management
   - Provides HTTP method shortcuts (get, post, put, delete, etc.)
   - Integrates with snapshot testing

2. **Request.js** (lib/Request.js) - Handles the actual request execution
   - Manages request/response lifecycle
   - Processes headers, body, and query parameters
   - Executes the Express app internally without HTTP

3. **ExpectRequest.js** (lib/ExpectRequest.js) - Assertion chaining system
   - Implements prioritized assertion execution order:
     1. `expect` (custom assertions)
     2. `expectHeader` (header assertions)
     3. `expectStatus` (status code assertions)
   - Provides fluent API for test assertions

### Key Design Patterns

- **Chained API Pattern**: All methods return `this` or a promise for chaining
- **No HTTP Overhead**: Directly invokes Express app handlers without network calls
- **Cookie Persistence**: Maintains cookies across requests using tough-cookie
- **Snapshot Testing**: Integrates with @tryghost/jest-snapshot for response snapshots

### Testing Conventions

- Tests use Mocha with native Node.js assert module
- 100% code coverage is required (enforced by c8)
- Test files follow `*.test.js` naming convention
- Fixtures stored in `/test/fixtures/`

## Important Notes

- **Debug Code Alert**: There's currently debug code in lib/Agent.js:25-26 that logs "IAM HERE" and throws an error. This needs to be removed before the code will function.
- This is part of the Ghost Framework monorepo managed with Lerna
- The package is publicly published to npm under @tryghost scope
- ESLint configuration extends Ghost's custom plugin rules