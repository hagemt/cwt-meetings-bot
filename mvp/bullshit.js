const { google } = require('googleapis')
const Spark = require('ciscospark')
const _ = require('lodash')

const GOOGLE_SCOPES = Object.freeze([
	'https://www.googleapis.com/auth/admin.directory.resource.calendar',
	//'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
	'https://www.googleapis.com/auth/calendar',
	//'https://www.googleapis.com/auth/calendar.readonly',
])

const Logging = require('./logging.js')

const log = Logging.getChildLogger({
	component: 'bullshit',
})

const createClient = ({ key, personEmail }) => {

	const auth = new google.auth.JWT({
		email: key.client_email,
		key: key.private_key,
		scopes: GOOGLE_SCOPES,
		subject: personEmail,
	})

	const service = google.admin('directory_v1')

	return {
		listCalendarResources: async () => new Promise((resolve, reject) => {
			const options = { auth, customer: 'my_customer' }
			service.resources.calendars.list(options, (err, res) => {
				if (err) reject(err)
				else resolve(res.data)
			})
		}),
	}

}

const getSparkClient = _.once((bot) => {
	return Spark.init({
		credentials: {
			authorization: {
				access_token: bot.secret,
			},
		},
	})
})

module.exports = {

	doEverything: async ({ ciscospark, data, gsuite }) => {
		try {
			const emails = {
				'tohagema@cisco.com': 'tor@onetooneandon.to',
			}
			const auth = {
				gsuite: {
					client: createClient({
						key: gsuite.service,
						personEmail: emails[data.personEmail],
					}),
				},
				spark: {
					client: getSparkClient({
						secret: ciscospark.bot.secret,
					}),
				},
			}
			const list = await auth.gsuite.client.listCalendarResources()
			const me = await auth.spark.client.people.get('me')
			console.log(list, me)
			return auth
		} catch (error) {
			log.error({ err: error }, 'during something')
		}
	},

}
