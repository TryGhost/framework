/* eslint-disable no-case-declarations */

const errors = require('@tryghost/errors');
const nodemailer = require('nodemailer');
const tpl = require('@tryghost/tpl');

const messages = {
    unknownTransport: `Unknown mail transport: {transport}`
};

/**
 * @param {String} transport
 * @param {Object} options
 * @returns {import('nodemailer').Transporter} Nodemailer Transporter
 */
module.exports = function (transport, options = {}) {
    let transportOptions;

    transport = transport.toLowerCase();

    switch (transport) {
    case 'smtp':
        transportOptions = options;

        /**
         * @deprecated `secureConnection` was removed in Nodemailer 1.0.2
         * in favor of `secure` but Ghost has been recommending `secureConnection`
         * and it's difficult to get everyone to switch at this point
         *
         * Therefore, we have to alias it here to keep things working
         */
        if (options.secureConnection === true) {
            transportOptions.secure = true;
        }

        if (options.service && options.service.toLowerCase() === 'sendmail') {
            transportOptions.sendmail = true;
        }
        break;
    case 'sendmail':
        transportOptions = options;
        transportOptions.sendmail = true;
        break;
    case 'ses':
        const aws = require('@aws-sdk/client-ses');

        const pattern = /(.*)email(.*)\.(.*).amazonaws.com/i;
        const result = pattern.exec(options.ServiceUrl);

        const sesOptions = options || {};
        sesOptions.accessKeyId = sesOptions.accessKeyId || sesOptions.AWSAccessKeyID;
        sesOptions.secretAccessKey = sesOptions.secretAccessKey || sesOptions.AWSSecretKey;
        sesOptions.sessionToken = sesOptions.sessionToken || sesOptions.AWSSecurityToken;
        sesOptions.apiVersion = '2010-12-01';
        sesOptions.region = sesOptions.region || (result && result[3]) || 'us-east-1';

        const ses = new aws.SES(sesOptions);

        transportOptions = {
            SES: {ses, aws}
        };

        break;
    case 'direct':
        const directTransport = require('nodemailer-direct-transport');
        transportOptions = directTransport(options);
        break;
    case 'stub':
        const stubTransport = require('nodemailer-stub-transport');
        transportOptions = stubTransport(options);
        break;
    default:
        throw new errors.EmailError({
            message: tpl(messages.unknownTransport, {transport})
        });
    }

    return nodemailer.createTransport(transportOptions);
};
