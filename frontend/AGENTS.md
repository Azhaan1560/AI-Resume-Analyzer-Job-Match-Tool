# AGENT.md

Instructions for any AI coding agent (Claude Code, Cursor, Copilot Workspace, Aider, etc.) operating on this repository.

## What this project is

A full-stack **AI Resume Analyzer & Job Match Tool**. User uploads a resume PDF and pastes a job description; the app extracts skills via a local LLM, scores the match, and rewrites resume bullet points. Built as a learning/portfolio project — optimize for correctness and clear reasoning over performance or scale.

The owner of this project is a beginner developer learning Next.js, NestJS, and LLM integration for the first time. When making changes, prefer explicit, well-commented code over clever/terse code, and avoid silently changing behavior the owner has explicitly decided on (see "Decisions to respect" below).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: NestJS + TypeScript
- **AI runtime (local)**: Ollama, model `phi3:mini-4k` (~3.8B params, Q4 quantized)
- **AI runtime (production)**: Gemini 1.5 Flash, auto-selected when `GEMINI_API_KEY` is set
- **PDF parsing**: `pdf-parse` v2 (class-based API — see Gotchas)
- **File upload**: Multer with `memoryStorage()`, configured inline on `FileInterceptor`, not via global `MulterModule`

## Repository layout

```
backend/src/
  main.ts                    bootstrap, CORS allowlist (localhost:3000 + prod Vercel URL)
  app.module.ts              ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })
  analysis/
    analysis.controller.ts   POST /analyze — validates file + body, delegates to service
    analysis.service.ts      all AI prompting, JSON parsing/repair, scoring logic lives here
    analysis.dto.ts          AnalyzeRequestDto / AnalyzeResponseDto
    analysis.module.ts
  pdf/
    pdf.service.ts           pdf-parse wrapper + text cleanup (regex-based)
    pdf.module.ts

frontend/
  app/page.tsx               upload form page
  app/results/page.tsx       results dashboard, reads sessionStorage
  app/layout.tsx
  components/                UploadForm, ScoreCard, SkillBadge, BulletCard
  lib/api.ts                 ONLY place that calls the backend — route all new API calls through here
  lib/types.ts               AnalysisResult interface — must mirror AnalyzeResponseDto exactly
```

## Request lifecycle

```
UploadForm (frontend)
  -> lib/api.ts: multipart POST /analyze (fields: "resume" file, "jobDescription" text)
  -> analysis.controller.ts: validate file present, mimetype === application/pdf, jobDescription.length >= 50
  -> pdf.service.ts: extractText(buffer) -> cleaned plain text
  -> analysis.service.ts:
       Promise.all([extractResumeData(text), extractJobData(jobDesc)])
       -> each calls callAI() -> callGemini() or callOllama() depending on env
       -> parseJson<T>() extracts/repairs JSON from raw model text
     calculateScore(resumeData, jobData)  // pure JS, no AI — fuzzy string match
     rewriteBullets(text, jobDesc)        // third AI call
  -> returns AnalyzeResponseDto
  -> frontend stores in sessionStorage, routes to /results, renders
```

## Decisions to respect (do not silently revert)

1. **Skill extraction scope is intentionally limited to the resume's Skills section.** A prior iteration tried pulling skills from project/experience descriptions too, but the project owner correctly identified this as wrong: if a skill isn't self-declared in the Skills section, it shouldn't count as "possessed" even if mentioned in passing inside a project bullet. Do not change `extractResumeData`'s prompt back to whole-resume scanning without being asked.
2. **Scoring logic is deterministic, not AI-driven.** `calculateScore()` uses Set membership + a `normalize()` function (strips `.`, spaces, hyphens) for fuzzy matching. Keep scoring out of the LLM — only extraction should be AI-based.
3. **AI provider selection is automatic via environment, not a config flag.** Constructor checks `GEMINI_API_KEY` presence. Don't introduce a separate `AI_PROVIDER=ollama|gemini` switch unless asked — the implicit detection is intentional and simpler for a single-owner project.
4. **`strictPropertyInitialization: false` in tsconfig**, not `!` assertions on every DTO field. This was a deliberate tradeoff favoring fewer repetitive symbols across many DTOs.

## Known fragile areas / gotchas

- **`pdf-parse` API is class-based (v2)**: use `import { PDFParse } from 'pdf-parse'` and instantiate with `new PDFParse({ data: buffer })`, then call `.getText()`. The older default-import function API (`import pdfParse from 'pdf-parse'`) is from v1 and will not work with the installed v2 package. The v2 package ships its own types, so `@types/pdf-parse` (which describes v1) has been removed.
- **`Express.Multer.File` does not resolve** in this environment's type setup. Use the inline type instead:
  ```typescript
  @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number }
  ```
- **Multer config lives on the controller decorator**, not in a global `MulterModule.register()` — this was a deliberate fallback after `MulterModule` import resolution issues. If reintroducing global Multer config, verify `@nestjs/platform-express` version compatibility first.
- **Phi-3 Mini (the local model) is unreliable at strict JSON output.** Expected failure modes, all defended against in `parseJson<T>()`:
  - Wraps JSON in ` ```json ... ``` ` fences
  - Groups list items into one comma-separated string instead of an array of separate strings
  - Hallucinates extra fields (email, phone, `currentTitle`) not requested in the schema
  - Occasionally generates entirely unrelated content (seen once: Python class instantiation code) instead of JSON
  - Produces malformed/truncated JSON with dangling unquoted text near the end

  Do not strip out the multi-layer parsing (fence-strip -> direct parse -> boundary extraction -> line-repair) or the retry-on-failure wrapper assuming the model "should just work" — empirically it doesn't, consistently enough that the defenses are load-bearing, not defensive paranoia.

- **`tsconfig.json`**: do not add `baseUrl` back (deprecated in TS 6, and `ignoreDeprecations: "6.0"` throws an invalid-value error on the installed TS version). NestJS does not require `baseUrl` to function.
- **CORS** in `main.ts` must list both `http://localhost:3000` and the deployed Vercel URL once one exists — requests from an unlisted origin fail silently with a browser-level CORS error, not a backend error, so check this first if the frontend can reach the backend via curl/Postman but not via the browser.

## Environment variables

```
backend/.env (gitignored)
  PORT=3001
  OLLAMA_URL=http://localhost:11434
  OLLAMA_MODEL=phi3:mini-4k
  GEMINI_API_KEY=                 # empty locally, set in Railway for prod

frontend/.env.local (gitignored)
  NEXT_PUBLIC_API_URL=http://localhost:3001
```

Both have committed `.env.example` counterparts — keep them in sync when adding new variables.

## Dev commands

```bash
ollama run phi3:mini-4k          # must be running before testing backend AI calls
cd backend && npm run start:dev  # localhost:3001
cd frontend && npm run dev       # localhost:3000
```

## Testing approach

No automated tests exist yet. Manual verification via Postman (file upload required, which ruled out Thunder Client's free tier):

- Happy path: valid PDF + job description >= 50 chars -> expect 201 with full `AnalyzeResponseDto`
- Validation paths: no file -> 400; non-PDF mimetype -> 400; short job description -> 400
- When debugging AI output issues, temporarily add `console.log('RAW AI RESPONSE:', data.message.content)` inside `callOllama` right before its return statement — this has been the single most useful debugging step throughout development, since most bugs trace back to what the model actually returned, not the surrounding TypeScript logic

## If you add a new AI-extraction method

Follow the existing pattern in `analysis.service.ts`:

1. Write a strict prompt: state the exact field names required, explicitly forbid markdown/explanation, show one correct example AND one incorrect example
2. Call via `callAI()` (the provider-agnostic wrapper), not `callOllama`/`callGemini` directly
3. Parse with `parseJson<YourType>()`
4. Consider whether the new field needs post-processing similar to `splitGroupedSkills()` if it's a list field
5. Update both `analysis.dto.ts` and `frontend/lib/types.ts` if the new data needs to reach the frontend
