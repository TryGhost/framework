#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {spawnSync} = require('child_process');

const RULES = {
    noNativeError: {
        key: 'no-native-error',
        aliases: [
            'ghost/ghost-custom/no-native-error',
            'custom/no-native-error',
            'no-native-error'
        ]
    },
    ghostErrorUsage: {
        key: 'ghost-error-usage',
        aliases: [
            'ghost/ghost-custom/ghost-error-usage',
            'custom/ghost-error-usage',
            'ghost-error-usage'
        ]
    },
    nodeAssertStrict: {
        key: 'node-assert-strict',
        aliases: [
            'ghost/ghost-custom/node-assert-strict',
            'custom/node-assert-strict',
            'node-assert-strict'
        ]
    }
};

const ALL_RULE_KEYS = Object.keys(RULES);

function runGitLsFiles() {
    const result = spawnSync('git', ['ls-files', 'packages'], {encoding: 'utf8'});
    if (result.status !== 0) {
        console.error(result.stderr || 'Failed to list files with git ls-files.');
        process.exit(result.status || 1);
    }

    return result.stdout
        .split('\n')
        .map(file => file.trim())
        .filter(Boolean)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
}

function shouldIgnoreFile(file) {
    return (
        file.includes('/node_modules/') ||
        file.includes('/build/') ||
        file.includes('/coverage/') ||
        file.includes('/cjs/') ||
        file.includes('/es/') ||
        file.includes('/types/') ||
        file.includes('/test/fixtures/') ||
        file.endsWith('.d.ts')
    );
}

function isTestFile(file) {
    return file.includes('/test/') || /\.test\.[jt]s$/.test(file);
}

function findRuleKeysInDirective(line) {
    const matchedRuleKeys = [];

    for (const ruleKey of ALL_RULE_KEYS) {
        if (RULES[ruleKey].aliases.some(alias => line.includes(alias))) {
            matchedRuleKeys.push(ruleKey);
        }
    }

    if (matchedRuleKeys.length > 0) {
        return matchedRuleKeys;
    }

    // Generic "eslint-disable" without specific rules should disable all custom checks.
    if (line.includes('eslint-disable') || line.includes('lint-custom-disable')) {
        return ALL_RULE_KEYS.slice();
    }

    return [];
}

function buildDisableMap(lines) {
    const fileDisabled = {};
    const lineDisabled = {};

    for (const ruleKey of ALL_RULE_KEYS) {
        fileDisabled[ruleKey] = false;
        lineDisabled[ruleKey] = new Set();
    }

    lines.forEach((line, index) => {
        if (!line.includes('disable')) {
            return;
        }

        const rules = findRuleKeysInDirective(line);
        if (rules.length === 0) {
            return;
        }

        const isNextLineDirective = line.includes('eslint-disable-next-line') || line.includes('lint-custom-disable-next-line');
        const isLineDirective = line.includes('eslint-disable-line') || line.includes('lint-custom-disable-line');

        for (const ruleKey of rules) {
            if (isNextLineDirective) {
                lineDisabled[ruleKey].add(index + 2);
            } else if (isLineDirective) {
                lineDisabled[ruleKey].add(index + 1);
            } else if (line.includes('eslint-disable') || line.includes('lint-custom-disable')) {
                fileDisabled[ruleKey] = true;
            }
        }
    });

    return {fileDisabled, lineDisabled};
}

function isRuleDisabled(ruleKey, lineNumber, disables) {
    return disables.fileDisabled[ruleKey] || disables.lineDisabled[ruleKey].has(lineNumber);
}

function firstMeaningfulCharAfterOpenParen(lines, startLine, afterOpenParen) {
    const immediate = afterOpenParen.trim();
    if (immediate.length > 0) {
        return immediate[0];
    }

    for (let i = startLine; i < lines.length; i += 1) {
        const trimmed = lines[i].trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
        }
        return trimmed[0];
    }

    return '';
}

function addIssue(issues, file, lineNumber, rule, message) {
    issues.push({file, lineNumber, rule, message});
}

function checkFile(file, issues) {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    const disables = buildDisableMap(lines);
    const testFile = isTestFile(file);
    const jsSourceFile = file.endsWith('.js') && !testFile;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();

        // Skip pure comment lines for line-based pattern checks.
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return;
        }

        if (jsSourceFile) {
            if (!isRuleDisabled('noNativeError', lineNumber, disables)) {
                const hasNewError = /\bnew\s+Error\s*\(/.test(line);
                if (hasNewError) {
                    addIssue(
                        issues,
                        file,
                        lineNumber,
                        RULES.noNativeError.key,
                        'Use @tryghost/errors instead of new Error().'
                    );
                }
            }

            if (!isRuleDisabled('ghostErrorUsage', lineNumber, disables)) {
                const patterns = [
                    /\bnew\s+errors\.[A-Za-z_$][\w$]*\s*\((.*)$/g,
                    /\bnew\s+([A-Z][a-zA-Z]+Error)\s*\((.*)$/g
                ];

                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(line)) !== null) {
                        const className = match[1];
                        if (typeof className === 'string' && !className.endsWith('Error')) {
                            continue;
                        }

                        const argFirstChar = firstMeaningfulCharAfterOpenParen(lines, index + 1, match[2] || '');
                        if (argFirstChar !== '' && argFirstChar !== '{') {
                            addIssue(
                                issues,
                                file,
                                lineNumber,
                                RULES.ghostErrorUsage.key,
                                'Error constructors should receive an object argument.'
                            );
                        }
                    }
                }
            }
        }

        if (testFile && !isRuleDisabled('nodeAssertStrict', lineNumber, disables)) {
            const importAssert = /^\s*import\s+.+\s+from\s+['"]assert['"]/.test(line) || /^\s*import\s+['"]assert['"]/.test(line);
            const requireAssert = /\b(?:const|let|var)\s+[^=]+=\s*require\(\s*['"]assert['"]\s*\)/.test(line);
            const strictMethod = /\bassert\.(strictEqual|deepStrictEqual|notStrictEqual|notDeepStrictEqual)\s*\(/.test(line);

            if (importAssert || requireAssert) {
                addIssue(
                    issues,
                    file,
                    lineNumber,
                    RULES.nodeAssertStrict.key,
                    'Use assert/strict (or node:assert/strict) instead of assert.'
                );
            }

            if (strictMethod) {
                addIssue(
                    issues,
                    file,
                    lineNumber,
                    RULES.nodeAssertStrict.key,
                    'When using assert/strict, avoid strict* methods (use equal/deepEqual variants).'
                );
            }
        }
    });
}

function main() {
    const files = runGitLsFiles().filter(file => !shouldIgnoreFile(file));
    const issues = [];

    for (const file of files) {
        checkFile(file, issues);
    }

    issues.sort((a, b) => {
        if (a.file !== b.file) {
            return a.file.localeCompare(b.file);
        }
        return a.lineNumber - b.lineNumber;
    });

    if (issues.length === 0) {
        console.log('Custom lint checks passed.');
        process.exit(0);
    }

    for (const issue of issues) {
        console.error(`${issue.file}:${issue.lineNumber} [${issue.rule}] ${issue.message}`);
    }

    console.error(`\nCustom lint checks failed with ${issues.length} issue(s).`);
    process.exit(1);
}

main();
