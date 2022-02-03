const {CookieJar} = require('cookiejar');
const ExpectRequest = require('./expect-request');
const {RequestOptions} = require('./request');

class Agent {
    constructor(app, defaults = {}) {
        this.app = app;
        this.defaults = defaults;

        this.jar = new CookieJar();
    }

    _makeUrl(url) {
        if (this.defaults.baseUrl) {
            url = `/${this.defaults.baseUrl}/${url}`.replace(/(^|[^:])\/\/+/g, '$1/');
        }

        return url;
    }

    _mergeOptions(method, url, options = {}) {
        // It doesn't make sense to call this method without these properties
        if (!method) {
            throw new Error('_mergeOptions cannot be called without a method'); /* eslint-disable-line no-restricted-syntax */
        }

        if (!url) {
            throw new Error('_mergeOptions cannot be called without a url'); /* eslint-disable-line no-restricted-syntax */
        }

        return new RequestOptions({
            method,
            url: this._makeUrl(url),
            headers: Object.assign({}, this.defaults.headers, options.headers),
            body: Object.assign({}, this.defaults.body, options.body)
        });
    }
}

['get', 'post', 'put', 'del'].forEach((method) => {
    Agent.prototype[method] = function (url, options) {
        if (!url) {
            throw new Error('Cannot make a request without supplying a url'); /* eslint-disable-line no-restricted-syntax */
        }
        return new ExpectRequest(this.app, this.jar, this._mergeOptions(method.toUpperCase(), url, options));
    };
});

module.exports = Agent;
