const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    riskProfile: {
        type: String,
        enum: ['保守', '稳健', '积极'],
        default: '稳健'
    },
    financialGoals: [{
        name: String,
        targetAmount: Number,
        currentAmount: Number,
        targetDate: Date,
        category: String
    }],
    preferences: {
        currency: {
            type: String,
            default: 'CNY'
        },
        language: {
            type: String,
            default: 'zh-CN'
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);