import { Controller, Get } from '@nestjs/common';
import { TasasService } from './tasas.service';

@Controller('tasas')
export class TasasController {
  constructor(private readonly tasasService: TasasService) {}

  @Get('actuales')
  obtenerTasasActuales() {
    return this.tasasService.obtenerTasasActuales();
  }
}
