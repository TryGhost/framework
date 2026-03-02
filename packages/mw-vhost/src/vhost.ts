// This a fork of expressjs/vhost with trust proxy support
/* eslint-disable */

/*!
 * vhost
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface VhostData {
    host: string | undefined;
    hostname: string;
    length: number;
    [index: number]: string;
}

declare module 'express' {
    interface Request {
        vhost?: VhostData;
    }
}

/**
 * Module variables.
 * @private
 */

const ASTERISK_REGEXP = /\*/g;
const ASTERISK_REPLACE = '([^.]+)';
const END_ANCHORED_REGEXP = /(?:^|[^\\])(?:\\\\)*\$$/;
const ESCAPE_REGEXP = /([.+?^=!:${}()|[\]/\\])/g;
const ESCAPE_REPLACE = '\\$1';

/**
 * Create a vhost middleware.
 *
 * @param hostname
 * @param handle
 * @return RequestHandler
 * @public
 */

export default function vhost(hostname: string | RegExp, handle: (req: Request, res: Response, next: NextFunction) => void): RequestHandler {
    if (!hostname) {
        throw new TypeError('argument hostname is required');
    }

    if (!handle) {
        throw new TypeError('argument handle is required');
    }

    if (typeof handle !== 'function') {
        throw new TypeError('argument handle must be a function');
    }

    // create regular expression for hostname
    const regexp = hostregexp(hostname);

    return function vhost(req: Request, res: Response, next: NextFunction): void {
        const vhostdata = vhostof(req, regexp);

        if (!vhostdata) {
            return next();
        }

        // populate
        req.vhost = vhostdata;

        // handle
        handle(req, res, next);
    };
}

/**
 * Get hostname of request.
 *
 * @param req
 * @return hostname string or undefined
 * @private
 */

function hostnameof(req: Request): string | undefined {
    const host =
        req.hostname || // express v4
        (req as Request & { host?: string }).host || // express v3
        req.headers.host; // http

    if (!host) {
        return;
    }

    const offset = host[0] === '['
        ? host.indexOf(']') + 1
        : 0;
    const index = host.indexOf(':', offset);

    return index !== -1
        ? host.substring(0, index)
        : host;
}

/**
 * Determine if object is RegExp.
 *
 * @param val
 * @return boolean
 * @private
 */

function isregexp(val: string | RegExp): val is RegExp {
    return Object.prototype.toString.call(val) === '[object RegExp]';
}

/**
 * Generate RegExp for given hostname value.
 *
 * @param val
 * @private
 */

function hostregexp(val: string | RegExp): RegExp {
    let source = !isregexp(val)
        ? String(val).replace(ESCAPE_REGEXP, ESCAPE_REPLACE).replace(ASTERISK_REGEXP, ASTERISK_REPLACE)
        : val.source;

    // force leading anchor matching
    if (source[0] !== '^') {
        source = '^' + source;
    }

    // force trailing anchor matching
    if (!END_ANCHORED_REGEXP.test(source)) {
        source += '$';
    }

    return new RegExp(source, 'i');
}

/**
 * Get the vhost data of the request for RegExp
 *
 * @param req
 * @param regexp
 * @return VhostData or undefined
 * @private
 */

function vhostof(req: Request, regexp: RegExp): VhostData | undefined {
    const host = req.headers.host;
    const hostname = hostnameof(req);

    if (!hostname) {
        return;
    }

    const match = regexp.exec(hostname);

    if (!match) {
        return;
    }

    const obj: VhostData = Object.create(null);

    obj.host = host;
    obj.hostname = hostname;
    obj.length = match.length - 1;

    for (let i = 1; i < match.length; i++) {
        obj[i - 1] = match[i];
    }

    return obj;
}
