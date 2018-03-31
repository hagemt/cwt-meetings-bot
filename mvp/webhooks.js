//const os = require('os')

const config = require('config')
const fetch = require('node-fetch')
const ngrok = require('ngrok')
const url = require('url')

const DEFAULT_HTTP_PORT = config.get('server.port')
const DEFAULT_NGROK_URL = 'http://localhost:4040'

const DEFAULT_URL_ORIGIN = process.env.CISCOSPARK_API_ORIGIN || 'https://api.ciscospark.com' // production
const buildURL = (anyURI, originURL = DEFAULT_URL_ORIGIN) => new url.URL(anyURI, originURL).toString()

// has actorId, secret, webhookId, etc.
const BOT = config.get('ciscospark.bot')

const newTunnelURL = async (port = DEFAULT_HTTP_PORT) => {
	const options = {
		addr: port,
		proto: 'http',
	}
	const httpsURL = await ngrok.connect(options)
	process.on('SIGUSR2', () => ngrok.kill())
	return httpsURL
}

const getTunnelURL = async (port = DEFAULT_HTTP_PORT) => {
	const httpsTunnel = ({ config, proto }) => proto === 'https' && config.addr.endsWith(port)
	try {
		const tunnelsURL = buildURL('/api/tunnels', DEFAULT_NGROK_URL)
		const response = await fetch(tunnelsURL)
		const { tunnels } = await response.json()
		const tunnel = tunnels.find(httpsTunnel)
		if (!tunnel || !tunnel.public_url) {
			throw new Error('no tunnel')
		}
		return tunnel.public_url
	} catch (getError) {
		try {
			return newTunnelURL(port)
		} catch (newError) {
			const messages = `${getError.message}/${newError.message}`
			throw new Error(`failed to find/create tunnel (${messages})`)
		}
	}
}

/*
const createWebhook = async (webhook) => {
	const webhooksURL = buildURL('/v1/webhooks')
	const response = await fetch(webhooksURL, {
		body: JSON.stringify(webhook),
		headers: {
			'Authorization': `Bearer ${BOT.secret}`,
			'Content-Type': 'application/json',
		},
		method: 'POST',
	})
	if (!response.ok) {
		throw new Error(`fetch failure: POST ${webhooksURL} (${await response.text()})`)
	}
	return response.json()
}
*/

const updateWebhook = async (webhook) => {
	const webhooksURL = buildURL(`/v1/webhooks/${BOT.webhookId}`)
	const response = await fetch(webhooksURL, {
		body: JSON.stringify(webhook),
		headers: {
			'Authorization': `Bearer ${BOT.secret}`,
			'Content-Type': 'application/json',
		},
		method: 'PUT',
	})
	if (!response.ok) {
		throw new Error(`fetch failure: PUT ${webhooksURL} (${await response.text()})`)
	}
	return response.json()
}

const listWebhooks = async () => {
	const webhooksURL = buildURL('/v1/webhooks?max=100')
	const headers = {
		'Authorization': `Bearer ${BOT.secret}`,
	}
	const response = await fetch(webhooksURL, { headers })
	if (!response.ok) {
		throw new Error(`fetch failed: GET ${webhooksURL} (${await response.text()})`)
	}
	const { items } = await response.json()
	return items
}

const developmentService = async ({ server }) => {
	const { port } = server.address() // null if not listening
	const demoURL = buildURL('/v0/demo', await getTunnelURL(port))
	for (const { id, targetUrl } of await listWebhooks()) {
		if (id === BOT.webhookId && targetUrl !== demoURL) {
			await updateWebhook({
				name: 'development',
				status: 'active',
				targetUrl: demoURL,
			})
			return
		}
	}
	throw new Error(`no webhook with ID: ${BOT.webhookId}`)
	// need to use createWebhook (requires change to filter)
}

const productionService = async () => {
	throw new Error('not ready for production')
}

module.exports = {
	developmentService,
	productionService,
}
