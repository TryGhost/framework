const assert = require('node:assert/strict');
const errors = require('@tryghost/errors');
const paginationPlugin = require('../lib/bookshelf-pagination');

function createBookshelf({countRows, fetchResult, selectError, fetchError} = {}) {
    const modelState = {
        queryCalls: [],
        rawCalls: [],
        fetchAllArgs: null
    };

    const qb = {
        orderByRaw(sql, bindings) {
            modelState.orderByRaw = {sql, bindings};
        }
    };

    const countQuery = {
        clone() {
            modelState.countCloned = true;
            return countQuery;
        },
        transacting(trx) {
            modelState.transacting = trx;
            return countQuery;
        },
        clear(part) {
            modelState.cleared = part;
            return countQuery;
        },
        select(raw) {
            modelState.selectRaw = raw;
            if (selectError) {
                return Promise.reject(selectError);
            }
            return Promise.resolve(countRows || [{aggregate: 1}]);
        }
    };

    function ModelConstructor() {}
    ModelConstructor.prototype.tableName = 'posts';
    ModelConstructor.prototype.idAttribute = 'id';
    ModelConstructor.prototype.query = function (method, ...args) {
        if (arguments.length === 0) {
            return countQuery;
        }

        if (typeof method === 'function') {
            method(qb);
            return this;
        }

        modelState.queryCalls.push([method, ...args]);
        return this;
    };
    ModelConstructor.prototype.fetchAll = function (options) {
        modelState.fetchAllArgs = options;
        if (fetchError) {
            return Promise.reject(fetchError);
        }
        return Promise.resolve(fetchResult || [{id: 1}]);
    };

    const bookshelf = {
        Model: ModelConstructor,
        knex: {
            raw(sql) {
                modelState.rawCalls.push(sql);
                return sql;
            }
        }
    };

    paginationPlugin(bookshelf);
    return {bookshelf, modelState};
}

describe('@tryghost/bookshelf-pagination', function () {
    it('internal parseOptions handles bad and all limits', function () {
        assert.deepEqual(paginationPlugin.paginationUtils.parseOptions({limit: 'bad', page: 'bad'}), {
            limit: 15,
            page: 1
        });

        assert.deepEqual(paginationPlugin.paginationUtils.parseOptions({limit: 'all'}), {
            limit: 'all',
            page: 1
        });
    });

    it('internal formatResponse defaults page when missing', function () {
        assert.deepEqual(paginationPlugin.paginationUtils.formatResponse(0, {limit: 15}), {
            page: 1,
            limit: 15,
            pages: 1,
            total: 0,
            next: null,
            prev: null
        });
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('adds fetchPage to Model prototype', function () {
        const {bookshelf} = createBookshelf();
        assert.equal(typeof bookshelf.Model.prototype.fetchPage, 'function');
    });

    it('applies defaults and returns pagination metadata', async function () {
        const {bookshelf, modelState} = createBookshelf({countRows: [{aggregate: 44}]});
        const model = new bookshelf.Model();

        const result = await model.fetchPage();

        assert.deepEqual(modelState.queryCalls.slice(0, 2), [
            ['limit', 15],
            ['offset', 0]
        ]);
        assert.deepEqual(result.pagination, {
            page: 1,
            limit: 15,
            pages: 3,
            total: 44,
            next: 2,
            prev: null
        });
    });

    it('supports order, orderRaw, groups and eagerLoad relation handling', async function () {
        const {bookshelf, modelState} = createBookshelf({countRows: [{aggregate: 44}]});
        const model = new bookshelf.Model();

        await model.fetchPage({
            page: 3,
            limit: 5,
            order: {
                'count.posts': 'DESC',
                'authors.name': 'ASC'
            },
            orderRaw: 'FIELD(status, ?, ?) DESC',
            orderRawBindings: ['published', 'draft'],
            eagerLoad: ['tiers.name'],
            groups: ['posts.id']
        });

        assert.equal(modelState.queryCalls.some(call => call[0] === 'orderBy' && call[1] === 'count__posts' && call[2] === 'DESC'), true);
        assert.equal(modelState.queryCalls.some(call => call[0] === 'orderBy' && call[1] === 'authors.name' && call[2] === 'ASC'), true);
        assert.equal(modelState.queryCalls.some(call => call[0] === 'groupBy' && call[1] === 'posts.id'), true);
        assert.deepEqual(modelState.orderByRaw, {
            sql: 'FIELD(status, ?, ?) DESC',
            bindings: ['published', 'draft']
        });
        assert.deepEqual(model.eagerLoad.sort(), ['authors', 'tiers'].sort());
    });

    it('supports limit=all without count query', async function () {
        const fetchResult = [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}];
        const {bookshelf, modelState} = createBookshelf({fetchResult});
        const model = new bookshelf.Model();

        const result = await model.fetchPage({limit: 'all'});

        assert.equal(modelState.countCloned, undefined);
        assert.equal(modelState.queryCalls.some(call => call[0] === 'limit'), false);
        assert.deepEqual(result.pagination, {
            page: 1,
            limit: 'all',
            pages: 1,
            total: 5,
            next: null,
            prev: null
        });
    });

    it('supports useBasicCount and transacting', async function () {
        const {bookshelf, modelState} = createBookshelf({countRows: [{aggregate: 1}]});
        const model = new bookshelf.Model();

        await model.fetchPage({
            page: 2,
            limit: 10,
            useBasicCount: true,
            transacting: 'trx'
        });

        assert.equal(modelState.transacting, 'trx');
        assert.equal(modelState.rawCalls[0], 'count(*) as aggregate');
    });

    it('uses distinct count query by default', async function () {
        const {bookshelf, modelState} = createBookshelf({countRows: [{aggregate: 1}]});
        const model = new bookshelf.Model();

        await model.fetchPage({page: 2, limit: 10});

        assert.equal(modelState.rawCalls[0], 'count(distinct posts.id) as aggregate');
    });

    it('falls back to zero total when aggregate row is missing', async function () {
        const {bookshelf} = createBookshelf({countRows: []});
        const model = new bookshelf.Model();

        const result = await model.fetchPage({page: 1, limit: 10});
        assert.equal(result.pagination.total, 0);
        assert.equal(result.pagination.pages, 1);
    });

    it('sets only prev for last page pagination metadata', async function () {
        const {bookshelf} = createBookshelf({countRows: [{aggregate: 10}]});
        const model = new bookshelf.Model();

        const result = await model.fetchPage({page: 2, limit: 5});
        assert.deepEqual(result.pagination, {
            page: 2,
            limit: 5,
            pages: 2,
            total: 10,
            next: null,
            prev: 1
        });
    });

    it('wraps offset/limit DB errors as NotFoundError', async function () {
        const {bookshelf} = createBookshelf({
            fetchError: {errno: 20}
        });
        const model = new bookshelf.Model();

        await assert.rejects(async () => {
            await model.fetchPage({page: 1, limit: 10});
        }, (err) => {
            assert.equal(err instanceof errors.NotFoundError, true);
            assert.equal(err.message, 'Page not found');
            return true;
        });
    });

    it('wraps SQL syntax errors as BadRequestError', async function () {
        const {bookshelf} = createBookshelf({
            selectError: {errno: 1054}
        });
        const model = new bookshelf.Model();

        await assert.rejects(async () => {
            await model.fetchPage({page: 1, limit: 10});
        }, (err) => {
            assert.equal(err instanceof errors.BadRequestError, true);
            assert.equal(err.message, 'Could not understand request.');
            return true;
        });
    });

    it('rethrows unknown errors unchanged', async function () {
        const rootError = new Error('boom');
        const {bookshelf} = createBookshelf({
            selectError: rootError
        });
        const model = new bookshelf.Model();

        await assert.rejects(async () => {
            await model.fetchPage({page: 1, limit: 10});
        }, (err) => {
            assert.equal(err, rootError);
            return true;
        });
    });

    it('rethrows unknown fetch errors unchanged', async function () {
        const fetchError = new Error('fetch failed');
        const {bookshelf} = createBookshelf({
            fetchError
        });
        const model = new bookshelf.Model();

        await assert.rejects(async () => {
            await model.fetchPage({page: 1, limit: 10});
        }, (err) => {
            assert.equal(err, fetchError);
            return true;
        });
    });
});
