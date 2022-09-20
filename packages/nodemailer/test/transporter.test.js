// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const nodemailer = require('../');

describe('Transporter', function () {
    it('can create an SMTP transporter', function () {
        const transporter = nodemailer('SMTP', {});
        transporter.transporter.name.should.equal('SMTP');
    });

    it('can create an SMTP transporter with deprecated secureConnection (true)', function () {
        const transporter = nodemailer('SMTP', {secureConnection: true});
        transporter.transporter.name.should.equal('SMTP');
        transporter.transporter.options.secure.should.equal(true);
    });

    it('can create an SMTP transporter with deprecated secureConnection (false)', function () {
        const transporter = nodemailer('SMTP', {secureConnection: false});
        transporter.transporter.name.should.equal('SMTP');
        transporter.transporter.options.secure.should.equal(false);
    });

    it('can create an SMTP transporter with Sendmail service', function () {
        const transporter = nodemailer('SMTP', {service: 'Sendmail'});
        transporter.transporter.name.should.equal('Sendmail');
    });

    it('can create an Sendmail transporter', function () {
        const transporter = nodemailer('Sendmail', {});
        transporter.transporter.name.should.equal('Sendmail');
    });

    it('can create an SES transporter', function () {
        const transporter = nodemailer('SES', {});
        transporter.transporter.name.should.equal('SESTransport');
    });

    it('can create a Direct transporter', function () {
        const transporter = nodemailer('direct', {});
        transporter.transporter.name.should.equal('SMTP (direct)');
    });

    it('can create a Stub transporter', function () {
        const transporter = nodemailer('stub', {});
        transporter.transporter.name.should.equal('Stub');
    });

    it('can create a Mailgun transporter', function () {
        const transporter = nodemailer('mailgun', {
            auth: {
                api_key: 'hello',
                domain: 'example.com'
            }
        });
        transporter.transporter.name.should.equal('Mailgun');
    });

    it('should throw an error when creating an unknown transporter', function () {
        try {
            const transporter = nodemailer('unknown', {});
            transporter.should.not.exist();
        } catch (err) {
            // this is expected
            should.exist(err);
        }
    });
});
