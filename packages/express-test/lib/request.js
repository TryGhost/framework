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

    _getReqRes() {
        const {app, reqOptions} = this;
        return reqresnext(Object.assign({}, reqOptions, {app}), {app});
    }

    _buildResponse(res) {
        const statusCode = res.statusCode;
        const headers = Object.assign({}, res.getHeaders());
        const text = res.body ? res.body.toString('utf8') : undefined;
        let body = {};

        return {statusCode, headers, text, body, response: res};
    }

    _doRequest(callback) {
        try {
            const {req, res} = this._getReqRes();

            res.on('finish', () => {
                const response = this._buildResponse(res);

                callback(null, response);
            });

            this.app(req, res);
        } catch (error) {
            callback(error);
        }
    }
}

module.exports = Request;
