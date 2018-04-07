const fs = require('fs')
const path = require('path')

const chrono = require('chrono-node')
const moment = require('moment')
const _ = require('lodash')

const { getEventBus } = require('./firehose.js')
const { getChildLogger } = require('./logging.js')

const hackathonDemo = (bus = getEventBus()) => {

	const log = getChildLogger({
		component: 'hackathon',
	})

	const INSTRUCTIONS = fs.readFileSync(path.resolve(__dirname, 'instructions.md')).toString()
	const CONFERENCE_ROOM_TYPES = new Set(['CONFERENCE_ROOM']) // TODO: change these to suit GSuite?
	const isConferenceRoom = ({ resourceCategory }) => CONFERENCE_ROOM_TYPES.has(resourceCategory)
	const isEmailAddress = any => /.@./.test(any) // TODO: proper check for RFC email address?

	const DEFAULT_MEETING_DURATION = { minutes: 15 } // short enough that it's probably ideal
	const [HOUR_TOO_EARLY, HOUR_TOO_LATE, MINUTES_TOO_FEW, MINUTES_TOO_MANY] = [6, 22, 1, 121]
	const LUNCHTIMES = ['11:35', '11:45', '11:55', '12:05', '12:15', '12:25', '12:35', '12:45', '12:55']
	const nextInterval = (now = new Date()) => [now, moment(now).add(DEFAULT_MEETING_DURATION).toDate()]

	const summarizeError = ({ code, message, stack }) => Object.assign(new Error(message || '@#$%'), { code, stack })
	const summarizeRoom = ({ generatedResourceName }) => generatedResourceName // e.g. BUILDING-FLOOR-ROOM (CAPACITY)

	const warnings = (start, end) => {
		const isEarly = moment(start).hours(9).minutes(0).seconds(0).milliseconds(0).isAfter(start)
		if (isEarly) return '\n\n> Protip: early meetings are sometimes a bad idea. People hate mornings!'
		const isLate = moment(start).hours(17).minutes(0).seconds(0).milliseconds(0).isBefore(start)
		if (isLate) return '\n\n> Protip: late meetings are sometimes a bad idea. People have kids!'
		const isLunch = LUNCHTIMES.some(any => moment(any, 'hh:mm').isBetween(start, end, 'minute'))
		if (isLunch) return '\n\n> Protip: lunch meetings are sometimes a bad idea. People need food!'
		return '\n\n> Protip: different time zones can make team meetings extra difficult. Plan ahead!'
	}

	const extractMeetingAttendees = ({ resources, text }) => {
		const candidates = resources.items.filter((item) => {
			return isConferenceRoom(item) && text.includes(item.resourceName)
		})
		if (candidates.length !== 1) {
			const nag = `Protip: you mentioned ${candidates.length} conference rooms in your request.`
			const ten = _.sampleSize(resources.items, 10).filter(isConferenceRoom).map(summarizeRoom)
			throw new Error(`${nag}\n\nHere are some nearby:\n${ten.map(one => `* ${one}`).join('\n')}`)
		}
		const emails = text.match(/\b(\w+)\b/g).filter(isEmailAddress)
		emails.unshift(candidates[0].resourceEmail)
		return emails
	}

	const extractMeetingTimes = ({ text }) => {
		const intervals = chrono.parse(text)
		if (intervals.length > 1) {
			throw new Error('you mentioned more than one time period in your request.')
		} else if (intervals.length < 1) {
			return nextInterval() // now
		}
		const start = intervals[0].start ? intervals[0].start.date() : new Date() // now
		const end = intervals[0].end ? intervals[0].end.date() : nextInterval(start)[1]
		const weekend = start.getDay() === 6 || start.getDay() === 0 // Saturday/Sunday
		if (weekend) throw new Error('that meeting would take place on the weekend.')
		if (end < new Date()) throw new Error('that meeting would end in the past.')
		const minutes = moment(end).diff(start, 'minutes', true) // as positive float
		const agony = start.getHours() < HOUR_TOO_EARLY || end.getHours > HOUR_TOO_LATE
		const insane = agony || minutes > MINUTES_TOO_MANY || minutes < MINUTES_TOO_FEW
		if (!insane) return [start, end] // FIXME (tohagema): check for event conflicts?
		throw new Error('I think you should pick a short time during business hours.')
	}

	const markdownReplyTo = async ({ clients, events, resources, text }) => {
		try {
			log.info({ events, resources, text }, 'may create calendar event')
			const emails = extractMeetingAttendees({ clients, events, resources, text })
			const [start, end] = extractMeetingTimes({ clients, events, resources, text })
			const event = { start, end, emails, long: text, short: 'Spark Meeting' }
			const { data: created } = await clients.google.createCalendarEvent(event)
			log.info({ created, events, resources, text }, 'created calendar event')
			const markdown = `Okay, I created [a reservation](${event.htmlLink}) just for you.`
			return markdown + warnings(start, end) // e.g. across lunch / outside 9-5pm / default
		} catch (error) {
			const err = ('code' in error) ? summarizeError(error) : error // FIXME
			log.info({ err, events, resources, text }, 'will post usage instructions')
			return INSTRUCTIONS + (error.message ? `\n\n> Heads up: ${error.message}` : '')
		}
	}

	bus.on('*',
		async function log ({ data }) {
			log.info({ data }, 'just FYI')
		})

	bus.on('messages:created',
		async function book ({ clients, data }) {
			const { personEmail, roomId, text } = await clients.cisco.readSecureMessage(data.id)
			if (!personEmail.endsWith('@cisco.com')) {
				const english = 'Sorry, but I only answer to Cisco employees.'
				return clients.cisco.sendSecureMessage({ roomId, text: english })
			}
			try {
				const { data: events } = await clients.google.listCalendarEvents()
				const { data: resources } = await clients.google.listCalendarResources()
				const english = await markdownReplyTo({ clients, events, resources, roomId, text })
				await clients.cisco.sendSecureMessage({ markdown: english, roomId })
			} catch (error) {
				const english = 'Sorry, something went wrong; please try that again.'
				await clients.cisco.sendSecureMessage({ roomId, text: english })
				throw error
			}
		})

	return bus

}

module.exports = {
	hackathonDemo,
}
