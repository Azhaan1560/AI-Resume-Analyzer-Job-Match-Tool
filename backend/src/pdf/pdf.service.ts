import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfService {
  async extractText(fileBuffer: Buffer): Promise<string> {
    const parser = new PDFParse({
      data: fileBuffer,
    });
    try {
      const result = await parser.getText();
      return this.cleanText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .replace(/[^x20-\x7E\n]/g, '')
      .trim();
  }
}
