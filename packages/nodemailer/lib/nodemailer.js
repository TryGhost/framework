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
module.exports = function (transport, options) {
    let transportOptions;

    switch (transport) {
    case 'SMTP':
        transportOptions = options;

        if (options.service && options.service === 'Sendmail') {
            transportOptions.sendmail = true;
        }
        break;
    case 'direct':
        const directTransport = require('nodemailer-direct-transport');
        transportOptions = directTransport(options);
        break;
    default:
        throw new errors.EmailError({
            message: tpl(messages.unknownTransport, {transport})
        });
    }

    return nodemailer.createTransport(transportOptions);
};
