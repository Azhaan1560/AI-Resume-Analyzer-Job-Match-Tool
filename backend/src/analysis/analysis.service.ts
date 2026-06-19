import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
}
@Injectable()
export class AnalysisService {
  constructor(private readonly configService: ConfigService) {}
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

    //Build & Return the final response
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

  //CALLING OLLAMA
  private async callOllama(prompt: string): Promise<string> {
    const ollamaUrl = this.configService.get<string>('OLLAMA_URL');

    const model = this.configService.get<string>('OLLAMA_MODEL');
    console.log('OLLAMA_URL:', ollamaUrl);
    console.log('OLLAMA_MODEL:', model);
    try {
      const response = await axios.post(`${ollamaUrl}/api/chat`, {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          num_ctx: 4096,
          temperature: 0,
        },
      });
      const data = response.data as OllamaResponse;
      // ← add this temporarily to see raw AI output
      console.log('RAW AI RESPONSE:', data.message.content);

      return data.message.content;
    } catch (error) {
      throw new InternalServerErrorException(
        `Ollama call failed.. Is Ollama running? Error: ${error}`,
      );
    }
  }

  // analysis.service.ts

  private parseJson<T>(raw: string): T {
    // Step 1 — strip markdown code blocks if AI wrapped JSON in ```json ... ```
    const stripped = raw
      .replace(/```json/gi, '') // remove opening ```json
      .replace(/```/g, '') // remove closing ```
      .trim();

    // Step 2 — try parsing the whole cleaned string first
    // This works when AI returns pure JSON with no extra text
    try {
      return JSON.parse(stripped) as T;
    } catch {
      // Step 3 — if that fails, hunt for JSON object {...} in the string
      // Using [\s\S]* instead of .* with /s flag — works on all Node versions
      const objectMatch = stripped.match(/\{[\s\S]*\}/);
      if (objectMatch?.[0]) {
        try {
          return JSON.parse(objectMatch[0]) as T;
        } catch {
          // Step 4 — hunt for JSON array [...] instead
          const arrayMatch = stripped.match(/\[[\s\S]*\]/);
          if (arrayMatch?.[0]) {
            return JSON.parse(arrayMatch[0]) as T;
          }
        }
      }

      // Step 5 — hunt for array if object search was skipped
      const arrayMatch = stripped.match(/\[[\s\S]*\]/);
      if (arrayMatch?.[0]) {
        try {
          return JSON.parse(arrayMatch[0]) as T;
        } catch {
          // fall through to final error
        }
      }

      // Nothing worked — throw a clear error
      throw new InternalServerErrorException(
        'AI returned unexpected format. Please try again.',
      );
    }
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

            Return ONLY this JSON :
            {
            "name": "full name or none",
            "skills": ["skill1", "skill2", "skill3"],
            "experienceYears": 0,
            "currentTitle": "current or most recent job title"
            }
        `;

    const raw = await this.callOllama(prompt);
    return this.parseJson<ResumeData>(raw);
  }

  private calculateScore(
    resumeData: ResumeData,
    jobData: JobData,
  ): { score: number; matched: string[]; missing: string[] } {
    const technicalSkills = resumeData.technicalSkills ?? [];
    const softSkills = resumeData.softSkills ?? [];
    const requiredSkills = jobData.requiredSkills ?? [];

    const resumeSkillsLower = new Set([
      ...technicalSkills.map((s) => s.toLowerCase()),
      ...softSkills.map((s) => s.toLowerCase()),
    ]);

    const matched = requiredSkills.filter((skill) =>
      resumeSkillsLower.has(skill.toLowerCase()),
    );

    const missing = requiredSkills.filter(
      (skill) => !resumeSkillsLower.has(skill.toLowerCase()),
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
      "requiredSkills": ["skill1", "skill2", "skill3],
      "niceToHaveSkills": ["skill1", "skill2"],
      "experienceNeeded": 0
    }
    
    Rules:
    - requiredSkills must be short individual skill names only (e.g. "Python", "OpenCV")
    - Do NOT write Python code, class definitions, or any programming language output
    - Return ONLY the JSON object shown above, filled with real data from the job posting
    `;

    const raw = await this.callOllama(prompt);
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
  
  Resume (first 1500 chatacters):
  ${resumeText.slice(0, 1500)}

  Job Description (first 800 characters):
  ${jobDescription.slice(0, 800)}
  Rules:
  -Use string action verbs (Led, Built, Designed, Reduced, Increased)
  -Add quantifiable results where reasonable (e.g "by 30%)
  -Stay honest - do not invent skills not in the resume
  -Keep each bullet under 20 words

  Return ONLY a JSON array of exactly 5 improved bullet point strings:
  ["Bullet 1", "Bullet 2","Bullet 3","Bullet 4","Bullet 5"] `;

    const raw = await this.callOllama(prompt);
    return this.parseJson<string[]>(raw);
  }
}
