import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnalysisService } from './analysis.service';
import { AnalyzeRequestDto, AnalyzeResponseDto } from './analysis.dto';
import { PdfService } from '../pdf/pdf.service';
import { memoryStorage } from 'multer';

@Controller('analyze')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly pdfService: PdfService,
  ) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('resume', {
      storage: memoryStorage(),
    }),
  )
  async analyze(
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },

    @Body() body: AnalyzeRequestDto,
  ): Promise<AnalyzeResponseDto> {
    console.log('FILE RECEIVED:', file);
    console.log('BODY RECEIVED:', body);
    if (!file) {
      throw new BadRequestException('Please upload a PDF resume file.');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are accepted.');
    }

    if (!body.jobDescription || body.jobDescription.trim().length < 50) {
      throw new BadRequestException(
        'Job description must be at least 50 characters.',
      );
    }

    const resumeText = await this.pdfService.extractText(file.buffer);

    if (resumeText.length < 100) {
      throw new BadRequestException(
        'Could not extract text from this PDF. Make sure it is not a scanned image',
      );
    }

    return this.analysisService.analyzeResume(resumeText, body.jobDescription);
  }
}
