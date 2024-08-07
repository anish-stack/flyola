const db = require('../Database/Database'); // Ensure you have proper database connection and query execution


function checkBookTime(sector, departure_time, date) {
    const currentDate = new Date();
    const inputDate = new Date(date);
    const departureDateTime = new Date(`${date}T${departure_time}`);

    // Convert current date to a date object without time
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // Check if the provided date is today
    if (todayDate.toDateString() === inputDate.toDateString()) {
        // Get the time difference between now and the departure time in hours
        const timeDifference = (departureDateTime - currentDate) / (1000 * 60 * 60);

        // Determine the minimum hours difference based on sector
        let minHoursDifference;
        if (sector === 'SGR' || sector === 'REW' || sector === 'UJN') {
            minHoursDifference = 0.3; // Stop booking if less than 0.3 hours
        } else {
            minHoursDifference = 1.5; // Stop booking if less than 1.5 hours
        }

        // Check if the time difference is less than the allowed minimum
        if (timeDifference < minHoursDifference) {
            // console.log('Bookings are stopped for this time.');
            return false;
        } else {
            // console.log('Bookings are allowed.');
            return true;
        }
    } else {
        // Allow bookings for dates other than today
        // console.log('Bookings are allowed for dates other than today.');
        return true;
    }
}





async function checkSeatAvailability(schedule_ids, date, totalNumberOfPassengers) {
    try {
        const seatLimit = 6;
        // console.log("pass", totalNumberOfPassengers);

        // Format the date to compare only the date part, ignoring the time part
        const formattedDate = new Date(date).toISOString().split('T')[0];

        // If schedule_ids is a single number, convert it to an array
        const scheduleIdsArray = Array.isArray(schedule_ids) ? schedule_ids : [schedule_ids];

        // console.log("ids", scheduleIdsArray);
        // console.log("date", formattedDate);

        // Prepare an array to store results for each schedule
        const seatAvailabilityResults = [];

        // Loop through each schedule ID
        for (const schedule_id of scheduleIdsArray) {
            // Fetch all bookings for the given schedule ID and date
            // console.log("innerid", schedule_id);
            const allBookingsQuery = `
                SELECT *
                FROM bookings
                WHERE schedule_id = ? AND bookDate = ? AND bookingStatus = 'Confirmed'
            `;
            const [allBookingsResults] = await db.query(allBookingsQuery, [schedule_id, formattedDate]);
            // console.log("Confirm", schedule_id);
            // console.log("Confirm", formattedDate);


            // Calculate total confirmed seats
            const totalConfirmedSeats = allBookingsResults.reduce((acc, booking) => acc + (booking.noOfPassengers || 0), 0);
            // console.log("Confirm", totalConfirmedSeats);

            // Calculate available seats
            const availableSeats = seatLimit - totalConfirmedSeats;
            // console.log("Available Seats:", availableSeats);

            // Ensure non-negative available seats
            const nonNegativeAvailableSeats = availableSeats >= 0 ? availableSeats : 0;

            // Check if available seats are enough for the total number of passengers
            let message = '';
            if (nonNegativeAvailableSeats >= totalNumberOfPassengers) {
                message = `Seats are available. You can book ${totalNumberOfPassengers} seats.`;
            } else {
                message = `Only ${nonNegativeAvailableSeats} seats are available.`;
            }

            // Store the result for this schedule ID
            seatAvailabilityResults.push({
                scheduleId: schedule_id,
                availableSeats: nonNegativeAvailableSeats,
                message: message
            });
        }

        // Return the results for all schedule IDs
        return seatAvailabilityResults;

    } catch (error) {
        // console.error("An error occurred while checking seat availability:", error);
        return null;
    }
}




exports.GetFlights = async (req, res) => {
    try {
        const { departure_city, arrival_city, date, adult, child, infant } = req.query;

        // Validate required fields
        if (!departure_city || !arrival_city || !date || !adult) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: departure city, arrival city, date, and adult."
            });
        }
        // Convert query parameters to numbers
        const numberOfAdults = parseInt(adult, 10) || 0;
        const numberOfChildren = parseInt(child, 10) || 0;
        const numberOfInfants = parseInt(infant, 10) || 0;
        const totalPassengers = numberOfAdults + numberOfChildren;

        const currentDate = new Date();
        const formattedCurrentDate = currentDate.toISOString().split('T')[0];

        // Convert the provided date to the same format for comparison
        const formattedDate = new Date(date).toISOString().split('T')[0];

        // Check if the provided date is in the past
        if (new Date(formattedDate) < new Date(formattedCurrentDate)) {
            return res.status(400).json({
                status: 'error',
                message: 'Not allowed. All flight bookings closed and departed.',
            });
        }
        const today = new Date();
        const inputDate = new Date(date);

        // Ensure the input date is not in the past
        today.setHours(0, 0, 0, 0);
        inputDate.setHours(0, 0, 0, 0);

        if (inputDate < today) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid date."
            });
        }

        // Get the day of the week
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[inputDate.getDay()];

        // Validate airport codes
        const [departureResult] = await db.query('SELECT * FROM airports WHERE airport_code = ?', [departure_city]);
        const [arrivalResult] = await db.query('SELECT * FROM airports WHERE airport_code = ?', [arrival_city]);

        if (departureResult.length === 0 || arrivalResult.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid departure or arrival airport code."
            });
        }

        const departureAirportId = departureResult[0].id;
        const arrivalAirportId = arrivalResult[0].id;

        // Get flights running on the same day
        const [FlightRunOnSameDay] = await db.query('SELECT id FROM flights WHERE departure_day = ?', [dayName]);
        const flightIdsOnSameDay = FlightRunOnSameDay.map(flight => flight.id);

        // Retrieve flight details for the given departure and arrival airport IDs
        const [flightResults] = await db.query(
            `SELECT id, flight_id, departure_time, arrival_time, price
             FROM flight_schedules
             WHERE departure_airport_id = ? AND arrival_airport_id = ?`,
            [departureAirportId, arrivalAirportId]
        );

        // Filter flight results for flights running on the same day
        const filteredFlightResults = flightResults.filter(flight =>
            flightIdsOnSameDay.includes(flight.flight_id)
        );

        if (filteredFlightResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No flights found for the selected day.'
            });
        }

        const flightIdsArray = filteredFlightResults.map(flight => flight.flight_id);

        // Fetch schedule details
        const [schedulesDetails] = await db.query(
            `SELECT *
             FROM flight_schedules   
             WHERE flight_id IN (?) AND departure_airport_id = ? AND arrival_airport_id = ?`,
            [flightIdsArray, departureAirportId, arrivalAirportId]
        );

        if (schedulesDetails.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No schedules found for the selected day.'
            });
        }

        // Retrieve airport codes
        const allAirportIds = [...new Set(schedulesDetails.flatMap(item => [item.departure_airport_id, item.arrival_airport_id]))];

        const [airportCodes] = await db.query(
            `SELECT airport_code, id 
             FROM airports 
             WHERE id IN (?)`,
            [allAirportIds]
        );

        const airportCodesMap = airportCodes.reduce((map, airport) => {
            map[airport.id] = airport.airport_code;
            return map;
        }, {});

        // Check seat availability
        const seatAvailabilityPromises = filteredFlightResults.map(async (flight) => {
            try {
                const schedule = schedulesDetails.find(
                    (item) => item.departure_time === flight.departure_time && item.arrival_time === flight.arrival_time
                );

                if (!schedule) {
                    throw new Error(`Schedule not found for departure time ${flight.departure_time} and arrival time ${flight.arrival_time}`);
                }

                // Check seat availability
                const availableSeats = await checkSeatAvailability(schedule.id, date, totalPassengers);
                return { scheduleId: schedule.id, availableSeats };
            } catch (error) {
                // console.error('Error checking seat availability:', error);
                return { scheduleId: null, availableSeats: null };
            }
        });
        function calculateFlightFlyingTime(departure_time, arrival_time) {
            // Parse the input time strings as Date objects
            const departure = new Date(`1970-01-01T${departure_time}Z`);
            const arrival = new Date(`1970-01-01T${arrival_time}Z`);

            // Calculate the difference in milliseconds
            const differenceInMilliseconds = arrival - departure;

            // Convert the difference to minutes
            const differenceInMinutes = differenceInMilliseconds / 1000 / 60;

            return differenceInMinutes;
        }



        const seatAvailability = await Promise.all(seatAvailabilityPromises);

        // Combine data with booking allowed check
        const combinedData = await Promise.all(filteredFlightResults.map(async (flight) => {
            const schedule = schedulesDetails.find((item) => item.departure_time === flight.departure_time && item.arrival_time === flight.arrival_time);
            const seats = seatAvailability.find(seat => seat.scheduleId === schedule.id);
            const [flightResultsNumber] = await db.query(
                `SELECT flight_number FROM flights WHERE id = ?`,
                [flight.flight_id]
            );
            const flightNumber = flightResultsNumber.length > 0 ? flightResultsNumber[0].flight_number : 'Unknown';

            // Check if booking is allowed
            const bookingAllowed = checkBookTime(departure_city, flight.departure_time, date);
            function safeJsonParse(jsonString) {
                try {
                    // Ensure the input is a non-empty string
                    if (typeof jsonString === 'string' && jsonString.trim() !== '') {
                        return JSON.parse(jsonString);
                    } else {
                        // Return an empty array if input is invalid
                        return [];
                    }
                } catch (error) {
                    console.error("JSON parsing error:", error);
                    // Return an empty array if JSON parsing fails
                    return [];
                }
            }
            // Fetch via stops
            const viaStopIdArray = safeJsonParse(schedule.via_stop_id);
            const [viaAirportCodes] = viaStopIdArray.length ? await db.query(
                `SELECT airport_code, id 
                 FROM airports 
                 WHERE id IN (?)`,
                [viaStopIdArray]
            ) : [[], []];
            // console.log(viaAirportCodes)
            const airportCodesMapVia = viaAirportCodes.reduce((map, airport) => {
                // console.log(airport)
                map[airport.id] = airport.airport_code;
                return map;
            }, {});


            const discountQuery = 'SELECT type, value FROM business_settings';
            const [fetchDiscount] = await db.query(discountQuery);
            const filterDiscount = fetchDiscount.find(item => item.type === 'discount_tickets');
            const discountValue = filterDiscount ? filterDiscount.value : null;
            //console.log(discountValue);

            const APPLIED_TAX = 0 // in percentage
            const DISCOUNT_APPLIED_ON_TICKET = discountValue || "0"

            const CalculatePrice = (basePrice, discountPercentage, taxPercentage, numberOfAdults, numberOfChildren, numberOfInfants) => {
                // Constants for fixed infant charge
                const infantCharge = 1000;

                // Convert inputs to numbers (if they are not already)
                basePrice = parseFloat(basePrice);
                discountPercentage = parseFloat(discountPercentage);
                taxPercentage = parseFloat(taxPercentage);

                // Calculate individual prices
                const baseAmountPerAdult = basePrice;
                const baseAmountPerChild = basePrice; // Assuming same base price for child
                const baseAmountPerInfant = infantCharge;

                // Calculate discount and tax for each type of passenger
                const discountAmountPerAdult = (discountPercentage / 100) * baseAmountPerAdult;
                const discountAmountPerChild = (discountPercentage / 100) * baseAmountPerChild;
                const discountAmountPerInfant = (discountPercentage / 100) * baseAmountPerInfant; // No discount for infants

                const priceAfterDiscountPerAdult = baseAmountPerAdult - discountAmountPerAdult;
                const priceAfterDiscountPerChild = baseAmountPerChild - discountAmountPerChild;
                const priceAfterDiscountPerInfant = baseAmountPerInfant - discountAmountPerInfant;

                const taxAmountPerAdult = (taxPercentage / 100) * priceAfterDiscountPerAdult;
                const taxAmountPerChild = (taxPercentage / 100) * priceAfterDiscountPerChild;
                const taxAmountPerInfant = 0; // Assuming no tax on infant charge

                const grossAmountPerAdult = priceAfterDiscountPerAdult + taxAmountPerAdult;
                const grossAmountPerChild = priceAfterDiscountPerChild + taxAmountPerChild;
                const grossAmountPerInfant = priceAfterDiscountPerInfant + taxAmountPerInfant;

                // Calculate total amounts
                const totalBaseAmount = (numberOfAdults * baseAmountPerAdult) + (numberOfChildren * baseAmountPerChild) + (numberOfInfants * baseAmountPerInfant);
                const totalDiscountAmount = (numberOfAdults * discountAmountPerAdult) + (numberOfChildren * discountAmountPerChild) + (numberOfInfants * discountAmountPerInfant);
                const totalTaxAmount = (numberOfAdults * taxAmountPerAdult) + (numberOfChildren * taxAmountPerChild) + (numberOfInfants * taxAmountPerInfant);
                const totalGrossAmount = (numberOfAdults * grossAmountPerAdult) + (numberOfChildren * grossAmountPerChild) + (numberOfInfants * grossAmountPerInfant);
                const result = [];
                if (numberOfAdults > 0) {
                    result.push({
                        Paxtype: "ADT",
                        // NumberOfAdults: 1,
                        BaseAmount: (1 * baseAmountPerAdult).toFixed(2),
                        TotalTaxAmount: (1 * taxAmountPerAdult).toFixed(2),
                        Discount: (1 * discountAmountPerAdult).toFixed(2),
                        GrossAmount: (1 * grossAmountPerAdult).toFixed(2),
                    });
                }

                if (numberOfChildren > 0) {
                    result.push({
                        Paxtype: "CHLD",
                        // NumberOfChildren: 1,
                        BaseAmount: (1 * baseAmountPerChild).toFixed(2),
                        TotalTaxAmount: (1 * taxAmountPerChild).toFixed(2),
                        Discount: (1 * discountAmountPerChild).toFixed(2),
                        GrossAmount: (1 * grossAmountPerChild).toFixed(2),
                    });
                }

                if (numberOfInfants > 0) {
                    result.push({
                        Paxtype: "INF",
                        // NumberOfInfants: 1,
                        BaseAmount: (1 * baseAmountPerInfant).toFixed(2),
                        TotalTaxAmount: "0.00", // Assuming no tax on infant charge
                        Discount: (1 * discountAmountPerInfant).toFixed(2), // Assuming no discount for infants
                        GrossAmount: (1 * grossAmountPerInfant).toFixed(2),
                    });
                }

                return result
            };





            const priceDetails = CalculatePrice(schedule.price, DISCOUNT_APPLIED_ON_TICKET, APPLIED_TAX, numberOfAdults, numberOfChildren, numberOfInfants);


            return {
                ItineraryFlightList: [
                    {
                        FlightDetails: [
                            {
                                FlightID: flight.id,
                                ScheduleID: schedule.id,
                                FlightNumber: flightNumber,
                                FlightDepartureDate: date,
                                Origin: airportCodesMap[schedule ? schedule.departure_airport_id : null] || 'Unknown',
                                Destination: airportCodesMap[schedule ? schedule.arrival_airport_id : null] || 'Unknown',
                                DepartureDateTime: flight.departure_time,
                                ArrivalDateTime: flight.arrival_time,
                                Stops: viaStopIdArray?.length || '0',
                                Via: viaStopIdArray.map(stop => airportCodesMapVia[stop]).join(', ') || 'Direct',
                                FlyingTime: calculateFlightFlyingTime(flight.departure_time, flight.arrival_time,),
                                AvailSeat: seats ? seats.availableSeats : 'Unknown',
                                Baggage: schedule ? schedule.baggage : 'Unknown',
                                BookingAllowed: bookingAllowed,
                            }
                        ],
                        fares: [
                            {
                                Currency: "INR",
                                FareType: "N",
                                FareDescription: [
                                    priceDetails
                                ]
                            }

                        ]
                    }
                ]
            };
        }));

        // Send response
        res.status(200).json({
            success: true,
            message: "Flight data retrieved successfully.",
            dayName,
            flights: combinedData
        });

    } catch (error) {
        console.error("An error occurred while retrieving flight data:", error);
        res.status(500).json({
            success: false,
            message: "An internal server error occurred."
        });
    }
};

// Function to get current date and time in IST
function getCurrentDateInIST() {
    const utcDate = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);

    // Extract year, month, and day
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(istDate.getDate()).padStart(2, '0');

    // Format as YYYY-MM-DD
    return `${year}-${month}-${day}`;
}

// Example usage
// console.log(getCurrentDateInIST()); // Output will be in the format YYYY-MM-DD


// Generate random alphanumeric string
const generateRandomString = (prefix) =>
    prefix + Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');

// Your BookTicket function
const calculateAge = (dob) => {
    const dobDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDifference = today.getMonth() - dobDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dobDate.getDate())) {
        age--;
    }

    return age;
};

exports.BookTicket = async (req, res) => {
    try {
        // Extracting and validating the data from the request body
        const { flightDetail, passengers, contactNumber, email, totalPrice, status } = req.body;

        // Basic validation
        if (!flightDetail || !passengers || !contactNumber || !email || !totalPrice) {
            return res.status(400).json({
                success: false,
                message: 'Incomplete booking information'
            });
        }

        // Filter out only Child and Adult passengers
        const relevantPassengers = passengers.filter(p => p.Paxtype === 'Adult' || p.Paxtype === 'Child');
        const totalPassengers = relevantPassengers.length;

        // Check seat availability
        const availableSeats = await checkSeatAvailability(flightDetail.ScheduleID, flightDetail.FlightDepartureDate, totalPassengers);

        let totalAvailableSeats = 0;
        for (const seatInfo of availableSeats) {
            if (seatInfo.availableSeats > 0) {
                totalAvailableSeats += seatInfo.availableSeats;
            }
        }

        // Check if enough seats are available
        if (totalAvailableSeats >= totalPassengers) {
            const userId = req.user.id;
            const userName = req.user.userName;


            // Generate booking references
            const generateBookingNumber = () => {
                const timestamp = Date.now().toString().slice(-10);
                const randomNumberString = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                return timestamp.slice(-7) + randomNumberString;
            };

            const generatePnrNumber = () => Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');

            const BookingNumber = generateBookingNumber();
            const pnr = generatePnrNumber();
            const paymentStatus = status || 'Pending';
            const bookingStatus = paymentStatus === 'Success' ? 'Confirmed' : 'Pending';
            const bookDate = flightDetail.FlightDepartureDate;

            // Get discount value from business settings
            const discountQuery = 'SELECT type, value FROM business_settings';
            const [fetchDiscount] = await db.query(discountQuery);
            const filterDiscount = fetchDiscount.find(item => item.type === 'discount_tickets');
            const discountValue = filterDiscount ? filterDiscount.value : null;

            // Check agent wallet amount
            const agentQuery = 'SELECT wallet_amount FROM agents WHERE agentId = ?';
            const [agentResult] = await db.execute(agentQuery, [userId]);

            if (agentResult.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Agent not found'
                });
            }

            const walletAmount = agentResult[0].wallet_amount;

            // Check if the agent has enough money
            if (walletAmount < totalPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient funds in agent wallet'
                });
            }

            // Deduct amount from agent wallet
            const updateWalletQuery = 'UPDATE agents SET wallet_amount = wallet_amount - ? WHERE agentId = ?';
            await db.execute(updateWalletQuery, [totalPrice, userId]);

            // Insert booking record
            const bookingQuery = `
                INSERT INTO bookings (pnr, bookingNo, contact_no, email_id, noOfPassengers, bookDate, schedule_id, totalFare, paymentStatus, bookingStatus, bookedUserId, agent_type, discount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await db.query(bookingQuery, [pnr, BookingNumber, contactNumber, email, totalPassengers, bookDate, flightDetail.ScheduleID, totalPrice, paymentStatus, bookingStatus, 1, userId, discountValue]);
            const bookingId = result.insertId;

            // Insert passenger records
            const passengerQuery = `
                INSERT INTO passenger_details (bookingId, title, name, dob, age, type)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            for (const passenger of relevantPassengers) {
                const age = calculateAge(passenger.DOB);
                await db.query(passengerQuery, [bookingId, passenger.Title, passenger.FullName, passenger.DOB, age, passenger.Paxtype]);
            }

            // Update number of tickets booked by agent
            const updateAgentTicketsQuery = 'UPDATE agents SET no_of_ticket_booked = no_of_ticket_booked + ? WHERE agentId = ?';
            await db.execute(updateAgentTicketsQuery, [totalPassengers, userId]);

          
            const FlightBookedInfo = {
                BookingResponse: {
                    AgentInfo: {
                        AgentId: userId,
                        UserName: userName,
                        AppType: "API",
                    },
                    AdultCount: relevantPassengers.filter(p => p.Paxtype === 'Adult').length,
                    ChildCount: relevantPassengers.filter(p => p.Paxtype === 'Child').length,
                    InfantCount: relevantPassengers.filter(p => p.Paxtype === 'Infant').length,
                    IssuedDate: new Date().toISOString(),
                    Item: [
                        {
                            FlightID: flightDetail.FlightID,
                            ScheduleID: flightDetail.ScheduleID,
                            Resultcode: 1,
                            PNR: pnr,
                            BookingId: bookingId,
                            BaseOrigin: flightDetail.Origin,
                            BaseDestination: flightDetail.Destination,
                            DepartureDateTime: flightDetail.DepartureDateTime,
                            ArrivalDateTime: flightDetail.ArrivalDateTime,
                            PromoCode: flightDetail.PromoCode || null,
                            Special: 'N',
                            TripType: flightDetail.TripType || 'O',
                            BookingStatus: bookingStatus,
                        }
                    ],
                    PaymentDetails: {
                        Item: [
                            {
                                Amount: totalPrice,
                                CurrencyCode: "INR"
                            }
                        ]
                    },
                    TravellerInfo: relevantPassengers.map((passenger, index) => ({
                        PaxId: index + 1,
                        Title: passenger.Title,
                        FirstName: passenger.FirstName,
                        LastName: passenger.LastName,
                        DOB: passenger.DOB,
                        PaxType: passenger.Paxtype,
                        TicketNo: `${pnr}-${index + 1}`,
                    }))
                }
            };

            res.status(201).json({
                success: true,
                message: 'Booking successful',
                data: FlightBookedInfo,
                availableSeats: totalAvailableSeats
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Only ${totalAvailableSeats} seats are available, but ${totalPassengers} are requested.`
            });
        }
    } catch (error) {
        console.error('Error booking ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


exports.getAirPorts = async (req, res) => {
    try {
        // Query to fetch airport data
        const AirPortsQuery = 'SELECT `city`, `airport_code`, `airport_name` FROM airports';
        const [AirPortsData] = await db.query(AirPortsQuery);

        // Check if data is returned
        if (AirPortsData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No airports found'
            });
        }

        // Send the data as a JSON response
        return res.status(200).json({
            success: true,
            data: AirPortsData
        });
    } catch (error) {
        console.error('Error fetching airports:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};