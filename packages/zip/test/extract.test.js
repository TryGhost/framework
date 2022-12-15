require('./utils');
const path = require('path');
const {promises: fs} = require('fs');
const {extract} = require('../');
const assert = require('assert');
const fsExtra = require('fs-extra');

describe('Extract', function () {
    let unzipDestination;

    const cleanUp = async () => {
        await fsExtra.remove(unzipDestination);
    };

    async function checkFiles(expectedFiles, relativePath = '') {
        const files = await fs.readdir(path.join(unzipDestination, relativePath), {withFileTypes: true});
        assert.equal(files.length, expectedFiles.length, 'Expected ' + relativePath + ' to have ' + expectedFiles.length + ' files/directories');

        for (const file of expectedFiles) {
            if (typeof file === 'string') {
                assert.ok(files.find(f => f.name === file && f.isFile()), 'Expected ' + relativePath + '/' + file + ' to exist and be a file');
            } else {
                const dirName = Object.keys(file)[0];
                const dir = files.find(f => f.name === dirName && (f.isDirectory() || f.isSymbolicLink()));
                assert.ok(dir, 'Expected ' + relativePath + '/' + dirName + ' to exist and be a directory');

                // Loop through the files in the directory
                await checkFiles(file[dirName], path.join(relativePath, dirName));
            }
        }
    }

    beforeEach(async function () {
        unzipDestination = path.join(__dirname, 'fixtures', 'theme-symlink-unzipped');

        await cleanUp();
    });

    afterEach(async function () {
        await cleanUp();
    });

    it('Supports extracting zip files with UTF8 filenames', async function () {
        // We need to test zip files that are generated with Mac Archive Utility and the zip command line tool (because Mac Archive Utility doesn't set the UTF8 bit)
        const fromCli = path.join(__dirname, 'fixtures', 'cli-zip-utf8-filenames.zip');
        await extract(fromCli, unzipDestination);
        // Rewrite the above method using the checkFiles helper defined at the top
        await checkFiles([
            {
                'mac-zip-utf8': [
                    'Стопкадър-от-филма-Държавни-тайни-на-Малина-Петров.txt'
                ]
            }
        ]);

        await cleanUp();

        const fromArchiveUtility = path.join(__dirname, 'fixtures', 'mac-zip-utf8.zip');
        await extract(fromArchiveUtility, unzipDestination);
        // Rewrite the above method using the checkFiles helper defined at the top
        await checkFiles([
            {
                'mac-zip-utf8': [
                    'Стопкадър-от-филма-Държавни-тайни-на-Малина-Петров.txt'
                ]
            }
        ]);
    });

    it('Supports directories', async function () {
        const fromCli = path.join(__dirname, 'fixtures', 'cats.zip');
        await extract(fromCli, unzipDestination);

        await checkFiles([
            {
                cats: [
                    {
                        empty: []
                    },
                    {
                        orange: ['Cat03.jpg']
                    },
                    'Deema_019.204205705_std.jpg',
                    'deema3.5771930_std.JPG',
                    'gJqEYBs.jpg',
                    'orange_symlink' // adm-zip doesn't support symlinks -> creates a text file instead
                ]
            },
            'a-cat.png'
        ]);
    });
});
