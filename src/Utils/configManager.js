import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_JSON_PATH = path.join(process.cwd(), 'config.json')
const CONFIG_JS_PATH = path.join(process.cwd(), 'config.js')

/**
 * Initialize config system
 */
export async function initConfig() {
  console.log('🔄 Initializing config system...')
  try {
    const templateConfig = await loadTemplateConfig()
    console.log('📄 Loaded template from config.js')

    const existingConfig = loadExistingConfig()
    const mergedConfig = deepMerge(templateConfig, existingConfig)

    saveConfig(mergedConfig)
    console.log('✅ Config system ready')
    return mergedConfig
  } catch (error) {
    console.error('❌ Config initialization failed:', error)
    const emergencyConfig = createEmergencyConfig()
    saveConfig(emergencyConfig)
    console.log('⚠️ Created emergency config')
    return emergencyConfig
  }
}

/**
 * Load template configuration dynamically
 */
async function loadTemplateConfig() {
  const module = await import(CONFIG_JS_PATH + `?t=${Date.now()}`) // avoid cache
  let template = null

  if (module.config && typeof module.config === 'object') template = module.config
  else if (module.default && typeof module.default === 'object') template = module.default
  else {
    for (const key of Object.keys(module)) {
      if (typeof module[key] === 'object' && module[key] !== null) {
        template = module[key]
        console.log(`📦 Found config in export: ${key}`)
        break
      }
    }
  }

  if (!template) throw new Error('No configuration object found in config.js')
  return sanitizeForJson(template)
}

/**
 * Load existing runtime config
 */
function loadExistingConfig() {
  if (!fs.existsSync(CONFIG_JSON_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Deep merge template + runtime
 */
function deepMerge(template, existing) {
  const result = structuredClone(template)
  for (const key in existing) {
    if (existing[key] && typeof existing[key] === 'object' && !Array.isArray(existing[key])) {
      result[key] = deepMerge(result[key] || {}, existing[key])
    } else {
      result[key] = existing[key]
    }
  }
  return result
}

/**
 * Remove non-JSON-safe values
 */
function sanitizeForJson(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (seen.has(obj)) return '[Circular]'
  seen.add(obj)

  if (Array.isArray(obj)) return obj.map(v => sanitizeForJson(v, seen))

  const clean = {}
  for (const key in obj) {
    if (typeof obj[key] !== 'function' && typeof obj[key] !== 'symbol' && obj[key] !== undefined) {
      clean[key] = sanitizeForJson(obj[key], seen)
    }
  }
  return clean
}

/**
 * Save config.json
 */
function saveConfig(config) {
  fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2))
}

/**
 * Emergency fallback
 */
function createEmergencyConfig() {
  return {
    botName: 'Kkzaabot',
    prefix: ['.'],
    owner: [],
    antiLink: { enabled: true }
  }
}

/**
 * Update functions
 */
export function updateConfig(updates) {
  const current = loadExistingConfig()
  const merged = deepMerge(current, updates)
  saveConfig(merged)
  return merged
}

export function updateSection(section, values) {
  return updateConfig({ [section]: values })
}

/**
 * Optional: watch template changes in dev
 */
export function watchTemplateChanges() {
  if (!fs.existsSync(CONFIG_JS_PATH)) return
  fs.watch(CONFIG_JS_PATH, async () => {
    console.log('📝 config.js changed — syncing...')
    await initConfig()
  })
}

/**
 * LIVE config proxy
 * Anywhere you do `import { config } from '#config'`
 */
export const config = new Proxy(
  {},
  {
    get(_, prop) {
      const cfg = loadExistingConfig()
      return cfg[prop]
    },
    has(_, prop) {
      return prop in loadExistingConfig()
    },
    ownKeys() {
      return Reflect.ownKeys(loadExistingConfig())
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true }
    }
  }
)