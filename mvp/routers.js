const Boom = require('boom')
const config = require('config')
const KoaRouter = require('koa-router')
const _ = require('lodash')

const { hackathonDemo } = require('./behaviors.js')
const { loadAll } = require('./clients.js')

const bot = config.get('ciscospark.bot')
const service = config.get('gsuite.service')

const CSWV = require('ciscospark-webhook-validator')
CSWV.getAccessToken = async () => bot.secret

const createRouters = _.once(() => {
	const events = hackathonDemo() // firehose
	const v0 = new KoaRouter({ prefix: '/v0' })
	v0.get('/ping', async ({ response }) => {
		const lastUpdated = new Date().toISOString()
		const upstreamServices = [] // should ping Spark?
		response.body = { lastUpdated, upstreamServices }
		response.status = 200 // OK
	})
	v0.post('/demo', async ({ request, response }) => {
		try {
			const { actorId, data, event, id, resource } = await CSWV.validate(request) // may throw Error
			if (actorId === bot.actorId || id !== bot.webhookId) return response.status = 204 // No Content
			const clients = await loadAll({ ciscospark: { bot }, gsuite: { service }, webhook: { data } })
			response.body = { consumed: events.consume(`spark:${resource}:${event}`, { clients, data }) }
			response.status = 200 // OK
		} catch (error) {
			throw Boom.badRequest(error.message)
		}
	})
	return [v0]
})

module.exports = {
	getAll: createRouters,
}
