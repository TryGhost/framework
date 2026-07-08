const assert = require('assert');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const fs = require('fs').promises;

const FileRotator = require('../lib/fileRotator');
const PeriodTrigger = require('../lib/periodTrigger');
const ThresholdTrigger = require('../lib/thresholdTrigger');
const WriteQueue = require('../lib/writeQueue');
const { Rotate, NewFile, BytesWritten } = require('../lib/customEvents');

const gunzip = promisify(zlib.gunzip);

async function exists(filePath) {
    try {
        await fs.stat(filePath);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

describe('FileRotator', function () {
    const logDir = 'logs/rotator';

    beforeAll(async function () {
        await fs.rm(logDir, { recursive: true, force: true });
        await fs.mkdir(logDir, { recursive: true });
    });

    it('Rotates gzipped backups with %N naming and prunes to totalFiles', async function () {
        const rotator = new FileRotator({
            path: path.join(logDir, 'test_%N.log'),
            totalFiles: 2,
            gzip: true,
            startNewFile: true,
        });
        const newFiles = [];
        rotator.on(NewFile, (fileInfo) => newFiles.push(fileInfo));

        await rotator.initialise();
        // Initialising twice is a no-op
        await rotator.initialise();

        await rotator.getCurrentHandle().write('first\n');
        await rotator.rotate();
        await rotator.getCurrentHandle().write('second\n');
        await rotator.rotate();
        await rotator.getCurrentHandle().write('third\n');
        await rotator.rotate();
        await rotator.shutdown();

        assert.ok(newFiles.length >= 4);
        assert.strictEqual(await exists(path.join(logDir, 'test.log')), true);
        assert.strictEqual(await exists(path.join(logDir, 'test_0.log.gz')), true);
        assert.strictEqual(await exists(path.join(logDir, 'test_1.log.gz')), true);
        assert.strictEqual(await exists(path.join(logDir, 'test_2.log.gz')), false);

        const newestBackup = await gunzip(await fs.readFile(path.join(logDir, 'test_0.log.gz')));
        assert.strictEqual(newestBackup.toString(), 'third\n');
    });

    it('Prunes backups over totalSize', async function () {
        const rotator = new FileRotator({
            path: path.join(logDir, 'size.log'),
            totalSize: '1b',
            startNewFile: true,
        });

        await rotator.initialise();
        await rotator.getCurrentHandle().write('some data longer than one byte\n');
        await rotator.rotate();
        await rotator.getCurrentHandle().write('even more data longer than one byte\n');
        await rotator.rotate();
        await rotator.shutdown();

        assert.strictEqual(await exists(path.join(logDir, 'size.log')), true);
        assert.strictEqual(await exists(path.join(logDir, 'size.0.log')), true);
        assert.strictEqual(await exists(path.join(logDir, 'size.1.log')), false);
    });

    it('Opens the existing file when startNewFile is not set', async function () {
        const filePath = path.join(logDir, 'existing.log');
        await fs.writeFile(filePath, 'already here\n');

        const rotator = new FileRotator({
            path: filePath,
        });
        await rotator.initialise();
        await rotator.shutdown();

        const contents = await fs.readFile(filePath, 'utf8');
        assert.strictEqual(contents, 'already here\n');
    });
});

describe('PeriodTrigger', function () {
    const fileInfo = { birthtimeMs: Date.now() };

    ['1h', '1d', '1w', '1m', '1y'].forEach(function (period) {
        it(`Schedules the first rotation in the future for period "${period}"`, function () {
            const trigger = new PeriodTrigger(period, false);
            trigger.newFile(fileInfo);
            assert.ok(trigger._rotateAt > Date.now());
            trigger.shutdown();
        });

        it(`Schedules rotation from the existing file for period "${period}"`, function () {
            const trigger = new PeriodTrigger(period, true);
            trigger.newFile(fileInfo);
            assert.ok(trigger._rotateAt > fileInfo.birthtimeMs);
            trigger.shutdown();
        });
    });

    it('Schedules millisecond periods from the existing file', function () {
        const trigger = new PeriodTrigger('500ms', true);
        trigger.newFile(fileInfo);
        assert.strictEqual(trigger._rotateAt, fileInfo.birthtimeMs + 500);
        trigger.shutdown();
    });

    it('Only rotates based on the existing file once', function () {
        const trigger = new PeriodTrigger('1d', true);
        trigger.newFile(fileInfo);
        const firstRotateAt = trigger._rotateAt;
        trigger.newFile({ birthtimeMs: 0 });
        assert.ok(trigger._rotateAt >= firstRotateAt);
        trigger.shutdown();
    });

    it('Shuts down cleanly before any file is seen', function () {
        const trigger = new PeriodTrigger('1d', false);
        trigger.shutdown();
    });
});

describe('ThresholdTrigger', function () {
    it('Emits a rotate event when the threshold is crossed', function () {
        const trigger = new ThresholdTrigger('1k');
        let rotations = 0;
        trigger.on(Rotate, () => rotations++);

        trigger.newFile({ size: 0 });
        trigger.updateWritten(1000);
        assert.strictEqual(rotations, 0);
        trigger.updateWritten(1000);
        assert.strictEqual(rotations, 1);
        trigger.shutdown();
    });
});

describe('WriteQueue', function () {
    it('Shuts down cleanly when never given a file handle', async function () {
        const queue = new WriteQueue();
        queue.push('data\n');
        await queue.shutdown();
    });

    it('Reports bytes written', async function () {
        const queue = new WriteQueue();
        const written = [];
        queue.on(BytesWritten, (bytes) => written.push(bytes));
        queue.setFileHandle({
            write: async (data) => ({ bytesWritten: data.length }),
        });
        queue.push('data\n');
        await queue.shutdown();
        const totalWritten = written.reduce((total, bytes) => total + bytes, 0);
        assert.strictEqual(totalWritten, 5);
    });
});
