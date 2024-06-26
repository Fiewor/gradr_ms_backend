const { MongoClient } = require("mongodb");
const dbClient = new MongoClient(process.env.AZURE_COSMOSDB_CONNECTION_STRING);

async function connectToMongoDB() {
  try {
    let res = await dbClient.connect();
    console.log("Connected to the Cosmos");
    return res;
  } catch (error) {
    console.error(error);
  } finally {
    await dbClient.close();
    console.log("Disconnected from MongoDB");
  }
}

module.exports = { connectToMongoDB };
