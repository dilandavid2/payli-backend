import { Module } from '@nestjs/common';
import { EncuestasController } from './encuestas.controller';
import { EncuestasRepository } from './encuestas.repository';
import { EncuestasService } from './encuestas.service';

@Module({
  controllers: [EncuestasController],
  providers: [EncuestasService, EncuestasRepository],
})
export class EncuestasModule {}
