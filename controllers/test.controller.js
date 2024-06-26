require("dotenv").config();
const WordExtractor = require("word-extractor");
const {
  ShareServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-file-share");
const { connectToMongoDB } = require("../config/db");
const {
  addCollectionContentVectorField,
} = require("../services/addCollectionVectorField");
const { ragLCELChain } = require("../ragLCELChain");

// the azure file share client
const account = "gradrstorage";
const accountKey = process.env.AZURE_STORAGE_KEY;

const credential = new StorageSharedKeyCredential(account, accountKey);
const serviceClient = new ShareServiceClient(
  `https://${account}.file.core.windows.net`,
  credential
);

exports.uploadAndGrade = async (req, res) => {
  const { marks, dependencyLevel, extraPrompt, examName } = req.body;

  console.log("marks: ", marks);
  console.log("dependencyLevel: ", dependencyLevel);
  console.log("extraPrompt: ", extraPrompt);
  console.log("examName: ", examName);

  //! Check if files were uploaded
  if (!req.files) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  // //! create share
  // const shareName = `gradrfiles`;
  // const shareClient = serviceClient.getShareClient(shareName);
  // await shareClient.createIfNotExists();
  // console.log(`Create share ${shareName} successfully`);

  // const parentDirClient = shareClient.getDirectoryClient(examName);
  // await parentDirClient.createIfNotExists();
  // console.log(`Create directory ${examName} successfully`);

  // //! create directory for students' answers
  // const answerDir = `${examName}/answers`;
  // const answerDirClient = shareClient.getDirectoryClient(answerDir);
  // await answerDirClient.createIfNotExists();
  // console.log(`Create directory ${answerDir} successfully`);

  // //! create directory for lecturer documents (marking guide and question)
  // const docsDir = `${examName}/docs`;
  // const docsDirClient = shareClient.getDirectoryClient(docsDir);
  // await docsDirClient.createIfNotExists();
  // console.log(`Create directory ${docsDir} successfully`);

  // //! TO-DO: upload student answers to 'answers', upload question and guide to 'docs'

  //! use ai to read questions and guide

  const { path: questionPath } = req.files["file1"][0];
  const { path: guidePath } = req.files["file2"][0];

  const extractor = new WordExtractor();

  const questionData = await extractor.extract(questionPath);
  let question = questionData.getBody();

  const guideData = await extractor.extract(guidePath);
  let guide = guideData.getBody();

  //! get onlineAnswers to question

  //! Load exam information into MongoDB
  // const { MongoClient } = require("mongodb");
  // const dbClient = new MongoClient(
  //   process.env.AZURE_COSMOSDB_CONNECTION_STRING
  // );

  // try {
  //   const db = dbClient.db("gradr");
  //   await dbClient.connect();

  //   // delete existing data
  //   await db.collection("exams").deleteMany({});

  //   console.log("Loading exam data...");
  //   let insertStatus = await db.collection("exams").insertOne({
  //     examName,
  //     question,
  //     guide,
  //     // onlineAnswers,
  //   });
  //   console.log("insert status: ", insertStatus);

  //   const addStatus = await addCollectionContentVectorField(db, "exams");
  //   console.log("addStatus: ", addStatus);
  // } catch (error) {
  //   console.error(error);
  // } finally {
  //   await dbClient.close();
  //   console.log("Disconnected from MongoDB");
  // }

  //! perform grading using student answer(image), question(string), guide(string) and onlineAnswers(string),

  let gradingResult = await ragLCELChain(
    "I don't know the answer",
    marks,
    guide
  );
  console.log("gradingResult: ", gradingResult);
};
