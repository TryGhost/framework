const assert = require('assert/strict');
const sinon = require('sinon');
const { Worker } = require('worker_threads');
const rootUtils = require('@tryghost/root-utils');
const { version } = require('../package.json');

const registryKey = Symbol.for(`@tryghost/metrics@${parseInt(version, 10)}`);

const indexPath = require.resolve('../index');
const metricsPath = require.resolve('../lib/metrics');
const factoryPath = require.resolve('../factory');
const libFactoryPath = require.resolve('../lib/factory');
const registryPath = require.resolve('../lib/registry');

function clearMainEntry() {
    delete require.cache[indexPath];
    delete require.cache[metricsPath];
}

function clearModules() {
    clearMainEntry();
    for (const modulePath of [factoryPath, libFactoryPath, registryPath]) {
        delete require.cache[modulePath];
    }
}

function clearRegistry() {
    delete globalThis[registryKey];
}

function loadFactory() {
    return require('../factory');
}

function loadMainEntry() {
    return require('../index');
}

const ALREADY_EXISTS = /setInstance\(\) was called after a different metrics instance was created/;

describe('@tryghost/metrics/factory', function () {
    beforeEach(function () {
        clearRegistry();
        clearModules();
    });

    afterEach(function () {
        sinon.restore();
        clearRegistry();
        clearModules();
    });

    describe('import', function () {
        it('builds nothing and reads no loggingrc', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');

            const factory = loadFactory();

            assert.deepEqual(Object.keys(factory).sort(), [
                'GhostMetrics',
                'getInstance',
                'setInstance',
            ]);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(getProcessRoot.called, false);
            assert.equal(require.cache[metricsPath], undefined);
            assert.equal(require.cache[indexPath], undefined);
        });

        it('exports the same GhostMetrics class as the main entry', function () {
            const factory = loadFactory();
            const metrics = loadMainEntry();

            assert.equal(factory.GhostMetrics, metrics.GhostMetrics);
            assert.equal(factory.GhostMetrics, require('../lib/GhostMetrics'));
        });
    });

    describe('getInstance', function () {
        it('returns undefined and builds nothing before any instance exists', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { getInstance } = loadFactory();

            assert.equal(getInstance(), undefined);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(getProcessRoot.called, false);
        });

        it('returns the instance the main entry built', function () {
            const metrics = loadMainEntry();
            const { getInstance } = loadFactory();

            assert.equal(getInstance(), metrics);
        });

        it('returns the registered instance', function () {
            const { GhostMetrics, getInstance, setInstance } = loadFactory();
            const instance = setInstance(new GhostMetrics());

            assert.equal(getInstance(), instance);
        });

        it('lets a caller adopt an existing instance instead of building one', function () {
            const metrics = loadMainEntry();
            const { GhostMetrics, getInstance, setInstance } = loadFactory();
            const build = sinon.spy(() => new GhostMetrics());

            const instance = getInstance() ?? setInstance(build());

            assert.equal(instance, metrics);
            assert.equal(build.called, false);
        });
    });

    describe('setInstance', function () {
        it('makes the instance the one the main entry returns', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { GhostMetrics, setInstance } = loadFactory();
            const instance = new GhostMetrics({ domain: 'set-instance-test' });

            assert.equal(setInstance(instance), instance);
            assert.equal(globalThis[registryKey], instance);

            const metrics = loadMainEntry();

            assert.equal(metrics, instance);
            assert.equal(metrics.domain, 'set-instance-test');
            // The main entry did not build its own instance
            assert.equal(getProcessRoot.called, false);
            // The main entry still attaches its usual extras
            assert.equal(metrics.GhostMetrics, GhostMetrics);
            assert.equal(typeof metrics.resetForTesting, 'function');
        });

        it('is returned by every copy of the main entry', function () {
            const { GhostMetrics, setInstance } = loadFactory();
            const instance = setInstance(new GhostMetrics());

            const first = loadMainEntry();
            clearMainEntry();
            const second = loadMainEntry();

            assert.equal(first, instance);
            assert.equal(second, instance);
        });

        it('is a no-op when called again with the same instance', function () {
            const { GhostMetrics, setInstance } = loadFactory();
            const instance = new GhostMetrics();

            setInstance(instance);

            assert.equal(setInstance(instance), instance);
            assert.equal(globalThis[registryKey], instance);
            assert.equal(loadMainEntry(), instance);
            assert.equal(setInstance(instance), instance);
        });

        it('accepts the instance the main entry already built', function () {
            const metrics = loadMainEntry();
            const { setInstance } = loadFactory();

            assert.equal(setInstance(metrics), metrics);
            assert.equal(globalThis[registryKey], metrics);
        });

        it('throws when the main entry already built a different instance', function () {
            const metrics = loadMainEntry();
            const { GhostMetrics, setInstance } = loadFactory();

            assert.throws(() => setInstance(new GhostMetrics()), {
                name: 'Error',
                message: ALREADY_EXISTS,
            });
            assert.equal(globalThis[registryKey], metrics);
        });

        it('throws when a different instance was already set', function () {
            const { GhostMetrics, setInstance } = loadFactory();
            const first = setInstance(new GhostMetrics());

            assert.throws(() => setInstance(new GhostMetrics()), ALREADY_EXISTS);
            assert.equal(globalThis[registryKey], first);
        });

        it('throws when a different copy of the factory registered an instance', function () {
            const first = loadFactory();
            const instance = first.setInstance(new first.GhostMetrics());

            clearModules();
            const second = loadFactory();

            assert.notEqual(second.setInstance, first.setInstance);
            assert.throws(() => second.setInstance(new second.GhostMetrics()), ALREADY_EXISTS);
            assert.equal(second.setInstance(instance), instance);
        });

        it('rejects values that are not an instance', function () {
            const { setInstance } = loadFactory();

            for (const value of [undefined, null, 'metrics', 42, () => {}]) {
                assert.throws(() => setInstance(value), {
                    name: 'TypeError',
                    message: /setInstance\(\) requires a metrics instance/,
                });
            }
            assert.equal(globalThis[registryKey], undefined);
        });

        it('is not visible in a worker thread', async function () {
            const { GhostMetrics, setInstance } = loadFactory();
            setInstance(new GhostMetrics({ domain: 'main-thread' }));

            const worker = new Worker(
                `const { parentPort } = require('worker_threads');
                const metrics = require(${JSON.stringify(indexPath)});
                parentPort.postMessage(metrics.domain);`,
                { eval: true },
            );

            try {
                const domain = await new Promise((resolve, reject) => {
                    worker.once('message', resolve);
                    worker.once('error', reject);
                });

                assert.equal(domain, 'localhost');
            } finally {
                await worker.terminate();
            }
        });
    });

    describe('main entry without setInstance', function () {
        it('shares one instance across copies', function () {
            const first = loadMainEntry();
            clearMainEntry();
            const second = loadMainEntry();

            assert.equal(second, first);
            assert.equal(globalThis[registryKey], first);
        });

        it('builds a fresh instance after resetForTesting()', function () {
            const first = loadMainEntry();
            first.resetForTesting();
            clearMainEntry();
            const second = loadMainEntry();

            assert.notEqual(second, first);
            assert.equal(globalThis[registryKey], second);
        });
    });
});
