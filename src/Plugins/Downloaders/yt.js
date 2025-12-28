// src/Plugins/Tools/youtube.js
import ytdl from 'ytdl-core'
import fs from 'fs'
import path from 'path'
import { log } from '#utils'

export default {
  name: 'YouTubeDownloader',
  Commands: ['yt', 'youtube'],
  OnlyGroup: false,
  OnlyAdmin: false,

  async handle(sock, m, { args, command }) {
    log.info(`[YouTube Plugin] Command received: ${command}`)
    log.info(`[YouTube Plugin] Raw args: ${args}`)

    const url = args[0]?.trim()
    if (!url) {
      await m.reply('❌ Please provide a YouTube link.\nExample: `.yt https://www.youtube.com/watch?v=VIDEOID`')
      return
    }

    log.info(`[YouTube Plugin] Parsed URL: ${url}`)

    // Validate YouTube URL
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})([&?].*)?$/i
    const match = url.match(ytRegex)

    log.info(`[YouTube Plugin] Regex match: ${match}`)

    if (!match) {
      await m.reply('❌ Invalid YouTube URL.')
      return
    }

    const videoId = match[4]
    log.info(`[YouTube Plugin] Extracted video ID: ${videoId}`)

    try {
      const info = await ytdl.getInfo(videoId)
      const title = info.videoDetails.title
      log.info(`[YouTube Plugin] Video title: ${title}`)

      // Download audio
      const audioStream = ytdl(videoId, { filter: 'audioonly', quality: 'highestaudio' })
      const filePath = path.join(process.cwd(), `downloads/${videoId}.mp3`)

      if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true })

      const writeStream = fs.createWriteStream(filePath)
      audioStream.pipe(writeStream)
      writeStream.on('finish', async () => {
        await sock.sendMessage(m.chat, {
          audio: fs.readFileSync(filePath),
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`
        })
        fs.unlinkSync(filePath)
      })

      await m.reply(`🎵 Downloading "${title}"... Please wait.`)

    } catch (error) {
      log.error(`[YouTube Plugin] Failed to download video: ${error.message}`)
      await m.reply('❌ Failed to download video. Try another link.')
    }
  }
}