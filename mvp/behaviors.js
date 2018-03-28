const { getEventBus } = require('./EventBus.js')
// https://www.npmjs.com/package/node-fetch
//const fetch = require('node-fetch')

const demoBehaviors = (firehose = getEventBus()) => {

	firehose.on('spark:messages:created', async function echo ({ auth, data }) {
		const { roomId, text } = await auth.spark.client.messages.get(data.id)
		const sent = await auth.spark.client.messages.create({ roomId, text })
		this.log.info({ data, sent }, 'echo message sent to/from Spark user')
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

}

module.exports = {
	demoBehaviors,
}
