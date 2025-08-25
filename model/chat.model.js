const mongoose = require("mongoose");


const chatschema = new mongoose.Schema({
        chatId: { type: String, required: true }, // Unique identifier for the chat
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User_info", required: true }, // Seller or Buyer
        receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User_info", required: true }, // Buyer or Seller
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );

const chatmodel = mongoose.model("chat", chatschema);

module.exports = chatmodel

