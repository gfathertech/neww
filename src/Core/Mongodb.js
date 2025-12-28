import { MongoClient } from 'mongodb'
import { initAuthCreds, BufferJSON } from 'baileys'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = 'whatsapp'
const COLLECTION = 'auth'

let mongoClient
let authCollection

export async function initMongo() {
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
    
    // CHANGE 1: Use BufferJSON.reviver to restore specific Baileys object types
    const creds = credsDoc 
        ? JSON.parse(credsDoc.value, BufferJSON.reviver) 
        : initAuthCreds()

    const keys = {
        get: async (type, ids) => {
            const data = {}
            // CHANGE 2: Kept the $in fix from before
            const docs = await col
                .find({ _id: { $in: ids.map(id => `${type}-${id}`) } })
                .toArray()

            docs.forEach(doc => {
                // CHANGE 3: Parse properly using reviver
                data[doc._id.replace(`${type}-`, '')] = JSON.parse(doc.value, BufferJSON.reviver)
            })

            return data
        },

        set: async (data) => {
            const bulk = col.initializeUnorderedBulkOp()
            let hasOps = false

            for (const category in data) {
                for (const id in data[category]) {
                    hasOps = true
                    // CHANGE 4: Store as stringified JSON to prevent BSON corruption
                    bulk.find({ _id: `${category}-${id}` }).upsert().updateOne({
                        $set: { value: JSON.stringify(data[category][id], BufferJSON.replacer) }
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
                { $set: { value: JSON.stringify(creds, BufferJSON.replacer) } },
                { upsert: true }
            )
        }
    }
}
