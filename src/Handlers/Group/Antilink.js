import { isJidGroup } from 'baileys'
import { config } from '#config'
import { Group, isAdmin } from '#lib'
import { log } from '#utils'

export default {
  name: 'AntiLink',
  priority: 50,
  
  /** URL detection regex */
  urlPatterns: {
    // Main URL pattern
    url: /\b(?:https?:\/\/|www\.)[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*/gi,
    
    // Specific service patterns (for special handling if needed)
    whatsappInvite: /(chat\.whatsapp\.com\/[a-zA-Z0-9]{10,})/gi,
    telegram: /(t\.me\/|telegram\.me\/)/gi,
    instagram: /(instagram\.com\/|instagr\.am\/)/gi,
    youtube: /(youtube\.com\/|youtu\.be\/)/gi,
    tiktok: /(tiktok\.com\/)/gi,
    twitter: /(twitter\.com\/|x\.com\/)/gi
  },
  
  /**
   * Main handler function - called for every message
   * Returns true to allow message, false to block it
   */
  async process(sock, m) {
    try {
      // Skip if not a group message
      if (!m.isGroup) return true
           
      // Skip if anti-link is disabled
      if (!config.antiLink?.enabled) return true
      
      // Get group info
      const group = new Group(m.chat, sock)
      await group.ensureMetadata()
      
      // Check if bot is admin (can't delete messages otherwise)
      const botId = sock.user.id
      if (!isAdmin(group.metadata, botId)) {
        // Bot not admin, can't enforce anti-link
        return true
      }
      
      // Check if this group is exempt
      if (config.antiLink.exemptGroups?.includes(m.chat)) {
        return true
      }
      
      // Check sender permissions
      const isSenderOwner = config.owner?.includes(m.senderAlt)
      const senderIsAdmin = isAdmin(group.metadata, m.sender)
      
      // Allow owner if configured
      if (config.antiLink.allowOwner && isSenderOwner) {
        return true
      }
      
      // Check if user is exempt
      if (config.antiLink.exemptUsers?.includes(m.sender)) {
        return true
      }
      
      // Allow admins if configured
      if (config.antiLink.allowAdmins && senderIsAdmin) {
        return true
      }
      
      // Extract URLs from message
      const text = m.text || ''
      const urls = this.extractUrls(text)
      
      // Skip if no URLs found
      if (urls.length === 0) return true
      
      // Check each URL against rules
      const violatingUrls = urls.filter(url => this.isUrlViolating(url, config.antiLink))
      
      // If any violating URLs found, take action
      if (violatingUrls.length > 0) {
        await this.handleViolation(sock, m, violatingUrls, config.antiLink, group)
        return false // Block the message
      }
      
      return true // Allow the message
      
    } catch (error) {
      log.error(`[AntiLink Handler] Error: ${error.message}`)
      log.debug(error.stack)
      return true // Don't block on error
    }
  },
  
  /**
   * Extract all URLs from text
   */
  extractUrls(text) {
    if (!text || typeof text !== 'string') return []
    
    try {
      const matches = text.match(this.urlPatterns.url) || []
      return matches
        .filter(url => url && url.trim())
        .map(url => url.toLowerCase().trim())
    } catch (error) {
      return []
    }
  },
  
  /**
   * Check if a URL violates anti-link rules
   */
  isUrlViolating(url, antiLinkConfig) {
    try {
      // Extract domain from URL
      const domain = this.extractDomain(url)
      if (!domain) return false
      
      // Check blacklist first (highest priority)
      if (this.isDomainInList(domain, antiLinkConfig.blacklist || [])) {
        log.debug(`[AntiLink] Domain blacklisted: ${domain}`)
        return true
      }
      
      // Check whitelist
      if (this.isDomainInList(domain, antiLinkConfig.whitelist || [])) {
        log.debug(`[AntiLink] Domain whitelisted: ${domain}`)
        return false // Whitelisted = allowed
      }
      
      // If we have a whitelist and domain is not in it, it's a violation
      // If no whitelist exists, everything is allowed (unless blacklisted)
      if (antiLinkConfig.whitelist && antiLinkConfig.whitelist.length > 0) {
        log.debug(`[AntiLink] Domain not in whitelist: ${domain}`)
        return true
      }
      
      return false
      
    } catch (error) {
      log.warn(`[AntiLink] Error checking URL ${url}: ${error.message}`)
      return false // On error, allow the URL
    }
  },
  
  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      // Add protocol if missing
      let cleanUrl = url
      if (!url.includes('://')) {
        cleanUrl = 'https://' + url
      }
      
      const urlObj = new URL(cleanUrl)
      let domain = urlObj.hostname
      
      // Remove www. prefix
      domain = domain.replace(/^www\./i, '')
      
      // Convert to lowercase for consistent comparison
      domain = domain.toLowerCase()
      
      return domain
    } catch (error) {
      return null
    }
  },
  
  /**
   * Check if domain is in a list (supports subdomain matching)
   */
  isDomainInList(domain, list) {
    if (!domain || !Array.isArray(list)) return false
    
    return list.some(item => {
      const listDomain = item.toLowerCase().trim()
      
      // Exact match
      if (domain === listDomain) return true
      
      // Subdomain match (e.g., sub.example.com matches example.com)
      if (domain.endsWith('.' + listDomain)) return true
      
      return false
    })
  },
  
  /**
   * Handle violation based on configured action
   */
  async handleViolation(sock, m, urls, antiLinkConfig, group) {
    const action = antiLinkConfig.action || 'delete'
    const domain = this.extractDomain(urls[0]) || 'unknown domain'
    
    log.info(`[AntiLink] Violation detected from ${m.sender} in ${m.chat}: ${domain}`)
    
    switch (action) {
      case 'warn':
        await this.warnUser(sock, m, domain)
        break
        
      case 'delete':
        await this.deleteMessage(sock, m)
        await this.notifyDeletion(sock, m, domain)
        break
        
      case 'kick':
        await this.deleteMessage(sock, m)
        await this.kickUser(sock, m, group, domain)
        break
        
      case 'mute':
        await this.deleteMessage(sock, m)
        await this.muteUser(sock, m, domain, antiLinkConfig.muteDuration)
        break
        
      default:
        // Default to delete
        await this.deleteMessage(sock, m)
        await this.notifyDeletion(sock, m, domain)
        break
    }
    
    // Log the violation
    this.logViolation(m, urls, action)
  },
  
  /**
   * Delete the violating message
   */
  async deleteMessage(sock, m) {
    try {
      await sock.sendMessage(m.chat, {
        delete: m.key
      })
      log.debug(`[AntiLink] Message deleted from ${m.sender}`)
    } catch (error) {
      log.warn(`[AntiLink] Failed to delete message: ${error.message}`)
    }
  },
  
  /**
   * Warn user about violation
   */
  async warnUser(sock, m, domain) {
    try {
      const warning = `⚠️ *Link Detected*\n\n` +
        `@${m.sender.split('@')[0]}, please avoid sending links in this group.\n` +
        `Domain: \`${domain}\`\n\n` +
        `_This is a warning. Repeated violations may result in stricter actions._`
      
      await sock.sendMessage(m.chat, {
        text: warning,
        mentions: [m.sender]
      })
      
      log.debug(`[AntiLink] Warning sent to ${m.sender}`)
    } catch (error) {
      log.warn(`[AntiLink] Failed to send warning: ${error.message}`)
    }
  },
  
  /**
   * Notify about message deletion
   */
  async notifyDeletion(sock, m, domain) {
    try {
      const notification = `🗑️ *Message Deleted*\n\n` +
        `@${m.sender.split('@')[0]}, your message was deleted because it contains links.\n` +
        `Domain: \`${domain}\`\n\n` +
        `_Anti-link protection is active in this group. ` +
        `Use \`.antilink status\` to check allowed domains._`
      
      await sock.sendMessage(m.chat, {
        text: notification,
        mentions: [m.sender]
      }, { quoted: m })
      
      log.debug(`[AntiLink] Deletion notification sent for ${m.sender}`)
    } catch (error) {
      log.warn(`[AntiLink] Failed to send deletion notification: ${error.message}`)
    }
  },
  
  /**
   * Kick user for violation
   */
  async kickUser(sock, m, group, domain) {
    try {
      // First delete the message
      await this.deleteMessage(sock, m)
      
      // Then kick the user
      await group.remove(m.sender)
      
      const kickMsg = `🚫 *User Removed*\n\n` +
        `@${m.sender.split('@')[0]} was removed from the group for sending unauthorized links.\n` +
        `Domain: \`${domain}\`\n\n` +
        `_Contact a group admin to be added back._`
      
      await sock.sendMessage(m.chat, {
        text: kickMsg,
        mentions: [m.sender]
      })
      
      log.info(`[AntiLink] User ${m.sender} kicked for link violation`)
    } catch (error) {
      log.error(`[AntiLink] Failed to kick user: ${error.message}`)
      
      // Fallback to just deleting the message
      await this.deleteMessage(sock, m)
      await this.notifyDeletion(sock, m, domain)
    }
  },
  
  /**
   * Mute user (simulated - WhatsApp doesn't have direct user mute API)
   */
  async muteUser(sock, m, domain, muteDuration = 300) {
    try {
      // First delete the message
      await this.deleteMessage(sock, m)
      
      const minutes = Math.floor(muteDuration / 60)
      const muteMsg = `🔇 *User Restricted*\n\n` +
        `@${m.sender.split('@')[0]} is restricted from sending messages for ${minutes} minutes.\n` +
        `Domain: \`${domain}\`\n\n` +
        `_Restriction will be lifted automatically._`
      
      await sock.sendMessage(m.chat, {
        text: muteMsg,
        mentions: [m.sender]
      })
      
      log.info(`[AntiLink] User ${m.sender} muted for ${minutes} minutes`)
      
      // Note: Actual muting would require tracking and blocking messages
      // This is just a notification-based "soft mute"
      
    } catch (error) {
      log.error(`[AntiLink] Failed to mute user: ${error.message}`)
      await this.deleteMessage(sock, m)
    }
  },
  
  /**
   * Log violation for tracking
   */
  logViolation(m, urls, action) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: m.sender,
      userName: m.pushName || 'Unknown',
      chatId: m.chat,
      urls: urls.slice(0, 3), // Log only first 3 URLs
      actionTaken: action,
      messageId: m.key.id
    }
    
    log.warn(`[AntiLink Violation] ${JSON.stringify(logEntry, null, 2)}`)
  },
  
  /**
   * Helper to get config (fallback if global.config not available)
   */
  async getConfig() {
    try {
      // Try to import config.json directly
      const configPath = new URL('../../config.json', import.meta.url)
      const configModule = await import(configPath.href + `?t=${Date.now()}`)
      return configModule.default || configModule
    } catch (error) {
      log.error(`[AntiLink] Failed to load config: ${error.message}`)
      return {
        antiLink: {
          enabled: false,
          whitelist: [],
          blacklist: []
        }
      }
    }
  }
}