import { Controller, Get, Query } from '@nestjs/common';
import { TasasService } from './tasas.service';

@Controller('tasas')
export class TasasController {
  constructor(private readonly tasasService: TasasService) {}

  @Get('actuales')
  obtenerTasasActuales() {
    return this.tasasService.obtenerTasasActuales();
  }

  @Get('historial')
  obtenerHistorial(
    @Query('par') par?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.tasasService.obtenerHistorial(par, periodo);
  }
}
