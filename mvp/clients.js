const { promisify } = require('util')

const { google } = require('googleapis')
const Spark = require('ciscospark')
const _ = require('lodash')

const Logging = require('./logging.js')
const log = Logging.getChildLogger({
	component: 'clients',
})

const GOOGLE_CALENDAR_SCOPES = Object.freeze([
	'https://www.googleapis.com/auth/admin.directory.resource.calendar',
	'https://www.googleapis.com/auth/calendar',
])

const GOOGLE_GSUITE_EMAILS = {
	'joshand@cisco.com': 'josh@onetooneandon.to',
	'tohagema@cisco.com': 'tor@onetooneandon.to',
}

const loadGoogleClients = ({ key, who }) => {

	const viaJWT = new google.auth.JWT({
		email: key.client_email, // service account
		key: key.private_key, // 2048-bit RSA
		scopes: GOOGLE_CALENDAR_SCOPES,
		subject: GOOGLE_GSUITE_EMAILS[who],
	})

	const adminDirectoryV1 = google.admin('directory_v1')
	const calendarV3 = google.calendar('v3')

	const createCalendarEvent = promisify(calendarV3.events.insert)
	const listCalendarEvents = promisify(calendarV3.events.list)
	const listCalendarResources = promisify(adminDirectoryV1.resources.calendars.list)

	return Object.freeze({

		createCalendarEvent: async ({ start, end, emails, details }) => {
			const [firstEmail, ...otherEmails] = emails
			const invited = [{
				email: firstEmail,
				responseStatus: 'accepted',
			}]
			for (const email of otherEmails) {
				invited.push({ email })
			}
			const event = {
				attendees: invited,
				description: details,
				end: { dateTime: end },
				start: { dateTime: start },
				summary: 'Spark Meeting',
			}
			log.info({ event }, 'create')
			return createCalendarEvent({
				auth: viaJWT, // default:
				calendarId: 'primary',
				resource: event,
			})
		},

		listCalendarEvents: async () => {
			log.info('will list events')
			return listCalendarEvents({
				auth: viaJWT, // default:
				calendarId: 'primary',
			})
		},

		listCalendarResources: async () => {
			log.info('will list resources')
			return listCalendarResources({
				auth: viaJWT, // what?
				customer: 'my_customer',
			})
		},

	})

}

const loadCiscoSparkClient = _.memoize(secret => Spark.init({
	credentials: {
		authorization: {
			access_token: secret,
		},
	},
}))

const loadAll = ({ ciscospark, gsuite, webhook: { data } }) => ({
	cisco: {
		spark: loadCiscoSparkClient(ciscospark.bot.secret),
	},
	google: loadGoogleClients({
		key: gsuite.service,
		who: data.personEmail,
	}),
})

module.exports = {
	loadAll,
}
