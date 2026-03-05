import assert from 'assert/strict';
import {string} from '../src/index.js';

describe('Lib: Security - String', function () {
    describe('Safe String', function () {
        const options = {};

        it('should remove beginning and ending whitespace', function () {
            const result = string.safe(' stringwithspace ', options);
            assert.equal(result, 'stringwithspace');
        });

        it('can handle null strings', function () {
            const result = string.safe(null as unknown as string);
            assert.equal(result, '');
        });

        it('should remove non ascii characters', function () {
            const result = string.safe('howtowin\u2713', options);
            assert.equal(result, 'howtowin');
        });

        it('should replace spaces with dashes', function () {
            const result = string.safe('how to win', options);
            assert.equal(result, 'how-to-win');
        });

        it('should replace most special characters with dashes', function () {
            const result = string.safe('a:b/c?d#e[f]g!h$i&j(k)l*m+n,o;{p}=q\\r%s<t>u|v^w~x\u00a3y"z@1.2`3', options);
            assert.equal(result, 'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t-u-v-w-x-y-z-1-2-3');
        });

        it('should replace all of the html4 compat symbols in ascii except hyphen and underscore', function () {
            // note: This is missing the soft-hyphen char that isn't much-liked by linters/browsers/etc,
            // it passed the test before it was removed
            const result = string.safe('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~\u00a1\u00a2\u00a3\u00a4\u00a5\u00a6\u00a7\u00a8\u00a9\u00aa\u00ab\u00ac\u00ae\u00af\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b8\u00b9\u00ba\u00bb\u00bc\u00bd\u00be\u00bf');
            assert.equal(result, '_-c-y-ss-c-a-r-deg-23up-1o-1-41-23-4');
        });

        it('should replace all of the foreign chars in ascii', function () {
            const result = string.safe('\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00df\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff');
            assert.equal(result, 'aaaaaaaeceeeeiiiidnoooooxouuuuythssaaaaaaaeceeeeiiiidnooooo-ouuuuythy');
        });

        it('should remove special characters at the beginning of a string', function () {
            const result = string.safe('.Not special', options);
            assert.equal(result, 'not-special');
        });

        it('should remove apostrophes ', function () {
            const result = string.safe('how we shouldn\'t be', options);
            assert.equal(result, 'how-we-shouldnt-be');
        });

        it('should convert to lowercase', function () {
            const result = string.safe('This has Upper Case', options);
            assert.equal(result, 'this-has-upper-case');
        });

        it('should convert multiple dashes into a single dash', function () {
            const result = string.safe('This :) means everything', options);
            assert.equal(result, 'this-means-everything');
        });

        it('should remove trailing dashes from the result', function () {
            const result = string.safe('This.', options);
            assert.equal(result, 'this');
        });

        it('should handle pound signs', function () {
            const result = string.safe('WHOOPS! I spent all my \u00a3 again!', options);
            assert.equal(result, 'whoops-i-spent-all-my-again');
        });

        it('should properly handle unicode punctuation conversion', function () {
            const result = string.safe('\u306b\u9593\u9055\u3044\u304c\u306a\u3044\u304b\u3001\u518d\u5ea6\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002', options);
            assert.equal(result, 'nijian-wei-iganaika-zai-du-que-ren-sitekudasai-zai-du-miip-misitekudasai');
        });

        it('should not lose or convert dashes if options are passed with truthy importing flag', function () {
            let result = string.safe('-slug-with-starting-ending-and---multiple-dashes-', {importing: true});
            assert.equal(result, '-slug-with-starting-ending-and---multiple-dashes-');
        });

        it('should still remove/convert invalid characters when passed options with truthy importing flag', function () {
            let result = string.safe('-slug-&with-\u2713-invalid-characters-\u306b\'', {importing: true});
            assert.equal(result, '-slug--with--invalid-characters-ni');
        });
    });
});
