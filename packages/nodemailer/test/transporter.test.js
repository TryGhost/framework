const assert = require('assert/strict');
const sinon = require('sinon');
const aws = require('@aws-sdk/client-ses');
const nodemailer = require('../');
const sandbox = sinon.createSandbox();

describe('Transporter', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('can create an SMTP transporter', function () {
        const transporter = nodemailer('SMTP', {});
        assert.equal(transporter.transporter.name, 'SMTP');
    });

    it('can create an SMTP transporter with deprecated secureConnection (true)', function () {
        const transporter = nodemailer('SMTP', {secureConnection: true});
        assert.equal(transporter.transporter.name, 'SMTP');
        assert.equal(transporter.transporter.options.secure, true);
    });

    it('can create an SMTP transporter with deprecated secureConnection (false)', function () {
        const transporter = nodemailer('SMTP', {secureConnection: false});
        assert.equal(transporter.transporter.name, 'SMTP');
        assert.equal(transporter.transporter.options.secure, false);
    });

    it('can create an SMTP transporter with Sendmail service', function () {
        const transporter = nodemailer('SMTP', {service: 'Sendmail'});
        assert.equal(transporter.transporter.name, 'Sendmail');
    });

    it('can create an Sendmail transporter', function () {
        const transporter = nodemailer('Sendmail', {});
        assert.equal(transporter.transporter.name, 'Sendmail');
    });

    it('can create an SES transporter', function () {
        const transporter = nodemailer('SES', {});
        assert.equal(transporter.transporter.name, 'SESTransport');
    });

    it('can create an SES transporter with region parsed from ServiceUrl and aws-style credentials', function () {
        const sesStub = sandbox.stub(aws, 'SES').callsFake(function SES(options) {
            this.options = options;
        });

        nodemailer('SES', {
            ServiceUrl: 'email-smtp.eu-west-2.amazonaws.com',
            AWSAccessKeyID: 'key',
            AWSSecretKey: 'secret'
        });

        assert.equal(sesStub.calledOnce, true);
        assert.equal(sesStub.args[0][0].region, 'eu-west-2');
        assert.deepEqual(sesStub.args[0][0].credentials, {accessKeyId: 'key', secretAccessKey: 'secret'});
    });

    it('can create an SES transporter with explicit region and modern credentials', function () {
        const sesStub = sandbox.stub(aws, 'SES').callsFake(function SES(options) {
            this.options = options;
        });

        nodemailer('SES', {
            ServiceUrl: 'email-smtp.us-east-1.amazonaws.com',
            region: 'eu-central-1',
            accessKeyId: 'new-key',
            secretAccessKey: 'new-secret'
        });

        assert.equal(sesStub.calledOnce, true);
        assert.equal(sesStub.args[0][0].region, 'eu-central-1');
        assert.deepEqual(sesStub.args[0][0].credentials, {accessKeyId: 'new-key', secretAccessKey: 'new-secret'});
    });

    it('can create a Direct transporter', function () {
        const transporter = nodemailer('direct', {});
        assert.equal(transporter.transporter.name, 'SMTP (direct)');
    });

    it('can create a Stub transporter', function () {
        const transporter = nodemailer('stub', {});
        assert.equal(transporter.transporter.name, 'Stub');
    });

    it('can create a Mailgun transporter', function () {
        const transporter = nodemailer('mailgun', {
            auth: {
                api_key: 'hello',
                domain: 'example.com'
            }
        });
        assert.equal(transporter.transporter.name, 'Mailgun');

        // Ensure the default timeout is set
        assert.equal(transporter.transporter.options.timeout, 60000);
    });

    it('can create a Mailgun transporter with custom timeout', function () {
        const transporter = nodemailer('mailgun', {
            auth: {
                api_key: 'hello',
                domain: 'example.com'
            },
            timeout: 10000
        });
        assert.equal(transporter.transporter.name, 'Mailgun');
        assert.equal(transporter.transporter.options.timeout, 10000);
    });

    it('should throw an error when creating an unknown transporter', function () {
        assert.throws(() => nodemailer('unknown', {}));
    });
});
