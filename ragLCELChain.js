// To support the LangChain LCEL RAG chain
const { PromptTemplate } = require("@langchain/core/prompts");
const {
  RunnableSequence,
  RunnablePassthrough,
} = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const {
  AzureCosmosDBVectorStore,
  AzureCosmosDBSimilarityType,
} = require("@langchain/community/vectorstores/azure_cosmosdb");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { MongoClient } = require("mongodb");
const dbClient = new MongoClient(process.env.AZURE_COSMOSDB_CONNECTION_STRING);

// set up the Azure Cosmos DB vector store using the initialized MongoDB client
const azureCosmosDBConfig = {
  client: dbClient,
  databaseName: "grdr",
  collectionName: "exams",
  indexName: "VectorSearchIndex",
  embeddingKey: "contentVector",
  textKey: "_id",
};
const vectorStore = new AzureCosmosDBVectorStore(
  new OpenAIEmbeddings(),
  azureCosmosDBConfig
);

// set up the OpenAI chat model
const chatModel = new ChatOpenAI();

async function ragLCELChain(studentAnswer, question, marks, guide) {
  // A system prompt describes the responsibilities, instructions, and persona of the AI.
  // Note the addition of the templated variable/placeholder for the list of products and the incoming question.
  const systemPrompt = `
            You are a lecturer grading a student's answers to a test.
    
            Your name is Gradr.
    
            You are designed to score a student's answers to a test question based on the provided marking guide.
            
            Assign scores out of the maximum attainable marks.

            Maximum Attainable Marks:
            {marks}

            Question:
            {question}

            Marking guide:
            {guide}

            Answer:
            {answer}
        `;

  // Use a retriever on the Cosmos DB vector store
  //   const retriever = vectorStore.asRetriever();

  // Initialize the prompt
  const prompt = PromptTemplate.fromTemplate(systemPrompt);

  // The RAG chain will populate the variable placeholders of the system prompt
  // with the formatted list of products based on the documents retrieved from the vector store.
  // The RAG chain will then invoke the LLM with the populated prompt and the question.
  // The response from the LLM is then parsed as a string and returned.
  const ragChain = RunnableSequence.from([
    {
      marks,
      question,
      guide,
      answer: new RunnablePassthrough(),
    },
    prompt,
    chatModel,
    new StringOutputParser(),
  ]);

  return await ragChain.invoke(studentAnswer);
}

module.exports = {
  ragLCELChain,
};
