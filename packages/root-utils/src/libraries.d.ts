declare module 'find-root' {
    function findRoot(dir: string): string;
    export default findRoot;
}

declare module 'caller' {
    function caller(depth?: number): string;
    export default caller;
}
