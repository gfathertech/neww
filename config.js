// src/config.js
// USERS EDIT THIS FILE ONLY!
// Add ANY new configs here - they auto-sync to config.json

const numberBot = '447777331420'
const prefix = ['.']
const botName = 'Kkzaabot'
const owner = ['447777331420', '2349136429929']
const botMode = 'group'
const usePairing = true

// Add ANY new sections here - they auto-appear in config.json
const antiLink = {
  enabled: true,
  action: 'delete',
  allowAdmins: true,
  allowOwner: true,
  muteDuration: 300,
  whitelist: [
    'github.com',
    'google.com',
    'wikipedia.org',
    'stackoverflow.com'
  ],
  blacklist: [],
  exemptUsers: [],
  exemptGroups: []
}

// Add more sections anytime!
const welcomeMessage = {
  enabled: true,
  message: 'Welcome to the group!',
  image: 'https://example.com/welcome.jpg'
}

const autoReply = {
  enabled: false,
  responses: {
    'hello': 'Hi there!',
    'ping': 'Pong!'
  }
}

// ANY new config goes here
const newFeature = {
  setting1: 'value1',
  setting2: ['array', 'values'],
  nested: {
    deep: 'config'
  }
}

// Export single config object
export const config = {
  botName,
  phone: numberBot,
  prefix,
  owner: owner.map(num => `${num}@s.whatsapp.net`),
  botMode,
  usePairing,
  antiLink,
  welcomeMessage,
  autoReply,
  newFeature
  // Add new fields here anytime!
}