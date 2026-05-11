/**
 * Production path-alias resolver.
 *
 * nest build uses tsc (not webpack), so compiled files in dist/ still contain
 * require('@common/...') / require('@modules/...') calls that Node.js cannot
 * resolve on its own. Loading this file with -r before dist/main.js teaches
 * the Node.js module resolver where each alias lives.
 *
 * Used by: docker-entrypoint.sh
 */
const { register } = require('tsconfig-paths');

register({
  // Aliases are resolved relative to the dist/ directory at runtime.
  baseUrl: __dirname + '/dist',
  paths: {
    '@/*':        ['*'],
    '@common/*':  ['common/*'],
    '@config/*':  ['config/*'],
    '@database/*':['database/*'],
    '@modules/*': ['modules/*'],
  },
});
