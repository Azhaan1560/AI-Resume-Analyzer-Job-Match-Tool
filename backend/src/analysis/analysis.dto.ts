export class AnalyzeRequestDto {
  jobDescription!: string;
}

export class AnalyzeResponseDto {
  matchScore!: number;
  matchedSkills!: string[];
  missingSkills!: string[];
  resumeSkills!: string[];
  improvedBullets!: string[];
  candidateName!: string;
  jobTitle!: string;
}
