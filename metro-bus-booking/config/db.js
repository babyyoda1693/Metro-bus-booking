const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/metro_bus_db';
  await mongoose.connect(uri);
  console.log('MongoDB connected:', mongoose.connection.name);
};
