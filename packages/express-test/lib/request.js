const {default: reqresnext} = require('reqresnext');

class Request {
    constructor(app, reqOptions) {
        this.app = app;
        this.reqOptions = reqOptions;
    }

    then(resolve, reject) {
        const self = this;
        this._fullfilledPromise = new Promise((_resolve, _reject) => {
            self._doRequest((error, result) => {
                if (error) {
                    _reject(error);
                }
                _resolve(result);
            });
        });

        return this._fullfilledPromise.then(resolve, reject);
    }

    _doRequest(callback) {
        const {app, reqOptions} = this;
        const {req, res} = reqresnext(Object.assign({}, reqOptions, {app}), {app});

        res.on('finish', () => {
            const statusCode = res.statusCode;
            const headers = Object.assign({}, res.getHeaders());
            const text = res.body.toString('utf8');
            let body = {};

            callback(null, {statusCode, headers, text, body, response: res});
        });

        this.app(req, res);
    }
}

module.exports = Request;
