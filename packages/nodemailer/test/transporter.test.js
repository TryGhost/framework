const assert = require('assert/strict');
const sinon = require('sinon');
const aws = require('@aws-sdk/client-sesv2');
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
        const transporter = nodemailer('SMTP', { secureConnection: true });
        assert.equal(transporter.transporter.name, 'SMTP');
        assert.equal(transporter.transporter.options.secure, true);
    });

    it('can create an SMTP transporter with deprecated secureConnection (false)', function () {
        const transporter = nodemailer('SMTP', { secureConnection: false });
        assert.equal(transporter.transporter.name, 'SMTP');
        assert.equal(transporter.transporter.options.secure, false);
    });

    it('can create an SMTP transporter with Sendmail service', function () {
        const transporter = nodemailer('SMTP', { service: 'Sendmail' });
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
        const sesStub = sandbox.stub(aws, 'SESv2Client').callsFake(function SESv2Client(options) {
            this.options = options;
        });

        nodemailer('SES', {
            ServiceUrl: 'email-smtp.eu-west-2.amazonaws.com',
            AWSAccessKeyID: 'key',
            AWSSecretKey: 'secret',
        });

        assert.equal(sesStub.calledOnce, true);
        assert.equal(sesStub.args[0][0].region, 'eu-west-2');
        assert.deepEqual(sesStub.args[0][0].credentials, {
            accessKeyId: 'key',
            secretAccessKey: 'secret',
        });
    });

    it('can create an SES transporter with explicit region and modern credentials', function () {
        const sesStub = sandbox.stub(aws, 'SESv2Client').callsFake(function SESv2Client(options) {
            this.options = options;
        });

        nodemailer('SES', {
            ServiceUrl: 'email-smtp.us-east-1.amazonaws.com',
            region: 'eu-central-1',
            accessKeyId: 'new-key',
            secretAccessKey: 'new-secret',
        });

        assert.equal(sesStub.calledOnce, true);
        assert.equal(sesStub.args[0][0].region, 'eu-central-1');
        assert.deepEqual(sesStub.args[0][0].credentials, {
            accessKeyId: 'new-key',
            secretAccessKey: 'new-secret',
        });
    });

    for (const ServiceUrl of [
        'email.eu-west-2.amazonaws.com',
        'https://email.eu-west-2.amazonaws.com/',
        'http://email.eu-west-2.amazonaws.com:80/',
        'EMAIL-SMTP.EU-WEST-2.AMAZONAWS.COM',
        'https://email-smtp.eu-west-2.amazonaws.com:443/',
        'https://email-fips.eu-west-2.amazonaws.com/',
        'email-smtp-fips.eu-west-2.amazonaws.com',
        'email.eu-west-2.amazonaws.com/?redirect=https://example.com',
        '  https://email.eu-west-2.amazonaws.com/  ',
    ]) {
        it(`parses the SES region from ${ServiceUrl}`, function () {
            const sesStub = sandbox.stub(aws, 'SESv2Client').callsFake(function SESv2Client() {});

            nodemailer('SES', { ServiceUrl });

            assert.equal(sesStub.args[0][0].region, 'eu-west-2');
        });
    }

    for (const [description, ServiceUrl] of [
        ['missing URL', undefined],
        ['non-string URL', {}],
        ['invalid URL', 'https://['],
        ['unsupported protocol', 'ftp://email.eu-west-2.amazonaws.com'],
        ['lookalike domain separator', 'email.eu-west-2Xamazonaws.com'],
        ['lookalike top-level domain', 'email.eu-west-2.amazonawsXcom'],
        ['domain suffix', 'email.eu-west-2.amazonaws.com.evil.test'],
        ['service prefix', 'notemail.eu-west-2.amazonaws.com'],
        ['nested region', 'email.extra.eu-west-2.amazonaws.com'],
        ['endpoint in path', 'https://evil.test/email.eu-west-2.amazonaws.com'],
        ['endpoint in user info', 'https://email.eu-west-2.amazonaws.com@evil.test'],
        ['long repeated input', `email.${'a'.repeat(100000)}!`],
        ['long repeated service', 'emaila'.repeat(20000)],
        ['long repeated labels', `email.${'.a'.repeat(20000)}`],
    ]) {
        it(`defaults the SES region for ${description}`, function () {
            const sesStub = sandbox.stub(aws, 'SESv2Client').callsFake(function SESv2Client() {});

            nodemailer('SES', { ServiceUrl });

            assert.equal(sesStub.args[0][0].region, 'us-east-1');
        });
    }

    it('does not inspect ServiceUrl when an explicit SES region is supplied', function () {
        const sesStub = sandbox.stub(aws, 'SESv2Client').callsFake(function SESv2Client() {});

        nodemailer('SES', {
            region: 'eu-central-1',
            get ServiceUrl() {
                throw new Error('ServiceUrl should not be read');
            },
        });

        assert.equal(sesStub.args[0][0].region, 'eu-central-1');
    });

    it('can create a Direct transporter', function () {
        const transporter = nodemailer('direct', {});
        assert.equal(transporter.transporter.name, 'SMTP');
    });

    it('can create a Stub transporter', function () {
        const transporter = nodemailer('stub', {});
        assert.equal(transporter.transporter.name, 'Stub');
    });

    it('can create a Mailgun transporter', function () {
        const transporter = nodemailer('mailgun', {
            auth: {
                api_key: 'hello',
                domain: 'example.com',
            },
        });
        assert.equal(transporter.transporter.name, 'Mailgun');

        // Ensure the default timeout is set
        assert.equal(transporter.transporter.options.timeout, 60000);
    });

    it('can create a Mailgun transporter with custom timeout', function () {
        const transporter = nodemailer('mailgun', {
            auth: {
                api_key: 'hello',
                domain: 'example.com',
            },
            timeout: 10000,
        });
        assert.equal(transporter.transporter.name, 'Mailgun');
        assert.equal(transporter.transporter.options.timeout, 10000);
    });

    it('should throw an error when creating an unknown transporter', function () {
        assert.throws(() => nodemailer('unknown', {}));
    });
});
