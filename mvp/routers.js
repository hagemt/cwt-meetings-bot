const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const url = require('url')

const Boom = require('boom')
const config = require('config')
const fetch = require('node-fetch')
const koaCORS = require('@koa/cors')
const KoaRouter = require('koa-router')
const parse = require('co-body')
const UUID = require('uuid')
const _ = require('lodash')

const { defaultStorage } = require('./storage.js')
const { hackathonDemo } = require('./behaviors.js')
const { loadAll } = require('./clients.js')

const bot = config.get('ciscospark.bot')
const service = config.get('gsuite.service')

const CSWV = require('ciscospark-webhook-validator')
CSWV.getAccessToken = async () => bot.secret // static

const DEFAULT_ORIGIN = process.env.CISCOSPARK_URL_ORIGIN || 'https://api.ciscospark.com'
const buildURL = (anyURI, origin = DEFAULT_ORIGIN) => new url.URL(anyURI, origin).toString()

const upstreamServices = async (pingURL = buildURL('/v1/ping')) => {
	const response = await fetch(pingURL) // no auth necessary
	if (!response.ok) throw new Error(await response.text())
	return [_.omit(await response.json(), ['upstreamServices'])]
}

const createAdminRouter = () => {
	const admin = new KoaRouter({
		prefix: '/v0/admin',
	})
	const admins = config.get('admin.users') // < sensitive:
	const GSUITE_EMAIL = config.get('gsuite.email') // admin
	const testers = config.get('ciscospark.testers') // base
	const CONFIG_PATH = path.resolve(__dirname, '..', 'config')
	const WHITELIST_PATH = path.resolve(CONFIG_PATH, 'testers')
	const hasAccess = (username, password) => {
		const expected = Buffer.from(admins[username] || '')
		const actual = Buffer.alloc(expected.length, password)
		const valid = crypto.timingSafeEqual(actual, expected)
		return valid && username in admins // else, invalid
	}
	const amendWhitelist = async (item) => {
		const canWhitelist = (maybeEmailAddress) => {
			if (typeof maybeEmailAddress === 'string') {
				const validEmailAddress = /^[^@]+@cisco.com$/
				return validEmailAddress.test(maybeEmailAddress)
			}
			return false
		}
		if (!canWhitelist(item)) throw new Error('bad email')
		const items = fs.readFileSync(WHITELIST_PATH).toString()
		fs.writeFileSync(WHITELIST_PATH, `${items}${item}\n`)
	}
	const fetchWhitelist = async () => {
		try {
			const whitelisted = {}
			const bytes = fs.readFileSync(WHITELIST_PATH)
			const lines = bytes.toString().split('\n')
			for (const line of lines) {
				if (line) whitelisted[line] = GSUITE_EMAIL
			}
			return Object.assign({}, testers, whitelisted)
		} catch (error) {
			return Object.assign({}, testers)
		}
	}
	admin.use('*', async (context, next) => {
		const authorization = context.get('authorization') || ''
		try {
			if (!authorization.startsWith('Basic ')) throw new Error('invalid auth scheme')
			const base64 = authorization.slice('Basic '.length) // decode($username:$password)
			const [username, password] = Buffer.from(base64, 'base64').toString().split(':', 2)
			if (!hasAccess(username, password)) throw new Error('username:password is incorrect')
		} catch (error) {
			const message = authorization ? 'invalid Authorization' : 'missing Authorization'
			context.omnibus.log.warn({ err: error }, message)
			throw Boom.unauthorized(message, 'Basic', {
				realm: 'Admin UI (whitelist, etc.)',
			})
		}
		await next()
	})
	admin.get('/whitelist', async ({ response }) => {
		response.body = await fetchWhitelist()
	})
	admin.post('/whitelist', async ({ request, response }) => {
		try {
			const body = await parse.text(request, {
				limit: 72, // should be 4x as long as necessary
			})
			await amendWhitelist(body)
		} catch (error) {
			throw Boom.badRequest(error.message)
		}
		response.body = await fetchWhitelist()
	})
	return admin
}

// limit expensive actions:
const READS_PER_MINUTE = 1
const PINGS_PER_MINUTE = 1

const createMeetingsRouter = () => {
	const meetings = new KoaRouter({
		prefix: '/v0/meetings',
	})
	const storage = defaultStorage()
	const FEEDBACK_HTML_PATH = path.resolve(__dirname, 'feedback.html')
	const feedbackHTML = () => fs.readFileSync(FEEDBACK_HTML_PATH).toString()
	const throttledHTML = _.throttle(feedbackHTML, 60 * 1000 / READS_PER_MINUTE)
	meetings.use(koaCORS()) // allow cross-origin
	meetings.get('/', async ({ response }) => {
		response.body = await storage.getMeetings()
	})
	meetings.get('feedback', '/:id', async ({ omnibus, params, query, response }) => {
		const buildHTML = _.template(throttledHTML())
		const html = buildHTML({
			title: `Please tell us about your ${query.feedback || 'recent'} experience.`,
			subtitle: `To reference this specific interaction, include your request ID: ${params.id}`,
			footer: `Copyright &copy; ${1900 + new Date().getYear()} Cisco Systems`,
		})
		omnibus.log.info({ params, query }, 'got feedback')
		response.set('content-type', 'text/html')
		response.body = html
	})
	meetings.post('/', async ({ omnibus, request, response }) => {
		try {
			const id = request.get('x-request-id') || UUID.v1()
			const body = await parse.json(request, { limit: 1024 })
			response.body = await storage.addMeeting({ id, body })
			omnibus.log.info({ meeting: { id, body } }, 'added meeting')
			const [params, query] = [{ id }, { feedback: 'developer' }]
			const feedbackURI = meetings.url('feedback', params, { query })
			response.set('location', buildURL(feedbackURI, request.href))
			response.status = 201
		} catch (error) {
			omnibus.log.warn({ err: error }, 'bad request')
			throw Boom.badRequest(error.message)
		}
	})
	meetings.delete('/', async ({ response }) => {
		throttledHTML.cancel()
		response.status = 204
	})
	return meetings
}

const mvpRouters = _.once(() => {
	const events = hackathonDemo()
	const pingUpdate = async () => {
		const lastUpdated = new Date()
		try {
			return {
				lastUpdated: lastUpdated.toISOString(),
				upstreamServices: await upstreamServices(),
			}
		} catch (error) {
			const upstreamService = {
				errorMessage: error.message,
			}
			return {
				lastUpdated: lastUpdated.toISOString(),
				upstreamServices: [upstreamService],
			}
		}
	}
	const throttledUpdate = _.throttle(pingUpdate, 60 * 1000 / PINGS_PER_MINUTE)
	const v0 = new KoaRouter({
		prefix: '/v0',
	})
	v0.get('/ping', async ({ response }) => {
		response.body = await throttledUpdate()
		response.status = 200 // OK
	})
	v0.post('/demo', async ({ request, response }) => {
		try {
			const { actorId, data, event, id, resource } = request.body = await CSWV.validate(request)
			if (actorId === bot.actorId || id !== bot.webhookId) return response.status = 204 // No Content
			const clients = await loadAll({ ciscospark: { bot }, gsuite: { service }, webhook: { data } })
			response.body = { consumed: events.consume(`${resource}:${event}`, { clients, data, request }) }
			response.status = 200 // OK
		} catch (error) {
			throw Boom.badRequest(error.message)
		}
	})
	return [createAdminRouter(), createMeetingsRouter(), v0]
})

module.exports = {
	forServer: mvpRouters,
}
