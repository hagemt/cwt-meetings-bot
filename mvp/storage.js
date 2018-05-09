const fs = require('fs')
const path = require('path')

const _ = require('lodash')

const Logging = require('./logging.js')

const getConfigLocalStorage = _.once(() => {
	const log = Logging.getChildLogger({
		component: 'storage',
	})
	const readJSON = async (filePath, defaultValue) => {
		try {
			return JSON.parse(fs.readFileSync(filePath))
		} catch (error) {
			switch (error.code) {
			case 'ENOENT':
				log.info({ path: filePath, value: defaultValue }, 'JSON read default')
				break
			default:
				log.error({ err: error }, 'JSON read failure')
			}
			return defaultValue
		}
	}
	const writeJSON = async (filePath, objectJSON) => {
		try {
			const stringJSON = JSON.stringify(objectJSON, null, '\t')
			fs.writeFileSync(filePath, stringJSON) // blocks other I/O
		} catch (error) {
			log.error({ err: error }, 'JSON write failure')
		}
	}
	const CONFIG_PATH = path.resolve(__dirname, '..', 'config') // hack
	const MEETINGS_PATH = path.resolve(CONFIG_PATH, 'local.meetings.json')
	const addMeeting = async (...args) => {
		const meeting = Object.assign({}, ...args)
		const { meetings } = await readJSON(MEETINGS_PATH, { meetings: [] })
		await writeJSON(MEETINGS_PATH, { meetings: meetings.concat(meeting) })
		return meeting
	}
	const getMeetings = async () => {
		const { meetings } = await readJSON(MEETINGS_PATH, { meetings: [] })
		return meetings
	}
	return Object.freeze({ addMeeting, getMeetings })
})

module.exports = {
	defaultStorage: getConfigLocalStorage,
}
