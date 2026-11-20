"use strict";

const { handleProviderRequest } = require("../lib/vercel-provider");

module.exports = async function handler(request, response) {
  return handleProviderRequest(request, response, "chat");
};
