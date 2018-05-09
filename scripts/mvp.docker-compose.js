/* eslint-env node */
const Process = require('child_process')
const path = require('path')

const DEFAULT_PACKAGE_ROOT_PATH = path.resolve(__dirname, '..', '..')
const PACKAGE_ROOT_PATH = process.env.PACKAGE_ROOT_PATH || DEFAULT_PACKAGE_ROOT_PATH
//const PACKAGE_JSON_NAME = require(path.resolve(PACKAGE_ROOT_PATH, 'package.json')).name

const asyncChild = async (parent, ...args) => new Promise((resolve, reject) => {
	const child = Process.spawn(args[0], args.slice(1), {
		cwd: parent.cwd(),
		env: parent.env,
		stdio: 'inherit',
	})
	const kill = () => {
		//if (!child.killed) process.kill(child.pid)
	}
	const timeout = setTimeout(kill, 60 * 1000)
	child.once('exit', (code, signal) => {
		clearTimeout(timeout)
		if (!signal && code === 0) {
			resolve(child)
		} else {
			const message = signal ? `fatal ${signal}` : `exit ${code}`
			reject(Object.assign(new Error(message), { child }))
		}
	})
})

const asyncParent = async (parent, { yamlFilePath }) => {
	//asyncChild(process, 'docker', 'stack', 'deploy', '-c', yamlFilePath, PACKAGE_JSON_NAME)
	await asyncChild(process, 'docker-compose', '-f', yamlFilePath, 'up', '-d')
}

if (!module.parent) {
	/* eslint-disable no-console */
	const args = process.argv.slice(1)
	const DEFAULT_YAML_FILE_PATH = path.resolve(PACKAGE_ROOT_PATH, 'docker-compose.yml')
	const YAML_FILE_PATH = process.env.YAML_FILE_PATH || DEFAULT_YAML_FILE_PATH
	asyncParent(process, { yamlFilePath: args[1] || YAML_FILE_PATH })
		.catch(error => error)
		.then((fatal) => {
			if (fatal instanceof Error) {
				console.error(fatal)
				process.exitCode = 1
			} else {
				process.exitCode = fatal.child.exitCode
			}
		})
}
