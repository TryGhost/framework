const http = require('http');
const {Writable, Readable} = require('stream');
const express = require('express');
const {CookieAccessInfo} = require('cookiejar');
const {parse} = require('url');
const {isJSON, attachFile} = require('./utils');

class MockSocket extends Writable {
    constructor() {
        super();
        this.remoteAddress = '127.0.0.1';
    }
    _write(chunk, encoding, callback) {
        callback();
    }
}

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
        this._formData = null; // Track FormData instance for multiple attachments
    }

    attach(name, filePath) {
        // Use the utility to create or append to FormData
        this._formData = attachFile(name, filePath, this._formData);

        // Set the body to the FormData instance
        return this.body(this._formData);
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

        // Override stream methods on the request to delegate to the provided readable stream.
        // Express middlewares (and multer for file uploads) use pipe/event listeners to consume the body.
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
            get readableEnded() {
                return readableStream.readableEnded;
            },
            pause: () => {
                readableStream.pause();
            },
            resume: () => {
                readableStream.resume();
            },
            read: () => {
                return readableStream.read(...arguments);
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

        // Create proper Node.js req/res objects using built-in http module.
        // MockSocket provides a writable stream so that res.end() properly emits 'finish'.
        const socket = new MockSocket();
        const hasStreamOverrides = !!this.reqOptions.methodOverrides;

        // When streaming body data, the socket must appear readable so that
        // body-parser's on-finished check doesn't skip the request as "already finished".
        if (hasStreamOverrides) {
            Object.defineProperty(socket, 'readable', {value: true});
        }

        const req = new http.IncomingMessage(socket);
        req.method = reqOptions.method;
        req.url = reqOptions.url;
        req.headers = {};
        for (const key of Object.keys(reqOptions.headers)) {
            req.headers[key.toLowerCase()] = reqOptions.headers[key];
        }
        req.headers.host = req.headers.host || 'localhost';
        req.body = reqOptions.body;
        req.app = app;

        // When body is pre-parsed (e.g. JSON object), mark it so body-parser skips parsing
        if (reqOptions.body !== undefined) {
            req._body = true;
        }

        const res = new http.ServerResponse(req);
        res.assignSocket(socket);

        // Apply Express prototypes so res.send(), res.json(), etc. are available
        Object.setPrototypeOf(req, express.request);
        Object.setPrototypeOf(res, express.response);

        res.req = req;
        req.res = res;
        res.app = app;

        // Track written body data for _buildResponse.
        // Express calls res.write() then res.end() separately, so we must capture both.
        let bodyChunks = [];
        const originalWrite = res.write.bind(res);
        res.write = function (chunk, encoding, cb) {
            if (chunk !== null && chunk !== undefined) {
                bodyChunks.push(Buffer.from(chunk, encoding));
            }
            return originalWrite(chunk, encoding, cb);
        };
        const originalEnd = res.end.bind(res);
        res.end = function (chunk, encoding, cb) {
            if (chunk !== null && chunk !== undefined) {
                bodyChunks.push(Buffer.from(chunk, encoding));
            }
            res.body = Buffer.concat(bodyChunks);
            return originalEnd(chunk, encoding, cb);
        };

        if (hasStreamOverrides) {
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
