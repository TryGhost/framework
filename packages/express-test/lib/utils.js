// const url = require('url');

module.exports.isJSON = function isJSON(mime) {
    // should match /json or +json
    // but not /json-seq
    return /[/+]json($|[^-\w])/i.test(mime);
};

module.exports.makeMessageFromMatchMessage = function makeMessageFromMatchMessage(message, errorMessage) {
    const messageLines = message.split('\n');
    messageLines.splice(0, 1, errorMessage);
    return messageLines.join('\n');
};

module.exports.normalizeURL = function normalizeURL(toNormalize) {
    const split = toNormalize.split('?');
    const pathname = split[0];
    let normalized = pathname + (pathname.endsWith('/') ? '' : '/');

    if (split.length === 2) {
        normalized += `?${split[1]}`;
    }

    return normalized;
};
