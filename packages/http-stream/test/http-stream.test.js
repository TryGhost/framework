require('should');
const HttpStream = require('../index');

const testConfig = {
    url: 'http://localhost:3001'
};

describe('HttpStream', function () {
    describe('write', function () {
        let server;
        beforeEach(function () {
            const express = require('express');
            const app = express();
            app.use(express.json());
            app.post('*', (req, res) => {
                res.json(req.body);
            });
            server = app.listen(3001);
        });
        afterEach(function () {
            server.close();
        });

        it('return false when string passed', async function () {
            let stream = new HttpStream(testConfig);
            let res = await stream.write('this shouldnt work');
            (res).should.eql(false);
        });

        it('be successful when object passed', async function () {
            let stream = new HttpStream(testConfig);
            let body = {this: 'should work'};
            let res = await stream.write(body);
            (res.statusCode).should.eql(200);
            (JSON.parse(res.body)).should.eql(body);
        });
    });
});
