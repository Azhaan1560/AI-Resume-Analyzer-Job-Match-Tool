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

      return data.message.content;
    } catch (error) {
      throw new InternalServerErrorException(
        `Ollama call failed.. Is Ollama running? Error: ${error}`,
      );
    }
  }

  private parseJson<T>(raw: string): T {
    const objectMatch = raw.match(/\{.*\}/s);
    const arrayMatch = raw.match(/\[.*\]/s);
    const jsonString = objectMatch?.[0] ?? arrayMatch?.[0];

    if (!jsonString) {
      throw new InternalServerErrorException(
        'AI returned an unexpected fromat.Try again',
      );
    }
    return JSON.parse(jsonString) as T;
  }

  private async extractResumeData(resumeText: string): Promise<ResumeData> {
    const prompt = `
            You are a professional resume parser.
            Analyze the resume below and return ONLY a JSON object.
            Do not write any explanation, greeting, or extra text. Return ONLY the JSON.

            Resume: ${resumeText}

            Return this EXACT JSON format:
            {
            "candidateName": "full name",
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
    const resumeSkillsLower = new Set([
      ...resumeData.technicalSkills.map((s) => s.toLowerCase()),
      ...resumeData.softSkills.map((s) => s.toLowerCase()),
    ]);

    const requiredSkills = jobData.requiredSkills;

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
Analyze the job posting below and return ONLY a JSON object.
Do not write any explanation, greeting, or extra text. Return ONLY the JSON.

Job Description:
${jobDescription}

Return this EXACT JSON format:
{
  "jobTitle": "title of the role",
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1"],
  "experienceNeeded": 0
}`;

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
  Rules:
  -Use string action verbs (Led, Built, Designed, Reduced, Increased)
  - Add quantifiable results where reasonable (e.g "by 30%)
  -Stay honest - do not invent skills not in the resume
  -Keep each bullet under 20 words

  Resume (first 1500 chatacters):
  ${resumeText.slice(0, 1500)}

  Job Description (first 800 characters):
  ${jobDescription.slice(0, 800)}

  Return ONLY a JSON array of exactly 5 improved bullet point strings:
  ["Bullet 1", "Bullet 2","Bullet 3","Bullet 4","Bullet 5"] `;

    const raw = await this.callOllama(prompt);
    return this.parseJson<string[]>(raw);
  }
}
