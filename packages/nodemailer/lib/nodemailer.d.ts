/**
 * Create a Nodemailer transporter for one of Ghost's supported transports.
 * The name is case-insensitive. Throws an `EmailError` for unknown transports.
 */
declare function createTransporter(
    transport: createTransporter.TransportName | (string & {}),
    options?: Record<string, any>,
): createTransporter.Transporter;

declare namespace createTransporter {
    type TransportName = 'smtp' | 'mailgun' | 'sendmail' | 'ses' | 'direct' | 'stub';

    /**
     * The parts of a Nodemailer `Transporter` that callers use. For full
     * types, cast to `import('nodemailer').Transporter` with
     * `@types/nodemailer` installed.
     */
    interface Transporter {
        sendMail(mail: object): Promise<any>;
        sendMail(mail: object, callback: (err: Error | null, info: any) => void): void;
        verify(): Promise<true>;
        close(): void;
        transporter: { name?: string; options?: object; [key: string]: unknown };
        options: object;
    }
}

export = createTransporter;
