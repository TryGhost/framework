const assert = require('assert/strict');
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

    it('Can chain match snapshot methods', function () {
        emailMockReceiver.send({
            html: '<div>test</div>',
            text: 'test text lorem ipsum',
            metadata: {
                to: 'test@example.com'
            }
        });

        emailMockReceiver
            .matchHTMLSnapshot()
            .matchPlaintextSnapshot()
            .matchMetadataSnapshot()
            .assertSentEmailCount(1);

        assert.equal(snapshotManager.assertSnapshot.calledThrice, true);
        assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
            html: '<div>test</div>'
        });
        assert.deepEqual(snapshotManager.assertSnapshot.args[1][0], {
            text: 'test text lorem ipsum'
        });
        assert.deepEqual(snapshotManager.assertSnapshot.args[2][0], {
            metadata: {
                metadata: {
                    to: 'test@example.com'
                }
            }
        });
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
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});

            emailMockReceiver.matchHTMLSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test 1</div>'
            });
        });

        it('Can match HTML snapshot with dynamic URL query parameters', function () {
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

    describe('matchPlaintextSnapshot', function () {
        it('Can match primitive text snapshot', function () {
            emailMockReceiver.send({text: 'test text lorem ipsum'});

            emailMockReceiver.matchPlaintextSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                text: 'test text lorem ipsum'
            });
        });

        it('Can match text snapshot with multiple send requests are executed', function () {
            emailMockReceiver.send({text: 'test 1'});
            emailMockReceiver.send({text: 'test 2'});

            emailMockReceiver.matchPlaintextSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                text: 'test 1'
            });

            emailMockReceiver.matchPlaintextSnapshot([], 1);
            assert.equal(snapshotManager.assertSnapshot.calledTwice, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[1][0], {
                text: 'test 2'
            });
        });

        it('Can match text snapshot with dynamic URL query parameters', function () {
            emailMockReceiver.send({
                text: 'test https://127.0.0.1:2369/welcome/?token=JRexE3uutntD6F6WXSVaDZke91fTjpvO&action=signup'
            });

            emailMockReceiver.matchPlaintextSnapshot([{
                pattern: /token=(\w+)/gmi,
                replacement: 'token=TEST_TOKEN'
            }]);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                text: 'test https://127.0.0.1:2369/welcome/?token=TEST_TOKEN&action=signup'
            });
        });

        it('Can match text snapshot with dynamic version in content', function () {
            emailMockReceiver.send({
                text: 'this email contains a dynamic version string v5.45'
            });

            emailMockReceiver.matchPlaintextSnapshot([{
                pattern: /v\d+.\d+/gmi,
                replacement: 'v5.0'
            }]);

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                text: 'this email contains a dynamic version string v5.0'
            });
        });

        it('Cant match text snapshot with multiple occurrences of dynamic content', function () {
            emailMockReceiver.send({
                text: 'this email contains a dynamic version string once v5.45 and twice v4.28'
            });

            emailMockReceiver.matchPlaintextSnapshot([{
                pattern: /v\d+.\d+/gmi,
                replacement: 'v5.0'
            }]);
            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                text: 'this email contains a dynamic version string once v5.0 and twice v5.0'
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

    describe('assertSentEmailCount', function () {
        it('Can assert email count', function () {
            emailMockReceiver.send({html: '<div>test</div>'});
            emailMockReceiver.assertSentEmailCount(1);
        });

        it('Can assert email count with multiple send requests are executed', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});
            emailMockReceiver.assertSentEmailCount(2);
        });

        it('Can reset email count', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.assertSentEmailCount(1);

            emailMockReceiver.reset();
            emailMockReceiver.assertSentEmailCount(0);
        });

        it('Throws error when email count is not equal to expected', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});

            assert.throws(function () {
                emailMockReceiver.assertSentEmailCount(2);
            });
        });
    });

    describe('getSentEmail', function () {
        it('Can get sent email', function () {
            emailMockReceiver.send({html: '<div>test</div>'});
            assert.equal(emailMockReceiver.getSentEmail(0).html, '<div>test</div>');
        });

        it('Can get sent email with multiple send requests are executed', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});

            assert.equal(emailMockReceiver.getSentEmail(0).html, '<div>test 1</div>');
            assert.equal(emailMockReceiver.getSentEmail(1).html, '<div>test 2</div>');
        });

        it('Returns undefined when email index is out of bounds', function () {
            emailMockReceiver.send({html: '<div>test 1</div>'});

            assert.equal(emailMockReceiver.getSentEmail(1), undefined);
        });
    });
});
