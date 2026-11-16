const sinon = require('sinon');
const assert = require('assert');
const sandbox = sinon.createSandbox();
const bunyan = require('bunyan');
const path = require('path');

const RotatingFileStream = require('../index');
const fs = require('fs').promises;
const testConfig = {
    path: 'logs/foo.log',
    totalFiles: 10,
    threshold: '1k',
    rotateExisting: true,
    gzip: true,
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RotatingFileStream', function () {
    beforeAll(async function () {
        await fs.mkdir(path.parse(testConfig.path).dir, {
            recursive: true,
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('Processes client configuration', async function () {
        const rfs = new RotatingFileStream(testConfig);
        assert.strictEqual(rfs._path, testConfig.path);
        await rfs.end();
    });

    it('Writes log files', async function () {
        const stream = new RotatingFileStream(testConfig);
        const logger = bunyan.createLogger({
            name: 'foo',
            streams: [
                {
                    stream,
                },
            ],
        });
        for (let i = 0; i < 100; i++) {
            logger.info('Testing ' + i);
        }
        await delay(0); // immediate delay causes logs to sync
        await stream.end();
    });

    it('Flushes queued logs to disk and stays writable', async function () {
        const logPath = 'logs/flush.log';
        const stream = new RotatingFileStream({
            ...testConfig,
            path: logPath,
        });
        const logger = bunyan.createLogger({
            name: 'foo',
            streams: [
                {
                    stream,
                },
            ],
        });

        logger.info('before flush');
        await stream.flush();
        assert.ok((await fs.readFile(logPath, 'utf8')).includes('before flush'));

        logger.info('after flush');
        await stream.flush();
        assert.ok((await fs.readFile(logPath, 'utf8')).includes('after flush'));

        await stream.end();
        // Flushing a closed stream is a no-op
        await stream.flush();
    });

    it('Rotates an existing file that is already over the threshold on start-up', async function () {
        const logPath = 'logs/oversized.log';
        const backupPath = 'logs/oversized.0.log';
        await fs.rm(logPath, { force: true });
        await fs.rm(backupPath, { force: true });
        await fs.writeFile(logPath, 'x'.repeat(2048));

        const stream = new RotatingFileStream({
            path: logPath,
            threshold: '1k',
        });
        await stream.write('fresh\n');
        await stream.flush();

        assert.strictEqual(await fs.readFile(backupPath, 'utf8'), 'x'.repeat(2048));
        assert.strictEqual(await fs.readFile(logPath, 'utf8'), 'fresh\n');

        await stream.end();
    });

    it('Sets up period correctly', async function () {
        const stream = new RotatingFileStream({
            period: '1w',
            ...testConfig,
        });
        bunyan.createLogger({
            name: 'foo',
            streams: [
                {
                    stream,
                },
            ],
        });
        await stream.end();
    });

    it('Sets up long periods correctly', async function () {
        const stream = new RotatingFileStream({
            period: '1y',
            ...testConfig,
        });
        bunyan.createLogger({
            name: 'foo',
            streams: [
                {
                    stream,
                },
            ],
        });
        await stream.end();
    });

    it('Goes fast with short periods', async function () {
        const stream = new RotatingFileStream({
            period: '50ms',
            ...testConfig,
        });
        const logger = bunyan.createLogger({
            name: 'foo',
            streams: [
                {
                    stream,
                },
            ],
        });
        for (let i = 0; i < 10; i++) {
            logger.info(`Testing ${i}!`);
            await delay(50);
        }
        await stream.end();
    });
});
