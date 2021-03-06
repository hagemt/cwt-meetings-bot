const PACKAGE_JSON = require('../package.json')

const defaults = {
	logger: {
		level: process.env.LOG_LEVEL || 'info',
		name: PACKAGE_JSON.name || 'mvp',
	},
	process: {
		env: Object.freeze(Object.assign({ NODE_ENV: 'development' }, process.env)),
	},
	server: {
		type: process.env.NODE_ENV || 'development',
		port: Number(process.env.PORT) || 8080,
	},
}

module.exports = defaults
