const assert = require('assert');
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
            const result = webhookMockReceiver.recordBodyResponse({foo: 'bar'});

            assert.equal(result, true);
            assert.deepEqual(webhookMockReceiver.bodyResponse, {
                body: {
                    foo: 'bar'
                }
            });
        });
    });

    describe('mock', function () {
        it('created a mock request receiver base on url', async function () {
            webhookMockReceiver.mock(webhookURL);

            assert.notEqual(webhookMockReceiver.receiver, undefined);

            assert.equal(webhookMockReceiver.receiver.isDone(), false);

            await got.post(webhookURL, {
                body: {
                    avocado: 'toast'
                },
                json: true
            });

            assert.equal(webhookMockReceiver.receiver.isDone(), true);
            assert.deepEqual(webhookMockReceiver.bodyResponse, {
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
                avocado: 'toast'
            });

            assert.notEqual(webhookMockReceiver.receiver, undefined);
            assert.notEqual(webhookMockReceiver.bodyResponse, undefined);

            webhookMockReceiver.reset();

            assert.equal(webhookMockReceiver.receiver, undefined);
            assert.equal(webhookMockReceiver.bodyResponse, undefined);
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

            await webhookMockReceiver.matchBodySnapshot();

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

        it('waits for the request completeion before checking the request payload', async function () {
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

            await webhookMockReceiver.matchBodySnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                body: {
                    avocado: 'toast'
                }
            });
        });
    });
});
