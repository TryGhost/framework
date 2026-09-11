const assert = require('assert/strict');
const security = require('../');

describe('Lib: Security - String', function () {
    describe('Safe String', function () {
        const options = {};

        it('should remove beginning and ending whitespace', function () {
            const result = security.string.safe(' stringwithspace ', options);
            assert.equal(result, 'stringwithspace');
        });

        it('can handle null strings', function () {
            const result = security.string.safe(null);
            assert.equal(result, '');
        });

        it('should remove non-letter characters', function () {
            const result = security.string.safe('howtowin✓', options);
            assert.equal(result, 'howtowin');
        });

        it('should replace spaces with dashes', function () {
            const result = security.string.safe('how to win', options);
            assert.equal(result, 'how-to-win');
        });

        it('should replace most special characters with dashes', function () {
            const result = security.string.safe(
                'a:b/c?d#e[f]g!h$i&j(k)l*m+n,o;{p}=q\\r%s<t>u|v^w~x£y"z@1.2`3',
                options,
            );
            assert.equal(result, 'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t-u-v-w-x-y-z-1-2-3');
        });

        it('should replace all of the html4 compat symbols in ascii except hyphen and underscore', function () {
            // note: This is missing the soft-hyphen char that isn't much-liked by linters/browsers/etc,
            // it passed the test before it was removed
            const result = security.string.safe(
                '!"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²_³´µ¶·¸¹º»¼½¾¿',
            );
            assert.equal(result, 'a-2_3u-1o-1-41-23-4');
        });

        it('should replace all of the foreign chars in ascii', function () {
            const result = security.string.safe(
                'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
            );
            assert.equal(
                result,
                'aaaaaaae-ceeeeiiiidnooooo-ouuuuythssaaaaaaaeceeeeiiiidnooooo-ouuuuythy',
            );
        });

        it('should remove special characters at the beginning of a string', function () {
            const result = security.string.safe('.Not special', options);
            assert.equal(result, 'not-special');
        });

        it('should remove apostrophes ', function () {
            const result = security.string.safe("how we shouldn't be", options);
            assert.equal(result, 'how-we-shouldnt-be');
        });

        it('should convert to lowercase', function () {
            const result = security.string.safe('This has Upper Case', options);
            assert.equal(result, 'this-has-upper-case');
        });

        it('should convert multiple dashes into a single dash', function () {
            const result = security.string.safe('This :) means everything', options);
            assert.equal(result, 'this-means-everything');
        });

        it('should remove trailing dashes from the result', function () {
            const result = security.string.safe('This.', options);
            assert.equal(result, 'this');
        });

        it('should handle pound signs', function () {
            const result = security.string.safe('WHOOPS! I spent all my £ again!', options);
            assert.equal(result, 'whoops-i-spent-all-my-again');
        });

        it('should properly handle unicode punctuation conversion', function () {
            // note: the previous unidecode transformation handled this differently than anyascii, so this is
            // a compromise that's "good enough" and gives the most optimal results for most languages
            // result using unidecode was: nijian-wei-iganaika-zai-du-que-ren-sitekudasai-zai-du-miip-misitekudasai
            const result = security.string.safe(
                'に間違いがないか、再度確認してください。再読み込みしてください。',
                options,
            );
            assert.equal(
                result,
                'ni-jian-weiiganaika-zai-du-que-renshitekudasai-zai-dumi-yumishitekudasai',
            );
        });

        it('should not transliterate the slugs if the unicodeSlugs flag is passed', function () {
            let result = security.string.safe('Ett smörgåsbord från Sydkorea: 스뫼르고스보르드', {
                unicodeSlugs: true,
            });
            assert.equal(result, 'ett-smörgåsbord-från-sydkorea-스뫼르고스보르드');
        });

        it('should not replace existing dashes and underscores when the slugSeparator is set to spaces', function () {
            let result = security.string.safe('Herr./Klaus-Jürgen_44', {
                slugSeparator: ' ',
            });
            assert.equal(result, 'herr klaus-jurgen_44');
        });

        it('should not lose or convert dashes if options are passed with truthy importing flag', function () {
            let result = security.string.safe('-slug-with-starting-ending-and---multiple-dashes-', {
                importing: true,
            });
            assert.equal(result, '-slug-with-starting-ending-and---multiple-dashes-');
        });

        it('should still remove/convert invalid characters when passed options with truthy importing flag', function () {
            let result = security.string.safe("-slug-&with-✓-invalid-characters-に'", {
                importing: true,
            });
            assert.equal(result, '-slug--with---invalid-characters-ni');
        });
    });
});
