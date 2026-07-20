import { Module } from '@nestjs/common';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';

@Module({
  controllers: [TasasController],
  providers: [TasasService],
})
export class TasasModule {}
