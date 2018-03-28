/* eslint-env node */
module.exports = {

	env: {
		es6: true,
	},

	extends: [
		'eslint:recommended',
	],

	parserOptions: {
		ecmaVersion: 2017,
	},

	root: true,

	rules: {
		'indent': ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		'quotes': ['error', 'single'],
		'semi': ['error', 'never'],
	},

}
