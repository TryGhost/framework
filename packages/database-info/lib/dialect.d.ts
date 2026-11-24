/** Which family of database a knex instance or config talks to. */
export type Dialect = 'mysql' | 'sqlite' | 'unknown';

/** The parts of a knex instance, or transaction, that the checks read. */
export interface KnexClientLike {
    client: {
        /** Set by knex: `'sqlite3'` for both SQLite drivers, `'mysql'` for both MySQL drivers. */
        dialect?: string;
        config?: { client?: unknown };
    };
}

/** The parts of a knex instance that `describeDatabase()` reads. */
export interface KnexLike extends KnexClientLike {
    client: KnexClientLike['client'] & {
        driverName?: string;
        driver?: { VERSION?: string };
    };
    raw(sql: string): PromiseLike<any>;
}

export interface DatabaseDetails {
    /** The driver knex uses, e.g. `sqlite3`, `better-sqlite3`, `mysql2`. */
    driver: string;
    /** `SQLite`, `MySQL`, `MariaDB` or `unknown`. */
    database: string;
    /** `sqlite3`, `mysql5`, `mysql8`, `mysql`, `mariadb` or `unknown`. */
    engine: string;
    /** The database version, or `unknown`. */
    version: string;
}

/** The dialect a knex instance or transaction talks to. */
export function getDialect(knex: KnexClientLike): Dialect;
/** The dialect a knex config names. `client` may be a driver name or a knex Client class. */
export function getConfigDialect(config: { client?: unknown }): Dialect;
export function isSQLite(knex: KnexClientLike): boolean;
export function isMySQL(knex: KnexClientLike): boolean;
export function isSQLiteConfig(config: { client?: unknown }): boolean;
export function isMySQLConfig(config: { client?: unknown }): boolean;
/**
 * Asks the database what it is. One query on MySQL, none on SQLite. Keeps nothing and
 * never rejects: what it cannot work out is `'unknown'`.
 */
export function describeDatabase(knex: KnexLike): Promise<DatabaseDetails>;
