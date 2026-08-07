/**
 * aiPipeline.js
 *
 * Orchestrates the full AI brand-safety vetting pipeline for a newly uploaded video:
 *   1. Download & extract audio from the video URL using ffmpeg
 *   2. Transcribe the audio using the local whisper-cli.exe binary
 *   3. Classify the transcript for brand safety using Google Gemini
 *   4. Persist results (transcript, confidenceScore, riskFlags, vettingStatus) to MongoDB
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Video from '../models/Video.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run a child process and collect stdout, rejecting on non-zero exit.
 */
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Process "${cmd}" exited with code ${code}:\n${stderr}`));
    });
    proc.on('error', reject);
  });
}

// ─── Step 1: Audio Extraction ─────────────────────────────────────────────────

/**
 * Uses ffmpeg to download a video URL and extract 16kHz mono WAV audio.
 * Returns the path to the temp WAV file.
 */
async function extractAudio(videoUrl) {
  const tmpDir = os.tmpdir();
  const tmpWav = path.join(tmpDir, `toka_audio_${Date.now()}.wav`);

  const ffmpegArgs = [
    '-y',              // overwrite output without asking
    '-i', videoUrl,    // input: video URL (ffmpeg downloads it)
    '-ar', '16000',    // sample rate: 16kHz (required by whisper)
    '-ac', '1',        // mono channel
    '-c:a', 'pcm_s16le', // raw PCM WAV
    '-vn',             // no video stream
    tmpWav
  ];

  await runProcess('ffmpeg', ffmpegArgs);
  return tmpWav;
}

// ─── Step 2: Transcription ────────────────────────────────────────────────────

/**
 * Runs the local whisper-cli.exe on the WAV file.
 * Returns the transcript text string.
 */
async function transcribeAudio(wavPath) {
  const whisperCli = process.env.WHISPER_CLI_PATH;
  const whisperModel = process.env.WHISPER_MODEL_PATH;

  if (!whisperCli || !whisperModel) {
    throw new Error('WHISPER_CLI_PATH and WHISPER_MODEL_PATH must be set in .env');
  }

  // Output file base (whisper-cli appends .txt automatically)
  const outBase = wavPath.replace(/\.wav$/, '');

  const whisperArgs = [
    '-m', whisperModel,
    '-f', wavPath,
    '--output-txt',
    '--output-file', outBase,
    '--no-timestamps',
    '--language', 'auto',
    '--no-prints'
  ];

  await runProcess(whisperCli, whisperArgs);

  // Read the output .txt file whisper-cli produced
  const txtPath = `${outBase}.txt`;
  const transcript = (await fs.readFile(txtPath, 'utf-8')).trim();
  
  // Clean up temp files
  await Promise.allSettled([fs.unlink(wavPath), fs.unlink(txtPath)]);

  return transcript;
}

// ─── Step 3: Gemini NLP Classification ───────────────────────────────────────

/**
 * Sends the transcript to Gemini Flash for brand-safety classification.
 * Returns { confidenceScore: number (0-100), riskFlags: string[] }
 */
async function classifyTranscript(transcript) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Try models in order of preference; fall back if quota hit
  const modelCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  const prompt = `You are a brand safety AI classifier for a video platform called Toka.

Analyze the following video transcript and determine if it is safe for brand advertising.

Return a valid JSON object with this exact structure (no markdown, no explanation):
{
  "confidenceScore": <number between 0 and 100, where 100 = fully brand safe>,
  "riskFlags": <array of strings identifying specific violations found, e.g. ["profanity", "alcohol", "violence", "adult_content", "hate_speech"] — use an empty array if none>
}

Transcript:
"""
${transcript || '[No speech detected]'}
"""`;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip any accidental markdown code fences
      const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error(`Gemini (${modelName}) returned invalid JSON: ${text}`);
      }

      const confidenceScore = Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 0));
      const riskFlags = Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String) : [];

      console.log(`[AI Pipeline] Gemini model used: ${modelName}`);
      return { confidenceScore, riskFlags };

    } catch (err) {
      // On quota exhaustion (429), try next model candidate
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        console.warn(`[AI Pipeline] ${modelName} quota exceeded, trying next model...`);
        continue;
      }
      throw err; // Re-throw non-quota errors
    }
  }

  // All models exhausted — return a conservative fallback requiring human review
  console.warn('[AI Pipeline] All Gemini models quota exceeded. Returning fallback classification.');
  return { confidenceScore: 80, riskFlags: ['gemini_quota_exceeded'] };
}

// ─── Step 4: Determine vettingStatus from score ───────────────────────────────

function resolveVettingStatus(score) {
  if (score < 70) return 'rejected';
  if (score >= 95) return 'approved';
  return 'human_review';
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Full pipeline entrypoint. Called in the background after a video is uploaded.
 * Marks the video as 'running', processes it, and updates the Mongoose document.
 */
export async function runAiPipeline(videoId, videoUrl) {
  console.log(`[AI Pipeline] Starting for video ${videoId}`);

  try {
    // Mark pipeline as running
    await Video.findByIdAndUpdate(videoId, {
      aiPipelineStatus: 'running',
      vettingStatus: 'ai_review'
    });

    // Step 1: Extract audio
    console.log(`[AI Pipeline] Extracting audio from: ${videoUrl}`);
    const wavPath = await extractAudio(videoUrl);

    // Step 2: Transcribe
    console.log(`[AI Pipeline] Transcribing audio...`);
    const transcript = await transcribeAudio(wavPath);
    console.log(`[AI Pipeline] Transcript (${transcript.length} chars): "${transcript.substring(0, 100)}..."`);

    // Step 3: Classify
    console.log(`[AI Pipeline] Classifying with Gemini...`);
    const { confidenceScore, riskFlags } = await classifyTranscript(transcript);
    console.log(`[AI Pipeline] Score: ${confidenceScore}, Flags: ${riskFlags.join(', ') || 'none'}`);

    // Step 4: Persist results
    const vettingStatus = resolveVettingStatus(confidenceScore);
    await Video.findByIdAndUpdate(videoId, {
      transcript,
      aiConfidenceScore: confidenceScore,
      riskFlags,
      vettingStatus,
      aiPipelineStatus: 'complete'
    });

    console.log(`[AI Pipeline] ✅ Complete for video ${videoId} → status: ${vettingStatus}`);
  } catch (err) {
    console.error(`[AI Pipeline] ❌ Failed for video ${videoId}:`, err.message);
    await Video.findByIdAndUpdate(videoId, {
      aiPipelineStatus: 'failed',
      vettingStatus: 'human_review' // fallback to human review on AI failure
    });
  }
}
