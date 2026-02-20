const assert = require('node:assert/strict');
const sinon = require('sinon');
const debugBase = require('@tryghost/debug')._base;
const installPlugin = require('..');

describe('@tryghost/bookshelf-include-count', function () {
    let Bookshelf;
    let BaseModel;
    let BaseCollection;
    let modelSerialize;
    let modelSync;
    let modelSave;
    let collectionSync;

    beforeEach(function () {
        modelSerialize = sinon.stub().callsFake(function () {
            return Object.assign({}, this.attributes);
        });
        modelSync = sinon.stub().returns('MODEL_SYNC');
        modelSave = sinon.stub().resolves('MODEL_SAVE');
        collectionSync = sinon.stub().returns('COLLECTION_SYNC');

        BaseModel = function BaseModel() {
            this.attributes = {};
            this.constructor = BaseModel;
        };
        BaseModel.prototype.serialize = modelSerialize;
        BaseModel.prototype.sync = modelSync;
        BaseModel.prototype.save = modelSave;
        BaseModel.prototype.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 1')});
        BaseModel.extend = function extend(proto) {
            function Child() {
                BaseModel.apply(this, arguments);
                this.constructor = Child;
            }
            Child.prototype = Object.create(BaseModel.prototype);
            Object.assign(Child.prototype, proto);
            Child.prototype.constructor = Child;
            Child.extend = BaseModel.extend;
            return Child;
        };

        BaseCollection = function BaseCollection() {
            this.constructor = BaseCollection;
        };
        BaseCollection.prototype.sync = collectionSync;
        BaseCollection.prototype.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 2')});
        BaseCollection.extend = function extend(proto) {
            function Child() {
                BaseCollection.apply(this, arguments);
                this.constructor = Child;
            }
            Child.prototype = Object.create(BaseCollection.prototype);
            Object.assign(Child.prototype, proto);
            Child.prototype.constructor = Child;
            Child.extend = BaseCollection.extend;
            return Child;
        };

        Bookshelf = {
            Model: BaseModel,
            Collection: BaseCollection
        };

        installPlugin(Bookshelf);
    });

    afterEach(function () {
        sinon.restore();
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('serialize nests count__ keys under count object', function () {
        const model = new Bookshelf.Model();
        model.attributes = {
            id: '1',
            count__posts: 3,
            count__members: 9,
            title: 'hello'
        };

        const result = model.serialize({});

        assert.deepEqual(result, {
            id: '1',
            title: 'hello',
            count: {
                posts: 3,
                members: 9
            }
        });
    });

    it('model sync applies counts for non-insert/update methods', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SQL')});
        model.constructor.countRelations = sinon.stub().returns({
            posts: sinon.stub()
        });

        const options = {method: 'read', withRelated: ['count.posts']};
        const result = model.sync(options);

        assert.equal(result, 'MODEL_SYNC');
        assert.equal(model.constructor.countRelations.calledOnce, true);
        assert.deepEqual(options.withRelated, []);
        assert.equal(modelSync.calledOnceWithExactly(options), true);
    });

    it('model sync skips addCounts for insert/update methods', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.constructor.countRelations = sinon.stub().returns({
            posts: sinon.stub()
        });

        const resultInsert = model.sync({method: 'insert', withRelated: ['count.posts']});
        const resultUpdate = model.sync({method: 'update', withRelated: ['count.posts']});

        assert.equal(resultInsert, 'MODEL_SYNC');
        assert.equal(resultUpdate, 'MODEL_SYNC');
        assert.equal(model.constructor.countRelations.called, false);
    });

    it('model sync logs query when debug is enabled', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SQL')});

        const result = model.sync({method: 'read'});

        assert.equal(result, 'MODEL_SYNC');
        assert.equal(model.query.calledOnce, true);
    });

    it('addCounts supports object withRelated entries and collection model fallback', function () {
        const countLikes = sinon.stub();
        const collection = new Bookshelf.Collection();
        collection.model = {
            countRelations: sinon.stub().returns({
                likes: countLikes
            })
        };

        const options = {
            withRelated: [
                {foo: sinon.stub()},
                {'count.likes': sinon.stub()}
            ]
        };

        collection.addCounts(options);

        assert.equal(countLikes.calledOnceWithExactly(collection, options), true);
        assert.deepEqual(options.withRelated, [{foo: options.withRelated[0].foo}]);
    });

    it('addCounts exits early for missing options/withRelated and absent countRelations', function () {
        const model = new Bookshelf.Model();
        model.constructor.countRelations = null;

        assert.equal(model.addCounts(), undefined);
        assert.equal(model.addCounts({}), undefined);
        assert.equal(model.addCounts({withRelated: ['count.posts']}), undefined);
    });

    it('save preserves count__ attributes through save promise', async function () {
        const model = new Bookshelf.Model();
        model.attributes = {
            id: '1',
            count__posts: 4,
            title: 'before'
        };

        modelSave.callsFake(function () {
            model.attributes = {
                id: '1',
                title: 'after'
            };
            return Promise.resolve('MODEL_SAVE');
        });

        const result = await model.save({title: 'after'});
        assert.equal(result, 'MODEL_SAVE');
        assert.deepEqual(model.attributes, {
            id: '1',
            title: 'after',
            count__posts: 4
        });
    });

    it('collection sync always applies counts and logs when debug enabled', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const collection = new Bookshelf.Collection();
        const countTags = sinon.stub();
        collection.model = {
            countRelations: sinon.stub().returns({
                tags: countTags
            })
        };
        collection.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 10')});

        const options = {withRelated: ['count.tags']};
        const result = collection.sync(options);

        assert.equal(result, 'COLLECTION_SYNC');
        assert.equal(countTags.calledOnceWithExactly(collection, options), true);
        assert.deepEqual(options.withRelated, []);
        assert.equal(collection.query.calledOnce, true);
        assert.equal(collectionSync.calledOnceWithExactly(options), true);
    });
});
