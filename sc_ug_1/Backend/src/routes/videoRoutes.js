const express = require('express');

const router = express.Router();

const videoController = require('../controllers/videoController');

const upload = require('../middleware/upload');

router.get('/', videoController.getVideos);

router.get('/:id', videoController.getVideo);

router.post('/', videoController.createVideo);

router.post(
    '/upload',
    upload.single('video'),
    videoController.uploadVideo
);

router.put('/:id', videoController.updateVideo);

router.delete('/:id', videoController.deleteVideo);

module.exports = router;

