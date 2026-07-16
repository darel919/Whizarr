# Bazarr LocalAI Whisper Proxy

An Elysia/Bun compatibility proxy that translates Bazarr's SubGen-style Whisper requests into LocalAI's OpenAI-compatible audio API. It runs no inference model and needs no media mounts or FFmpeg.

## Configure and run

```bash
cp .env.example .env
# Set LOCALAI_BASE_URL and LOCALAI_MODEL in .env
docker compose up --build -d
```

Configure Bazarr's **Whisper ASR Docker Endpoint** as `http://HOST:30201`. Do not point Bazarr directly at LocalAI.

For local development:

```bash
bun install
LOCALAI_BASE_URL=http://10.10.10.10:30200 LOCALAI_MODEL=whisper-1 bun run dev
```

## API

- `GET /status` provides Bazarr's required version response without invoking inference.
- `GET /health` checks LocalAI reachability and whether `LOCALAI_MODEL` appears in `/v1/models`. It returns 503 when degraded.
- `POST /asr` accepts Bazarr's `audio_file`, wraps raw 16 kHz mono PCM in WAV, and returns LocalAI SRT unchanged.
- `POST /detect-language` sends only the configured leading audio duration to LocalAI and returns Bazarr-compatible language JSON.

The Bun HTTP idle timeout is disabled intentionally: Bazarr keeps a single request open while Whisper inference runs. Keep Bazarr's **Transcription/translation timeout** comfortably above the expected LocalAI processing time as well.

`MAX_AUDIO_UPLOAD_MB` is enforced both by Bun's HTTP server and by the application. Its default of 1024 MB accommodates the full raw PCM uploads Bazarr creates for feature-length media.

Language detection prefers LocalAI's `verbose_json` ISO-639-1 language field and accepts top-level and common nested `language`/`language_code` shapes. Some LocalAI Whisper versions return only `segments`, `text`, and `duration`; for those responses, the proxy uses the lightweight local `tinyld` detector on the 30-second transcript. It accepts only sufficiently long, high-confidence results and otherwise fails explicitly. Transcript content is never logged.

Raw audio is assumed only when `encode` is not `true` and the upload has no recognized audio MIME type. Recognized WAV, MP3, MP4, FLAC, Ogg, and WebM uploads are forwarded in their existing container.

## Translation

Translation is disabled by default because LocalAI backend support varies. When your installed LocalAI backend has been verified to expose `POST /v1/audio/translations`, set `LOCALAI_TRANSLATION_MODEL` to the working model or alias. The proxy then uses that endpoint. Without this explicit configuration, `task=translate` returns HTTP 501 and is never silently downgraded to transcription.

## Verification

```bash
bun test
bun run typecheck
docker compose config
```

Real LocalAI integration still requires audio samples and access to the deployed backend. Probe `/v1/models`, transcription SRT, verbose JSON language detection, and translation before enabling the Bazarr provider in production.
