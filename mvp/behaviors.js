const { getEventBus } = require('./firehose.js')

const hackathonDemo = (firehose = getEventBus()) => {

	const denyEmailAddress = async ({ clients, roomId }) => {
		const english = 'Sorry, but I only answer to Cisco employees.'
		return clients.cisco.spark.message.create({ roomId, text: english })
	}

	const recoverEnglish = async ({ text }) => {
		return text
	}

	const replyEnglish = async ({ text }) => {
		return text
	}

	firehose.on('spark:*',
		async function log ({ data }) {
			firehose.log.info({ data }, 'just FYI')
		})

	firehose.on('spark:messages:created',
		async function book ({ clients, data }) {
			const { personEmail, roomId, text } = await clients.cisco.spark.messages.get(data.id)
			if (!personEmail.endsWith('@cisco.com')) return denyEmailAddress({ clients, roomId })
			try {
				const { data: events } = await clients.google.listCalendarEvents()
				const { data: resources } = await clients.google.listCalendarResources()
				const reply = await replyEnglish({ clients, events, resources, text })
				const english = reply ? reply : await recoverEnglish({ clients, text })
				await clients.cisco.spark.messages.create({ roomId, text: english })
			} catch (error) {
				const english = 'Sorry, something went wrong; please try that again.'
				await clients.cisco.spark.messages.create({ roomId, text: english })
				throw error
			}
		})

	return firehose

}

module.exports = {
	hackathonDemo,
}
