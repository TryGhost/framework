# Express Test

Rapid express testing without HTTP

## Install

`npm install @tryghost/express-test --save`

or

`yarn add @tryghost/express-test`


## Usage

```
const TestAgent = require('@tryghost/express-test');
const agent = new TestAgent(app, {defaults});
```

For the most up-to-date and clear usage info, there's a live working example of this library in action inside `tests/example-app.test.js`.

An instantiated agent can make HTTP-like calls, with a supertest-like chained API to set headers & body and to check status, headers and anything else.


```
const agent = new TestAgent(app)

return await agent
    .post('/check/')
    .header('x-check', true) // set a header
    .body({foo: 'bar'}) // Set the body of the POST
    .expectStatus(200) // Assert that the response status is 200
    .expectHeader('x-checked', 'false') // Assert a header is set on the response
    .expect(({body}) => {
        // Make any further assertions
        assert.deepEqual(body, {foo: 'bar'});
    });
```
This is an initial version for review. More docs coming if it works :)


### Assertion execution order
The order of *chained* assertion execution is NOT the order they were declared in. The framework follows the priority order of the assertion types:
1. `expect`
2. `expectHeader`
3. `expectStatus`

Meaning, any `expect` declarations would be asserted first following by `expectHeader` and `expectStatus` declarations.

The custom order is here to prioritize assertions with the most context first. The feature was added based on frustrations with frameworks like [superagent](https://github.com/visionmedia/superagent), which didn't provide enough information when the status code assertions failed.

## Develop

This is a mono repository, managed with [lerna](https://lernajs.io/).

Follow the instructions for the top-level repo.
1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.


## Run

- `yarn dev`


## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests




# Copyright & License

Copyright (c) 2013-2022 Ghost Foundation - Released under the [MIT license](LICENSE).
