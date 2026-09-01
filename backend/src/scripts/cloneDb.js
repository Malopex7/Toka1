import 'dotenv/config';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

const SOURCE_URI = 'mongodb+srv://malopex:lKWDGwc0KzmxTT7d@cluster0.mzpmg3f.mongodb.net/toka-db';
const TARGET_URI = process.env.MONGO_URI;

async function inspectAndClone() {
  console.log('--- Database Migration Tool ---');
  console.log('Source:', SOURCE_URI.replace(/:[^:@]+@/, ':****@'));
  console.log('Target:', TARGET_URI ? TARGET_URI.replace(/:[^:@]+@/, ':****@') : 'MISSING TARGET_URI');

  if (!TARGET_URI) {
    console.error('Error: TARGET_URI (process.env.MONGO_URI) is not defined in backend/.env');
    process.exit(1);
  }

  let sourceConn;
  let targetConn;

  try {
    console.log('\nConnecting to source database...');
    sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
    console.log('✓ Connected to Source DB');

    console.log('Connecting to target database...');
    targetConn = await mongoose.createConnection(TARGET_URI).asPromise();
    console.log('✓ Connected to Target DB');

    const collections = await sourceConn.db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections in source:`);

    for (const col of collections) {
      const colName = col.name;
      // Skip system collections
      if (colName.startsWith('system.')) continue;

      const sourceCollection = sourceConn.db.collection(colName);
      const targetCollection = targetConn.db.collection(colName);

      const count = await sourceCollection.countDocuments();
      console.log(`\n📦 Migrating "${colName}" (${count} documents)...`);

      if (count === 0) {
        console.log(`   Skipping empty collection "${colName}".`);
        continue;
      }

      // Read all documents from source in batches of 500
      const cursor = sourceCollection.find({});
      let batch = [];
      let totalMigrated = 0;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        batch.push(doc);

        if (batch.length >= 500) {
          // Upsert documents into target by _id to avoid duplicate key errors
          const operations = batch.map((d) => ({
            replaceOne: {
              filter: { _id: d._id },
              replacement: d,
              upsert: true,
            },
          }));
          await targetCollection.bulkWrite(operations);
          totalMigrated += batch.length;
          process.stdout.write(`   Migrated ${totalMigrated}/${count} documents...\r`);
          batch = [];
        }
      }

      if (batch.length > 0) {
        const operations = batch.map((d) => ({
          replaceOne: {
            filter: { _id: d._id },
            replacement: d,
            upsert: true,
          },
        }));
        await targetCollection.bulkWrite(operations);
        totalMigrated += batch.length;
        batch = [];
      }

      console.log(`   ✓ Successfully migrated ${totalMigrated} documents into "${colName}".`);

      // Copy indexes (except default _id_ index)
      try {
        const indexes = await sourceCollection.indexes();
        for (const idx of indexes) {
          if (idx.name === '_id_') continue;
          const { key, name, unique, sparse, background } = idx;
          const options = { name };
          if (unique) options.unique = true;
          if (sparse) options.sparse = true;
          if (background) options.background = true;
          try {
            await targetCollection.createIndex(key, options);
          } catch (idxErr) {
            console.warn(`   ⚠️ Notice copying index ${name}:`, idxErr.message);
          }
        }
        console.log(`   ✓ Cloned indexes for "${colName}".`);
      } catch (idxErr) {
        console.warn(`   ⚠️ Could not inspect indexes for "${colName}":`, idxErr.message);
      }
    }

    console.log('\n🎉 ALL DATA HAS BEEN SUCCESSFULLY IMPORTED TO YOUR NEW DATABASE!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    if (sourceConn) await sourceConn.close();
    if (targetConn) await targetConn.close();
    process.exit(0);
  }
}

inspectAndClone();
