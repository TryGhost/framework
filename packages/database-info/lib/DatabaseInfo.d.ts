/**
 * Detects which database (and version) a knex instance is connected to.
 */
declare class DatabaseInfo {
    constructor(knex: DatabaseInfo.KnexLike);

    /**
     * Query the database for its details. Must be called before the getters
     * return anything other than `unknown`.
     */
    init(): Promise<DatabaseInfo.DatabaseDetails>;

    getDriver(): string;
    getDatabase(): string;
    getEngine(): string;
    getVersion(): string;

    /** Whether the knex instance uses a SQLite driver. */
    static isSQLite(knex: DatabaseInfo.KnexClientLike): boolean;
    /** Whether a knex config object uses a SQLite driver. */
    static isSQLiteConfig(config: { client?: unknown }): boolean;
    /** Whether the knex instance uses a MySQL driver. */
    static isMySQL(knex: DatabaseInfo.KnexClientLike): boolean;
    /** Whether a knex config object uses a MySQL driver. */
    static isMySQLConfig(config: { client?: unknown }): boolean;
}

declare namespace DatabaseInfo {
    /**
     * The parts of a knex instance (or transaction) that the static
     * `isSQLite()` / `isMySQL()` checks read.
     */
    interface KnexClientLike {
        client: { config: { client?: unknown } };
    }

    /**
     * The parts of a knex instance that the constructor and `init()` read.
     * `driver` is the loaded database driver module; `init()` reads
     * `driver.VERSION` for SQLite.
     */
    interface KnexLike {
        client: {
            config: { client: string };
            driver: { VERSION?: string };
        };
        raw(sql: string): PromiseLike<any>;
    }

    interface DatabaseDetails {
        /** The driver knex uses, e.g. `sqlite3`, `better-sqlite3`, `mysql2`. */
        driver: string;
        /** `SQLite`, `MySQL`, `MariaDB` or `unknown`. */
        database: string;
        /** `sqlite3`, `mysql5`, `mysql8`, `mysql`, `mariadb` or `unknown`. */
        engine: string;
        /** The database version, or `unknown`. */
        version: string;
    }
}

export = DatabaseInfo;
