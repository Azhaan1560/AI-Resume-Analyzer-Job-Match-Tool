import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AnalysisModule],
})
export class AppModule {}
