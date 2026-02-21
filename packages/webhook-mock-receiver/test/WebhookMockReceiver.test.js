const assert = require('assert/strict');
const got = require('got');
const sinon = require('sinon');

const WebhookMockReceiver = require('../');

describe('Webhook Mock Receiver', function () {
    let snapshotManager;
    let webhookMockReceiver;
    const webhookURL = 'https://test-webhook-receiver.com/webhook';

    before(function () {
        snapshotManager = {
            assertSnapshot: sinon.spy()
        };
        webhookMockReceiver = new WebhookMockReceiver({
            snapshotManager
        });
    });

    afterEach(function () {
        sinon.reset();
        webhookMockReceiver.reset();
    });

    describe('recordBodyResponse', function () {
        it('saves the payload', function () {
            webhookMockReceiver.recordRequest({foo: 'bar'}, {
                headers: {
                    lorem: 'ipsum'
                }
            });

            assert.deepEqual(webhookMockReceiver.body, {
                body: {
                    foo: 'bar'
                }
            });
            assert.deepEqual(webhookMockReceiver.headers, {
                headers: {
                    lorem: 'ipsum'
                }
            });
        });
    });

    describe('mock', function () {
        it('created a mock request receiver base on url', async function () {
            webhookMockReceiver.mock(webhookURL);

            await got.post(webhookURL, {
                body: {
                    avocado: 'toast'
                },
                json: true
            });

            assert.deepEqual(webhookMockReceiver.body, {
                body: {
                    avocado: 'toast'
                }
            });
        });
    });

    describe('reset', function () {
        it('resets the default state of the mock receiver', async function () {
            webhookMockReceiver.mock(webhookURL);
            await got.post(webhookURL, {
                avocado: 'toast',
                headers: {
                    hey: 'ho'
                }
            });

            assert.notEqual(webhookMockReceiver.body, undefined);
            assert.notEqual(webhookMockReceiver.headers, undefined);

            webhookMockReceiver.reset();

            assert.equal(webhookMockReceiver.body, undefined);
            assert.equal(webhookMockReceiver.headers, undefined);
        });
    });

    describe('receivedRequest', function () {
        it('has has internal receivers done once receivedRequest resolves', async function () {
            webhookMockReceiver.mock(webhookURL);

            // shoot a request with a delay simulating request completion delay
            setTimeout(() => {
                got.post(webhookURL, {
                    body: {
                        avocado: 'toast'
                    },
                    json: true
                });
            }, (10 + 1));

            assert.equal(webhookMockReceiver._receiver.isDone(), false);

            await webhookMockReceiver.receivedRequest();

            assert.equal(webhookMockReceiver._receiver.isDone(), true);
        });
    });

    describe('matchBodySnapshot', function () {
        it('checks the request payload', async function () {
            webhookMockReceiver.mock(webhookURL);
            await got.post(webhookURL, {
                body: {
                    avocado: 'toast'
                },
                json: true
            });

            webhookMockReceiver.matchBodySnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                body: {
                    avocado: 'toast'
                }
            });

            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].field, 'body');
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].type, 'body');
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].properties, {});
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].error.constructor.name, 'AssertionError');
        });

        it('waits for the request completion before checking the request payload', async function () {
            webhookMockReceiver.mock(webhookURL);

            // shoot a request with a delay simulating request completion delay
            // 10 is the delay that's used now to recheck for completed request
            setTimeout(() => {
                got.post(webhookURL, {
                    body: {
                        avocado: 'toast'
                    },
                    json: true
                });
            }, (10 + 1));

            await webhookMockReceiver.receivedRequest();
            webhookMockReceiver.matchBodySnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                body: {
                    avocado: 'toast'
                }
            });
        });
    });

    describe('matchHeaderSnapshot', function () {
        it('checks the request payload', async function () {
            webhookMockReceiver.mock(webhookURL);
            await got.post(webhookURL, {
                headers: {
                    foo: 'bar'
                }
            });

            await webhookMockReceiver.matchHeaderSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(Object.keys(snapshotManager.assertSnapshot.args[0][0]), ['headers']);
            const headers = snapshotManager.assertSnapshot.args[0][0].headers;
            assert.equal(headers.foo, 'bar');
            assert.equal(headers['accept-encoding'], 'gzip, deflate');
            assert.match(headers['user-agent'], /^got\//);

            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].field, 'headers');
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].type, 'header');
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].properties, {});
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][1].error.constructor.name, 'AssertionError');
        });
    });

    describe('chainable interface', function () {
        it('chains body and header snapshot matching assertions', async function () {
            webhookMockReceiver.mock(webhookURL);
            await got.post(webhookURL);

            webhookMockReceiver
                .matchHeaderSnapshot()
                .matchBodySnapshot();
        });
    });
});
