const fs = require('fs')
const path = require('path')

const Bunyan = require('bunyan')
const config = require('config')
//const debug = require('debug')
const _ = require('lodash')

const resolveLogFilePath = () => {
	try {
		const relative = config.get('logger.path')
		const absolute = path.resolve(__dirname, '..')
		const resolved = path.resolve(absolute, relative)
		fs.accessSync(resolved, fs.constants.W_OK)
		return resolved
	} catch (error) {
		return
	}
}

const getRootLogger = _.once(() => {
	const NODE_ENV = config.get('server.type')
	const LOG_FILE_PATH = resolveLogFilePath()
	const IS_PRODUCTION = NODE_ENV === 'production'
	const logSerializers = {} // for err, req and res:
	Object.assign(logSerializers, Bunyan.stdSerializers)
	const logBuffer = new Bunyan.RingBuffer({
		limit: 100, // number of log lines
	})
	const logStreams = []
	logStreams.push({
		level: 'trace',
		stream: logBuffer,
	})
	if (LOG_FILE_PATH) {
		logStreams.push({
			level: 'trace',
			path: LOG_FILE_PATH,
		})
	}
	if (IS_PRODUCTION) {
		/*
		logStreams.push({
			level: 'trace',
			// logstash?
		})
		*/
		// replace this:
		logStreams.push({
			// will inherit level
			stream: process.stdout,
		})
	} else {
		logStreams.push({
			// will inherit level
			stream: process.stdout,
		})
	}
	return Bunyan.createLogger({
		component: path.basename(__dirname),
		level: config.get('logger.level'),
		name: config.get('logger.name'),
		serializers: logSerializers,
		src: !IS_PRODUCTION,
		streams: logStreams,
	})
})

const getChildLogger = (...args) => {
	const fields = Object.assign({}, ...args)
	return getRootLogger().child(fields)
}

/*
const getDebugLogger = _.once(() => {
	return debug('mvp')
})
*/

module.exports = {
	getChildLogger,
	//getDebugLogger,
}
