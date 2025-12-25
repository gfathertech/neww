import { MongoClient } from 'mongodb'
import { proto } from 'baileys'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = 'whatsapp'
const COLLECTION = 'auth'

let mongoClient
let authCollection

async function initMongo() {
  if (authCollection) return authCollection

  mongoClient = new MongoClient(MONGO_URI)
  await mongoClient.connect()

  const db = mongoClient.db(DB_NAME)
  authCollection = db.collection(COLLECTION)
  return authCollection
}

export async function useMongoAuthState() {
  const col = await initMongo()

  const credsDoc = await col.findOne({ _id: 'creds' })

  const creds = credsDoc?.data
    ? proto.Credential.fromObject(credsDoc.data)
    : proto.Credential.fromObject({})

  const keys = {
    get: async (type, ids) => {
      const data = await col
        .find({ _id: { $in: ids.map(id => `${type}-${id}`) } })
        .toArray()

      return Object.fromEntries(
        data.map(doc => [doc._id.replace(`${type}-`, ''), doc.data])
      )
    },

    set: async data => {
      const bulk = col.initializeUnorderedBulkOp()
      for (const category in data) {
        for (const id in data[category]) {
          bulk.find({ _id: `${category}-${id}` }).upsert().updateOne({
            $set: { data: data[category][id] }
          })
        }
      }
      if (bulk.length > 0) await bulk.execute()
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