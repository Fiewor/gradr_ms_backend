const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

// set up the Azure OpenAI client
// const embeddingsDeploymentName = "embeddings";
const embeddingsDeploymentName =
  process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME;
const aoaiClient = new OpenAIClient(
  `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.openai.azure.com/`,
  new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
);

async function generateEmbeddings(text) {
  console.log("generating embeddings...");

  const embeddings = await aoaiClient.getEmbeddings(
    embeddingsDeploymentName,
    text
  );
  console.log("embeddings: ", embeddings);
  // Rest period to avoid rate limiting on Azure OpenAI
  await new Promise((resolve) => setTimeout(resolve, 500));
  return embeddings.data[0].embedding;
}

module.exports = {
  generateEmbeddings,
};
