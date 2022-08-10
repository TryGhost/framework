const _debug = require('@tryghost/debug')._base;
const debug = _debug('ghost-query');
const _ = require('lodash');

/**
 * @param {import('bookshelf')} Bookshelf
 */
module.exports = function (Bookshelf) {
    const modelProto = Bookshelf.Model.prototype;
    const countQueryBuilder = {
        /**
         * Ideally, these configs should exist on the model and be much more dynamic
         * In reality, there's no point fixing this
         */
        tags: {
            posts: function addPostCountToTags(model, options) {
                model.query('columns', 'tags.*', function (qb) {
                    qb.count('posts.id')
                        .from('posts')
                        .leftOuterJoin('posts_tags', 'posts.id', 'posts_tags.post_id')
                        .whereRaw('posts_tags.tag_id = tags.id')
                        .as('count__posts');

                    if (options.context && options.context.public) {
                        // @TODO use the filter behavior for posts
                        qb.andWhere('posts.type', '=', 'post');
                        qb.andWhere('posts.status', '=', 'published');
                    }
                });
            }
        },
        labels: {
            members: function addMemberCountToLabels(model) {
                model.query('columns', 'labels.*', function (qb) {
                    qb.count('members.id')
                        .from('members')
                        .leftOuterJoin('members_labels', 'members.id', 'members_labels.member_id')
                        .whereRaw('members_labels.label_id = labels.id')
                        .as('count__members');
                });
            }
        },
        users: {
            posts: function addPostCountToUsers(model, options) {
                model.query('columns', 'users.*', function (qb) {
                    qb.count('posts.id')
                        .from('posts')
                        .join('posts_authors', 'posts.id', 'posts_authors.post_id')
                        .whereRaw('posts_authors.author_id = users.id')
                        .as('count__posts');

                    if (options.context && options.context.public) {
                        // @TODO use the filter behavior for posts
                        qb.andWhere('posts.type', '=', 'post');
                        qb.andWhere('posts.status', '=', 'published');
                    }
                });
            }
        },
        comments: {
            replies: function addReplyCountToComments(model) {
                model.query('columns', 'comments.*', function (qb) {
                    qb.count('replies.id')
                        .from('comments AS replies')
                        .whereRaw('replies.parent_id = comments.id')
                        .as('count__replies');
                });
            },
            likes: function addLikesCountToComments(model) {
                model.query('columns', 'comments.*', function (qb) {
                    qb.count('comment_likes.id')
                        .from('comment_likes')
                        .whereRaw('comment_likes.comment_id = comments.id')
                        .as('count__likes');
                });
            },
            liked: function addLikedCountToComments(model, options) {
                model.query('columns', 'comments.*', function (qb) {
                    if (options.context && options.context.member && options.context.member.id) {
                        qb.count('comment_likes.id')
                            .from('comment_likes')
                            .whereRaw('comment_likes.comment_id = comments.id')
                            .where('comment_likes.member_id', options.context.member.id)
                            .as('count__liked');
                        return;
                    }

                    // Return zero
                    qb.select(Bookshelf.knex.raw('0')).as('count__liked');
                });
            }
        },
        /* Speculative */
        channels: {
            posts: function addPostCountToChannels(model, options) {
                model.query('columns', 'channels.*', function (qb) {
                    qb.count('posts.id')
                        .from('posts')
                        .leftOuterJoin('posts_channels', 'posts.id', 'posts_channels.post_id')
                        .whereRaw('posts_channels.channel_id = channels.id')
                        .as('count__posts');

                    if (options.context && options.context.public) {
                        // @TODO use the filter behavior for posts
                        qb.andWhere('posts.type', '=', 'post');
                        qb.andWhere('posts.status', '=', 'published');
                    }
                });
            }
        },
        newsletters: {
            posts: function addPostCountToNewsletters(model) {
                model.query('columns', 'newsletters.*', function (qb) {
                    qb.count('posts.id')
                        .from('posts')
                        .whereRaw('posts.newsletter_id = newsletters.id')
                        .as('count__posts');
                });
            },
            members: function addMemberCountToNewsletters(model) {
                model.query('columns', 'newsletters.*', function (qb) {
                    qb.count('members_newsletters.id')
                        .from('members_newsletters')
                        .whereRaw('members_newsletters.newsletter_id = newsletters.id')
                        .as('count__members');
                });
            }
        }
    };

    const addCounts = function (options) {
        if (!options) {
            return;
        }

        const tableName = _.result(this, 'tableName');

        // withRelated can be an object or an array of strings. We need to support handling both representations.
        // ['user', 'replies']
        // OR
        // [
        //    {'user': function() {} }
        // ]

        function hasKey(key) {
            if (!options.withRelated) {
                return;
            }
            if (options.withRelated.indexOf(key) > -1) {
                return true;
            }
            for (const item of options.withRelated) {
                if (typeof item !== 'string') {
                    if (item[key] !== undefined) {
                        return true;
                    }
                }
            }
            return false;
        }
        function removeKey(key) {
            // VERY IMPORTANT HERE:
            // We need to keep the reference to the withRelated array and not create a new array
            // This is required to make eager relations work correctly (otherwise the updated withRelated won't get passed further)
            const newItems = options.withRelated.filter((item) => {
                if (typeof item === 'string') {
                    return item !== key;
                }
                return item[key] === undefined;
            });
            options.withRelated.splice(0, options.withRelated.length, ...newItems);
        }

        // Normalize withRelated
        if (hasKey('count.posts')) {
            // remove post_count from withRelated
            removeKey('count.posts');

            // Call the query builder
            countQueryBuilder[tableName].posts(this, options);
        }
        if (hasKey('count.members')) {
            // remove post_count from withRelated
            removeKey('count.members');

            // Call the query builder
            countQueryBuilder[tableName].members(this, options);
        }
        if (hasKey('count.replies')) {
            // remove post_count from withRelated
            removeKey('count.replies');

            // Call the query builder
            countQueryBuilder[tableName].replies(this, options);
        }
        if (hasKey('count.likes')) {
            // remove post_count from withRelated
            removeKey('count.likes');

            // Call the query builder
            countQueryBuilder[tableName].likes(this, options);
        }
        if (hasKey('count.liked')) {
            // remove post_count from withRelated
            removeKey('count.liked');

            // Call the query builder
            countQueryBuilder[tableName].liked(this, options);
        }
    };

    const Model = Bookshelf.Model.extend({
        addCounts,
        serialize: function serialize(options) {
            const attrs = modelProto.serialize.call(this, options);
            const countRegex = /^(count)(__)(.*)$/;

            _.forOwn(attrs, function (value, key) {
                const match = key.match(countRegex);
                if (match) {
                    attrs[match[1]] = attrs[match[1]] || {};
                    attrs[match[1]][match[3]] = value;
                    delete attrs[key];
                }
            });

            return attrs;
        },

        /**
         * Instead of adding the counts in .fetch and .fetchAll,
         * we need to do it in sync because Bookshelf doesn't call fetch for eagerRelations
         * E.g. when trying to load counts on replies.count.likes, we wouldn't get an opportunity to load the counts on the replies relation.
         */
        sync: function (options) {
            if (!options.method || (options.method !== 'insert' && options.method !== 'update')) {
                this.addCounts.apply(this, arguments);
            }

            if (_debug.enabled('ghost-query')) {
                debug('QUERY', this.query().toQuery());
            }

            // Call parent fetchAll
            return modelProto.sync.apply(this, arguments);
        },

        // Warning: Make sure this method always returns a Bluebird Promise (modelProto.save.apply does, so returning that is fine)
        save: function save() {
            // the count__ variables are not 'permitted' and will get removed after a save
            // so this will make sure they are kept alive after a save (unless they are also still available after the save)

            const savedAttributes = {};
            const countRegex = /^(count)(__)(.*)$/;

            for (const key of Object.keys(this.attributes)) {
                const match = key.match(countRegex);
                if (match) {
                    savedAttributes[key] = this.attributes[key];
                }
            }
            
            return modelProto.save.apply(this, arguments).then((t) => {
                // Set savedAttributes, but keep count__ variables if they stayed inside this.attributes
                if (savedAttributes) {
                    Object.assign(this.attributes, savedAttributes, this.attributes);
                }
                return t;
            });
        }
    });

    Bookshelf.Model = Model;

    const collectionProto = Bookshelf.Collection.prototype;

    const Collection = Bookshelf.Collection.extend({
        addCounts,
        sync: function () {
            // For now, only apply this for eager loaded collections
            this.addCounts.apply(this, arguments);

            if (_debug.enabled('ghost-query')) {
                debug('QUERY', this.query().toQuery());
            }

            // Call parent fetchAll
            return collectionProto.sync.apply(this, arguments);
        }
    });

    Bookshelf.Collection = Collection;
};
