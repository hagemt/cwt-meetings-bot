const { EventEmitter } = require('events')

const Bunyan = require('bunyan')
const _ = require('lodash')

const PACKAGE_JSON = require('../package.json')

const ALL_CHANNEL_NAME = '*'
const CHANNEL_NAMES = new Set([
	'spark:memberships:created',
	'spark:memberships:updated',
	'spark:memberships:deleted',
	'spark:messages:created',
	//'spark:messages:updated',
	'spark:messages:deleted',
	'spark:rooms:created',
	'spark:rooms:updated',
	//'spark:rooms:deleted',
])

const DEFAULT_CHANNEL_NAME = 'unknown'
const DEFAULT_HANDLER_NAME = 'anonymous'

const DEFAULT_ACCESS_TOKEN = process.env.CISCOSPARK_ACCESS_TOKEN
const ROOT_LOGGER_LEVEL = process.env.LOG_LEVEL || 'info'

const createClient = ({ token = DEFAULT_ACCESS_TOKEN }) => {
	if (token) console.log(`spark ${token}`) // eslint-disable-line no-console
	// TODO (tohagema): use the same client from ciscospark-tools (support)
}

const createLogger = (...args) => {
	// TODO (tohagema): use the same logger from server, elsewhere?
	const options = {
		component: 'events',
		level: ROOT_LOGGER_LEVEL,
		name: PACKAGE_JSON.name,
	}
	return Bunyan.createLogger(options)
		.child(Object.assign({}, ...args))
}

const createRegister = (bus, log) => {
	return (consumerChannel, consumerHandler) => {
		const registeredHandler = async (...args) => {
			const metrics = {
				arguments: args,
				channels: [consumerChannel],
				handlers: [consumerHandler.name || DEFAULT_HANDLER_NAME],
			}
			try {
				log.trace({ metrics }, 'consumer call')
				const elapsed = process.hrtime() // opaque
				await consumerHandler.apply(bus, args)
				const [s, ns] = process.hrtime(elapsed)
				metrics.milliseconds = s * 1e3 + ns / 1e6
				log.trace({ metrics }, 'consumer done')
			} catch (error) {
				bus.emit('error', error, consumerChannel)
			} finally {
				bus.emit('consumed', args, consumerChannel)
			}
		}
		if (consumerChannel === ALL_CHANNEL_NAME) {
			for (const broadcastChannel of CHANNEL_NAMES) {
				bus.on(broadcastChannel, registeredHandler)
			}
			bus.emit('registered', consumerHandler, [...CHANNEL_NAMES])
		} else if (CHANNEL_NAMES.has(consumerChannel)) {
			bus.on(consumerChannel, registeredHandler)
			bus.emit('registered', consumerHandler, [consumerChannel])
		} else {
			throw new Error(`invalid channel: ${consumerChannel}`)
		}
		return bus
	}
}

const createEventBus = (...args) => {
	const client = createClient({
	})
	const bus = new EventEmitter()
	const log = createLogger({
	})
	const register = createRegister(bus, log)
	const consume = (consumerChannel, ...args) => {
		return bus.emit(consumerChannel, ...args)
	}
	const recover = (error, consumerChannel) => {
		return bus.emit('recovered', error, consumerChannel)
	}
	bus.on('consumed', (args, consumerChannel) => {
		const channelName = consumerChannel || DEFAULT_CHANNEL_NAME
		log.debug({ args }, `event consumed (channel: ${channelName})`)
	})
	bus.on('error', (error, consumerChannel) => {
		if (!consumerChannel) log.warn({ err: error }, 'unknown consumer channel')
		else log.warn({ err: error }, `from consumer (channel: ${consumerChannel})`)
	})
	// no 'recovered' handler, by default (need to implement this)
	bus.on('registered', (consumerHandler, consumerChannels) => {
		const channels = Array.isArray(consumerChannels) ? consumerChannels.slice() : []
		if (channels.length === 0) channels.push(consumerChannels || DEFAULT_CHANNEL_NAME)
		const code = consumerHandler.toString() // this approach is cool but has some flaws
		const handlers = [consumerHandler.name || DEFAULT_HANDLER_NAME] // is this useful?
		log.debug({ channels, code, handlers }, `added ${channels.length} consumer(s)`)
	})
	return Object.assign(bus, ...args, { consume, register, log, recover, spark: client })
}

module.exports = {
	getEventBus: _.once(() => createEventBus()),
}

/* istanbul ignore next */
if (!module.parent) {
	const bus = createEventBus()
	bus.register('*', async function print (...args) {
		this.log.info(`called with ${args.length} argument(s)`)
	})
	const data = { text: 'Test!' } // from a webhook delivery envelope
	const envelope = { data, event: 'created', id: '', resource: 'messages' }
	const encodeJSON = any => Buffer.from(JSON.stringify(any)).toString('base64')
	const consume = () => bus.consume('spark:messages:created', envelope, encodeJSON(envelope))
	setInterval(consume, 1000) // synthetic delivery event (message created) every second or so
}
