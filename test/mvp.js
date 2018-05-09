const assert = require('assert')
const url = require('url')

const fetch = require('node-fetch')

describe('docker container (ping)', () => {

	const ORIGIN_URL = process.env.ORIGIN_URL || 'http://localhost:8080'
	const buildURL = (...args) => new url.URL(...args).toString()

	it('responds 200 (OK)', async () => {
		const response = await fetch(buildURL('/v0/ping', ORIGIN_URL))
		assert.equal(response.status, 200, 'unexpected HTTP response status')
		assert('lastUpdated' in await response.json(), 'no lastUpdated time')
	})

})
