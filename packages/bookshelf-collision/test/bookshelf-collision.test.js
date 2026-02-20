const assert = require('node:assert/strict');
const sinon = require('sinon');
const errors = require('@tryghost/errors');
const installPlugin = require('..');

describe('@tryghost/bookshelf-collision', function () {
    let Bookshelf;
    let ParentModel;
    let parentSync;
    let parentUpdate;
    let parentSave;

    beforeEach(function () {
        parentUpdate = sinon.stub().resolves('UPDATED');
        parentSync = {update: parentUpdate};
        parentSave = sinon.stub().resolves('SAVED');

        ParentModel = function BaseModel() {
            this.attributes = {};
            this._changed = {};
        };

        ParentModel.prototype.sync = sinon.stub().returns(parentSync);
        ParentModel.prototype.save = parentSave;

        ParentModel.extend = function extend(proto) {
            function Child() {
                ParentModel.apply(this, arguments);
            }
            Child.prototype = Object.create(ParentModel.prototype);
            Object.assign(Child.prototype, proto);
            Child.prototype.constructor = Child;
            Child.extend = ParentModel.extend;
            return Child;
        };

        Bookshelf = {Model: ParentModel};
        installPlugin(Bookshelf);
    });

    afterEach(function () {
        sinon.restore();
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('replaces Bookshelf.Model with extended model', function () {
        assert.notEqual(Bookshelf.Model, ParentModel);
    });

    it('save stores cloned client/server data and calls parent save', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();

        model.attributes = {id: 1, updated_at: '2024-01-01T00:00:00.000Z'};
        const clientPayload = {title: 'post'};
        const result = await model.save(clientPayload);

        assert.equal(result, 'SAVED');
        assert.equal(parentSave.calledOnce, true);
        assert.deepEqual(model.clientData, {title: 'post'});
        assert.deepEqual(model.serverData, {id: 1, updated_at: '2024-01-01T00:00:00.000Z'});
        assert.notEqual(model.clientData, clientPayload);
        assert.notEqual(model.serverData, model.attributes);
    });

    it('save defaults clientData to empty object when no data is passed', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.attributes = {id: 1};

        await model.save();

        assert.deepEqual(model.clientData, {});
        assert.deepEqual(model.serverData, {id: 1});
    });

    it('sync returns parent sync for non-post tables', function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'users';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};

        const result = model.sync({method: 'update'});

        assert.equal(result, parentSync);
        assert.equal(result.update, parentUpdate);
    });

    it('sync returns parent sync when serverData is missing', function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';

        const result = model.sync({method: 'patch'});

        assert.equal(result, parentSync);
        assert.equal(result.update, parentUpdate);
    });

    it('sync returns parent sync for unsupported methods', function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};

        const result = model.sync({method: 'insert'});

        assert.equal(result, parentSync);
        assert.equal(result.update, parentUpdate);
    });

    it('sync wraps update for post updates/patches', function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};

        const updateSync = model.sync({method: 'patch'});

        assert.equal(updateSync, parentSync);
        assert.notEqual(updateSync.update, parentUpdate);
    });

    it('wrapped update returns response when only ignored fields changed', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};
        model.clientData = {updated_at: '2024-01-02T00:00:00.000Z'};
        model._changed = {updated_at: '2024-01-02T00:00:00.000Z', html: '<p>x</p>'};

        const updateSync = model.sync({method: 'update'});
        const result = await updateSync.update();

        assert.equal(result, 'UPDATED');
        assert.equal(parentUpdate.calledOnce, true);
    });

    it('wrapped update returns response when changed fields exist but timestamps match', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};
        model.clientData = {updated_at: '2024-01-01T00:00:00.000Z'};
        model._changed = {title: 'changed'};

        const updateSync = model.sync({method: 'update'});
        const result = await updateSync.update('a1', 'a2');

        assert.equal(result, 'UPDATED');
        assert.equal(parentUpdate.calledOnceWithExactly('a1', 'a2'), true);
    });

    it('wrapped update throws UpdateCollisionError when timestamps differ and meaningful fields changed', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {updated_at: '2024-01-01T00:00:00.000Z'};
        model.clientData = {updated_at: '2024-01-02T00:00:00.000Z'};
        model._changed = {title: 'new-title'};

        const updateSync = model.sync({method: 'update'});

        await assert.rejects(async function () {
            await updateSync.update();
        }, function (err) {
            assert.equal(err instanceof errors.UpdateCollisionError, true);
            assert.equal(err.code, 'UPDATE_COLLISION');
            assert.deepEqual(err.errorDetails, {
                changedFields: ['title'],
                clientUpdatedAt: '2024-01-02T00:00:00.000Z',
                serverUpdatedAt: '2024-01-01T00:00:00.000Z'
            });
            return true;
        });

        assert.equal(parentUpdate.calledOnce, true);
    });

    it('falls back to current date when no timestamps are present and no fields changed', async function () {
        const Model = Bookshelf.Model;
        const model = new Model();
        model.tableName = 'posts';
        model.serverData = {};
        model.clientData = {};
        model._changed = {};

        const updateSync = model.sync({method: 'update'});
        const result = await updateSync.update();

        assert.equal(result, 'UPDATED');
    });
});
