import express from 'express';

const app = express();


app.get('/', (req, res) => {
    res.status(200).json({
        message : "success",
        status: true
    })
})

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port : ${PORT}, http://localhost:${PORT}`);
})