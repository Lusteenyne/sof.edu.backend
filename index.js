const express = require('express');
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const connect = require('./Db.config/db.connect');
const chatmodel = require('./model/chat.model'); 
const socket = require('socket.io');
const studentrouter = require('./routes/student.route'); 
const adminrouter = require('./routes/admin.route'); 
const teacherrouter = require('./routes/teacher.route'); 

const cors = require('cors');
app.use(cors( { origin: 'https://sof-edu.onrender.com' }));
app.use(express.json({ limit: "50mb"})); 


//Routes
app.use(express.static("public"));
app.use("/student", studentrouter); 
app.use("/admin",adminrouter); 
app.use("/teacher", teacherrouter); 






// Connect to database
connect();

// Start the server
const port = process.env.PORT || 5003;
const connection = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Setup Socket.IO only after MongoDB connects
mongoose.connection.once("open", () => {
    console.log("MongoDB connected. Setting up Socket.IO...");

    const io = socket(connection, {
        cors: { origin: "https://sof-edu.onrender.com" }
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
