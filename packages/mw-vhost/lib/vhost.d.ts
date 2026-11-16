import { IncomingMessage, ServerResponse } from 'http';

/**
 * Create middleware that calls `handle` only when the request hostname
 * matches `hostname`. Strings may use `*` as a wildcard for one label.
 * Supports Express `trust proxy` via `req.hostname`.
 */
declare function vhost<
    Req extends vhost.Request = vhost.Request,
    Res extends ServerResponse = ServerResponse,
>(hostname: string | RegExp, handle: vhost.Handler<Req, Res>): vhost.Handler<Req, Res>;

declare namespace vhost {
    /**
     * Data attached to `req.vhost` when the hostname matches. Numeric keys
     * hold the values captured by `*` wildcards (or regexp groups);
     * unmatched optional groups are `undefined`.
     */
    interface VhostData {
        host: string | undefined;
        hostname: string;
        length: number;
        [index: number]: string | undefined;
    }

    type Request = IncomingMessage & { hostname?: string; host?: string; vhost?: VhostData };

    type Handler<Req extends Request = Request, Res extends ServerResponse = ServerResponse> = (
        req: Req,
        res: Res,
        next: (err?: unknown) => void,
    ) => void;
}

export = vhost;
