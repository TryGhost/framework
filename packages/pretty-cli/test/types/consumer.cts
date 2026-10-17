import cli = require('../../index.js');
import ui = require('../../lib/ui');
import styles = require('../../lib/styles');

const api: cli.Api = new cli.Api({ name: 'test', strictMode: true });
api.positional('<command>', { hidden: true })
    .boolean('--force', { defaultValue: false })
    .string(['--name', '-n'])
    .number('--count', { defaultValue: 1 })
    .option('--custom', { type: 'string' })
    .enumeration('--mode', { choices: ['a', 'b'] })
    .path('--path').file('--file').dir('--dir')
    .array('--values', { type: 'string' })
    .stringArray('--names').numberArray('--counts')
    .version('-v, --version', { version: '1.0.0' })
    .command('run', async (argv, context) => {
        if (typeof argv.count === 'number') {
            ui.log.info(argv.count);
        }
        context.deferHelp();
    })
    .check((argv, context) => {
        if (argv.force === false) {
            context.cliMessage('Confirmation required');
        }
    })
    .usage({ prefix: 'Usage:', commandPlaceholder: '<command>' })
    .groupOrder(['Commands:', 'Options:'])
    .example('test run', { desc: 'Run a command' })
    .exampleOrder(['Examples:'])
    .outputSettings({ maxWidth: 80 }).showHelpByDefault().epilogue('Done');

const help: string = api.getHelp();
const label: string = styles.group(help);
cli.ui.log(label);
