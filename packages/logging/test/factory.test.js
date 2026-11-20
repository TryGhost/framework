const assert = require('assert/strict');
const sinon = require('sinon');
const { Worker } = require('worker_threads');
const rootUtils = require('@tryghost/root-utils');
const { version } = require('../package.json');

const registryKey = Symbol.for(`@tryghost/logging@${parseInt(version, 10)}`);

const indexPath = require.resolve('../index');
const loggingPath = require.resolve('../lib/logging');
const factoryPath = require.resolve('../factory');
const libFactoryPath = require.resolve('../lib/factory');
const registryPath = require.resolve('../lib/registry');

function clearModules() {
    for (const modulePath of [indexPath, loggingPath, factoryPath, libFactoryPath, registryPath]) {
        delete require.cache[modulePath];
    }
}

function loadFactory() {
    return require('../factory');
}

function loadMainEntry() {
    return require('../index');
}

describe('@tryghost/logging/factory', function () {
    beforeEach(function () {
        delete globalThis[registryKey];
        clearModules();
    });

    afterEach(function () {
        sinon.restore();
        delete globalThis[registryKey];
        clearModules();
    });

    describe('import', function () {
        it('builds nothing and reads no loggingrc', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');

            const factory = loadFactory();

            assert.deepEqual(Object.keys(factory).sort(), [
                'GhostLogger',
                'getInstance',
                'setInstance',
            ]);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(getProcessRoot.called, false);
            assert.equal(require.cache[loggingPath], undefined);
            assert.equal(require.cache[indexPath], undefined);
        });

        it('exports the same GhostLogger class as the main entry', function () {
            const factory = loadFactory();
            const logging = loadMainEntry();

            assert.equal(factory.GhostLogger, logging.GhostLogger);
            assert.equal(factory.GhostLogger, require('../lib/GhostLogger'));
        });
    });

    describe('getInstance', function () {
        it('returns undefined and builds nothing before any logger exists', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { getInstance } = loadFactory();

            assert.equal(getInstance(), undefined);
            assert.equal(globalThis[registryKey], undefined);
            assert.equal(getProcessRoot.called, false);
        });

        it('returns the logger the main entry built', function () {
            const logging = loadMainEntry();
            const { getInstance } = loadFactory();

            assert.equal(getInstance(), logging);
        });

        it('returns the registered logger', function () {
            const { GhostLogger, getInstance, setInstance } = loadFactory();
            const logger = setInstance(new GhostLogger({ transports: [] }));

            assert.equal(getInstance(), logger);
        });

        it('lets a caller adopt an existing logger instead of building one', function () {
            const logging = loadMainEntry();
            const { GhostLogger, getInstance, setInstance } = loadFactory();
            const build = sinon.spy(() => new GhostLogger({ transports: [] }));

            const logger = getInstance() ?? setInstance(build());

            assert.equal(logger, logging);
            assert.equal(build.called, false);
        });
    });

    describe('setInstance', function () {
        it('makes the instance the one the main entry returns', function () {
            const getProcessRoot = sinon.spy(rootUtils, 'getProcessRoot');
            const { GhostLogger, setInstance } = loadFactory();
            const logger = new GhostLogger({ name: 'set-instance-test', transports: [] });

            assert.equal(setInstance(logger), logger);
            assert.equal(globalThis[registryKey], logger);

            const logging = loadMainEntry();

            assert.equal(logging, logger);
            assert.equal(logging.name, 'set-instance-test');
            // The main entry did not build its own logger
            assert.equal(getProcessRoot.called, false);
            // The main entry still attaches its usual extras
            assert.equal(logging.GhostLogger, GhostLogger);
            assert.equal(typeof logging.resetForTesting, 'function');
        });

        it('is shared with a duplicate copy of the main entry', function () {
            const { GhostLogger, setInstance } = loadFactory();
            const logger = setInstance(new GhostLogger({ transports: [] }));

            const first = loadMainEntry();
            delete require.cache[indexPath];
            delete require.cache[loggingPath];
            const second = loadMainEntry();

            assert.equal(first, logger);
            assert.equal(second, logger);
        });

        it('is a no-op when called again with the same instance', function () {
            const { GhostLogger, setInstance } = loadFactory();
            const logger = new GhostLogger({ transports: [] });

            setInstance(logger);

            assert.equal(setInstance(logger), logger);
            assert.equal(globalThis[registryKey], logger);
            assert.equal(loadMainEntry(), logger);
            assert.equal(setInstance(logger), logger);
        });

        it('accepts the instance the main entry already built', function () {
            const logging = loadMainEntry();
            const { setInstance } = loadFactory();

            assert.equal(setInstance(logging), logging);
            assert.equal(globalThis[registryKey], logging);
        });

        it('throws when the main entry already built a different instance', function () {
            const logging = loadMainEntry();
            const { GhostLogger, setInstance } = loadFactory();

            assert.throws(() => setInstance(new GhostLogger({ transports: [] })), {
                name: 'Error',
                message: /setInstance\(\) was called after a different logger instance was created/,
            });
            assert.equal(globalThis[registryKey], logging);
        });

        it('throws when a different instance was already set', function () {
            const { GhostLogger, setInstance } = loadFactory();
            const first = setInstance(new GhostLogger({ transports: [] }));

            assert.throws(
                () => setInstance(new GhostLogger({ transports: [] })),
                /setInstance\(\) was called after a different logger instance was created/,
            );
            assert.equal(globalThis[registryKey], first);
        });

        it('throws when a different copy of the factory registered an instance', function () {
            const first = loadFactory();
            const logger = first.setInstance(new first.GhostLogger({ transports: [] }));

            clearModules();
            const second = loadFactory();

            assert.notEqual(second.setInstance, first.setInstance);
            assert.throws(
                () => second.setInstance(new second.GhostLogger({ transports: [] })),
                /setInstance\(\) was called after a different logger instance was created/,
            );
            assert.equal(second.setInstance(logger), logger);
        });

        it('can set a new instance after resetForTesting()', function () {
            const { GhostLogger, setInstance } = loadFactory();
            setInstance(new GhostLogger({ transports: [] }));
            loadMainEntry().resetForTesting();

            const replacement = new GhostLogger({ transports: [] });

            assert.equal(setInstance(replacement), replacement);
            assert.equal(globalThis[registryKey], replacement);
        });

        it('rejects values that are not an instance', function () {
            const { setInstance } = loadFactory();

            for (const value of [undefined, null, 'logger', 42, () => {}]) {
                assert.throws(() => setInstance(value), {
                    name: 'TypeError',
                    message: /setInstance\(\) requires a logger instance/,
                });
            }
            assert.equal(globalThis[registryKey], undefined);
        });

        it('does not change what a worker thread builds', async function () {
            const { GhostLogger, setInstance } = loadFactory();
            const logger = setInstance(new GhostLogger({ transports: [] }));
            const info = sinon.spy(logger, 'info');

            // The fixture requires the main entry and logs 'Hello!'. A worker has
            // its own globalThis, so it builds its own 'parent' transport logger
            // instead of seeing the instance set on the main thread.
            const worker = new Worker('./test/fixtures/worker.js');

            try {
                const data = await new Promise((resolve, reject) => {
                    worker.once('message', resolve);
                    worker.once('error', reject);
                    worker.once('exit', (code) => {
                        reject(new Error(`Worker exited with code ${code} before logging`));
                    });
                });

                assert.equal(data, 'Hello!');
                assert.equal(info.called, false);
            } finally {
                await worker.terminate();
            }
        });
    });
});
