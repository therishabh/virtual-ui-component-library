import mongoose from 'mongoose';

/**
 * MONGO_URI env variable se MongoDB connect karta hai.
 *
 * - Fail hone pe error throw karta hai, process.exit nahi karta. Aage kya karna hai
 *   (retry, log, shutdown) ye caller (server.js) decide karega.
 * - MONGO_URI function ke andar read karte hain, module level pe nahi. ESM me imports
 *   hoist hote hain, to top-level pe read karne se dotenv ke .env load karne se pehle
 *   hi value read ho jati (undefined aata).
 */
const connectToDb = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not defined');

    // Connect hone ke baad runtime events, monitoring ke liye kaam aate hain
    mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

    // Galat URI ya unreachable host pe default 30s latakne ki jagah 5s me fail ho jao
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

// Connection close karta hai. Signal handling (SIGINT/SIGTERM) yahan nahi, server.js ke graceful shutdown me hai,
// taaki sahi order me ho: pehle server band, phir DB.
export const disconnectDb = async () => {
    await mongoose.connection.close();
};

export default connectToDb;
