const { execFileSync } = require('node:child_process');

describe('Security CommonJS compatibility', function () {
    it('keeps lazy root getters and legacy lib entry points', function () {
        execFileSync(process.execPath, [
            '-e',
            `
            const assert = require('node:assert/strict');
            const path = require('node:path');
            const entry = process.argv[1];
            const security = require(entry);
            const names = ['url', 'tokens', 'string', 'identifier', 'password', 'secret'];
            assert.deepEqual(Object.keys(security), names);
            for (const name of names) {
                const file = require.resolve(path.join(path.dirname(entry), 'lib', name));
                assert.equal(require.cache[file], undefined);
                assert.equal(typeof Object.getOwnPropertyDescriptor(security, name).get, 'function');
                assert.equal(security[name], require(file));
            }
        `,
            require.resolve('../'),
        ]);
    });
});
