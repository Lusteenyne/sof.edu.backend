const mongoose = require('mongoose');
const validator = require('validator');

const superAdminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: 'Please provide a valid email address'
      }
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: [true, 'Gender is required']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: {
        validator: function (v) {
          return /^\+?[0-9]{7,15}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number!`
      }
    },
    securityQuestion: {
      type: String,
      required: [true, 'Security question is required'],
      trim: true
    },
    securityAnswer: {
      type: String,
      required: [true, 'Security answer is required'],
      trim: true
    },

    resetCode: { type: String },
    resetCodeExpiry: { type: Date },

  
    agreeToTerms: {
      type: Boolean,
      required: [true, 'You must agree to the terms and conditions']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    profilePhoto: {
      type: String,
      default: ''
    },
    age: Number,
    dateOfBirth: Date,
    address: String,
    nationality: String,
    stateOfOrigin: String,
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married']
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
