const interpolate = /(?<!{){([^{]+?)}/g;

/**
 * Template function
 * Takes strings like 'Your site is now available on {url}' and interpolates them with passed in data
 * Will ignore double or triple braces like {{get}} or {{{helpername}}}
 * Can handle escaped braces e.g. \\{\\{{helpername}\\}\\}
 * But there's a simple bare minimum escaping needed to make {{{helpername}}} work e.g. {\\{{helpername}}}
 */
function tpl(string: string, data?: object | null): string {
    if (!data) {
        return string;
    }

    // We replace any escaped left braces with the unicode character so we can swap it back later
    let processedString = string.replace(/\\{/g, '\\U+007B');
    // Interpolate {key} patterns with data values
    processedString = processedString.replace(interpolate, (_match, key) => {
        const trimmed = key.trim();
        if (!(trimmed in data)) {
            throw new ReferenceError(`${trimmed} is not defined`);
        }
        return String((data as Record<string, unknown>)[trimmed]);
    });
    // Replace our swapped out left braces and any escaped right braces
    return processedString.replace(/\\U\+007B/g, '{').replace(/\\}/g, '}');
}

export = tpl;
