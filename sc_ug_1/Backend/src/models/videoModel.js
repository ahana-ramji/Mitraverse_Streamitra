const db = require('../db');

async function getAllVideos() {
    const result = await db.query(
        'SELECT * FROM videos ORDER BY upload_date DESC'
    );

    return result.rows;
}

async function getVideoById(videoId) {
    const result = await db.query(
        'SELECT * FROM videos WHERE video_id = $1',
        [videoId]
    );

    return result.rows[0];
}

/*
TODO: 
- Add Video Resolution
- Video Size
*/
async function createVideo(title, description, ownerId) {
    const result = await db.query(
        `INSERT INTO videos
        (
            title,
            description,
            upload_date,
            owner_id,
            status
        )
        VALUES ($1, $2, NOW(), $3, $4)
        RETURNING *`,
        [
            title,
            description,
            ownerId,
            'uploaded'
        ]
    );

    return result.rows[0];
}

async function updateVideo(videoId, title, description) {
    const result = await db.query(
        `UPDATE videos
         SET title = $1,
             description = $2
         WHERE video_id = $3
         RETURNING *`,
        [title, description, videoId]
    );

    return result.rows[0];
}

async function deleteVideo(videoId) {
    const result = await db.query(
        `DELETE FROM videos
         WHERE video_id = $1
         RETURNING *`,
        [videoId]
    );

    return result.rows[0];
}

/*
TODO: 
- Add Video Resolution
- Video Size
*/
async function createUploadedVideo(
    title,
    description,
    ownerId,
    filename
) {
    const result = await db.query(
        `INSERT INTO videos
        (
            title,
            description,
            upload_date,
            owner_id,
            status,
            filename
        )
        VALUES
        (
            $1,
            $2,
            NOW(),
            $3,
            'uploaded',
            $4
        )
        RETURNING *`,
        [
            title,
            description,
            ownerId,
            filename
        ]
    );

    return result.rows[0];
}

// Keeps the current filename when none is given
async function updateVideoStatus(videoId, status, filename = null) {
    const result = await db.query(
        `UPDATE videos
         SET status = $1,
             filename = COALESCE($2, filename)
         WHERE video_id = $3
         RETURNING *`,
        [status, filename, videoId]
    );

    return result.rows[0];
}

module.exports = {
    getAllVideos,
    getVideoById,
    createVideo,
    updateVideo,
    deleteVideo,
    createUploadedVideo,
    updateVideoStatus
};
