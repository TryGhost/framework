// End-to-end tests for the pagination plugin against a real bookshelf model
// backed by an in-memory sqlite database. These pin the plugin's assumptions
// about knex's query-builder AST (`_statements`, `_single.table`) to the
// versions of knex and bookshelf actually installed, and validate that the
// chosen count aggregate returns the same row count as the matching fetch.
const assert = require('node:assert/strict');
const knex = require('knex');
const bookshelf = require('bookshelf');
const paginationPlugin = require('../lib/bookshelf-pagination');

const {hasMultiTableSource} = paginationPlugin.paginationUtils;

async function setupDatabase() {
    const db = knex({
        client: 'sqlite3',
        useNullAsDefault: true,
        connection: ':memory:'
    });

    await db.schema.createTable('authors', (t) => {
        t.string('id').primary();
        t.string('name');
    });
    await db.schema.createTable('posts', (t) => {
        t.string('id').primary();
        t.string('title');
        t.string('status');
        t.string('author_id');
    });
    await db.schema.createTable('tags', (t) => {
        t.string('id').primary();
        t.string('name');
    });
    await db.schema.createTable('posts_tags', (t) => {
        t.string('post_id');
        t.string('tag_id');
    });

    await db('authors').insert([
        {id: 'a1', name: 'Alice'},
        {id: 'a2', name: 'Bob'}
    ]);
    await db('posts').insert([
        {id: 'p1', title: 'one', status: 'published', author_id: 'a1'},
        {id: 'p2', title: 'two', status: 'published', author_id: 'a1'},
        {id: 'p3', title: 'three', status: 'draft', author_id: 'a2'}
    ]);
    await db('tags').insert([
        {id: 't1', name: 'tech'},
        {id: 't2', name: 'news'}
    ]);
    // p1 has two tags — the outer-join cases below will duplicate p1 into
    // two physical rows, which is what makes count(*) vs count(distinct)
    // observable at the result level.
    await db('posts_tags').insert([
        {post_id: 'p1', tag_id: 't1'},
        {post_id: 'p1', tag_id: 't2'},
        {post_id: 'p2', tag_id: 't1'}
    ]);

    // Capture every compiled SQL query so each test can assert which count
    // aggregate the plugin chose by inspecting the count query directly.
    const queries = [];
    db.on('query', (q) => {
        queries.push(q.sql);
    });

    const bk = bookshelf(db);
    paginationPlugin(bk);

    const Post = bk.model('Post', {tableName: 'posts', idAttribute: 'id'});

    return {db, Post, queries};
}

function countQuerySql(queries) {
    return queries.find(sql => typeof sql === 'string' && /\bcount\(/i.test(sql));
}

describe('hasMultiTableSource against real knex builders', function () {
    // These exercise hasMultiTableSource directly using real knex
    // QueryBuilders (no DB connection). They pin the plugin's assumptions
    // about knex's internal AST shape — `_statements` / `_single.table` —
    // to the version of knex installed, and cover branches that are hard
    // to drive end-to-end through fetchPage.
    let db;

    beforeEach(function () {
        db = knex({client: 'sqlite3', useNullAsDefault: true});
    });

    afterEach(async function () {
        await db.destroy();
    });

    it('returns false for a plain single-table query', function () {
        assert.equal(hasMultiTableSource(db('posts').where('status', 'published')), false);
    });

    it('returns false when a JOIN is nested inside a WHERE subquery', function () {
        const qb = db('posts').whereIn('posts.id', function () {
            this.select('post_id')
                .from('posts_tags')
                .innerJoin('users', 'users.id', 'posts_tags.author_id')
                .where('users.id', 1);
        });
        assert.equal(hasMultiTableSource(qb), false);
    });

    it('returns true for an outer innerJoin', function () {
        assert.equal(hasMultiTableSource(db('posts').innerJoin('tags', 'tags.id', 'posts.id')), true);
    });

    it('returns true for leftJoin, rightJoin and joinRaw', function () {
        assert.equal(hasMultiTableSource(db('posts').leftJoin('tags', 'tags.id', 'posts.id')), true);
        assert.equal(hasMultiTableSource(db('posts').joinRaw('right join tags on tags.id = posts.id')), true);
    });

    it('returns true for a UNION query', function () {
        const qb = db('posts').select('id').where('status', 'published').union(function () {
            this.select('id').from('posts').where('status', 'draft');
        });
        assert.equal(hasMultiTableSource(qb), true);
    });

    it('returns true for a derived table in FROM', function () {
        const derived = db('posts').where('status', 'published').as('sub');
        assert.equal(hasMultiTableSource(db.queryBuilder().from(derived)), true);
    });

    it('returns true for fromRaw with multiple tables', function () {
        assert.equal(hasMultiTableSource(db.queryBuilder().fromRaw('`posts`, `tags`')), true);
    });

    it('returns true when the table string itself contains a comma', function () {
        // Real knex accepts this shape; it only fails at execution time.
        // The detection must still classify it as multi-source.
        assert.equal(hasMultiTableSource(db('posts, tags')), true);
    });

    it('returns false for a CTE-only query with a single-table outer FROM', function () {
        const qb = db('posts')
            .with('published_ids', db('posts').select('id').where('status', 'published'))
            .whereIn('posts.id', db('published_ids').select('id'));
        assert.equal(hasMultiTableSource(qb), false);
    });
});

function usesCountStar(sql) {
    return /\bcount\(\*\) as aggregate\b/i.test(sql);
}

function usesCountDistinct(sql) {
    return /\bcount\(distinct posts\.id\) as aggregate\b/i.test(sql);
}

describe('@tryghost/bookshelf-pagination (integration)', function () {
    let db;
    let Post;
    let queries;

    beforeEach(async function () {
        ({db, Post, queries} = await setupDatabase());
    });

    afterEach(async function () {
        if (db) {
            await db.destroy();
        }
    });

    it('useSmartCount picks count(*) for a plain single-table filter', async function () {
        const result = await Post.forge()
            .where('author_id', 'a1')
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountStar(countSql), `expected count(*), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
        assert.equal(result.collection.length, 2);
    });

    it('useSmartCount picks count(*) when a JOIN is nested inside a WHERE subquery', async function () {
        // Regression: `where id in (select … inner join …)` must stay on
        // the count(*) path because the outer query is still single-table.
        const result = await Post.forge()
            .query(function (qb) {
                qb.whereIn('posts.id', function () {
                    this.select('posts_tags.post_id')
                        .from('posts_tags')
                        .innerJoin('posts as p2', 'p2.id', 'posts_tags.post_id')
                        .innerJoin('authors', 'authors.id', 'p2.author_id')
                        .where('authors.name', 'Alice');
                });
            })
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountStar(countSql), `expected count(*), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
        assert.equal(result.collection.length, 2);
    });

    it('useSmartCount picks count(distinct) when an outer INNER JOIN duplicates rows', async function () {
        // p1 has two tags, so posts × posts_tags produces three physical
        // rows for the two published posts. count(*) would report 3;
        // count(distinct posts.id) must report 2.
        const result = await Post.forge()
            .query(function (qb) {
                qb.innerJoin('posts_tags', 'posts_tags.post_id', 'posts.id')
                    .where('posts.status', 'published');
            })
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountDistinct(countSql), `expected count(distinct), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
    });

    it('useSmartCount picks count(distinct) for a joinRaw', async function () {
        const result = await Post.forge()
            .query(function (qb) {
                qb.joinRaw('inner join `posts_tags` on `posts_tags`.`post_id` = `posts`.`id`')
                    .where('posts.status', 'published');
            })
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountDistinct(countSql), `expected count(distinct), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
    });

    it('useSmartCount picks count(distinct) when the FROM source is a derived table', async function () {
        const result = await Post.forge()
            .query(function (qb) {
                qb.from(db('posts').where('status', 'published').as('posts'));
            })
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountDistinct(countSql), `expected count(distinct), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
    });

    it('useSmartCount picks count(*) when the query has only a CTE (with) clause', async function () {
        const result = await Post.forge()
            .query(function (qb) {
                qb.with('published_ids', db('posts').select('id').where('status', 'published'))
                    .whereIn('posts.id', db('published_ids').select('id'));
            })
            .fetchPage({page: 1, limit: 10, useSmartCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountStar(countSql), `expected count(*), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
    });

    it('useBasicCount skips the smart-count check entirely', async function () {
        // useBasicCount forces count(*) even on a join — the caller opts
        // in to "I know what I'm doing" and accepts row duplication.
        // p1 has two tags, so count(*) reports 3 rows for 2 published posts.
        const result = await Post.forge()
            .query(function (qb) {
                qb.innerJoin('posts_tags', 'posts_tags.post_id', 'posts.id')
                    .where('posts.status', 'published');
            })
            .fetchPage({page: 1, limit: 10, useBasicCount: true});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountStar(countSql), `expected count(*), got: ${countSql}`);
        assert.equal(result.pagination.total, 3);
    });

    it('default (no count option) uses count(distinct)', async function () {
        const result = await Post.forge()
            .where('status', 'published')
            .fetchPage({page: 1, limit: 10});

        const countSql = countQuerySql(queries);
        assert.ok(usesCountDistinct(countSql), `expected count(distinct), got: ${countSql}`);
        assert.equal(result.pagination.total, 2);
    });
});
