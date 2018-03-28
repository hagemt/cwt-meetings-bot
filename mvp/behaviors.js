const { getEventBus } = require('./EventBus.js')
// https://www.npmjs.com/package/node-fetch
//const fetch = require('node-fetch')

const firehose = getEventBus() // singleton

firehose.on('spark:messages:created', async (/* { auth, data } */) => {
	/*
	const response = await fetch('https://api.googleapis.com/gsuite', {
		body: {},
		headers: {
			'authorization': `Bearer ${auth.token}`,
		},
	})
	*/
	// use node-fetch here w/ headers['authorization'] = `Bearer ${token}`
	// auth object can be built however is necessary (gsuite and spark)
})

// add other handlers for more behaviors here; @see getEventBus
