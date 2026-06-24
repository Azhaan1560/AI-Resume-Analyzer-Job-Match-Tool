import axios, { AxiosError } from 'axios';
import { AnalysisResult, ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function analyzeResume(
    resumeFile: File,
    jobDescription: string,
): Promise<AnalysisResult>{

    const formData = new FormData();
    formData.append('resume', resumeFile);

    formData.append('jobDescription', jobDescription);

    try {
        const response = await axios.post<AnalysisResult>(
            
            `${API_URL}/analyze`,
            formData,
            {
                timeout: 180000,
            },
        );

        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiError>;
        const message = axiosError.response?.data?.message ??
            'Something went wrong, Is the backend running';
        throw new Error(
            Array.isArray(message) ? message.join(',') : message
        );
    }
}