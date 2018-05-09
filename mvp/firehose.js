const { EventEmitter } = require('events')

const _ = require('lodash') // for _.once

const { getChildLogger } = require('./logging.js')

/*
const CHANNEL_NAME_PREFIX = '' // e.g. 'ciscospark'
const CHANNEL_NAME_SUFFIX = '' // e.g. 'trigger'
const channelName = (...args) => {
	const strings = [] // slugs, colon separated
	if (CHANNEL_NAME_PREFIX) strings.push(CHANNEL_NAME_PREFIX)
	for (const any of args) if (any) strings.push(String(any))
	if (CHANNEL_NAME_SUFFIX) strings.push(CHANNEL_NAME_SUFFIX)
	return strings.join(':')
}
*/

const CHANNEL_NAMES = new Set([
	'memberships:created',
	'memberships:updated',
	'memberships:deleted',
	'messages:created',
	//'messages:updated',
	'messages:deleted',
	'rooms:created',
	'rooms:updated',
	//'rooms:deleted',
])

const CHANNEL_NAME_DEFAULT = 'unknown'
const CHANNEL_NAME_ALL = '*' // all:all
const HANDLER_NAME_DEFAULT = 'anonymous'

const createRegister = (bus, log) => {
	return (consumerChannel, consumerHandler) => {
		const registeredHandler = async (...args) => {
			const metrics = {
				arguments: args,
				channels: [consumerChannel],
				handlers: [consumerHandler.name || HANDLER_NAME_DEFAULT],
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
		if (consumerChannel === CHANNEL_NAME_ALL) {
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
	const bus = new EventEmitter()
	const log = getChildLogger({
		component: 'firehose',
	})
	const register = createRegister(bus, log)
	const consume = (consumerChannel, ...args) => {
		return bus.emit(consumerChannel, ...args)
	}
	const recover = (error, consumerChannel) => {
		return bus.emit('recovered', error, consumerChannel)
	}
	bus.on('consumed', (args, consumerChannel) => {
		const channelName = consumerChannel || CHANNEL_NAME_DEFAULT
		log.debug({ args }, `event consumed (channel: ${channelName})`)
	})
	bus.on('error', (error, consumerChannel) => {
		if (!consumerChannel) log.warn({ err: error }, 'unknown consumer channel')
		else log.warn({ err: error }, `from consumer (channel: ${consumerChannel})`)
	})
	/*
	bus.on('recovered', (error, consumerChannel) => {
		bus.emit('error', error, consumerChannel)
	})
	*/
	bus.on('registered', (consumerHandler, consumerChannels) => {
		const channels = Array.isArray(consumerChannels) ? consumerChannels.slice() : []
		if (channels.length === 0) channels.push(consumerChannels || CHANNEL_NAME_DEFAULT)
		const code = consumerHandler.toString() // this approach is cool but has some flaws
		const handlers = [consumerHandler.name || HANDLER_NAME_DEFAULT] // is this useful?
		log.debug({ channels, code, handlers }, `added ${channels.length} consumer(s)`)
	})
	return Object.assign(bus, ...args, { consume, register, log, recover })
}

module.exports = {
	getEventBus: _.once(() => createEventBus()), // simple memoized provider
	getKnownChannels: _.once(() => Object.freeze(Array.from(CHANNEL_NAMES))),
}

/* istanbul ignore next */
if (!module.parent) {
	const bus = createEventBus()
	bus.register(CHANNEL_NAME_ALL, async function print (...args) {
		this.log.info(`called with ${args.length} argument(s)`)
	})
	const data = { text: 'Test!' } // from a webhook delivery envelope
	const envelope = { data, event: 'created', id: '', resource: 'messages' }
	const encodeJSON = any => Buffer.from(JSON.stringify(any)).toString('base64')
	const consume = () => bus.consume('messages:created', envelope, encodeJSON(envelope))
	setInterval(consume, 1000) // synthetic delivery event (message created) every second or so
}
