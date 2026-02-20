const assert = require('assert/strict');
const sinon = require('sinon');
const prettyCLI = require('../');

describe('API', function () {
    it('Exposes styled-sywac, styles & the sywac API', function () {
        assert.equal(typeof prettyCLI, 'object');
        assert.equal(typeof prettyCLI.parseAndExit, 'function');
        assert.notEqual(prettyCLI.types, undefined);

        assert.equal(typeof prettyCLI.Api, 'function');
        assert.equal(typeof prettyCLI.Api.get, 'function');

        assert.equal(typeof prettyCLI.styles, 'object');
        assert.deepEqual(Object.keys(prettyCLI.styles).sort(), [
            'descError',
            'flags',
            'flagsError',
            'group',
            'groupError',
            'hints',
            'hintsError',
            'messages',
            'usagePrefix'
        ]);

        assert.equal(typeof prettyCLI.ui, 'object');
        assert.equal(typeof prettyCLI.ui.log, 'function');
        assert.deepEqual(Object.keys(prettyCLI.ui.log).sort(), [
            'debug',
            'error',
            'fatal',
            'info',
            'ok',
            'trace',
            'warn'
        ]);
    });
});

describe('styles', function () {
    it('usagePrefix styles first word and indents the remainder', function () {
        const out = prettyCLI.styles.usagePrefix('Usage: app --help');
        assert.equal(String(out).includes('Usage:'), true);
        assert.equal(String(out).includes('\n  app --help'), true);
    });

    it('applies style functions for standard and error states', function () {
        assert.equal(String(prettyCLI.styles.group('Options:')).includes('Options:'), true);
        assert.equal(String(prettyCLI.styles.flags('--help')).includes('--help'), true);
        assert.equal(String(prettyCLI.styles.hints('[required]')).includes('[required]'), true);

        assert.equal(String(prettyCLI.styles.groupError('Options:')).includes('Options:'), true);
        assert.equal(String(prettyCLI.styles.flagsError('--help')).includes('--help'), true);
        assert.equal(String(prettyCLI.styles.descError('bad arg')).includes('bad arg'), true);
        assert.equal(String(prettyCLI.styles.hintsError('[required]')).includes('[required]'), true);
        assert.equal(String(prettyCLI.styles.messages('boom')).includes('boom'), true);
    });
});

describe('ui', function () {
    let consoleLog;

    beforeEach(function () {
        consoleLog = sinon.stub(console, 'log');
    });

    afterEach(function () {
        consoleLog.restore();
    });

    it('log writes through directly', function () {
        prettyCLI.ui.log('hello', 1);
        assert.equal(consoleLog.calledOnce, true);
        assert.deepEqual(consoleLog.args[0], ['hello', 1]);
    });

    it('severity helpers prefix with expected labels', function () {
        prettyCLI.ui.log.ok('a');
        prettyCLI.ui.log.trace('b');
        prettyCLI.ui.log.debug('c');
        prettyCLI.ui.log.info('d');
        prettyCLI.ui.log.warn('e');
        prettyCLI.ui.log.error('f');
        prettyCLI.ui.log.fatal('g');

        assert.equal(consoleLog.callCount, 7);
        assert.equal(String(consoleLog.args[0][0]).includes('ok'), true);
        assert.equal(String(consoleLog.args[1][0]).includes('trace'), true);
        assert.equal(String(consoleLog.args[2][0]).includes('debug'), true);
        assert.equal(String(consoleLog.args[3][0]).includes('info'), true);
        assert.equal(String(consoleLog.args[4][0]).includes('warn'), true);
        assert.equal(String(consoleLog.args[5][0]).includes('error'), true);
        assert.equal(String(consoleLog.args[6][0]).includes('fatal'), true);
    });
});
