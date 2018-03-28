//const assert = require('assert')

const config = require('config')
const supertest = require('supertest')

const MVP = require('../mvp')

describe('MVP', () => {

	const port = config.get('server.port')
	const test = { port }

	before(() => {
		Object.assign(test, MVP.createService())
		return MVP.startService(test, { port })
	})

	it('responds to ping', () => {
		return supertest(test.server)
			.get('/v0/ping')
			.expect(200)
	})

	after(() => {
		if (!test.server.listening) return
		return MVP.stopService(test)
	})

})
