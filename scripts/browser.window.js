/* eslint-env node */
const Process = require('child_process')

const openBrowserTabs = async (...args) => {
	return Process.spawn('firefox', args, {
		detach: true,
	})
}

if (!module.parent) {
	const tabs = process.argv.slice(2)
	const wait = 2000 // ms (for container)
	setTimeout(openBrowserTabs, wait, ...tabs)
}
