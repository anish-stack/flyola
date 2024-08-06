const express = require('express')
const Protect = require('../middlewares/Auth')
const { GetFlights, getAirPorts, BookTicket } = require('../controllers/flights.controller')
const router = express.Router()

router.get('/Flights',GetFlights)
router.post('/Flights-Booking', Protect,BookTicket)


router.get('/airports',getAirPorts)







module.exports = router
