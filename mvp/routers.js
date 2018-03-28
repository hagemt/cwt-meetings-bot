const Boom = require('boom')
const KoaRouter = require('koa-router')
const _ = require('lodash')

//const { access_token } = require('config').get('spark.authorization')
const { getEventBus } = require('./EventBus.js') // provider
const { validate } = require('ciscospark-webhook-validator')

const createRouters = _.once(() => {
	const firehose = getEventBus() // singleton
	const v0 = new KoaRouter({ prefix: '/v0' })
	v0.get('/ping', async ({ response }) => {
		response.body = {
			lastUpdated: new Date().toISOString(),
		}
		response.status = 200 // OK
	})
	v0.post('*', async ({ request, response }) => {
		//const { data, event, resource } = await validate(request)
		const data = {}
		const resource = 'messages'
		const event = 'created'
		const object = { auth: {}, data } // passed to behavior handler
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
