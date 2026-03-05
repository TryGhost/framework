import Api from 'sywac/api';
import styles from './styles.js';
import {log} from './ui.js';

/**
 * Pretty CLI
 *
 * A mini-module to style a sywac instance in a standard way
 */

// Exports a pre-configured version of sywac
const prettyCLI = Api.get()
// Use help & version with short forms AND
// group them into a Global Options group to keep them separate from per-command options
    .help('-h, --help', {group: 'Global Options:'})
    .version('-v, --version', {group: 'Global Options:'})
    // Load our style rules
    .style(styles)
    // Add some padding at the end
    .epilogue(' ')
    // If no command is passed, output the help menu
    .showHelpByDefault();

export default prettyCLI;

// Expose a clean version, just in case
export {Api};

// Export the styles
export {styles};

// Export our ui tools
export const ui = {log};
