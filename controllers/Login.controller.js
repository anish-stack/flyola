const db = require('../Database/Database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const SendToken = require('../utils/SendToken');
exports.CreateAgent = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if both username and password are provided
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        // Check if the username already exists
        const checkQuery = 'SELECT * FROM agents WHERE username = ?';
        const [existingAgents] = await db.execute(checkQuery, [username]);

        if (existingAgents.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username already exists."
            });
        }

        // Generate a unique agentId
        const StartWithAgentId = 'AGT';
        const generateAgentId = StartWithAgentId + crypto.randomBytes(4).toString('hex').toUpperCase();

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert into the agents table
        const query = 'INSERT INTO agents (agentId, username, password) VALUES (?, ?, ?)';
        const values = [
            generateAgentId,
            username,
            hashedPassword,
        ];

        await db.execute(query, values);

        res.status(201).json({
            success: true,
            message: "Agent created successfully.",
            agentId: generateAgentId
        });
    } catch (error) {
        console.error("Error creating agent:", error.message);
        res.status(500).json({
            success: false,
            message: "An error occurred while creating the agent.",
            error: error.message
        });
    }
};
exports.LoginAgent = async (req, res) => {
    try {
        const { agentId, username, password } = req.body;
        console.log(req.body)
        if (!username || !password || !agentId) {
            return res.status(403).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        // Check if the username and agentId exist
        const checkQuery = 'SELECT * FROM agents WHERE username = ? AND agentId = ?';
        const [existingAgents] = await db.execute(checkQuery, [username, agentId]);

        // If no agents are found
        if (existingAgents.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or agent ID"
            });
        }

        const existingAgent = existingAgents[0]; // Get the first result

        // Compare the password
        const isMatch = await bcrypt.compare(password, existingAgent.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        // Password matches, send token
        await SendToken(res, existingAgent, 200); // Correctly call SendToken with `res` first

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "An error occurred while logging in.",
            error: error.message
        });
    }
};


exports.logoutAgent = async (req, res) => {
    try {
        // Clear the token cookie
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0)
        });

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "An error occurred during logout.",
            error: error.message
        });
    }
};
