const Boom = require('boom')
const config = require('config')
const KoaRouter = require('koa-router')
const _ = require('lodash')

const { hackathonDemo } = require('./behaviors.js')
const { loadAll } = require('./clients.js')
const { getEventBus } = require('./firehose.js')

const bot = config.get('ciscospark.bot')
const service = config.get('gsuite.service')

const CSWV = require('ciscospark-webhook-validator')
CSWV.getAccessToken = async () => bot.secret

const createRouters = _.once(() => {
	const firehose = hackathonDemo(getEventBus())
	const v0 = new KoaRouter({ prefix: '/v0' })
	v0.get('/ping', async ({ response }) => {
		const lastUpdated = new Date().toISOString()
		const upstreamServices = [] // could ping Hydra
		response.body = { lastUpdated, upstreamServices }
		response.status = 200 // OK
	})
	v0.post('/echo', async ({ request, response }) => {
		try {
			const { actorId, data, event, id, resource } = await CSWV.validate(request) // may throw Error
			if (actorId === bot.actorId || id !== bot.webhookId) return response.status = 204 // No Content
			const clients = await loadAll({ ciscospark: { bot }, gsuite: { service }, webhook: { data } })
			response.body = { consumed: firehose.consume(`spark:${resource}:${event}`, { clients, data }) }
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
