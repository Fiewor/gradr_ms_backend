const {
  ShareServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-file-share");
const { streamToBuffer } = require("./streamToBuffer");

const account = "gradrstorage";
const accountKey = process.env.AZURE_STORAGE_KEY;

const credential = new StorageSharedKeyCredential(account, accountKey);
const serviceClient = new ShareServiceClient(
  `https://${account}.file.core.windows.net`,
  credential
);

const shareName = "gradrfiles";

async function downloadFile(fileName) {
  console.log("received file: ", fileName);

  const fileClient = serviceClient
    .getShareClient(shareName)
    .rootDirectoryClient.getFileClient(fileName);

  // Get file content from position 0 to the end
  // In Node.js, get downloaded data by accessing downloadFileResponse.readableStreamBody
  const downloadFileResponse = await fileClient.download();
  console.log("downloadFileResponse: ", downloadFileResponse);
  const bufferisedStream = await streamToBuffer(
    downloadFileResponse.readableStreamBody
  ).toString();
  console.log(`Downloaded file content: ${bufferisedStream}`);
  return bufferisedStream;
}

module.exports = {
  downloadFile,
};
