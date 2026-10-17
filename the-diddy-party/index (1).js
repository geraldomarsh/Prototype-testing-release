// Vercel serverless function. vercel.json sends every /api/... request here;
// the handler reads the original path from req.url.
module.exports = require("../lib/handler").handle;
