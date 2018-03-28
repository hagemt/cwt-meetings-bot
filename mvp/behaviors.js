const { getEventBus } = require('./firehose.js')

const hackathonDemo = (events = getEventBus()) => {

	events.on('spark:*',
		async function log ({ data }) {
			events.log.info({ data }, 'just FYI')
		})

	events.on('spark:messages:created',
		async function book ({ clients, data }) {
			const { roomId, text } = await clients.cisco.spark.messages.get(data.id)
			const { data: resources } = await clients.google.listCalendarResources()
			const { data: event } = await clients.google.createCalendarEvent()
			const { data: list } = await clients.google.listCalendarEvents()
			const message = await clients.cisco.spark.messages.create({ roomId, text })
			events.log.info({ event, list, message, resources }, 'responded to message')
		})

	return events

}

module.exports = {
	hackathonDemo,
}
