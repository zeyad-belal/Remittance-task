/ * eslint-env node * /
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [
            ['@db', './db'],
            ['@features', './features'],
            ['@security', './security'],
            ['@services', './services'],
            ['@sync', './sync']
          ],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        }
      }
    }
  },
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  
  
],
);
