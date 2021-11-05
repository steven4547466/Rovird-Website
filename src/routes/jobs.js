const express = require('express')
const router = express.Router()
const detector = require("../../detector")
const crypto = require("crypto")

const completedJobs = {}

const rateLimit = {}
const timeouts = {}

router.get('/', (req, res) => {
  if (isRateLimited(req, res)) {
    return
  }

  if (!req.query.jobId) {
    res.status(400)
    res.send("No JobId in query")
    res.end()
    return
  }

  if (completedJobs[req.query.jobId] === null) {
    res.status(400)
    res.send("Job not yet complete. Try again soon")
    res.end()
    return
  }

  if (!completedJobs[req.query.jobId]) {
    res.status(400)
    res.send("Incorrect JobId")
    res.end()
    return
  }

  res.status(200)
  res.send(JSON.stringify(completedJobs[req.query.jobId]))
  delete completedJobs[req.query.jobId]
  res.end()
})

router.post('/', (req, res) => {
  if (isRateLimited(req, res)) {
    return
  }

  if (!req.body || !Array.isArray(req.body) || req.body.length == 0) {
    res.status(400)
    res.send("No body provided")
    res.end()
    return
  }

  const jobId = crypto.randomUUID()
  getResults(req.body, jobId)
  res.status(200)
  res.send(JSON.stringify({ jobId }))
  res.end()
})

function isRateLimited(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(",")[0]
  if (!ip) {
    res.status(400)
    res.send("Unable to resolve ip")
    res.end()
    return true
  }

  let limit = rateLimit[ip]
  if (!limit) {
    rateLimit[ip] = {
      "x-ratelimit-limit": 60,
      "x-ratelimit-remaining": 60,
      "x-ratelimit-reset": Math.floor(Date.now() / 1000) + 60,
      "retry-after": 60
    }
    limit = rateLimit[ip]
  }

  if (timeouts[ip]) clearTimeout(timeouts[ip])

  timeouts[ip] = setTimeout(() => {
    if (rateLimit[ip]) delete rateLimit[ip]
  }, 60000)

  if (Math.floor(Date.now() / 1000) >= limit["x-ratelimit-reset"]) {
    rateLimit[ip]["x-ratelimit-reset"] = Math.floor(Date.now() / 1000) + 60
    for (let [k, v] of Object.entries(limit)) {
      res.header(k, v)
    }

    return false
  }

  if (limit["x-ratelimit-remaining"] == 0) {
    res.status(429)
    for (let [k, v] of Object.entries(limit)) {
      res.header(k, v)
    }
    res.end()
    return true
  }

  limit["x-ratelimit-remaining"] -= 1

  for (let [k, v] of Object.entries(limit)) {
    res.header(k, v)
  }

  return false
}

async function getResults(body, jobId) {
  let results = []
  completedJobs[jobId] = null
  for (let script of body) {
    if (!script.Source || !script.Children || !script.UUID) {
      continue
    }
    results.push(await detector.scoreScript(script, {}, [], 0, null, jobId))
    detector.removeCyclic(jobId)
  }
  setTimeout(() => {
    if (completedJobs[jobId]) delete completedJobs[jobId]
  }, 600000)
  completedJobs[jobId] = results
}

module.exports = router
