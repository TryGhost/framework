# Example App

This lives here, rather than in test fixtures, because if it lives inside of /test then we can't check coverage reports!
We are using this to check that the express-test framework works as expected & checking coverage helps with that.

This folder is NOT included in the package.json files array, and therefore should not be included in the package.
Therefore express & express-session can be dev dependencies. They're not used inside of /lib.
