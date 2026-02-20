const assert = require('node:assert/strict');
const sinon = require('sinon');
const rewire = require('rewire');
const pagination = rewire('../lib/bookshelf-pagination');

describe('pagination', function () {
    let paginationUtils;

    afterEach(function () {
        sinon.restore();
    });

    describe('paginationUtils', function () {
        before(function () {
            paginationUtils = pagination.__get__('paginationUtils');
        });

        describe('formatResponse', function () {
            let formatResponse;

            before(function () {
                formatResponse = paginationUtils.formatResponse;
            });

            it('returns correct pagination object for single page', function () {
                assert.deepEqual(formatResponse(5, {limit: 10, page: 1}), {
                    limit: 10,
                    next: null,
                    page: 1,
                    pages: 1,
                    prev: null,
                    total: 5
                });
            });

            it('returns correct pagination object for first page of many', function () {
                assert.deepEqual(formatResponse(44, {limit: 5, page: 1}), {
                    limit: 5,
                    next: 2,
                    page: 1,
                    pages: 9,
                    prev: null,
                    total: 44
                });
            });

            it('returns correct pagination object for middle page of many', function () {
                assert.deepEqual(formatResponse(44, {limit: 5, page: 9}), {
                    limit: 5,
                    next: null,
                    page: 9,
                    pages: 9,
                    prev: 8,
                    total: 44
                });
            });

            it('returns correct pagination object for last page of many', function () {
                assert.deepEqual(formatResponse(44, {limit: 5, page: 3}), {
                    limit: 5,
                    next: 4,
                    page: 3,
                    pages: 9,
                    prev: 2,
                    total: 44
                });
            });

            it('returns correct pagination object when page not set', function () {
                assert.deepEqual(formatResponse(5, {limit: 10}), {
                    limit: 10,
                    next: null,
                    page: 1,
                    pages: 1,
                    prev: null,
                    total: 5
                });
            });

            it('returns correct pagination object for limit all', function () {
                assert.deepEqual(formatResponse(5, {limit: 'all'}), {
                    limit: 'all',
                    next: null,
                    page: 1,
                    pages: 1,
                    prev: null,
                    total: 5
                });
            });
        });

        describe('parseOptions', function () {
            let parseOptions;

            before(function () {
                parseOptions = paginationUtils.parseOptions;
            });

            it('uses defaults if no options are passed', function () {
                assert.deepEqual(parseOptions(), {
                    limit: 15,
                    page: 1
                });
            });

            it('accepts numbers for limit and page', function () {
                assert.deepEqual(parseOptions({
                    limit: 10,
                    page: 2
                }), {
                    limit: 10,
                    page: 2
                });
            });

            it('uses defaults if bad options are passed', function () {
                assert.deepEqual(parseOptions({
                    limit: 'thelma',
                    page: 'louise'
                }), {
                    limit: 15,
                    page: 1
                });
            });

            it('permits all for limit', function () {
                assert.deepEqual(parseOptions({
                    limit: 'all'
                }), {
                    limit: 'all',
                    page: 1
                });
            });
        });

        describe('addLimitAndOffset', function () {
            let addLimitAndOffset;
            const collection = {};

            before(function () {
                addLimitAndOffset = paginationUtils.addLimitAndOffset;
            });

            beforeEach(function () {
                collection.query = sinon.stub().returns(collection);
            });

            it('adds query options if limit is set', function () {
                addLimitAndOffset(collection, {limit: 5, page: 1});

                assert.equal(collection.query.calledTwice, true);
                assert.equal(collection.query.firstCall.calledWith('limit', 5), true);
                assert.equal(collection.query.secondCall.calledWith('offset', 0), true);
            });

            it('does not add query options if limit is not set', function () {
                addLimitAndOffset(collection, {page: 1});

                assert.equal(collection.query.called, false);
            });
        });
    });

    describe('fetchPage', function () {
        let model;
        let bookshelf;
        let knex;
        let mockQuery;

        before(function () {
            paginationUtils = pagination.__get__('paginationUtils');
        });

        beforeEach(function () {
            paginationUtils.parseOptions = sinon.stub();
            paginationUtils.addLimitAndOffset = sinon.stub();
            paginationUtils.formatResponse = sinon.stub().returns({});

            mockQuery = {
                clone: sinon.stub(),
                select: sinon.stub(),
                toQuery: sinon.stub(),
                clear: sinon.stub()
            };
            mockQuery.clone.returns(mockQuery);
            mockQuery.select.returns(Promise.resolve([{aggregate: 1}]));

            model = function ModelCtor() {};
            model.prototype.fetchAll = sinon.stub().returns(Promise.resolve({}));
            model.prototype.query = sinon.stub().returns(mockQuery);

            knex = {raw: sinon.stub().returns(Promise.resolve())};
            bookshelf = {Model: model, knex: knex};

            pagination(bookshelf);
        });

        it('extends Model with fetchPage', function () {
            assert.equal(typeof bookshelf.Model.prototype.fetchPage, 'function');
        });

        it('calls all paginationUtils and methods', async function () {
            paginationUtils.parseOptions.returns({});

            await bookshelf.Model.prototype.fetchPage();

            sinon.assert.callOrder(
                paginationUtils.parseOptions,
                model.prototype.query,
                mockQuery.clone,
                mockQuery.select,
                paginationUtils.addLimitAndOffset,
                model.prototype.fetchAll,
                paginationUtils.formatResponse
            );

            assert.equal(paginationUtils.parseOptions.calledOnceWithExactly(undefined), true);
            assert.equal(paginationUtils.addLimitAndOffset.calledOnce, true);
            assert.equal(paginationUtils.formatResponse.calledOnce, true);
            assert.equal(model.prototype.query.calledOnceWithExactly(), true);
            assert.equal(mockQuery.clone.calledOnceWithExactly(), true);
            assert.equal(mockQuery.select.calledOnce, true);
            assert.equal(model.prototype.fetchAll.calledOnceWithExactly({}), true);
        });

        it('calls methods when order is set', async function () {
            const orderOptions = {order: {id: 'DESC'}};
            paginationUtils.parseOptions.returns(orderOptions);

            await bookshelf.Model.prototype.fetchPage(orderOptions);

            assert.equal(model.prototype.query.calledTwice, true);
            assert.equal(model.prototype.query.secondCall.calledWith('orderBy', 'id', 'DESC'), true);
            assert.equal(model.prototype.fetchAll.calledOnceWithExactly(orderOptions), true);
        });

        it('calls methods when group by is set', async function () {
            const groupOptions = {groups: ['posts.id']};
            paginationUtils.parseOptions.returns(groupOptions);

            await bookshelf.Model.prototype.fetchPage(groupOptions);

            assert.equal(model.prototype.query.calledTwice, true);
            assert.equal(model.prototype.query.secondCall.calledWith('groupBy', 'posts.id'), true);
            assert.equal(model.prototype.fetchAll.calledOnceWithExactly(groupOptions), true);
        });

        it('calls orderByRaw when orderRaw is set', async function () {
            const mockQb = {orderByRaw: sinon.stub()};
            model.prototype.query.callsFake(function (arg) {
                if (typeof arg === 'function') {
                    arg(mockQb);
                }
                return mockQuery;
            });

            const orderRawOptions = {orderRaw: 'CASE WHEN slug = ? THEN ? END ASC'};
            paginationUtils.parseOptions.returns(orderRawOptions);

            await bookshelf.Model.prototype.fetchPage(orderRawOptions);
            assert.equal(mockQb.orderByRaw.calledOnceWithExactly('CASE WHEN slug = ? THEN ? END ASC', undefined), true);
        });

        it('passes orderRawBindings to orderByRaw when provided', async function () {
            const mockQb = {orderByRaw: sinon.stub()};
            model.prototype.query.callsFake(function (arg) {
                if (typeof arg === 'function') {
                    arg(mockQb);
                }
                return mockQuery;
            });

            const orderRawOptions = {
                orderRaw: 'CASE WHEN slug = ? THEN ? END ASC',
                orderRawBindings: ['my-slug', 0]
            };
            paginationUtils.parseOptions.returns(orderRawOptions);

            await bookshelf.Model.prototype.fetchPage(orderRawOptions);
            assert.equal(mockQb.orderByRaw.calledOnceWithExactly(
                'CASE WHEN slug = ? THEN ? END ASC',
                ['my-slug', 0]
            ), true);
        });

        it('returns expected response', async function () {
            paginationUtils.parseOptions.returns({});
            const result = await bookshelf.Model.prototype.fetchPage();

            assert.ok(Object.prototype.hasOwnProperty.call(result, 'collection'));
            assert.ok(Object.prototype.hasOwnProperty.call(result, 'pagination'));
            assert.equal(typeof result.collection, 'object');
            assert.equal(typeof result.pagination, 'object');
        });

        it('returns expected response when aggregate is empty', async function () {
            mockQuery.select.returns(Promise.resolve([]));
            paginationUtils.parseOptions.returns({});

            const result = await bookshelf.Model.prototype.fetchPage();
            assert.ok(Object.prototype.hasOwnProperty.call(result, 'collection'));
            assert.ok(Object.prototype.hasOwnProperty.call(result, 'pagination'));
        });
    });
});
