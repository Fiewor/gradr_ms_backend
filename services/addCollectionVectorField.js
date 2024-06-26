const { generateEmbeddings } = require("./generateEmbeddings");
const { MongoClient } = require("mongodb");
const dbClient = new MongoClient(process.env.AZURE_COSMOSDB_CONNECTION_STRING);

async function addCollectionContentVectorField(db, collectionName) {
  await dbClient.connect();

  const collection = db.collection(collectionName);
  const docs = await collection.find({}).toArray();
  console.log(`docs in ${collection} collection: `, docs);
  const bulkOperations = [];
  console.log(
    `Generating content vectors for ${docs.length} documents in ${collectionName} collection`
  );
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    // do not include contentVector field in the content to be embedded
    if ("contentVector" in doc) {
      delete doc["contentVector"];
    }
    const content = JSON.stringify(doc);
    console.log("call generateEmbeddings");
    const contentVector = await generateEmbeddings(content);
    bulkOperations.push({
      updateOne: {
        filter: { _id: doc["_id"] },
        update: { $set: { contentVector: contentVector } },
        upsert: true,
      },
    });
    //output progress every 25 documents
    if ((i + 1) % 25 === 0 || i === docs.length - 1) {
      console.log(
        `Generated ${i + 1} content vectors of ${
          docs.length
        } in the ${collectionName} collection`
      );
    }
  }
  if (bulkOperations.length > 0) {
    console.log(
      `Persisting the generated content vectors in the ${collectionName} collection using bulkWrite upserts`
    );
    await collection.bulkWrite(bulkOperations);
    console.log(
      `Finished persisting the content vectors to the ${collectionName} collection`
    );
  }

  //check to see if the vector index already exists on the collection
  console.log(
    `Checking if vector index exists in the ${collectionName} collection`
  );
  const vectorIndexExists = await collection.indexExists("VectorSearchIndex");
  console.log("vector exists: ", vectorIndexExists);

  if (!vectorIndexExists) {
    await db.command({
      createIndexes: collectionName,
      indexes: [
        {
          name: "VectorSearchIndex",
          key: {
            contentVector: "cosmosSearch",
          },
          cosmosSearchOptions: {
            kind: "vector-ivf",
            numLists: 1,
            similarity: "COS",
            dimensions: 1536,
          },
        },
      ],
    });
    console.log(
      `Created vector index on contentVector field on ${collectionName} collection`
    );
  } else {
    console.log(
      `Vector index already exists on contentVector field in the ${collectionName} collection`
    );
  }
}
module.exports = {
  addCollectionContentVectorField,
};
