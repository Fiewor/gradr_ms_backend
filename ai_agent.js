require("dotenv").config();
const { MongoClient } = require("mongodb");
const { AgentExecutor } = require("langchain/agents");
const {
  OpenAIFunctionsAgentOutputParser,
} = require("langchain/agents/openai/output_parser");
const {
  formatToOpenAIFunctionMessages,
} = require("langchain/agents/format_scratchpad");
const { DynamicTool } = require("@langchain/core/tools");
const { RunnableSequence } = require("@langchain/core/runnables");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const {
  MessagesPlaceholder,
  ChatPromptTemplate,
} = require("@langchain/core/prompts");
const {
  convertToOpenAIFunction,
} = require("@langchain/core/utils/function_calling");
const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const {
  AzureCosmosDBVectorStore,
} = require("@langchain/community/vectorstores/azure_cosmosdb");

class CosmicWorksAIAgent {
  constructor() {
    // set up the MongoDB client
    this.dbClient = new MongoClient(
      process.env.AZURE_COSMOSDB_CONNECTION_STRING
    );
    // set up the Azure Cosmos DB vector store
    const azureCosmosDBConfig = {
      client: this.dbClient,
      databaseName: "cosmic_works",
      collectionName: "products",
      indexName: "VectorSearchIndex",
      embeddingKey: "contentVector",
      textKey: "_id",
    };
    this.vectorStore = new AzureCosmosDBVectorStore(
      new OpenAIEmbeddings(),
      azureCosmosDBConfig
    );

    // set up the OpenAI chat model
    // https://js.langchain.com/docs/integrations/chat/azure
    this.chatModel = new ChatOpenAI({
      temperature: 0,
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
      azureOpenAIApiDeploymentName:
        process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
    });

    // initialize the chat history
    this.chatHistory = [];

    // initialize the agent executor
    (async () => {
      this.agentExecutor = await this.buildAgentExecutor();
    })();
  }

  async formatDocuments(docs) {
    // Prepares the product list for the system prompt.
    let strDocs = "";
    for (let index = 0; index < docs.length; index++) {
      let doc = docs[index];
      let docFormatted = { _id: doc.pageContent };
      Object.assign(docFormatted, doc.metadata);

      // Build the product document without the contentVector and tags
      if ("contentVector" in docFormatted) {
        delete docFormatted["contentVector"];
      }
      if ("tags" in docFormatted) {
        delete docFormatted["tags"];
      }

      // Add the formatted product document to the list
      strDocs += JSON.stringify(docFormatted, null, "\t");

      // Add a comma and newline after each item except the last
      if (index < docs.length - 1) {
        strDocs += ",\n";
      }
    }
    // Add two newlines after the last item
    strDocs += "\n\n";
    return strDocs;
  }

  async buildAgentExecutor() {
    // A system prompt describes the responsibilities, instructions, and persona of the AI.
    // Note the variable placeholders for the list of products and the incoming question are not included.
    // An agent system prompt contains only the persona and instructions for the AI.
    const systemMessage = `
            You are a lecturer grading students answers to a test.
    
            Your name is Gradr.
    
            You are designed to score students answers based on the provided marking guide and online answers.
    
            If you don't know the answer to a question, respond with "I don't know."
            
            Only answer questions related to the question.
        `;
    // Create vector store retriever chain to retrieve documents and formats them as a string for the prompt.
    const retrieverChain = this.vectorStore
      .asRetriever()
      .pipe(this.formatDocuments);

    // Define tools for the agent can use, the description is important this is what the AI will
    // use to decide which tool to use.

    // A tool that retrieves product information from Cosmic Works based on the user's question.
    const answersRetrieverTool = new DynamicTool({
      name: "answers_retriever_tool",
      description: `Searches Cosmic Works product information for similar products based on the question. 
                    Returns the product information in JSON format.`,
      func: async (input) => await retrieverChain.invoke(input),
    });

    // Generate OpenAI function metadata to provide to the LLM
    // The LLM will use this metadata to decide which tool to use based on the description.
    const tools = [answersRetrieverTool];
    const modelWithFunctions = this.chatModel.bind({
      functions: tools.map((tool) => convertToOpenAIFunction(tool)),
    });

    // OpenAI function calling is fine-tuned for tool using therefore you don't need to provide instruction.
    // All that is required is that there be two variables: `input` and `agent_scratchpad`.
    // Input represents the user prompt and agent_scratchpad acts as a log of tool invocations and outputs.
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Define the agent and executor
    // An agent is a type of chain that reasons over the input prompt and has the ability
    // to decide which function(s) (tools) to use and parses the output of the functions.
    const runnableAgent = RunnableSequence.from([
      {
        input: (i) => i.input,
        agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps),
        chat_history: (i) => i.chat_history,
      },
      prompt,
      modelWithFunctions,
      new OpenAIFunctionsAgentOutputParser(),
    ]);

    // An agent executor can be thought of as a runtime, it orchestrates the actions of the agent
    // until completed. This can be the result of a single or multiple actions (one can feed into the next).
    // Note: If you wish to see verbose output of the tool usage of the agent,
    //       set returnIntermediateSteps to true
    const executor = AgentExecutor.fromAgentAndTools({
      agent: runnableAgent,
      tools,
      //returnIntermediateSteps: true
    });

    return executor;
  }

  // Helper function that executes the agent with user input and returns the string output
  async executeAgent(input) {
    let returnValue = "";
    try {
      await this.dbClient.connect();
      // Invoke the agent with the user input
      const result = await this.agentExecutor.invoke({
        input: input,
        chat_history: this.chatHistory,
      });

      this.chatHistory.push(new HumanMessage(input));
      this.chatHistory.push(new AIMessage(result.output));

      // Output the intermediate steps of the agent if returnIntermediateSteps is set to true
      if (this.agentExecutor.returnIntermediateSteps) {
        console.log(JSON.stringify(result.intermediateSteps, null, 2));
      }
      // Return the final response from the agent
      returnValue = result.output;
    } finally {
      await this.dbClient.close();
    }
    return returnValue;
  }
}

module.exports = CosmicWorksAIAgent;
