const express = require("express");
const testRouter = express.Router();

const testController = require("../controllers/test.controller");
const testMiddleware = require("../middlewares/test.middleware");

testRouter.post(
  "/",
  testMiddleware.handleUpload,
  testController.uploadAndGrade
);

module.exports = testRouter;
