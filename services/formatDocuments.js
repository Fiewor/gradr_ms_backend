function formatDocuments(docs) {
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
  console.log("strDocs: ", strDocs);
  return strDocs;
}

module.exports = { formatDocuments };
