const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Quality ladder for adaptive bitrate streaming, highest first
const LADDER = [
    { height: 1080, bitrate: '5000k', maxrate: '5350k', bufsize: '7500k' },
    { height: 720, bitrate: '2800k', maxrate: '2996k', bufsize: '4200k' },
    { height: 480, bitrate: '1400k', maxrate: '1498k', bufsize: '2100k' },
    { height: 360, bitrate: '800k', maxrate: '856k', bufsize: '1200k' }
];

const SEGMENT_SECONDS = 4;

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data; });
        child.stderr.on('data', (data) => { stderr += data; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) return resolve(stdout);
            reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`));
        });
    });
}

// Source height and whether it has audio, so we don't upscale or map a missing track
async function probe(inputPath) {
    const output = await run('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_type,height',
        '-of', 'json',
        inputPath
    ]);
    const streams = JSON.parse(output).streams || [];
    const video = streams.find((s) => s.codec_type === 'video');

    if (!video) throw new Error('No video stream found');

    return {
        height: video.height,
        hasAudio: streams.some((s) => s.codec_type === 'audio')
    };
}

/*
Transcodes a video into a multi-bitrate HLS stream:
outputDir/master.m3u8 plus outputDir/stream_N/index.m3u8 and seg_NNN.ts
*/
async function transcodeToHls(inputPath, outputDir) {
    const { height, hasAudio } = await probe(inputPath);

    // Skip renditions above the source resolution, but always keep the lowest one
    let ladder = LADDER.filter((r) => r.height <= height);
    if (ladder.length === 0) ladder = [LADDER[LADDER.length - 1]];

    fs.mkdirSync(outputDir, { recursive: true });

    const n = ladder.length;
    const split = `[0:v]split=${n}${ladder.map((_, i) => `[v${i}]`).join('')}`;
    const scales = ladder.map((r, i) => `[v${i}]scale=-2:${r.height}[o${i}]`);

    const args = ['-y', '-i', inputPath, '-filter_complex', [split, ...scales].join(';')];

    ladder.forEach((r, i) => {
        args.push(
            '-map', `[o${i}]`,
            `-c:v:${i}`, 'libx264',
            `-b:v:${i}`, r.bitrate,
            `-maxrate:v:${i}`, r.maxrate,
            `-bufsize:v:${i}`, r.bufsize
        );
    });

    if (hasAudio) {
        ladder.forEach(() => args.push('-map', '0:a:0'));
        args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
    }

    // Keyframes at every segment boundary in every rendition, so the player can switch cleanly
    args.push(
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
        '-sc_threshold', '0',
        '-f', 'hls',
        '-hls_time', String(SEGMENT_SECONDS),
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', path.join(outputDir, 'stream_%v', 'seg_%03d.ts'),
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', ladder.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' '),
        path.join(outputDir, 'stream_%v', 'index.m3u8')
    );

    await run('ffmpeg', args);
    await saveThumbnail(inputPath, outputDir);

    return path.join(outputDir, 'master.m3u8');
}

// Grabs a frame from the source video as outputDir/thumbnail.jpg for the video card.
// A missing thumbnail shouldn't fail the whole transcode, so errors are only logged.
async function saveThumbnail(inputPath, outputDir) {
    try {
        await run('ffmpeg', [
            '-y',
            '-ss', '0.5',
            '-i', inputPath,
            '-frames:v', '1',
            '-vf', 'scale=480:-2',
            path.join(outputDir, 'thumbnail.jpg')
        ]);
    } catch (err) {
        console.error(`Thumbnail failed for ${inputPath}:`, err.message);
    }
}

module.exports = {
    transcodeToHls
};

// Run directly to test without uploading: node src/services/transcode.js <video> [outputDir]
if (require.main === module) {
    const [input, output = path.join('uploads', 'hls', 'test')] = process.argv.slice(2);

    if (!input) {
        console.error('Usage: node src/services/transcode.js <video> [outputDir]');
        process.exit(1);
    }

    const started = Date.now();
    transcodeToHls(input, output)
        .then((master) => {
            const seconds = ((Date.now() - started) / 1000).toFixed(1);
            console.log(`Done in ${seconds}s: ${master}`);
        })
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
}
