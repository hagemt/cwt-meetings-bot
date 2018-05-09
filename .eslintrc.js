/* eslint-env node */
module.exports = {

	env: {
		es6: true,
	},

	extends: [
		'eslint:recommended',
		'plugin:import/recommended',
	],

	parserOptions: {
		ecmaVersion: 2017,
	},

	plugins: [
		'import',
	],

	root: true,

	rules: {
		'comma-dangle': ['error', 'always-multiline'],
		'import/unambiguous': 'off',
		'indent': ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		'quotes': ['error', 'single'],
		'semi': ['error', 'never'],
	},

}
