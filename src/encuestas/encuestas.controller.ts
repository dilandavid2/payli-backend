import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EncuestasService } from './encuestas.service';

@Controller('encuestas')
export class EncuestasController {
  constructor(private readonly encuestasService: EncuestasService) {}

  @Post('comparacion')
  @HttpCode(200)
  guardar(@Body() cuerpo: unknown) {
    return this.encuestasService.guardar(cuerpo);
  }
}
