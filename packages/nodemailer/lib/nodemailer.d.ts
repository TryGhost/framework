/**
 * Create a Nodemailer transporter for one of Ghost's supported transports.
 * The name is case-insensitive. Throws an `EmailError` for unknown transports.
 *
 * The returned transporter's `verify()` signature depends on the transport
 * actually selected, so pass the transport name (and any transport-selecting
 * options such as `service`) as literals to get the precise type.
 */
declare function createTransporter<
    Name extends string,
    Options extends object = {},
    Service extends string = never,
>(
    transport: Name,
    options?: Options & { service?: Service },
): createTransporter.Transporter<Lowercase<Name>, Options, Service>;

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

    /**
     * smtp or direct with options that may switch the transport: promise or
     * `false` without a callback (none of the switched-to transports is stub).
     */
    interface UnknownVerify {
        verify(): Promise<true> | false;
        verify(callback: VerifyCallback): void | false;
    }

    /**
     * Transport name not known at compile time. It could be `stub`, whose
     * `verify()` throws asynchronously without a callback, so only the
     * callback form is allowed. Narrow the name to get the promise form.
     */
    interface UnknownNameVerify {
        verify(callback: VerifyCallback): void | false;
    }

    /** Options that make Nodemailer pick a different transport than SMTP. */
    type TransportSelectingOption = 'sendmail' | 'streamTransport' | 'jsonTransport' | 'SES';

    /**
     * Whether the options may switch the transport away from SMTP. Options
     * typed with open keys (e.g. `Record<string, any>`) are treated as maybe.
     */
    type MaySwitchTransport<Options> = string extends keyof Options
        ? true
        : Extract<keyof Options, TransportSelectingOption> extends never
          ? false
          : true;

    /** `service: 'sendmail'` (any case) switches smtp to Sendmail. */
    type SmtpServiceVerify<Service extends string> = [Service] extends [never]
        ? PromiseVerify
        : string extends Service
          ? UnknownVerify
          : Extract<Lowercase<Service>, 'sendmail'> extends never
            ? PromiseVerify
            : Lowercase<Service> extends 'sendmail'
              ? NoVerify
              : UnknownVerify;

    type VerifyFor<Name extends string, Options, Service extends string> = Name extends 'smtp'
        ? MaySwitchTransport<Options> extends true
            ? UnknownVerify
            : SmtpServiceVerify<Service>
        : Name extends 'direct'
          ? MaySwitchTransport<Options> extends true
              ? UnknownVerify
              : PromiseVerify
          : Name extends 'ses'
            ? PromiseVerify
            : Name extends 'sendmail' | 'mailgun'
              ? NoVerify
              : Name extends 'stub'
                ? CallbackVerify
                : UnknownNameVerify;

    /**
     * The parts of a Nodemailer `Transporter` that callers use. For full
     * types, cast to `import('nodemailer').Transporter` with
     * `@types/nodemailer` installed.
     */
    type Transporter<
        Name extends string = string,
        Options = {},
        Service extends string = never,
    > = VerifyFor<Name, Options, Service> & {
        sendMail(mail: object): Promise<any>;
        sendMail(mail: object, callback: (err: Error | null, info: any) => void): void;
        close(): void;
        transporter: { name?: string; options?: object; [key: string]: unknown };
        options: object;
    };
}

export = createTransporter;
