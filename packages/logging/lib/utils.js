function upperFirst(str) {
    if (!str) {
        return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function isObject(value) {
    return (value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value));
}

function isEmpty(value) {
    if (!value) {
        // Covers null, undefined, false, 0, or empty string
        return true;
    }
    // If it's an object, check keys length
    if (isObject(value)) {
        return Object.keys(value).length === 0;
    }
    // If it's a string or an array, check length
    if (typeof value === 'string' || Array.isArray(value)) {
        return value.length === 0;
    }
    return false;
}

function includes(array, item) {
    return array.indexOf(item) !== -1;
}

function toArray(args) {
    return Array.prototype.slice.call(args);
}

module.exports = {
    upperFirst,
    isObject,
    isEmpty,
    includes,
    toArray
};
