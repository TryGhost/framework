// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const nodemailer = require('../');

describe('Transporter', function () {
    it('can create an SMTP transporter', function () {
        const transporter = nodemailer('SMTP', {});
        transporter.transporter.name.should.equal('SMTP');
    });

    it('can create an SMTP transporter with Sendmail service', function () {
        const transporter = nodemailer('SMTP', {service: 'Sendmail'});
        transporter.transporter.name.should.equal('Sendmail');
    });

    it('can create a Direct transporter', function () {
        const transporter = nodemailer('direct', {});
        transporter.transporter.name.should.equal('SMTP (direct)');
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
