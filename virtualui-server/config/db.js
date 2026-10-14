import mongoose from 'mongoose';
import env from './env.js';

/**
 * MONGO_URI env variable se MongoDB connect karta hai.
 *
 * - Fail hone pe error throw karta hai, process.exit nahi karta. Aage kya karna hai
 *   (retry, log, shutdown) ye caller (server.js) decide karega.
 * - MONGO_URI config/env.js se aata hai, jo startup pe validate hota hai (missing ho to server start hi nahi hota).
 */
const connectToDb = async () => {
    // Connect hone ke baad runtime events, monitoring ke liye kaam aate hain
    mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

    // Galat URI ya unreachable host pe default 30s latakne ki jagah 5s me fail ho jao
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

// Connection close karta hai. Signal handling (SIGINT/SIGTERM) yahan nahi, server.js ke graceful shutdown me hai,
// taaki sahi order me ho: pehle server band, phir DB.
export const disconnectDb = async () => {
    await mongoose.connection.close();
};

export default connectToDb;
