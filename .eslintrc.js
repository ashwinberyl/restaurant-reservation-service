module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 'latest',
    },
    rules: {
        'no-console': 'off',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
};
