const assert = require('assert');
const sinon = require('sinon');

const EmailMockReceiver = require('../index');

describe('Email mock receiver', function () {
    let snapshotManager;
    let emailMockReceiver;

    before(function () {
        snapshotManager = {
            assertSnapshot: sinon.spy()
        };
    });

    beforeEach(function () {
        emailMockReceiver = new EmailMockReceiver({snapshotManager});
    });

    afterEach(function () {
        sinon.reset();
        emailMockReceiver.reset();
    });

    it('Can initialize', function () {
        assert.ok(new EmailMockReceiver({snapshotManager: {}}));
    });

    describe('matchHTMLSnapshot', function () {
        it('Can match primitive HTML snapshot', function () {
            emailMockReceiver.send({html: '<div>test</div>'});
            emailMockReceiver.matchHTMLSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test</div>'
            });
        });

        it('Can match first HTML snapshot with multiple send requests are executed', function () {
            emailMockReceiver = new EmailMockReceiver({snapshotManager});

            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});

            emailMockReceiver.matchHTMLSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test 1</div>'
            });
        });

        it('Can match HTML snapshot with dynamic URL query parameters', function () {
            emailMockReceiver = new EmailMockReceiver({snapshotManager});

            emailMockReceiver.send({
                html: '<div>test https://127.0.0.1:2369/welcome/?token=JRexE3uutntD6F6WXSVaDZke91fTjpvO&action=signup</div>'
            });

            emailMockReceiver.matchHTMLSnapshot([{
                pattern: /token=(\w+)/gmi,
                replacement: 'token=TEST_TOKEN'
            }]);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test https://127.0.0.1:2369/welcome/?token=TEST_TOKEN&action=signup</div>'
            });
        });

        it('Can match HTML snapshot with dynamic version in content', function () {
            emailMockReceiver = new EmailMockReceiver({snapshotManager});

            emailMockReceiver.send({
                html: '<div>this email contains a dynamic version string v5.45</div>'
            });

            emailMockReceiver.matchHTMLSnapshot([{
                pattern: /v\d+.\d+/gmi,
                replacement: 'v5.0'
            }]);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>this email contains a dynamic version string v5.0</div>'
            });
        });

        it('Cant match HTML snapshot with multiple occurrences of dynamic content', function () {
            emailMockReceiver = new EmailMockReceiver({snapshotManager});

            emailMockReceiver.send({
                html: '<div>this email contains a dynamic version string once v5.45 and twice v4.28</div>'
            });

            emailMockReceiver.matchHTMLSnapshot([{
                pattern: /v\d+.\d+/gmi,
                replacement: 'v5.0'
            }]);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>this email contains a dynamic version string once v5.0 and twice v5.0</div>'
            });
        });
    });

    describe('matchMetadataSnapshot', function (){
        it('Can match primitive metadata snapshot ignoring html property', function () {
            emailMockReceiver.send({
                subject: 'test',
                to: 'test@example.com',
                html: '<div>do not include me</div>'
            });
            emailMockReceiver.matchMetadataSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0].metadata, {
                subject: 'test',
                to: 'test@example.com'
            });
        });

        it('Can match explicit second metadata snapshot when multiple send requests are executed', function () {
            emailMockReceiver.send({
                subject: 'test 1',
                to: 'test@example.com'
            });

            emailMockReceiver.send({
                subject: 'test 2',
                to: 'test@example.com'
            });

            emailMockReceiver.matchMetadataSnapshot({}, 1);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0].metadata, {
                subject: 'test 2',
                to: 'test@example.com'
            });
        });
    });

    describe('sentEmailCount', function () {
        it('Can assert email count', function () {
            emailMockReceiver.send({html: '<div>test</div>'});
            emailMockReceiver.sentEmailCount(1);
        });

        it('Can assert email count with multiple send requests are executed', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});
            emailMockReceiver.sentEmailCount(2);
        });

        it('Can reset email count', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.sentEmailCount(1);

            emailMockReceiver.reset();
            emailMockReceiver.sentEmailCount(0);
        });
    });
});
