import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AnalyzeResponseDto } from './analysis.dto';

interface ResumeData {
  name: string;
  technicalSkills: string[];
  softSkills: string[];
  yearsExperience: number;
}

interface JobData {
  jobTitle: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  experienceNeeded: number;
}

@Injectable()
export class AnalysisService {
  private readonly genAI: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.genAI = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
  }

  async analyzeResume(
    resumeText: string,
    jobDescription: string,
  ): Promise<AnalyzeResponseDto> {
    const [resumeData, jobData] = await Promise.all([
      this.extractResumeData(resumeText),
      this.extractJobData(jobDescription),
    ]);

    const { score, matched, missing } = this.calculateScore(
      resumeData,
      jobData,
    );
    const improvedBullets = await this.rewriteBullets(
      resumeText,
      jobDescription,
    );

    // Build & return the final response
    return {
      matchScore: score,
      matchedSkills: matched,
      missingSkills: missing,
      resumeSkills: resumeData.technicalSkills,
      improvedBullets,
      candidateName: resumeData.name,
      jobTitle: jobData.jobTitle,
    };
  }

  // ── GEMINI CALL ──────────────────────────────────────────────
  // Drop-in replacement for the old Ollama call: same signature,
  // same string return type, so the three callers don't change.
  private async callGemini(prompt: string): Promise<string> {
    const model =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    try {
      const response = await this.genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0,
          // Force valid JSON — no markdown fences or preamble to strip.
          responseMimeType: 'application/json',
        },
      });

      return response.text ?? '';
    } catch (error) {
      throw new InternalServerErrorException(
        `Gemini call failed. Check your GEMINI_API_KEY. Error: ${error}`,
      );
    }
  }

  // ── JSON PARSER (kept as a safety net) ───────────────────────
  // With responseMimeType: 'application/json' Gemini returns clean
  // JSON, but this still guards against the rare malformed response.
  private parseJson<T>(raw: string): T {
    const stripped = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(stripped) as T;
    } catch {
      const objectMatch = stripped.match(/\{[\s\S]*\}/);
      if (objectMatch?.[0]) {
        try {
          return JSON.parse(objectMatch[0]) as T;
        } catch {
          const arrayMatch = stripped.match(/\[[\s\S]*\]/);
          if (arrayMatch?.[0]) {
            return JSON.parse(arrayMatch[0]) as T;
          }
        }
      }

      const arrayMatch = stripped.match(/\[[\s\S]*\]/);
      if (arrayMatch?.[0]) {
        try {
          return JSON.parse(arrayMatch[0]) as T;
        } catch {
          // fall through to final error
        }
      }

      throw new InternalServerErrorException(
        'AI returned unexpected format. Please try again.',
      );
    }
  }

  // ── SKILL MATCHING HELPERS ───────────────────────────────────
  // lowercase + strip separators; keep + and # so C++ / C# survive
  private normalizeSkill(skill: string): string {
    return skill.toLowerCase().replace(/[\s._\-/]/g, '');
  }

  // synonyms that are NOT just version differences (extend as needed)
  private static readonly SKILL_ALIASES: Record<string, string> = {
    reactjs: 'react',
    nodejs: 'node',
    postgres: 'postgresql',
    js: 'javascript',
    ts: 'typescript',
    k8s: 'kubernetes',
    tf: 'tensorflow',
    sklearn: 'scikitlearn',
    scikit: 'scikitlearn',
  };

  private canonical(skill: string): string {
    const n = this.normalizeSkill(skill);
    return AnalysisService.SKILL_ALIASES[n] ?? n;
  }

  // does a resume skill satisfy a required job skill?
  private skillsMatch(jobSkill: string, resumeSkill: string): boolean {
    const j = this.canonical(jobSkill);
    const r = this.canonical(resumeSkill);
    if (!j || !r) return false;
    if (j === r) return true;

    // a trailing version token = same base skill:
    // yolo↔yolov8 / yolov8n, vue↔vue3, python↔python3, resnet↔resnet50
    const versionTail = /^v?\d+[a-z]*$/; // v8, v8n, 3, 11, 50 ...
    if (r.startsWith(j) && versionTail.test(r.slice(j.length))) return true;
    if (j.startsWith(r) && versionTail.test(j.slice(r.length))) return true;

    return false;
  }

  private async extractResumeData(resumeText: string): Promise<ResumeData> {
    const prompt = `
            You are a professional resume parser.
            Analyze the resume below.
            Return ONLY raw JSON.
            No explanation, no markdown, no code blocks, no extra text. Just the JSON object.

            CRITICAL RULES FOR SKILLS:
            - Each skill must be ONE individual technology, language, tool, or soft skill only
            - NEVER group skills together like "Python Java" — split into "Python" and "Java" as SEPARATE array items
            - NEVER include category labels like "Programming Languages:" or "AIML:" as part of a skill
            - NEVER include connector words like "using", "with", "and", "library" inside a skill name
            - If the resume says "OpenCV, YOLOv8, Pandas, NumPy, Scikit-learn" — that is FIVE separate skills, not one

            CRITICAL RULES FOR OTHER FIELDS:
            - Return EXACTLY these 4 fields and NO others: name, technicalSkills, softSkills, yearsExperience
            - name must be the candidate's actual full name from the resume, never empty
            - Do NOT include email, phone, address, or any other fields

            Example of CORRECT output:
            {
              "name": "Jane Doe",
              "technicalSkills": ["Python", "Java", "React", "LangChain"],
              "softSkills": ["Communication", "Leadership"],
              "yearsExperience": 2
            }

            Example of WRONG output (do not do this):
            {
              "technicalSkills": ["Experienced in Python and Java development for 3 years"]
            }

            Resume: ${resumeText}

            Return ONLY this JSON:
            {
              "name": "full name or none",
              "technicalSkills": ["skill1", "skill2", "skill3"],
              "softSkills": ["skill1", "skill2"],
              "yearsExperience": 0
            }
        `;

    const raw = await this.callGemini(prompt);
    return this.parseJson<ResumeData>(raw);
  }

  private calculateScore(
    resumeData: ResumeData,
    jobData: JobData,
  ): { score: number; matched: string[]; missing: string[] } {
    const resumeSkills = [
      ...(resumeData.technicalSkills ?? []),
      ...(resumeData.softSkills ?? []),
    ];
    const requiredSkills = jobData.requiredSkills ?? [];

    const matched = requiredSkills.filter((req) =>
      resumeSkills.some((have) => this.skillsMatch(req, have)),
    );

    const missing = requiredSkills.filter(
      (req) => !resumeSkills.some((have) => this.skillsMatch(req, have)),
    );

    const score =
      requiredSkills.length > 0
        ? Math.round((matched.length / requiredSkills.length) * 100)
        : 0;

    return { score, matched, missing };
  }

  private async extractJobData(jobDescription: string): Promise<JobData> {
    const prompt = `
    You are a job description analyst.
    Analyze the job posting below.
    Extract job Requirements.
    Return ONLY raw JSON.
    Nothing else - No explanation, no markdown, no code blocks, no extra text. Just the JSON object.

    Job Description:
    ${jobDescription}

    Return ONLY this EXACT JSON format:
    {
      "jobTitle": "title of the role",
      "requiredSkills": ["skill1", "skill2", "skill3"],
      "niceToHaveSkills": ["skill1", "skill2"],
      "experienceNeeded": 0
    }

    Rules:
    - requiredSkills must be short individual skill names only (e.g. "Python", "OpenCV")
    - Do NOT write Python code, class definitions, or any programming language output
    - Return ONLY the JSON object shown above, filled with real data from the job posting
    `;

    const raw = await this.callGemini(prompt);
    return this.parseJson<JobData>(raw);
  }

  private async rewriteBullets(
    resumeText: string,
    jobDescription: string,
  ): Promise<string[]> {
    const prompt = `
  You are a professional resume coach.
  Rewrite the experience bullet points from the resume to better match the job.
  Return ONLY raw JSON.
  No explanation, no markdown, no code blocks, no extra text. Just the JSON object.

  Resume (first 1500 characters):
  ${resumeText.slice(0, 1500)}

  Job Description (first 800 characters):
  ${jobDescription.slice(0, 800)}
  Rules:
  - Use strong action verbs (Led, Built, Designed, Reduced, Increased)
  - Add quantifiable results where reasonable (e.g. "by 30%")
  - Stay honest - do not invent skills not in the resume
  - Keep each bullet under 20 words

  Return ONLY a JSON array of exactly 5 improved bullet point strings:
  ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"]`;

    const raw = await this.callGemini(prompt);
    return this.parseJson<string[]>(raw);
  }
}
