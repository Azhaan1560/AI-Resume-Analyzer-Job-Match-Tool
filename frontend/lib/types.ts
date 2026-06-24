export interface AnalysisResult{
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  resumeSkills: string[];
  improvedBullets: string[];
  candidateName : string;
  jobTitle: string;
}

export interface ApiError{
    statusCode: number;
    message: string;
}

export type FormStatus = 'idle' | 'loading' | 'success' | 'error';
