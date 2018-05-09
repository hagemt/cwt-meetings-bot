const url = require('url')

const config = require('config')
const fetch = require('node-fetch')
const { google } = require('googleapis')
//const _ = require('lodash')

const Logging = require('./logging.js')
const PACKAGE_JSON = require('../package.json')

const log = Logging.getChildLogger({
	component: 'clients',
})

const GOOGLE_CALENDAR_SCOPES = Object.freeze([
	'https://www.googleapis.com/auth/admin.directory.resource.calendar',
	'https://www.googleapis.com/auth/calendar',
])

const EMAIL_WHITELIST = config.get('ciscospark.testers')

const loadGoogleClients = ({ key, who }) => {

	// the auth (provider) to client functions:
	const viaJWT = new google.auth.JWT({
		email: key.client_email, // service account
		key: key.private_key, // 2048-bit RSA
		scopes: GOOGLE_CALENDAR_SCOPES,
		subject: EMAIL_WHITELIST[who],
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

const USER_AGENT_PREFIX = `${PACKAGE_JSON.name}/${PACKAGE_JSON.version} (+${PACKAGE_JSON.bugs.url})`
const USER_AGENT_SUFFIX = `${process.release.name}/${process.version} ${process.platform}/${process.arch}`
const JSON_USER_AGENT = `${USER_AGENT_PREFIX} ${USER_AGENT_SUFFIX}`

const json = async (uri, options = {}) => {
	const JSON_URL_ORIGIN = options.url || 'https://api.ciscospark.com'
	const request = Object.assign({ method: 'GET' }, options, {
		url: new url.URL(uri, JSON_URL_ORIGIN).toString(),
	})
	if (typeof request.body === 'object') {
		request.body = JSON.stringify(request.body)
	}
	const response = await fetch(request.url, request)
	switch (response.status) {
	case 200:
		return await response.json()
	case 204:
		response.end()
		return
	default:
		throw new Error(await response.text())
	}
}

const loadCiscoClients = ({ bot }) => {
	const authorization = `Bearer ${bot.secret}`
	const JSON_MIME_TYPE = 'application/json'
	const JSON_HEADERS = Object.freeze({
		'accept': JSON_MIME_TYPE,
		'authorization': authorization,
		'content-type': JSON_MIME_TYPE,
		'user-agent': JSON_USER_AGENT,
	})
	return Object.freeze({
		readSecureMessage: async (...args) => {
			const { id } = Object.assign({}, ...args)
			return json(`/v1/messages/${id}`, {
				headers: JSON_HEADERS,
			})
		},
		sendSecureMessage: async (...args) => {
			const message = Object.assign({}, ...args)
			return json('/v1/messages', {
				body: message, // check?
				headers: JSON_HEADERS,
				method: 'POST',
			})
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
