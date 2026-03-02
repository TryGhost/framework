module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/test'
    ],
    globals: {
        beforeAll: 'readonly',
        afterAll: 'readonly'
    }
};
