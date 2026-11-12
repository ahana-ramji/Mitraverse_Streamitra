require('dotenv').config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const videoRoutes = require("./routes/videoRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Video Streaming Backend Running"
    });
});

app.use("/api/videos", videoRoutes);

const PORT = process.env.PORT || 8080;

app.use(
    '/videos/streams',
    express.static(path.join(__dirname, 'streams'))
);

app.use(
    '/videos',
    express.static('uploads')
);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

