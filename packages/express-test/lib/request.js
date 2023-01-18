const {default: reqresnext} = require('reqresnext');
const {CookieAccessInfo} = require('cookiejar');
const {parse} = require('url');
const {isJSON} = require('./utils');
const {Readable} = require('stream');

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

    /**
     * @param {object|string|FormData|Buffer} body Set the request body object or FormData (for multipart/form-data)
     * @returns
     */
    body(body) {
        if (body.getBuffer && typeof body.getBuffer === 'function') {
            // body is FormData (we cannot reliably check instanceof, not working in all situations)
            const requestBuffer = body.getBuffer();
            const headers = body.getHeaders({
                ...this.reqOptions.headers
            });
            this.reqOptions.headers = headers;
            return this.body(requestBuffer);
        }
        if (typeof body === 'string') {
            const buffer = Buffer.from(body, 'utf8');
            return this.body(buffer);
        }
        if (body instanceof Buffer) {
            this.reqOptions.headers['content-length'] = body.length;
            return this.stream(Readable.from(body));
        }

        // Manually parsed object (e.g. JSON object)
        this.reqOptions.body = body;
        return this;
    }

    /**
     * Instead of setting a body object, you can also stream the request body. Use this if you want the body
     * to be parsed by the middlewares instead of skipping that step and already setting the decoded body object.
     * @param {stream.Readable} readableStream
     * @returns
     */
    stream(readableStream) {
        this.reqOptions.body = undefined;

        // reqresnext doesn't support streaming, which we need for file uploads. So we need to add some new methods.
        // ExpressRequest inherits from http.IncomingMessage which inherits from stream.Readable
        // It is that stream that is eventually read by middlewares and converted as JSON, as text, as form data etc.
        // Currently the Express middlewares (and multer for file uploads) use the pipe method and/or the event listeners, so we don't need to override other methods
        // If we need other methods, we only need to map them to the readable stream.
        this.reqOptions.methodOverrides = {
            pipe: (destination) => {
                readableStream.pipe(destination);
            },
            unpipe: (destination) => {
                readableStream.unpipe(destination);
            },
            on: (event, listener) => {
                readableStream.on(event, listener);
            },
            removeListener: (event, listener) => {
                readableStream.removeListener(event, listener);
            },
            get readable() {
                return readableStream.readable;
            },
            pause: () => {
                readableStream.pause();
            },
            read: () => {
                readableStream.read(...arguments);
            }
        };
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

        const {req, res} = reqresnext({...reqOptions, app}, {app});

        if (this.reqOptions.methodOverrides) {
            // Copies all properties from original to copy, including getters and setters
            const props = Object.keys(this.reqOptions.methodOverrides);
            for (const prop of props) {
                const descriptor = Object.getOwnPropertyDescriptor(this.reqOptions.methodOverrides, prop);
                Object.defineProperty(req, prop, descriptor);
            }
        }

        return {req, res};
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
