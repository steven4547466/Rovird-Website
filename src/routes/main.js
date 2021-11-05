const express = require('express')
const router = express.Router()

/**
 * Home page rendering
 */
router.get('/', (req, res) => {
  res.render('index', {live: false})
})

module.exports = router
