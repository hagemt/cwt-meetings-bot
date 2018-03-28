const config = require('config')

module.exports = config

if (!module.parent) {
	// eslint-disable-next-line no-console
	console.log(JSON.stringify(config, null, '\t'))
}
