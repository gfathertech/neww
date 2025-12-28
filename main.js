/*
 👨‍💻 Developer  : Zaidan Yusuf Akar
 💻 GitHub     : github.com/kkzaadev
 📝 Kkzaabot Made With Love And Sighs❤️👉👌💦
*/

import express from 'express'
import { startBot, initMongo} from '#core'
import { initHandlers, reloadPlugins } from '#lib'
import { log } from '#utils'
import { initConfig } from '#config'

log.info(`Start BaseBot ...`)

process.env.TZ = 'Asia/Jakarta' 

const app = express()
const PORT = process.env.PORT || 7860

let botStarted = false


// 🟢 Hugging Face root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    bot: botStarted ? 'online' : 'starting',
    uptime: process.uptime()
  })
})

// 🩺 Health check (for UptimeRobot)
app.get('/health', (req, res) => {
  res.send('OK')
})

app.listen(PORT, async () => {
  log.info(`Express server running on port ${PORT}`)

  if (botStarted) return
  botStarted = true

  try {
    await initConfig()
    log.info("Config loaded")
    
    await initMongo()
    log.info("MongoDB connected")
    
    await initHandlers()
    console.log("First")

    await reloadPlugins()
    log.info("Second")

    await startBot()
    log.info("Third")

  } catch (err) {
    log.error(`Error: ${err.message}`)
    process.exit(1)
  }
})

process.on('uncaughtException', err => {
  log.error('Uncaught Exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', reason => {
  log.error('Unhandled Rejection:', reason)
  process.exit(1)
})