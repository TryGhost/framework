const _ = require('lodash');
const validator = require('@tryghost/validator');
const errors = require('@tryghost/errors');
const ghostVersion = require('@tryghost/version');

let got = require('got').default;
const CacheableLookup = require('cacheable-lookup').default;

const cacheableLookup = new CacheableLookup({
    lookup: false,
});

const defaultOptions = {
    headers: {
        'user-agent': 'Ghost/' + ghostVersion.safe + ' (https://github.com/TryGhost/Ghost)',
    },
    method: 'GET',
    // Ensure OS-level name resolution is not used
    dnsLookup: cacheableLookup.lookup,
};

module.exports = async function request(url, options = {}) {
    const isUrlValid =
        typeof url === 'string' &&
        // `validator.isURL` doesn't let us express "any TLD or localhost", so we do two checks.
        (validator.isURL(url) || validator.isURL(url, { host_whitelist: ['localhost'] }));
    if (!isUrlValid) {
        return Promise.reject(
            new errors.InternalServerError({
                message: 'URL empty or invalid.',
                code: 'URL_MISSING_INVALID',
                context: url,
            }),
        );
    } else {
        // URL is valid and request execution can continue.
    }

    if (
        process.env.NODE_ENV?.startsWith('test') &&
        !Object.prototype.hasOwnProperty.call(options, 'retry')
    ) {
        options.retry = {
            limit: 0,
        };
    }

    if (!options.method && (options.body || options.json)) {
        options.method = 'POST';
    }

    const mergedOptions = _.merge({}, defaultOptions, options);

    try {
        const response = await got(url, mergedOptions);
        return response;
    } catch (error) {
        if (error.options) {
            Object.assign(error, error.options);
            delete error.options;
        }
        if (error.response) {
            Object.assign(error, error.response);
            delete error.reponse;
        } else {
            // Some transport errors do not include a response object.
        }
        throw error;
    }
};
