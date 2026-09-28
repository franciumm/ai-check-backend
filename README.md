# AI Check — Backend API

Vercel serverless backend for the [AI Check Chrome Extension](https://github.com/franciumm/ai-check-extension). Proxies image detection requests to [Sightengine](https://sightengine.com) so API keys are never exposed in client-side code.

## API

### `POST /api/detect`

**Request:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "score": 0.92,
  "label": "Surely AI",
  "generators": {
    "midjourney": 0.85,
    "stable_diffusion": 0.05
  }
}
```

**Labels:**
| Score Range | Label |
|-------------|-------|
| < 0.25 | Not AI |
| 0.25 – 0.75 | Possibly AI |
| 0.75 – 0.90 | Likely AI |
| ≥ 0.90 | Surely AI |

## Deploy to Vercel

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/franciumm/ai-check-backend&env=SIGHTENGINE_API_USER,SIGHTENGINE_API_SECRET)

### Option 2: CLI

```bash
npm i -g vercel
vercel
```

### Environment Variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `SIGHTENGINE_API_USER` | Your Sightengine API user ID |
| `SIGHTENGINE_API_SECRET` | Your Sightengine API secret key |

Get credentials at [sightengine.com](https://sightengine.com)

## Test

```bash
curl -X POST https://YOUR_URL/api/detect \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/640px-Camponotus_flavomarginatus_ant.jpg"}'
```

## Tech Stack

- Vercel Serverless Functions
- Zero dependencies (native `fetch` + `FormData`)
- Sightengine `genai` model

## License

MIT
