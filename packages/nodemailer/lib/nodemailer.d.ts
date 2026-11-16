/**
 * Create a Nodemailer transporter for one of Ghost's supported transports.
 * The name is case-insensitive. Throws an `EmailError` for unknown transports.
 *
 * The returned transporter's `verify()` signature depends on the transport,
 * so pass the transport name as a literal to get the precise type.
 */
declare function createTransporter<Name extends string>(
    transport: Name,
    options?: Record<string, any>,
): createTransporter.Transporter<Lowercase<Name>>;

declare namespace createTransporter {
    type TransportName = 'smtp' | 'mailgun' | 'sendmail' | 'ses' | 'direct' | 'stub';

    type VerifyCallback = (err: Error | null, success?: true) => void;

    /** smtp, ses, direct: promise without a callback, callback otherwise. */
    interface PromiseVerify {
        verify(): Promise<true>;
        verify(callback: VerifyCallback): void;
    }

    /** sendmail, mailgun: the transport has no `verify`, so it returns `false`. */
    interface NoVerify {
        verify(callback?: VerifyCallback): false;
    }

    /** stub: only supports the callback form; without one it throws asynchronously. */
    interface CallbackVerify {
        verify(callback: VerifyCallback): void;
    }

    type VerifyFor<Name extends string> = Name extends 'smtp' | 'ses' | 'direct'
        ? PromiseVerify
        : Name extends 'sendmail' | 'mailgun'
          ? NoVerify
          : Name extends 'stub'
            ? CallbackVerify
            : {
                  verify(): Promise<true> | false;
                  verify(callback: VerifyCallback): void | false;
              };

    /**
     * The parts of a Nodemailer `Transporter` that callers use. For full
     * types, cast to `import('nodemailer').Transporter` with
     * `@types/nodemailer` installed.
     */
    type Transporter<Name extends string = string> = VerifyFor<Name> & {
        sendMail(mail: object): Promise<any>;
        sendMail(mail: object, callback: (err: Error | null, info: any) => void): void;
        close(): void;
        transporter: { name?: string; options?: object; [key: string]: unknown };
        options: object;
    };
}

export = createTransporter;
