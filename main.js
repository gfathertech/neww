/*
 👨‍💻 Developer  : Zaidan Yusuf Akar
 💻 GitHub     : github.com/kkzaadev
 📝 Kkzaabot Made With Love And Sighs❤️👉👌💦
*/

import { startBot } from '#core'
import { initHandlers, reloadPlugins } from '#lib'
import { log } from '#utils'

log.info(`Start BaseBot ...`)

process.env.TZ = 'Asia/Jakarta'

try {
	await initHandlers()
console.log("First");
	await reloadPlugins()
log.info("Second")
	await startBot()
log.info("Third")
} catch (err) {
	log.error(`Error: ${err.message}`)
	process.exit(1)
}

process.on('uncaughtException', async err => {
	log.error('Uncaught Exception:', err)
	process.exit(1)
})

process.on('unhandledRejection', async reason => {
	log.error('Unhandled Rejection:', reason)
	process.exit(1)
})
