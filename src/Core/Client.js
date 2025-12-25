import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser
} from 'baileys'
import MAIN_LOGGER from 'pino'
import NodeCache from '@cacheable/node-cache'
import { processCommand } from './BaseBot.js'
import { useMongoAuthState } from './Mongodb.js'
import { config } from '#config'
import qrcode from 'qrcode-terminal'
import { Serialize, cachedGroupMetadata, MetadataCache } from '#lib'
import { log } from '#utils'

const logger = MAIN_LOGGER({ level: 'silent' })
const msgRetryCounterCache = new NodeCache()

export const groupCache = new NodeCache({ stdTTL: 60 * 60, useClones: false })
const phone = config.phone

// Reconnect backoff vars
let reconnectDelay = 1000 // start with 1s
let reconnectAttempts = 0
const MAX_RECONNECTS = 10

/** Starts WhatsApp socket connection */
export const start = async () => {
  const { state, saveCreds } = await useMongoAuthState()
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    msgRetryCounterCache,
    cachedGroupMetadata
  })

  let qrCount = 0
  let pairingRequested = false

  /** Connection updates */
  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update

    // QR code display for non-pairing
    if (qr && !config.usePairing) {
      qrCount++
      log.info('Displaying QR Code')
      qrcode.generate(qr, { small: true })
      log.info(`Please scan with WhatsApp app! (Try ${qrCount}/5)`)

      if (qrCount >= 5) {
        log.error('Timeout: Too many QR attempts')
        process.exit(1)
      }
    }

    // Pairing code request (safe)
    if (
      connection === 'open' &&
      config.usePairing &&
      !sock.authState.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true
      try {
        const code = await sock.requestPairingCode(phone)
        log.info(`PhoneNumber: ${phone}`)
        log.info(`Pairing Code: ${code.slice(0, 4)}-${code.slice(4)}`)
      } catch (err) {
        log.error('Failed to request pairing code:', err.message)
      }
    }

    if (connection === 'open') {
      log.info('Connected to WhatsApp')
      // Reset reconnect variables on success
      reconnectDelay = 1000
      reconnectAttempts = 0
    }

    // Safe reconnect with exponential backoff
    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        reconnectAttempts++
        if (reconnectAttempts > MAX_RECONNECTS) {
          log.error('Max reconnect attempts reached. Exiting...')
          process.exit(1)
        }
        log.warn(
          `Connection closed, reconnecting in ${reconnectDelay / 1000}s (Attempt ${reconnectAttempts}/${MAX_RECONNECTS})...`
        )
        setTimeout(() => start(), reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, 30000) // max 30s
      } else {
        log.error('Connection closed. You are logged out.')
      }
    }
  })

  // Persist creds to MongoDB
  sock.ev.on('creds.update', saveCreds)

  // Messages handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    const m = new Serialize(sock, msg)
    await processCommand(sock, m)
  })

  // Group updates
  sock.ev.on('groups.update', async updates => {
    try {
      const m = new MetadataCache(sock)
      await m.updateGroup(updates)
    } catch (error) {
      log.warn(`[ERROR] Failed to update groups: ${error.message}`)
    }
  })

  // Group participants updates
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action === 'remove') {
      const botKicked = participants.some(p => {
        const participantId = p.id || p
        return (
          participantId === jidNormalizedUser(sock.user.id) ||
          participantId === jidNormalizedUser(sock.user.lid)
        )
      })
      if (botKicked) {
        groupCache.del(id)
        return
      }
    }
    try {
      const m = new MetadataCache(sock)
      await m.updateParticipant(id, participants, action)
    } catch (error) {
      log.warn(`[ERROR] Failed to update participants: ${error.message}`)
    }
  })
}