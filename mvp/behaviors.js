const fs = require('fs')
const path = require('path')
const url = require('url')

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
	const isEmailAddress = any => /^[^@]+@[^@]+$/.test(any) // TODO: check for RFC email address?

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
			const nag = `You mentioned ${candidates.length} conference rooms in your last request.`
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

	const eventSummary = ({ start, end, emails, long, short }) => `I'm not allowed to book this yet. Here's what I understood:

* Who: ${['You'].concat(emails.slice(1)).join(', ')}
* What: ${short}
* When: from ${String(start)} to ${String(end)}
* Where: (fake email for room resource) ${emails[0]}
* Why: ${long}
`

	const markdownReplyTo = async ({ clients, events, resources, text }) => {
		try {
			log.info({ events, resources, text }, 'may create calendar event')
			const emails = extractMeetingAttendees({ clients, events, resources, text })
			const [start, end] = extractMeetingTimes({ clients, events, resources, text })
			const title = 'Digital Workspace Meeting' // extractMeetingTitle()
			const event = { start, end, emails, long: text, short: title }
			const isReadOnly = !process.env.USE_GSUITE // simplest toggle
			if (isReadOnly) {
				log.info({ event, events, resources, text }, 'would create calendar event via GSuite')
				return eventSummary(event) + warnings(start, end) // FIXME (tohagema): better toggle?
			}
			const { data: created } = await clients.google.createCalendarEvent(event)
			log.info({ created, events, resources, text }, 'created calendar event')
			const markdown = `Okay, I created [a reservation](${event.htmlLink}) just for you.`
			//const markdown = `Event:\n\n\`\`\`json\n${JSON.stringify(event, null, '\t')}\n\`\`\``
			return markdown + warnings(start, end) // e.g. across lunch / outside 9-5pm / default
		} catch (error) {
			const err = ('code' in error) ? summarizeError(error) : error // FIXME
			log.info({ err, events, resources, text }, 'will post usage instructions')
			return error.message ? INSTRUCTIONS + `\n\n> ${error.message}` : INSTRUCTIONS
		}
	}

	const markdownMeetingsURLs = ({ request }) => {
		const buildURL = (...args) => new url.URL(...args).toString()
		const meetingsURI = `/v0/meetings/${request.get('trackingid') || 'default'}`
		const positiveURL = buildURL(meetingsURI + '?feedback=positive', request.href)
		const negativeURL = buildURL(meetingsURI + '?feedback=negative', request.href)
		return `Click [👍](${positiveURL}) or [👎](${negativeURL}) to provide feedback!`
	}

	bus.on('*',
		async function log ({ data }) {
			log.info({ data }, 'just FYI')
		})

	bus.on('messages:created',
		async function book ({ clients, data, request }) {
			const { personEmail, roomId, text } = await clients.cisco.readSecureMessage({ id: data.id })
			if (!personEmail.endsWith('@cisco.com')) {
				const english = 'Sorry, but I only answer to Cisco employees.'
				return clients.cisco.sendSecureMessage({ roomId, text: english })
			}
			try {
				const { data: events } = await clients.google.listCalendarEvents()
				const { data: resources } = await clients.google.listCalendarResources()
				const markdown = await markdownReplyTo({ clients, events, resources, roomId, text })
				const english = markdown + '\n\n' + markdownMeetingsURLs({ request })
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
