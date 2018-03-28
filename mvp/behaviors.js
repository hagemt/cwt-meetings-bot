const fs = require('fs')
const path = require('path')

const chrono = require('chrono-node')
const moment = require('moment')
const _ = require('lodash')
/*
const momentNatural = require('moment-natural')
const momentParser = require('moment-parser')
const natural = require('natural')
const stopwords = require('stopwords')
const blacklist = new Set(stopwords.english)
*/

const { getEventBus } = require('./firehose.js')

const hackathonDemo = (firehose = getEventBus()) => {

	const isEmailAddress = any => any.includes('@')
	const denyEmailAddress = async ({ clients, roomId }) => {
		const english = 'Sorry, but I only answer to Cisco employees.'
		return clients.cisco.spark.message.create({ roomId, text: english })
	}

	const DEFAULT_MEETING_DURATION = { minutes: 15 } // short enough that it's probably ideal
	const [HOUR_TOO_EARLY, HOUR_TOO_LATE, MINUTES_TOO_FEW, MINUTES_TOO_MANY] = [6, 22, 1, 121]
	const INSTRUCTIONS = fs.readFileSync(path.resolve(__dirname, 'instructions.md')).toString()
	const isConferenceRoom = ({ resourceCategory }) => resourceCategory === 'CONFERENCE_ROOM'
	const nextInterval = (now = new Date()) => [now, moment(now).add(DEFAULT_MEETING_DURATION).toDate()]
	const summarizeError = ({ code, stack }) => Object.assign(new Error('Google APIs'), { code, stack })
	const summarizeRoom = ({ generatedResourceName }) => generatedResourceName

	const warnings = (start, end) => {
		const isBetween = any => moment(any, 'hh:mm').isBetween(start, end, 'minute')
		const isLunch = ['11:35', '11:45', '11:55', '12:05', '12:20'].some(isBetween)
		const isEarly = moment(start).hours(8).minutes(0).seconds(0).isAfter(start)
		const isLate = moment(start).hours(18).minutes(0).seconds(0).isBefore(start)
		if (isLunch) return '\n\n> Protip: meetings over lunch are sometimes a bad idea.'
		if (isEarly) return '\n\n> Protip: early meetings are sometimes a bad idea.'
		if (isLate) return '\n\n> Protip: late meetings are sometimes a bad idea.'
		return '\n\n> Protip: time zones can make meetings extra difficult.'
	}

	const extractMeetingAttendees = ({ resources, text }) => {
		const candidates = resources.items.filter((item) => {
			return isConferenceRoom(item) && text.includes(item.resourceName)
		})
		if (candidates.length !== 1) {
			const nag = `you mentioned ${candidates.length} conference rooms in your request.`
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
		const start = intervals[0].start ? intervals[0].start.date() : null
		//if (!start) throw new Error('you did not mention any time period.')
		const end = nextInterval(start) // impossible for start to be undefined?
		const minutes = moment(end).diff(start, 'minutes', true) // positive float
		const agony = start.getHours() < HOUR_TOO_EARLY || end.getHours > HOUR_TOO_LATE
		const insane = agony || minutes > MINUTES_TOO_MANY || minutes < MINUTES_TOO_FEW
		if (!insane) return [start, end] // FIXME (tohagema): check for event conflicts?
		throw new Error('I think you should pick a better time, during business hours.')
	}

	const markdownReplyTo = async ({ clients, events, resources, text }) => {
		try {
			firehose.log.info({ events, resources, text }, 'may create new calendar event')
			const emails = extractMeetingAttendees({ clients, events, resources, text })
			const [start, end] = extractMeetingTimes({ clients, events, resources, text })
			const event = { start, end, emails, details: text } // summary: 'Spark Meeting'
			const { data: created } = await clients.google.createCalendarEvent(event)
			firehose.log.info({ created, events, resources, text }, 'created calendar event')
			const markdown = `Okay, I created [a reservation](${event.htmlLink}) just for you.`
			return markdown + warnings(start, end) // e.g. across lunch / outside 9-5pm / default
		} catch (error) {
			const err = ('code' in error) ? summarizeError(error) : error
			firehose.log.warn({ err, events, resources, text }, 'will instruct')
			return INSTRUCTIONS + (error.message ? `\n\n> Heads up: ${error.message}` : '')
		}
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
				const markdown = await markdownReplyTo({ clients, events, resources, roomId, text })
				await clients.cisco.spark.messages.create({ markdown, roomId })
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
