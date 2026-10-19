export = {
    get url(): typeof import('./lib/url') {
        return require('./lib/url');
    },

    get tokens(): typeof import('./lib/tokens') {
        return require('./lib/tokens');
    },

    get string(): typeof import('./lib/string') {
        return require('./lib/string');
    },

    get identifier(): typeof import('./lib/identifier') {
        return require('./lib/identifier');
    },

    get password(): typeof import('./lib/password') {
        return require('./lib/password');
    },

    get secret(): typeof import('./lib/secret') {
        return require('./lib/secret');
    },
};
