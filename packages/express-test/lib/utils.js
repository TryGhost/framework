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

module.exports.convertKeysToLowerCase = function (map) {
    const newMap = {};

    for (const key in map) {
        newMap[key.toLowerCase()] = map[key];
    }

    return newMap;
};
