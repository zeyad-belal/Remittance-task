module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@db': './db',
            '@features': './features',
            '@security': './security',
            '@services': './services',
            '@sync': './sync',
          },
        },
      ],
    ],
    env: { production: { plugins: ['transform-remove-console'] } },
  };
};
