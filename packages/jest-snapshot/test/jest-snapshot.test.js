const {assert, sinon} = require('./utils');

// We require the root dire
const snapshotTools = require('../');

describe('Jest Snapshot', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('exposes a set of functions', function () {
        assert.deepEqual(Object.keys(snapshotTools), ['mochaHooks', 'snapshotManager', 'matchSnapshotAssertion', 'any', 'anything', 'stringMatching']);

        const {any, anything, stringMatching} = snapshotTools;

        // Check the methods we export from other packages still exist and are functions
        assert.equal(typeof any, 'function');
        assert.equal(typeof anything, 'function');
        assert.equal(typeof stringMatching, 'function');
    });

    it('matchSnapshotAssertion calls the match function and asserts the result', function () {
        const matchSnapshotSpy = sinon.stub(snapshotTools.snapshotManager, 'match').returns(
            {
                message: () => { },
                pass: {
                    should: {
                        eql: () => { }
                    }
                }
            }
        );
        const fakeThis = {obj: {foo: 'bar'}, assert: () => {}};
        const fakeProps = {};
        snapshotTools.matchSnapshotAssertion.call(fakeThis, fakeProps);
        sinon.assert.calledOnce(matchSnapshotSpy);
        sinon.assert.calledOnceWithExactly(matchSnapshotSpy, fakeThis.obj, fakeProps);
    });

    describe('mochaHooks', function () {
        it('beforeAll correctly resets the registry', function () {
            const registrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistry');
            snapshotTools.mochaHooks.beforeAll();
            sinon.assert.calledOnce(registrySpy);
        });

        it('beforeEach correctly sets the current test', function () {
            const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
            sinon.assert.calledOnce(setTestSpy);
        });

        it('beforeEach with retries correctly resets the registry for the current test', function () {
            const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
            const resetRegistrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistryForCurrentTest').returns();
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 1}});
            sinon.assert.calledTwice(setTestSpy);
            sinon.assert.calledOnce(resetRegistrySpy);
        });
    });

    describe('framework expectations', function () {
        // The expectation of this framework is that you wire up the beforeAll and beforeEach hooks
        // and then call snapshotManager.match in your tests, either directly, via matchSnapshotAssertion
        // or via the snapshotManager.assertSnapshot method.

        // This test checks that match works as expected when using beforeAll and beforeEach
        const testFile = 'test/framework-expectations-test.js';
        const firstTestTitle = 'My first test';
        const secondTestTitle = 'My second test';

        it('snapshot matching works as expected when using beforeAll and beforeEach', function () {
            // Setup some spies
            const resetRegistrySpy = sinon.spy(snapshotTools.snapshotManager, 'resetRegistry');
            const setCurrentTestSpy = sinon.spy(snapshotTools.snapshotManager, 'setCurrentTest');

            const firstTest = {file: `${testFile}`, fullTitle: () => firstTestTitle, currentRetry: () => 0};
            const secondTest = {file: `${testFile}`, fullTitle: () => secondTestTitle, currentRetry: () => 0};
            const expectedResult = {foo: 'bar'};

            let testResult;

            // Call beforeAll - this should reset the registry
            snapshotTools.mochaHooks.beforeAll();
            sinon.assert.calledOnce(resetRegistrySpy);
            assert.deepEqual(snapshotTools.snapshotManager.registry, {});

            // Execute a test calling beforeEach and using match
            snapshotTools.mochaHooks.beforeEach.call({currentTest: firstTest});
            testResult = snapshotTools.snapshotManager.match(expectedResult);

            // Check the test was called how we expected
            sinon.assert.calledOnce(setCurrentTestSpy);
            assert.deepEqual(setCurrentTestSpy.firstCall.args[0], {testPath: `${testFile}`, testTitle: firstTestTitle});
            assert.equal(testResult.pass, true);

            // Check the registry looks as expected
            assert.deepEqual(snapshotTools.snapshotManager.registry, {
                [`${testFile}`]: {
                    [`${firstTestTitle}`]: 1
                }
            });

            // Execute a second test
            snapshotTools.mochaHooks.beforeEach.call({currentTest: secondTest});
            testResult = snapshotTools.snapshotManager.match(expectedResult);

            sinon.assert.calledTwice(setCurrentTestSpy);
            assert.deepEqual(setCurrentTestSpy.secondCall.args[0], {testPath: `${testFile}`, testTitle: secondTestTitle});
            assert.equal(testResult.pass, false);

            // Check the registry looks as expected
            assert.deepEqual(snapshotTools.snapshotManager.registry, {
                [`${testFile}`]: {
                    [`${firstTestTitle}`]: 1,
                    [`${secondTestTitle}`]: 1
                }
            });

            // Execute a third test, which is the second test duplicated
            snapshotTools.mochaHooks.beforeEach.call({currentTest: secondTest});
            testResult = snapshotTools.snapshotManager.match(expectedResult);

            sinon.assert.calledThrice(setCurrentTestSpy);
            assert.deepEqual(setCurrentTestSpy.thirdCall.args[0], {testPath: `${testFile}`, testTitle: secondTestTitle});
            assert.equal(testResult.pass, false);

            // Check the registry looks as expected
            assert.deepEqual(snapshotTools.snapshotManager.registry, {
                [`${testFile}`]: {
                    [`${firstTestTitle}`]: 1,
                    [`${secondTestTitle}`]: 2
                }
            });
        });
    });
});
