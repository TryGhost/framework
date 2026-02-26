module.exports = {
    plugins: ['ghost', '@vitest'],
    env: {
        '@vitest/env': true
    },
    extends: [
        'plugin:ghost/test'
    ]
};
