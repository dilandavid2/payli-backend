import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  obtenerEstado() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
