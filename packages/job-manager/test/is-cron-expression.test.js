const assert = require('assert/strict');
const rewire = require('rewire');

const isCronExpression = require('../lib/is-cron-expression');

describe('Is cron expression', function () {
    it('valid cron expressions', function () {
        assert.equal(isCronExpression('* * * * * *'), true);
        assert.equal(isCronExpression('1 * * * * *'), true);
        assert.equal(isCronExpression('0 0 13-23 * * *'), true, 'Range should be 0-23');
    });

    it('invalid cron expressions', function () {
        assert.equal(isCronExpression('0 123 * * * *'), false);
        assert.equal(isCronExpression('a * * * *'), false);
        assert.equal(isCronExpression('* 13-24 * * *'), false, 'Invalid range should be 0-23');
    });

    it('supports cron-validate default export shape', function () {
        const rewiredModule = rewire('../lib/is-cron-expression');
        let calledWith = null;

        rewiredModule.__set__('cronValidate', (expression, options) => {
            calledWith = {expression, options};
            return {
                isValid() {
                    return true;
                }
            };
        });

        assert.equal(rewiredModule('*/5 * * * * *'), true);
        assert.deepEqual(calledWith, {
            expression: '*/5 * * * * *',
            options: {
                preset: 'default',
                override: {
                    useSeconds: true
                }
            }
        });
    });
});
