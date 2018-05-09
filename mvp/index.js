const http = require('http')

const Boom = require('boom')
const config = require('config')
const httpShutdown = require('http-shutdown')
const koaOmnibus = require('koa-omnibus')
const _ = require('lodash')

const Logging = require('./logging.js')
const Routers = require('./routers.js')
const webhooks = require('./webhooks.js')

const getServer = _.once(() => {
	const application = koaOmnibus.createApplication({
		// FIXME (tohagema): something does not seem work work correctly with this:
		targetLogger: (options, context, fields) => Logging.getChildLogger(fields),
	})
	application.use(async ({ request, response }, next) => {
		await next()
		const message = `${request.method} ${request.url}`
		switch (response.status) {
		case 201:
			response.body = Object.assign({}, response.body, {
				href: response.get('location'),
			})
			break
		case 204:
			response.body = ''
			break
		case 404:
			throw Boom.notFound(message)
		case 405:
			throw Boom.methodNotAllowed(message)
		case 501:
			throw Boom.notImplemented(message)
		default:
		}
	})
	for (const router of Routers.forServer()) {
		const allowedMethods = router.allowedMethods({
			/*
			// TODO (tohagema): the version above is less magic
			methodNotAllowed: () => new Boom.methodNotAllowed(),
			notImplemented: () => new Boom.notImplemented(),
			throw: true,
			*/
			throw: false,
		})
		application.use(allowedMethods)
		application.use(router.routes())
	}
	// TODO (tohagema): SSL (https)
	// locate certificate via config
	const server = http.createServer()
	server.on('request', application.callback())
	return httpShutdown(server) // adds #shutdown
})

const createService = _.once(() => {
	const log = Logging.getChildLogger({
		component: 'service',
	})
	const server = getServer()
	return Object.freeze({ log, server })
})

const startService = async ({ log, server }, { port } = {}) => {
	return new Promise((resolve, reject) => {
		const portNumber = Number(port) || config.get('server.port')
		server.on('error', (error) => {
			if (!server.listening) reject(error)
			else log.error({ err: error }, 'from server')
		})
		server.once('listening', () => {
			const options = {
				PORT: portNumber,
			}
			log.info(options, 'listening')
			resolve(options)
		})
		server.listen(portNumber)
	})
}

const stopService = async ({ server }) => {
	return new Promise((resolve, reject) => {
		server.shutdown((shutdownError) => {
			if (shutdownError) reject(shutdownError)
			else resolve()
		})
	})
}

module.exports = {
	createService,
	startService,
	stopService,
}

/* istanbul ignore next */
if (!module.parent) {
	const service = createService()
	startService(service)
		.then(async () => {
			const NODE_ENV = config.get('server.type')
			switch (NODE_ENV) {
			case 'production':
				await webhooks.productionService(service)
				break
			case 'load':
			case 'test':
				break
			case 'development':
			default:
				await webhooks.developmentService(service)
			}
			service.log.info({ NODE_ENV }, 'ready')
		})
		.catch((error) => {
			service.log.fatal({ err: error }, 'failed to start')
			//process.exitCode = 1 // use this if possible
			// eslint-disable-next-line no-process-exit
			process.exit(1)
		})
}
