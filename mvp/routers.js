const Boom = require('boom')
const KoaRouter = require('koa-router')
const _ = require('lodash')

const { ciscospark, gsuite } = require('config')
const { getEventBus } = require('./EventBus.js')
const CSWV = require('ciscospark-webhook-validator')
CSWV.getAccessToken = async () => ciscospark.bot.secret

const { doEverything } = require('./bullshit.js')

const createRouters = _.once(() => {
	const firehose = getEventBus() // singleton
	const v0 = new KoaRouter({ prefix: '/v0' })
	v0.get('/ping', async ({ response }) => {
		response.body = {
			lastUpdated: new Date().toISOString(),
		}
		response.status = 200 // OK
	})
	v0.post('/echo', async ({ request, response }) => {
		const { actorId, data, event, id, resource } = await CSWV.validate(request)
		const ignore = actorId === ciscospark.bot.actorId || id !== ciscospark.bot.webhookId
		if (ignore) return response.status = 204
		const auth = await doEverything({ ciscospark, data, gsuite })
		const object = { auth, data } // passed to behavior handler
		//const string = JSON.stringify({ data }) // should be a coordinate
		const handled = firehose.emit(`spark:${resource}:${event}`, object)
		if (!handled) throw Boom.notAcceptable('no handler registered')
		response.status = 202 // Accepted
	})
	return [v0]
})

module.exports = {
	getAll: createRouters,
}
