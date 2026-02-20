const assert = require('node:assert/strict');
const installPlugin = require('..');

describe('@tryghost/bookshelf-order', function () {
    let Bookshelf;
    let ParentModel;

    beforeEach(function () {
        ParentModel = function BaseModel() {};
        ParentModel.extend = function extend(proto) {
            function Child() {}
            Child.prototype = Object.create(ParentModel.prototype);
            Object.assign(Child.prototype, proto);
            Child.prototype.constructor = Child;
            Child.extend = ParentModel.extend;
            return Child;
        };

        Bookshelf = {Model: ParentModel};
        installPlugin(Bookshelf);
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('provides default no-op order hooks', function () {
        const model = new Bookshelf.Model();
        assert.equal(model.orderAttributes(), undefined);
        assert.equal(model.orderRawQuery(), undefined);
    });

    it('parses simple order rules and ignores invalid ones', function () {
        const model = new Bookshelf.Model();
        model.orderAttributes = function () {
            return ['posts.created_at', 'posts.title'];
        };
        model.orderRawQuery = function () {};

        const result = model.parseOrderOption('created_at desc, invalid, title asc', []);

        assert.deepEqual(result, {
            order: {
                'posts.created_at': 'DESC',
                'posts.title': 'ASC'
            },
            orderRaw: '',
            eagerLoad: []
        });
    });

    it('supports repeated order query parameters and count.posts relation', function () {
        const model = new Bookshelf.Model();
        model.orderAttributes = function () {
            return ['posts.created_at'];
        };
        model.orderRawQuery = function () {};

        const result = model.parseOrderOption(['count.posts desc', 'created_at asc'], ['count.posts']);

        assert.deepEqual(result, {
            order: {
                'count.posts': 'DESC',
                'posts.created_at': 'ASC'
            },
            orderRaw: '',
            eagerLoad: []
        });
    });

    it('uses orderRawQuery with eagerLoad and deduplicates eager relations', function () {
        const model = new Bookshelf.Model();
        model.orderAttributes = function () {
            return ['posts.title'];
        };
        model.orderRawQuery = function (field, direction) {
            if (field === 'score') {
                return {
                    orderByRaw: `SCORE ${direction}`,
                    eagerLoad: 'authors'
                };
            }

            if (field === 'rank') {
                return {
                    orderByRaw: `RANK ${direction}`,
                    eagerLoad: 'authors'
                };
            }
        };

        const result = model.parseOrderOption('score asc, rank desc, title asc', []);

        assert.deepEqual(result, {
            order: {
                'posts.title': 'ASC'
            },
            orderRaw: 'SCORE ASC, RANK DESC',
            eagerLoad: ['authors']
        });
    });

    it('ignores unknown order attributes and raw queries without eagerLoad', function () {
        const model = new Bookshelf.Model();
        model.orderAttributes = function () {
            return ['posts.title'];
        };
        model.orderRawQuery = function (field, direction) {
            if (field === 'custom') {
                return {
                    orderByRaw: `CUSTOM ${direction}`
                };
            }
        };

        const result = model.parseOrderOption('unknown desc, custom asc', []);

        assert.deepEqual(result, {
            order: {},
            orderRaw: 'CUSTOM ASC',
            eagerLoad: []
        });
    });
});
