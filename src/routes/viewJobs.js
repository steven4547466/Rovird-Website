const express = require('express')
const router = express.Router()

/**
 * View jobs page rendering
 */
router.get('/', (req, res) => {
  res.render('jobsview')
})

module.exports = router
