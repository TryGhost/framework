#!/usr/bin/env node
/**
 * Version and tag only the packages that actually changed.
 *
 * `nx release version <bump>` applies the bump to every project in scope,
 * unconditionally — handing it an explicit specifier disables change
 * detection entirely. That published all 43 packages on every ship, even
 * when two had changed.
 *
 * `nx affected` is not a substitute: nx treats any pnpm-lock.yaml change as
 * invalidating the whole graph, and renovate touches the lockfile on every
 * dependency PR, so the affected set is always all 43.
 *
 * Instead, compare each package against the git tag for its own current
 * version. A package is released when its own files changed since it was
 * last published, or when it has no tag yet. Dependents are pulled in by
 * nx's own `updateDependents: "auto"`, so they are not computed here.
 *
 * Usage:
 *   node scripts/ship.mjs patch          # version + tag changed packages
 *   node scripts/ship.mjs --list         # print what would be released
 *   SHIP_ALL=1 node scripts/ship.mjs patch   # force every package
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tagExists = (tag) =>
    spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).status === 0;

const hasChangesSince = (tag, dir) =>
    spawnSync('git', ['diff', '--quiet', tag, 'HEAD', '--', dir]).status !== 0;

function releasablePackages() {
    const released = [];
    const skipped = [];

    for (const entry of readdirSync('packages', { withFileTypes: true }).sort()) {
        if (!entry.isDirectory()) continue;

        const dir = join('packages', entry.name);
        let pkg;
        try {
            pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        } catch {
            continue;
        }
        if (pkg.private) continue;

        const tag = `${pkg.name}@${pkg.version}`;
        if (!tagExists(tag)) {
            released.push({ name: pkg.name, reason: `no tag ${tag}` });
        } else if (hasChangesSince(tag, dir)) {
            released.push({ name: pkg.name, reason: `changed since ${tag}` });
        } else {
            skipped.push(pkg.name);
        }
    }

    return { released, skipped };
}

function main() {
    const args = process.argv.slice(2);
    const listOnly = args.includes('--list');
    const nxArgs = args.filter((a) => a !== '--list');

    if (process.env.SHIP_ALL) {
        console.log('SHIP_ALL set — releasing every package.');
        if (listOnly) return;
        return runNx(nxArgs, null);
    }

    const { released, skipped } = releasablePackages();

    for (const { name, reason } of released) {
        console.log(`release  ${name}  (${reason})`);
    }
    console.log(`\n${released.length} to release, ${skipped.length} unchanged.`);

    if (released.length === 0) {
        console.log('Nothing changed since the last release. Skipping.');
        return;
    }
    if (listOnly) return;

    runNx(nxArgs, released.map((p) => p.name).join(','));
}

function runNx(nxArgs, projects) {
    const remote = process.env.GHOST_UPSTREAM || 'origin';
    const argv = ['nx', 'release', 'version', ...nxArgs, '--git-push', '--git-remote', remote];
    if (projects) argv.push(`--projects=${projects}`);

    console.log(`\n> npx ${argv.join(' ')}\n`);
    const result = spawnSync('npx', argv, { stdio: 'inherit' });
    process.exit(result.status ?? 1);
}

main();
