const path = require('path')

const Bunyan = require('bunyan')
const config = require('config')
const _ = require('lodash')

const createRootLogger = _.once(() => {
	const logSerializers = {}
	Object.assign(logSerializers, Bunyan.stdSerializers)
	const logStreams = []
	logStreams.push({
		stream: process.stdout,
	})
	return Bunyan.createLogger({
		component: path.dirname(__dirname),
		level: config.get('logger.level'),
		name: config.get('logger.name'),
		serializers: logSerializers,
		src: false, // use NODE_ENV?
		streams: logStreams,
	})
})

const getChildLogger = (...args) => {
	const fields = Object.assign({}, ...args)
	return createRootLogger().child(fields)
}

module.exports = {
	createRootLogger,
	getChildLogger,
}
