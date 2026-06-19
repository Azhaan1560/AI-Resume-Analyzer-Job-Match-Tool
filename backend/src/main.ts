import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'https://localhost:3000',
    methods: ['POST'],
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`Backend running on http://localhost:${port}`);
  console.log(`Analyze endpoint: POST http://localhost:${port}/analyze`);
}
bootstrap();
