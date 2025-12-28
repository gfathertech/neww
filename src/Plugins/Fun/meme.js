import axios from 'axios'
import { config } from '#config'
import { log } from '#utils'

export default {
  name: 'Meme',
  Commands: ['meme', 'memes'],
  OnlyGroup: false,

  /**
   * Handle the command
   */
  async handle(sock, m, { args }) {
    try {
      // Fetch a random meme
      const response = await axios.get('https://meme-api.com/gimme')
      const meme = response.data

      if (!meme || !meme.url) {
        await m.reply('❌ Could not fetch meme at the moment.')
        return
      }

      const caption = `😂 *${meme.title}*\n\n📦 Subreddit: ${meme.subreddit}`

      // Send the meme
      await sock.sendMessage(m.chat, {
        image: { url: meme.url },
        caption
      })

      log.info(`[Meme] Sent meme: ${meme.title}`)
    } catch (error) {
      log.error(`[Meme] Failed to fetch meme: ${error.message}`)
      await m.reply('❌ Failed to fetch meme. Try again later.')
    }
  }
}