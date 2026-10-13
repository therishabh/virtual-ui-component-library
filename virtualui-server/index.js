import 'dotenv/config';
import express from 'express';
import connectToDb from './config/db.js';

const app = express();

app.get('/', (req, res) => {
    res.status(200).json({
        message : "success",
        status: true
    })
})

const PORT = process.env.PORT || 8000;

try {
    await connectToDb();
    app.listen(PORT, () => {
        console.log(`Server is running on port : ${PORT}, http://localhost:${PORT}`);
    });
} catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
}
