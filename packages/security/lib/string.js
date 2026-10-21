const slugify = require('@tryghost/string').slugify;

// @TODO: the safe() function can possibly be removed from here if Ghost uses slugify() directly instead

/**
 * @param {string} string - the string we want to slugify
 * @param {object} [options] - filter options
 * @param {bool} [options.importing] - don't perform optional cleanup, e.g. removing extra dashes
 * @param {bool} [options.unicodeSlugs] - don't perform optional transliteration, e.g. keep smörgåsbord as it is instead of turning it into smorgasbord
 * @param {string} [options.slugSeparator] - separator to be used for the slugs, can be ` `, `_` or `-`, defaults to `-`
 * @returns {string} - a slugified string
 */
module.exports.safe = function safe(string, options = {}) {
    return slugify(string, {
        requiredChangesOnly: options.importing === true,
        unicodeSlugs: options.unicodeSlugs === true,
        slugSeparator: options.slugSeparator
    });
};
