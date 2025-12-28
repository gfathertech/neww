// src/Plugins/Tools/antilink.js
import { config, updateConfig } from '#config'

export default {
  name: 'AntiLinkManager',
  Commands: ['antilink', 'al'],
  OnlyGroup: true,
  OnlyAdmin: true,

  async handle(sock, m, { args }) {
    const [main, sub, ...rest] = args.split(' ').map(a => a.toLowerCase())

    switch (main) {
      case 'on':
        await this.toggleAntiLink(true, m)
        break
      case 'off':
        await this.toggleAntiLink(false, m)
        break
      case 'status':
        await this.showStatus(sub, m)
        break
      case 'whitelist':
        await this.manageWhitelist(sub, rest.join(' '), m)
        break
      case 'action':
        await this.setAction(sub, m)
        break
      default:
        await this.showHelp(m)
    }
  },

  async toggleAntiLink(enabled, m) {
    try {
      updateConfig({ antiLink: { enabled } })
      const status = enabled ? 'enabled' : 'disabled'
      await m.reply(`✅ Anti-link ${status}`)
    } catch {
      await m.reply('❌ Failed to update Anti-link status')
    }
  },

  async manageWhitelist(sub, domain, m) {
    try {
      let whitelist = [...config.antiLink.whitelist]

      if (!sub) {
        // Show current whitelist
        if (whitelist.length === 0) {
          await m.reply('📭 No domains in whitelist')
        } else {
          const list = whitelist.map(d => `• ${d}`).join('\n')
          await m.reply(`✅ Whitelisted domains:\n${list}`)
        }
        return
      }

      if (!domain) {
        await m.reply('❌ Please specify a domain')
        return
      }

      if (sub === 'add') {
        if (!whitelist.includes(domain)) whitelist.push(domain)
        await m.reply(`✅ Added ${domain} to whitelist`)
      } else if (sub === 'remove') {
        whitelist = whitelist.filter(d => d !== domain)
        await m.reply(`❌ Removed ${domain} from whitelist`)
      } else {
        await m.reply('❌ Invalid whitelist action. Use add/remove')
        return
      }

      updateConfig({ antiLink: { whitelist } })
    } catch {
      await m.reply('❌ Failed to update whitelist')
    }
  },

  async setAction(action, m) {
    const validActions = ['warn', 'delete', 'kick', 'mute']

    if (!action || !validActions.includes(action)) {
      await m.reply(`❌ Invalid action. Use: ${validActions.join(', ')}`)
      return
    }

    try {
      updateConfig({ antiLink: { action } })
      await m.reply(`✅ Action set to: ${action}`)
    } catch {
      await m.reply('❌ Failed to update action')
    }
  },

  async showStatus(sub, m) {
    try {
      const antiLink = config.antiLink

      if (sub === 'delete') {
        // Example: clear some temp status if needed
        await m.reply('🗑️ Anti-link delete subcommand executed')
        return
      }

      const status = antiLink.enabled ? '🟢 ENABLED' : '🔴 DISABLED'
      const message = `🔒 ANTI-LINK STATUS\n\n` +
        `Status: ${status}\n` +
        `Action: ${antiLink.action}\n` +
        `Allow Admins: ${antiLink.allowAdmins ? '✅' : '❌'}\n` +
        `Allow Owner: ${antiLink.allowOwner ? '✅' : '❌'}\n` +
        `Whitelist: ${antiLink.whitelist.length} domains\n` +
        `Blacklist: ${antiLink.blacklist.length} domains`

      await m.reply(message)
    } catch {
      await m.reply('❌ Failed to get status')
    }
  },

  async showHelp(m) {
    const help = `🛡️ ANTI-LINK COMMANDS\n\n` +
      `${m.prefix}antilink on - Enable\n` +
      `${m.prefix}antilink off - Disable\n` +
      `${m.prefix}antilink status [delete] - Show status / delete temp\n` +
      `${m.prefix}antilink action <warn|delete|kick|mute>\n` +
      `${m.prefix}antilink whitelist - Show list\n` +
      `${m.prefix}antilink whitelist add <domain>\n` +
      `${m.prefix}antilink whitelist remove <domain>\n\n` +
      `Admin only`

    await m.reply(help)
  }
}