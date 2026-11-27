"use strict";

module.exports = function handler(request, response) {
  response.statusCode = 404;
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end("Not found");
};
