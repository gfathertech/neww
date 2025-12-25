import { MongoClient } from 'mongodb'
import { initAuthCreds } from 'baileys'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = 'whatsapp'
const COLLECTION = 'auth'

let mongoClient
let authCollection

async function initMongo() {
  if (authCollection) return authCollection

  mongoClient = new MongoClient(MONGO_URI, {
    tls: true,
    serverSelectionTimeoutMS: 10000
  })

  await mongoClient.connect()
  const db = mongoClient.db(DB_NAME)
  authCollection = db.collection(COLLECTION)

  return authCollection
}

export async function useMongoAuthState() {
  const col = await initMongo()

  const credsDoc = await col.findOne({ _id: 'creds' })
  const creds = credsDoc?.data ?? initAuthCreds()

  const keys = {
    get: async (type, ids) => {
      const docs = await col
        .find({ _id: { $in: ids.map(id => `${type}-${id}`) } })
        .toArray()

      return Object.fromEntries(
        docs.map(d => [d._id.replace(`${type}-`, ''), d.data])
      )
    },

    set: async data => {
      const bulk = col.initializeUnorderedBulkOp()
      let hasOps = false

      for (const category in data) {
        for (const id in data[category]) {
          hasOps = true
          bulk.find({ _id: `${category}-${id}` }).upsert().updateOne({
            $set: { data: data[category][id] }
          })
        }
      }

      if (hasOps) await bulk.execute()
    }
  }

  return {
    state: { creds, keys },
    saveCreds: async () => {
      await col.updateOne(
        { _id: 'creds' },
        { $set: { data: creds } },
        { upsert: true }
      )
    }
  }
}