const KoaRouter = require('koa-router')
const _ = require('lodash')

const createRouters = _.once(() => {
	const ping = new KoaRouter({ prefix: '/v0/ping' })
	ping.get('/', async ({ response }) => {
		response.body = {
			lastUpdated: new Date().toISOString(),
		}
		response.status = 200
	})
	return [ping]
})

module.exports = {
	getAll: createRouters,
}
