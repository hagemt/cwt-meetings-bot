const { google } = require('googleapis')
const Spark = require('ciscospark')
const _ = require('lodash')

const config = require('config')
const testers = config.get('cisco.testers')

const Logging = require('./logging.js')
const log = Logging.getChildLogger({
	component: 'clients',
})

const GOOGLE_CALENDAR_SCOPES = Object.freeze([
	'https://www.googleapis.com/auth/admin.directory.resource.calendar',
	'https://www.googleapis.com/auth/calendar',
])

const loadGoogleClients = ({ key, who }) => {

	// the auth (provider) to client functions:
	const viaJWT = new google.auth.JWT({
		email: key.client_email, // service account
		key: key.private_key, // 2048-bit RSA
		scopes: GOOGLE_CALENDAR_SCOPES,
		subject: testers[who],
	})

	// add client objects here as necessary
	const adminDirectoryV1 = google.admin('directory_v1')
	const calendarV3 = google.calendar('v3')

	// only expose functions as necessary
	return Object.freeze({

		createCalendarEvent: async ({ start, end, emails, long, short }) => {
			const [firstEmailAddress, ...otherEmailAddresses] = Array.from(emails)
			const invited = [{
				email: firstEmailAddress,
				responseStatus: 'tentative',
			}]
			for (const email of otherEmailAddresses) {
				invited.push({ email })
			}
			const event = {
				attendees: invited,
				description: long,
				end: { dateTime: end },
				start: { dateTime: start },
				summary: short || 'Spark Meeting',
			}
			log.info({ event }, 'will create event')
			return new Promise((resolve, reject) => {
				const options = {
					auth: viaJWT, // default:
					calendarId: 'primary',
					resource: event,
				}
				calendarV3.events.insert(options, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				})
			})
		},

		listCalendarEvents: async () => {
			log.info('will list events')
			return new Promise((resolve, reject) => {
				const options = {
					auth: viaJWT, // default:
					calendarId: 'primary',
				}
				calendarV3.events.list(options, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				})
			})
		},

		listCalendarResources: async () => {
			log.info('will list resources')
			return new Promise((resolve, reject) => {
				const options = {
					auth: viaJWT, // default:
					customer: 'my_customer',
				}
				adminDirectoryV1.resources.calendars.list(options, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				})
			})
		},

	})

}

const getSparkClient = _.memoize(secret => Spark.init({
	credentials: {
		authorization: {
			access_token: secret,
		},
	},
}))

const loadCiscoClients = ({ bot }) => {
	const spark = getSparkClient(bot.secret)
	return Object.freeze({
		readSecureMessage: async (...args) => {
			return spark.messages.get(...args)
		},
		sendSecureMessage: async (...args) => {
			return spark.messages.create(...args)
		},
	})
}

// TODO: add methods that interact with Outlook
const loadMicrosoftClients = () => Object.freeze({
})

const loadAll = async ({ ciscospark, gsuite, webhook }) => ({
	cisco: loadCiscoClients({
		bot: ciscospark.bot,
	}),
	google: loadGoogleClients({
		key: gsuite.service, // account
		who: webhook.data.personEmail,
	}),
	microsoft: loadMicrosoftClients({
		// how to connect to exchange calendar
		// using an LDAP account, probably
	}),
})

module.exports = {
	loadAll,
}
