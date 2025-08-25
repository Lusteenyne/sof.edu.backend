const cloudinary = require("cloudinary").v2;
require("dotenv").config();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.CLOUDKEY,
  api_secret: process.env.CLOUDSECRET,
});

// Multer Storage Configuration for Local Temp Disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Temporary local storage
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

// Multer Middleware
const upload = multer({ storage });


async function uploadFilesToCloudinary(files) {
  const uploadResults = {};

  for (const file of files) {
    try {
      const cloudinaryResponse = await cloudinary.uploader.upload(file.path, {
        resource_type: "raw", // Handles PDFs, DOCXs, ZIPs, etc.
        folder: "teacher-uploads",
        public_id: path.parse(file.originalname).name
          .replace(/\s+/g, "_")
          .toLowerCase(),
      });

      uploadResults[file.fieldname] = {
        url: cloudinaryResponse.secure_url,
        public_id: cloudinaryResponse.public_id,
      };
    } catch (error) {
      console.error(`Error uploading ${file.originalname}:`, error);
      throw error;
    } finally {
      // Delete local file after upload
      fs.unlink(file.path, (err) => {
        if (err) console.error(`Failed to delete ${file.path}:`, err);
      });
    }
  }

  return uploadResults;
}

module.exports = {
  cloudinary,
  upload,
  uploadFilesToCloudinary,
};
