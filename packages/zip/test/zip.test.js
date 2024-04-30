// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const path = require('path');
const fs = require('fs-extra');
const {hashElement} = require('folder-hash');

// Mimic how we expect this to be required
const {compress, extract} = require('../');

describe('Compress and Extract should be opposite functions', function () {
    let symlinkPath, themeFolder, zipDestination, unzipDestination;

    const cleanUp = () => {
        fs.removeSync(symlinkPath);
        fs.removeSync(zipDestination);
        fs.removeSync(unzipDestination);
    };

    before(function () {
        symlinkPath = path.join(__dirname, 'fixtures', 'theme-symlink');
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');

        cleanUp();
    });

    after(function () {
        cleanUp();
    });

    it('ensure symlinks work', function (done) {
        fs.symlinkSync(themeFolder, symlinkPath);

        let originalHash;

        hashElement(symlinkPath)
            .then((_originalHash) => {
                originalHash = _originalHash;
                return compress(symlinkPath, zipDestination);
            })
            .then((res) => {
                res.should.be.an.Object().with.properties('path', 'size');
                res.path.should.eql(zipDestination);
                res.size.should.be.below(619618);

                return extract(zipDestination, unzipDestination);
            })
            .then((res) => {
                res.should.be.an.Object().with.properties('path');
                res.path.should.eql(unzipDestination);

                return hashElement(unzipDestination);
            })
            .then((extractedHash) => {
                originalHash.children.toString().should.eql(extractedHash.children.toString());

                done();
            })
            .catch((err) => {
                return done(err);
            });
    });
});

describe('Extract zip', function () {
    let themeFolder, zipDestination, unzipDestination, symLinkPath, longFilePath;

    before(function () {
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');
        symLinkPath = path.join(__dirname, 'fixtures', 'test-theme-symlink');
    });

    afterEach(function () {
        if (fs.existsSync(zipDestination)) {
            fs.removeSync(zipDestination);
        }

        if (fs.existsSync(unzipDestination)) {
            fs.removeSync(unzipDestination);
        }

        if (fs.existsSync(symLinkPath)) {
            fs.removeSync(symLinkPath);
        }

        if (fs.existsSync(longFilePath)) {
            fs.removeSync(longFilePath);
        }
    });

    it('extracts a zip file', async function () {
        await compress(themeFolder, zipDestination);

        await extract(zipDestination, unzipDestination);

        fs.existsSync(unzipDestination).should.be.true();
        fs.existsSync(path.join(unzipDestination, 'package.json')).should.be.true();
    });

    it('throws if the zip contains a filename with 254 or more bytes', async function () {
        const longFileName = 'a'.repeat(250) + '.txt'; // 254 bytes
        longFilePath = path.join(themeFolder, longFileName);

        fs.writeFileSync(longFilePath, 'test content');

        await compress(themeFolder, zipDestination);
        await extract(zipDestination, unzipDestination).should.be.rejectedWith('File names in the zip folder must be shorter than 254 characters.');
    });
});
