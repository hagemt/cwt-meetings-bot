const http = require('http')

const config = require('config')
const httpShutdown = require('http-shutdown')
const koaOmnibus = require('koa-omnibus')
const _ = require('lodash')

const Logging = require('./logging.js')
const Routers = require('./routers.js')
const webhooks = require('./webhooks.js')

const getServer = _.once(() => {
	const application = koaOmnibus.createApplication({
		//targetLogger: (options, context, fields) => Logging.getChildLogger(fields),
	})
	for (const router of Routers.getAll()) {
		application.use(router.allowedMethods())
		application.use(router.routes())
	}
	const server = http.createServer() // later: SSL
	server.on('request', application.callback())
	return httpShutdown(server)
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
