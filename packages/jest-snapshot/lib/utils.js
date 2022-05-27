/**
 *
 * @param {String} message
 * @param {String} errorMessage
 * @returns {String}
 */
module.exports.makeMessageFromMatchMessage = function makeMessageFromMatchMessage(message, errorMessage) {
    const messageLines = message.split('\n');
    messageLines.splice(0, 1, errorMessage);
    return messageLines.join('\n');
};
