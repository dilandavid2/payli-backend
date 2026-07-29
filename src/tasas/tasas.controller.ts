import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { TasasService } from './tasas.service';
import { BinanceService } from './binance.service';

@Controller('tasas')
export class TasasController {
  constructor(
    private readonly tasasService: TasasService,
    private readonly binanceService: BinanceService,
  ) {}

  @Get('actuales')
  obtenerTasasActuales() {
    return this.tasasService.obtenerTasasActuales();
  }

  @Get('binance')
  obtenerTasasBinance() {
    return this.binanceService.obtenerTasas();
  }

  @Get('historial')
  obtenerHistorial(
    @Query('par') par?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.tasasService.obtenerHistorial(par, periodo);
  }

  @Post('historial/importar-trm')
  importarHistorialTrm(
    @Headers('authorization') autorizacion: string | undefined,
    @Body() cuerpo: unknown,
  ) {
    return this.tasasService.importarHistorialTrm(autorizacion, cuerpo);
  }
}
