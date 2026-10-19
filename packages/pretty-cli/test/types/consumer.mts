import cli from '../../index.js';
import ui from '../../lib/ui.js';
import styles from '../../lib/styles.js';
import implementation from '../../lib/pretty-cli.js';

const fresh: cli.Api = cli.Api.get({ name: 'gx' });
fresh.help('-h, --help').style(cli.styles).preface('Ghost Dev Tools').strict();
fresh.command({
    flags: 'generate',
    setup(group) {
        group.command({
            flags: 'package <name>',
            setup(command) {
                command.string('--description', { defaultValue: 'Example' });
            },
            async run(argv, context) {
                if (typeof argv.name === 'string') {
                    cli.ui.log.info(argv.name);
                } else {
                    context.cliMessage('Expected a package name');
                }
            }
        });
    }
});
fresh.string({ aliases: 'name' });
fresh.command({ aliases: 'run', run() {} });
fresh.version('--version', { version: () => '1.0.0' });
const deferredVersion: cli.Context['versionRequested'] = { version: () => '1.0.0' };
cli.ui.log(deferredVersion);
const result: cli.ParseResult = await fresh.parse(['--help']);
const code: number = result.code;
const output: string = result.output;
const args: cli.Args = await fresh.parseAndExit([]);
const styled: string = styles.flags(output);
ui.log('Result', code, styled, args);
implementation.ui.log.ok('Done');

// Catch accidental erosion of the declaration boundary to untyped results.
type Assert<T extends true> = T;
export type Checks = [
    Assert<ReturnType<typeof fresh.parse> extends Promise<cli.ParseResult> ? true : false>,
    Assert<cli.Args['name'] extends string ? false : true>,
    Assert<boolean extends cli.Flags ? false : true>
];

// These sywac forms must work for both ESM and CommonJS consumers.
fresh.positional({'<name>': {desc: 'Name', required: true}}).help();
fresh.positional([{flags: '<name>', desc: 'Name'}, '[destination]']).help();
fresh.positional({params: {'<name>': {desc: 'Name'}}}).help();
fresh.commandDirectory('commands', {extensions: ['.cjs']}).help();
fresh.commandDirectory({extensions: ['.cjs']}).help();
fresh.commandDirectory().help();

// @ts-expect-error Positional map entries must use typed option values.
fresh.positional({'<name>': {required: 'yes'}});
// @ts-expect-error Positional array entries must use typed option values.
fresh.positional([{flags: '<name>', required: 'yes'}]);
// @ts-expect-error Directory extensions must be an array of strings.
fresh.commandDirectory({extensions: '.cjs'});
