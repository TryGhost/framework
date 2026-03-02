import template from 'lodash.template';

const interpolate = /(?<!{){([^{]+?)}/g;

/**
 * Template function
 * Takes strings like 'Your site is now available on {url}' and interpolates them with passed in data
 * Will ignore double or triple braces like {{get}} or {{{helpername}}}
 * Can handle escaped braces e.g. \\{\\{{helpername}\\}\\}
 * But there's a simple bare minimum escaping needed to make {{{helpername}}} work e.g. {\\{{helpername}}}
 */
const tpl = (string: string, data?: Record<string, unknown>): string => {
    if (!data) {
        return string;
    }

    // We replace any escaped left braces with the unicode character so we can swap it back later
    let processedString = string.replace(/\\{/g, '\\U+007B');
    // Let lodash do its thing
    processedString = template(processedString, {interpolate})(data);
    // Replace our swapped out left braces and any escaped right braces
    return processedString.replace(/\\U\+007B/g, '{').replace(/\\}/g, '}');
};

export default tpl;
