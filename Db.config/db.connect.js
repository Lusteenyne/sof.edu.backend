const mongoose = require("mongoose");



const connect = async () => {
    try {
        const connected = await mongoose.connect(process.env.MONGO_URI); //to access anything

        if (connected) {
            console.log("connected to database");
        }
    } catch (error) {
        console.log(error);
    }
};
connect();

module.exports = connect; //exporting the function
