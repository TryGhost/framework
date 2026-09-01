const assert = require('assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const packageRoot = path.join(__dirname, '..');

describe('ESM interop', function () {
    it('does not break a concurrent require() of got elsewhere in the process', function () {
        // Loading `got` via `import()` leaves it half-initialised until the promise
        // resolves, so any other CJS consumer that requires it in the meantime fails
        // with ERR_REQUIRE_ESM_RACE_CONDITION.
        const script = `
            require(process.argv[1]);
            const got = require('got');
            if (typeof got.default !== 'function') {
                throw new Error('got was not loaded');
            }
            process.stdout.write('ok');
        `;

        const output = execFileSync(process.execPath, ['-e', script, packageRoot], {
            cwd: packageRoot,
            encoding: 'utf8',
        });

        assert.equal(output, 'ok');
    });
});
