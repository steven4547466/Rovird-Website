const express = require('express')
const router = express.Router()
const detector = require("../../detector")
const crypto = require("crypto")

const shared = require("../../shared")

const completedJobs = shared.completedJobs

const maxRateLimit = 120
const rateLimitResetTime = 60

const rateLimit = {}
const timeouts = {}

router.get('/', (req, res) => {
  if (isRateLimited(req, res)) {
    return
  }

  if (!req.query.jobIds) {
    res.status(400)
    res.send("No Job Ids in query")
    res.end()
    return
  }

  let data = {}

  for (let id of req.query.jobIds.split(",")) {
    if (completedJobs[id] === null) {
      data[id] = 0
    } else if(!completedJobs[id]) {
      data[id] = -1 // I would do null, but roblox doesn't parse null to nil
    } else {
      data[id] = 1
    }
  }

  res.status(200)
  res.send(JSON.stringify(data))
  res.end()
})

function clamp(num, min, max) { return Math.min(Math.max(num, min), max) }

function isRateLimited(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(",")[0]
  if (!ip) {
    res.status(400)
    res.send("Unable to resolve ip")
    res.end()
    return true
  }

  let now = Math.floor(Date.now() / 1000)

  let limit = rateLimit[ip]
  if (!limit) {
    rateLimit[ip] = {
      "x-ratelimit-limit": maxRateLimit,
      "x-ratelimit-remaining": maxRateLimit,
      "x-ratelimit-reset": now + rateLimitResetTime,
    }
    limit = rateLimit[ip]
  }

  if (timeouts[ip]) clearTimeout(timeouts[ip])

  timeouts[ip] = setTimeout(() => {
    if (rateLimit[ip]) delete rateLimit[ip]
  }, 60000)

  if (now >= limit["x-ratelimit-reset"]) {
    rateLimit[ip]["x-ratelimit-reset"] = now + rateLimitResetTime
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
    res.header("retry-after", clamp(limit["x-ratelimit-reset"] - now, 0, Infinity))
    res.end()
    return true
  }

  limit["x-ratelimit-remaining"] -= 1

  for (let [k, v] of Object.entries(limit)) {
    res.header(k, v)
  }

  return false
}

module.exports = router
