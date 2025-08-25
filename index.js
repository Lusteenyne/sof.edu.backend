const express = require('express');
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const connect = require('./Db.config/db.connect');
const chatmodel = require('./model/chat.model'); // Import the chat model
const socket = require('socket.io');
const studentrouter = require('./routes/student.route'); // Import the student router
const adminrouter = require('./routes/admin.route'); // Import the admin router
const teacherrouter = require('./routes/teacher.route'); // Import the teacher router

const cors = require('cors');
app.use(cors( { orgin: '*' })); // Middleware to enable CORS for all origins
app.use(express.json({ limit: "50mb"})); // Middleware to parse JSON bodies


//Routes
app.use("/student", studentrouter); // Assuming you have a student router defined in routes/student.route.js
app.use("/admin",adminrouter); // Assuming you have an admin router defined in routes/admin.route.js)
app.use("/teacher", teacherrouter); // Assuming you have a teacher router defined in routes/teacher.route.js






// Connect to database
connect(); // This must happen BEFORE anything else

// Start the server
const port = process.env.PORT || 5003;
const connection = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Setup Socket.IO only after MongoDB connects
mongoose.connection.once("open", () => {
    console.log("MongoDB connected. Setting up Socket.IO...");

    const io = socket(connection, {
        cors: { origin: "*" }
    });

    io.on("connection", async (socket) => {
        console.log("A user connected");

        // Fetch and send all existing chats
        try {
            const allchat = await chatmodel.find();
            socket.emit("allchat", allchat);
        } catch (error) {
            console.error("Error fetching chats:", error);
        }

        // Listen for new messages
        socket.on("sendmessage", async (messages) => {
            try {
                const newMessage = await chatmodel.create({ message: messages.message });
                console.log("Message saved:", newMessage);
                socket.emit("receivemessage", newMessage);
            } catch (error) {
                console.error("Error saving message:", error);
            }
        });
    });
});
