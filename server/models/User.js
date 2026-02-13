const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  fileName: String,
  filePath: String,
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  wallet: {
    crypto_credits: {
      type: Number,
      default: 1000
    },
    rare_gems: {
      type: Number,
      default: 0
    }
  },
  inventory: [rewardSchema],
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return this.password === candidatePassword;
};

userSchema.methods.calculateLevel = function() {
  this.level = Math.floor(this.xp / 100) + 1;
};

module.exports = mongoose.model('User', userSchema);
