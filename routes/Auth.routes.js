const express = require('express')
const { CreateAgent, LoginAgent, logoutAgent } = require('../controllers/Login.controller')
const Protect = require('../middlewares/Auth')
const router = express.Router()

router.post('/register-agent', CreateAgent)
router.post('/login-agent', LoginAgent)
router.get('/logout-agent', Protect,logoutAgent)





module.exports = router
