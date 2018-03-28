const { promisify } = require('util')

const { google } = require('googleapis')
const Spark = require('ciscospark')
const _ = require('lodash')

const GOOGLE_CALENDAR_SCOPES = Object.freeze([
	'https://www.googleapis.com/auth/admin.directory.resource.calendar',
	'https://www.googleapis.com/auth/calendar',
])

const GOOGLE_EMAILS = {
	'tohagema@cisco.com': 'tor@onetooneandon.to',
}

const GOOGLE_PLACES = {
	'Earth': 'onetooneandon.to_3130393733393133373332@resource.calendar.google.com',
	'Mars': 'onetooneandon.to_3236363931363433333230@resource.calendar.google.com',
}

const loadGoogleClients = ({ key, who }) => {

	const viaJWT = new google.auth.JWT({
		email: key.client_email, // service account
		key: key.private_key, // 2048-bit RSA
		scopes: GOOGLE_CALENDAR_SCOPES,
		subject: GOOGLE_EMAILS[who],
	})

	const adminDirectoryV1 = google.admin('directory_v1')
	const calendarV3 = google.calendar('v3')

	const createCalendarEvent = promisify(calendarV3.events.insert)
	const listCalendarEvents = promisify(calendarV3.events.list)
	const listCalendarResources = promisify(adminDirectoryV1.resources.calendars.list)

	return Object.freeze({

		createCalendarEvent: async () => {
			const event = {
				'summary': 'Summary',
				'location': 'Location',
				'description': 'Description',
				'start': {
					'dateTime': '2018-04-01T09:00:00-07:00',
					//'timeZone': 'America/Los_Angeles',
				},
				'end': {
					'dateTime': '2018-04-01T17:00:00-07:00',
					//'timeZone': 'America/Los_Angeles',
				},
				'attendees': [
					{ email: GOOGLE_PLACES['Earth'], responseStatus: 'accepted' },
				],
			}
			return createCalendarEvent({
				auth: viaJWT,
				calendarId: 'primary',
				resource: event,
			})
		},

		listCalendarEvents: async () => {
			return listCalendarEvents({
				auth: viaJWT,
				calendarId: 'primary',
			})
		},

		listCalendarResources: async () => {
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
