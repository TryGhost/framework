const path = require('path');
const semver = require('semver');
const rootUtils = require('@tryghost/root-utils');
const packageInfo = require(path.join(rootUtils.getProcessRoot(), 'package.json'));
const version = packageInfo.version;
const plainVersion = version.match(/^(\d+\.)?(\d+\.)?(\d+)/)[0];
const prereleaseParts = semver.prerelease(version);
const prereleaseVersion = prereleaseParts ? `${plainVersion}-${prereleaseParts.join('.')}` : plainVersion;

// major.minor
module.exports.safe = version.match(/^(\d+\.)?(\d+)/)[0];

// major.minor.patch-{prerelease}
module.exports.full = prereleaseParts ? prereleaseVersion : plainVersion;

// original string in package.json (can contain pre-release and build suffix)
module.exports.original = version;
