declare module 'prettyjson' {
    interface RenderOptions {
        noColor?: boolean;
    }
    function render(data: unknown, options: RenderOptions, indent?: number): string;
    export { render };
}

declare module 'date-format' {
    function asString(format: string, date: Date): string;
    export { asString };
}
