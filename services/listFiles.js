const {
  ShareServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-file-share");

const account = "gradrstorage";
const accountKey = process.env.AZURE_STORAGE_KEY;

const credential = new StorageSharedKeyCredential(account, accountKey);
const serviceClient = new ShareServiceClient(
  `https://${account}.file.core.windows.net`,
  credential
);

const shareName = "gradrfiles";

async function listFiles(directoryName) {
  let res = [];

  const directoryClient = serviceClient
    .getShareClient(shareName)
    .getDirectoryClient(directoryName);

  let dirIter = directoryClient.listFilesAndDirectories();
  let i = 1;

  for await (const item of dirIter) {
    if (item.kind === "directory") {
      console.log(`${i} - directory\t: ${item.name}`);
      res.push(item.name);
    } else {
      console.log(`${i} - file\t: ${item.name}`);
    }
    i++;
  }

  return res;
}

module.exports = {
  listFiles,
};
