const {default: reqresnext} = require('reqresnext');
const {CookieAccessInfo} = require('cookiejar');
const {parse} = require('url');
const {isJSON} = require('./utils');

class RequestOptions {
    constructor({method, url, headers, body} = {}) {
        this.method = method || 'GET';
        this.url = url || '/';
        this.headers = headers || {};
        this.body = body;
    }

    toString() {
        return `${this.method} request on ${this.url}`;
    }
}

class Request {
    constructor(app, cookieJar, reqOptions) {
        this.app = app;
        this.reqOptions = reqOptions instanceof RequestOptions ? reqOptions : new RequestOptions(reqOptions);
        this.cookieJar = cookieJar;
    }

    body(body) {
        this.reqOptions.body = body;
        return this;
    }

    header(name, value) {
        this.reqOptions.headers[name] = value;
        return this;
    }

    then(resolve, reject) {
        const self = this;
        this._fullfilledPromise = new Promise((_resolve, _reject) => {
            self.finalize((error, response) => {
                if (error) {
                    return _reject(error);
                }
                return _resolve(response);
            });
        });

        return this._fullfilledPromise.then(resolve, reject);
    }

    /*
     * This method exists to make it easy to extend this class with ExpectRequest
     * We use callbacks so we don't need to introduce async/await here which may make things
     * Difficult and/or confusing with the thennable
     */
    finalize(callback) {
        this._doRequest((error, response) => {
            if (error) {
                return callback(error);
            }
            return callback(null, response);
        });
    }

    _getReqRes() {
        const {app, reqOptions} = this;

        return reqresnext(Object.assign({}, reqOptions, {app}), {app});
    }

    _buildResponse(res) {
        const statusCode = res.statusCode;
        const headers = Object.assign({}, res.getHeaders());
        const text = res.body ? res.body.toString('utf8') : undefined;
        let body = {};

        if (isJSON(res.getHeader('Content-Type'))) {
            body = text && JSON.parse(text);
        }

        return {statusCode, headers, text, body, response: res};
    }

    _doRequest(callback) {
        try {
            const {req, res} = this._getReqRes();

            this._restoreCookies(req);

            res.on('finish', () => {
                const response = this._buildResponse(res);

                this._saveCookies(res);

                callback(null, response);
            });

            this.app(req, res);
        } catch (error) {
            callback(error);
        }
    }

    _getCookies(req) {
        const url = parse(req.url);

        const access = new CookieAccessInfo(
            url.hostname,
            url.pathname,
            url.protocol === 'https:'
        );

        return this.cookieJar.getCookies(access).toValueString();
    }

    _restoreCookies(req) {
        req.headers.cookie = this._getCookies(req);
        return req;
    }

    _saveCookies(res) {
        const cookies = res.getHeader('set-cookie');

        if (cookies) {
            this.cookieJar.setCookies(cookies);
        }
    }
}

module.exports = Request;
module.exports.Request = Request;
module.exports.RequestOptions = RequestOptions;
