const {CookieJar} = require('cookiejar');
const ExpectRequest = require('./expect-request');
const {RequestOptions} = require('./request');
const {normalizeURL} = require('./utils');

/**
 * @typedef AgentOptions
 * @param {string} [baseUrl] - the base URL path for the API query
 * @param {Object} [queryParams] - custom query params to append to each request
 * @param {Object} [headers] - any default headers to append to each request
 * @param {Object} [body] - a default body to append to each request
 * */

class Agent {
    /**
     *
     * @param {Object} app instance of Express app
     * @param {AgentOptions} [defaults]
     */
    constructor(app, defaults = {}, snapshotManager) {
        this.app = app;
        this.defaults = defaults;

        this.jar = new CookieJar();
        this.snapshotManager = snapshotManager;
    }

    /**
     *
     * @param {String} url
     * @param {object} [urlOptions]
     * @param {string} [urlOptions.baseUrl] - the base URL path for the API query
     * @param {Object} [urlOptions.queryParams] - custom query params to append to each request
     * @returns
     */
    _makeUrl(url, urlOptions = {}) {
        let processedURL = url;
        const baseUrl = urlOptions.baseUrl || this.defaults.baseUrl || null;

        if (baseUrl) {
            processedURL = `/${baseUrl}/${processedURL}`.replace(/(^|[^:])\/\/+/g, '$1/');
        }

        processedURL = normalizeURL(processedURL);

        const queryParams = Object.assign({}, this.defaults.queryParams, urlOptions.queryParams);

        if (Object.keys(queryParams).length > 0) {
            const searchParams = new URLSearchParams();

            for (const key in queryParams) {
                searchParams.append(key, queryParams[key]);
            }

            if (processedURL.includes('?')) {
                processedURL = `${processedURL}&${searchParams.toString()}`;
            } else {
                processedURL = `${processedURL}?${searchParams.toString()}`;
            }
        }

        return processedURL;
    }

    /**
     *
     * @param {string}} method - HTTP method
     * @param {string} url - url to request
     * @param {AgentOptions} options
     * @returns
     */
    _mergeOptions(method, url, options = {}) {
        // It doesn't make sense to call this method without these properties
        if (!method) {
            throw new Error('_mergeOptions cannot be called without a method'); /* eslint-disable-line no-restricted-syntax */
        }

        if (!url) {
            throw new Error('_mergeOptions cannot be called without a url'); /* eslint-disable-line no-restricted-syntax */
        }

        // urlOptions
        const {baseUrl, queryParams} = options;

        return new RequestOptions({
            method,
            url: this._makeUrl(url, Object.assign({}, {baseUrl, queryParams})),
            headers: Object.assign({}, this.defaults.headers, options.headers),
            // Set this to an empty object for ease, as express.json will do this anyway
            body: Object.assign({}, this.defaults.body, options.body)
        });
    }
}

['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].forEach((method) => {
    Agent.prototype[method] = function (url, options) {
        if (!url) {
            throw new Error('Cannot make a request without supplying a url'); /* eslint-disable-line no-restricted-syntax */
        }
        return new ExpectRequest(this.app, this.jar, this._mergeOptions(method.toUpperCase(), url, options), this.snapshotManager);
    };
});

module.exports = Agent;
