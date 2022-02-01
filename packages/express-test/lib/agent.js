const Test = require('./test');

class Agent {
    constructor(app, defaults) {
        this.app = app;
        this.defaults = defaults;
    }

    _makeUrl(url) {
        if (this.defaults.baseUrl) {
            url = `/${this.defaults.baseUrl}/${url}`.replace(/(^|[^:])\/\/+/g, '$1/');
        }

        return url;
    }

    _mergeOptions(method, url, options = {}) {
        return {
            method,
            url: this._makeUrl(url),
            headers: Object.assign({}, this.defaults.headers, options.headers),
            body: Object.assign({}, this.defaults.body, options.body)

        };
    }
}

['get', 'post', 'put', 'del'].forEach((method) => {
    Agent.prototype[method] = function (url, options) {
        return new Test(this.app, this._mergeOptions(method.toUpperCase(), url, options));
    };
});

module.exports = Agent;
