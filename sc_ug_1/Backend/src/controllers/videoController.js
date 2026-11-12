const Video = require('../models/videoModel');
const fs = require('fs');
const path = require('path');
const { transcodeToHls } = require('../services/transcode');

// HLS output lives in src/streams/<id>/, served at /videos/streams/<id>/master.m3u8
const STREAMS_DIR = path.join(__dirname, '../streams');

async function getVideos(req, res) {
    try {
        const videos = await Video.getAllVideos();
        res.json(videos);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Server Error'
        });
    }
}


async function getVideo(req, res) {
    try {
        const videoId = req.params.id;

        const video = await Video.getVideoById(videoId);

        if (!video) {
            return res.status(404).json({
                error: "Video not found"
            });
        }

        res.json(video);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Server Error"
        });
    }
}

async function createVideo(req, res) {
    try {
        const { title, description, owner_id } = req.body;

        const video = await Video.createVideo(
            title,
            description,
            owner_id
        );

        res.status(201).json(video);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Server Error"
        });
    }
}

async function updateVideo(req, res) {
    try {
        const videoId = req.params.id;
        const { title, description } = req.body;

        const video = await Video.updateVideo(
            videoId,
            title,
            description
        );

        if (!video) {
            return res.status(404).json({
                error: "Video not found"
            });
        }

        res.json(video);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Server Error"
        });
    }
}

async function deleteVideo(req, res) {
    try {
        const videoId = req.params.id;

        const existingVideo =
            await Video.getVideoById(videoId);

        if (!existingVideo) {
            return res.status(404).json({
                error: "Video not found"
            });
        }

        if (existingVideo.filename) {

            const filePath = path.join(
                __dirname,
                '../../uploads',
                existingVideo.filename
            );

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        fs.rmSync(
            path.join(STREAMS_DIR, String(videoId)),
            { recursive: true, force: true }
        );

        await Video.deleteVideo(videoId);

        res.json({
            message: "Video deleted successfully"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Server Error"
        });
    }
}

async function uploadVideo(req, res) {
    try {

        if (!req.file) {
            return res.status(400).json({
                error: "No file uploaded"
            });
        }

        const title =
            req.body.title || req.file.originalname;

        const description =
            req.body.description || '';

        const ownerId = 1;

        const uploaded =
            await Video.createUploadedVideo(
                title,
                description,
                ownerId,
                req.file.filename
            );

        const video =
            await Video.updateVideoStatus(
                uploaded.video_id,
                'processing'
            );

        res.status(201).json(video);

        // Transcoding takes a while, so it runs after the response.
        const id = video.video_id;
        const started = Date.now();
        console.log(`Transcoding video ${id} (${req.file.filename})...`);

        transcodeToHls(
            req.file.path,
            path.join(STREAMS_DIR, String(id))
        )
            .then(() => {
                const seconds = ((Date.now() - started) / 1000).toFixed(1);
                console.log(`Video ${id} ready in ${seconds}s: /videos/streams/${id}/master.m3u8`);
                return Video.updateVideoStatus(id, 'ready', `streams/${id}/master.m3u8`);
            })
            .catch((err) => {
                console.error(`Transcode failed for video ${id}:`, err);
                return Video.updateVideoStatus(id, 'failed');
            })
            .catch(console.error);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Server Error"
        });
    }
}
 

module.exports = {
    getVideos,
    getVideo,
    createVideo,
    updateVideo,
    deleteVideo,
    uploadVideo
};
