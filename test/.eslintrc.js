module.exports = {

	extends: [
		'plugin:mocha/recommended',
		'plugin:node/recommended',
	],

	env: {
		mocha: true,
		node: true,
	},

	plugins: [
		'mocha',
		'node',
	],

}
