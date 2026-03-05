declare module 'lodash.template' {
    interface TemplateOptions {
        interpolate?: RegExp;
    }

    interface TemplateExecutor {
        (data?: Record<string, unknown>): string;
    }

    function template(string: string, options?: TemplateOptions): TemplateExecutor;
    export default template;
}
