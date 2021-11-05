const express = require('express')
const router = express.Router()
const detector = require("../../detector")
const crypto = require("crypto")

const completedJobs = {}

router.get('/', (req, res) => {
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
  const jobId = crypto.randomUUID()
  getResults(req.body, jobId)
  res.status(200)
  res.send(JSON.stringify({jobId}))
  res.end()
})

async function getResults(body, jobId) {
  let results = []
  completedJobs[jobId] = null
  for (let script of body) {
    results.push(await detector.scoreScript(script))
  }
  setTimeout(() => {
    if (completedJobs[jobId]) delete completedJobs[jobId]
  }, 600000)
  completedJobs[jobId] = results
}

module.exports = router
