const assert = require('assert/strict');
const sinon = require('sinon');
const { Worker } = require('worker_threads');
const rootUtils = require('@tryghost/root-utils');
const { version } = require('../package.json');

const major = parseInt(version, 10);
const registryKey = Symbol.for(`@tryghost/metrics@${major}`);
const defaultBuiltKey = Symbol.for(`@tryghost/metrics@${major}:default`);

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
    delete globalThis[defaultBuiltKey];
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
                'createMetrics',
                'setInstance',
            ]);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(globalThis[defaultBuiltKey], undefined);
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

    describe('createMetrics', function () {
        it('builds a GhostMetrics from the options passed in', function () {
            const { createMetrics, GhostMetrics } = loadFactory();

            const metrics = createMetrics({
                domain: 'factory-test',
                metrics: { transports: [], metadata: { id: 'abc' } },
            });

            assert.ok(metrics instanceof GhostMetrics);
            assert.equal(metrics.domain, 'factory-test');
            assert.deepEqual(metrics.transports, []);
            assert.deepEqual(metrics.metadata, { id: 'abc' });
        });

        it('works without options', function () {
            const { createMetrics, GhostMetrics } = loadFactory();

            assert.ok(createMetrics() instanceof GhostMetrics);
        });

        it('returns a new instance each call and registers none of them', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { createMetrics } = loadFactory();

            const first = createMetrics();
            const second = createMetrics();

            assert.notEqual(first, second);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(globalThis[defaultBuiltKey], undefined);
            assert.equal(getProcessRoot.called, false);
        });
    });

    describe('setInstance', function () {
        it('makes the instance the one the main entry returns', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { createMetrics, setInstance, GhostMetrics } = loadFactory();
            const instance = createMetrics({ domain: 'set-instance-test' });

            assert.equal(setInstance(instance), instance);
            assert.equal(globalThis[registryKey], instance);

            const metrics = loadMainEntry();

            assert.equal(metrics, instance);
            assert.equal(metrics.domain, 'set-instance-test');
            // The main entry did not build its own instance
            assert.equal(getProcessRoot.called, false);
            assert.equal(globalThis[defaultBuiltKey], undefined);
            // The main entry still attaches the class
            assert.equal(metrics.GhostMetrics, GhostMetrics);
        });

        it('is returned by every copy of the main entry', function () {
            const { createMetrics, setInstance } = loadFactory();
            const instance = setInstance(createMetrics());

            const first = loadMainEntry();
            clearMainEntry();
            const second = loadMainEntry();

            assert.equal(first, instance);
            assert.equal(second, instance);
        });

        it('is a no-op when called again with the same instance', function () {
            const { createMetrics, setInstance } = loadFactory();
            const instance = createMetrics();

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
            const { createMetrics, setInstance } = loadFactory();

            assert.equal(globalThis[defaultBuiltKey], metrics);
            assert.throws(() => setInstance(createMetrics()), {
                name: 'Error',
                message: ALREADY_EXISTS,
            });
            assert.equal(globalThis[registryKey], undefined);
        });

        it('throws when a different instance was already set', function () {
            const { createMetrics, setInstance } = loadFactory();
            const first = setInstance(createMetrics());

            assert.throws(() => setInstance(createMetrics()), ALREADY_EXISTS);
            assert.equal(globalThis[registryKey], first);
        });

        it('throws when a different copy of the factory registered an instance', function () {
            const first = loadFactory();
            const instance = first.setInstance(first.createMetrics());

            clearModules();
            const second = loadFactory();

            assert.notEqual(second.setInstance, first.setInstance);
            assert.throws(() => second.setInstance(second.createMetrics()), ALREADY_EXISTS);
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
            const { createMetrics, setInstance } = loadFactory();
            setInstance(createMetrics({ domain: 'main-thread' }));

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
        it('still builds a separate instance per copy', function () {
            const first = loadMainEntry();
            clearMainEntry();
            const second = loadMainEntry();

            assert.notEqual(second, first);
            assert.equal(globalThis[registryKey], undefined);
            // Only the first default instance is remembered
            assert.equal(globalThis[defaultBuiltKey], first);
        });
    });
});
