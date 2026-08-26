import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EncuestaComparacion,
  EncuestasRepository,
} from './encuestas.repository';

const categorias = [
  'alimentos',
  'farmacia',
  'tecnologia',
  'ropa_calzado',
  'hogar',
  'restaurante',
  'servicios',
  'otro',
] as const;
const etapas = ['explorando', 'planeo_comprar', 'ya_compre'] as const;
const modos = ['un_monto', 'dos_precios', 'tres_precios'] as const;
const monedas = ['USD', 'COP', 'VES'] as const;

@Injectable()
export class EncuestasService {
  constructor(private readonly repositorio: EncuestasRepository) {}

  async guardar(cuerpo: unknown) {
    if (typeof cuerpo !== 'object' || cuerpo === null) {
      throw new BadRequestException('Encuesta inválida.');
    }

    const datos = cuerpo as Record<string, unknown>;
    const categoria = this.enumerado(datos.categoria, categorias, 'categoría');
    const etapa = this.enumerado(datos.etapa, etapas, 'etapa');
    const modoComparacion = this.enumerado(
      datos.modoComparacion,
      modos,
      'modo de comparación',
    );
    const montos = this.validarMontos(datos.montos);
    const encuesta: EncuestaComparacion = {
      categoria,
      etapa,
      modoComparacion,
      montos,
      ...this.textoOpcional(datos.producto, 'producto', 100),
      ...this.textoOpcional(datos.comercio, 'comercio', 100),
      ...this.textoOpcional(datos.ciudad, 'ciudad', 80),
    };

    await this.repositorio.guardar(encuesta);
    return { guardada: true };
  }

  private validarMontos(valor: unknown): Record<string, number> {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      throw new BadRequestException('Los montos son inválidos.');
    }

    const entrada = valor as Record<string, unknown>;
    const resultado: Record<string, number> = {};
    for (const moneda of monedas) {
      if (entrada[moneda] === undefined) continue;
      const monto = Number(entrada[moneda]);
      if (!Number.isFinite(monto) || monto <= 0 || monto > 1e15) {
        throw new BadRequestException(`El monto ${moneda} es inválido.`);
      }
      resultado[moneda] = monto;
    }

    if (Object.keys(resultado).length === 0) {
      throw new BadRequestException('Debe incluir al menos un monto.');
    }
    return resultado;
  }

  private enumerado<T extends readonly string[]>(
    valor: unknown,
    opciones: T,
    nombre: string,
  ): T[number] {
    if (typeof valor !== 'string' || !opciones.includes(valor)) {
      throw new BadRequestException(`${nombre} inválido.`);
    }
    return valor;
  }

  private textoOpcional(
    valor: unknown,
    nombre: 'producto' | 'comercio' | 'ciudad',
    maximo: number,
  ): Partial<Pick<EncuestaComparacion, typeof nombre>> {
    if (valor === undefined || valor === null || valor === '') return {};
    if (typeof valor !== 'string' || valor.trim().length > maximo) {
      throw new BadRequestException(`${nombre} inválido.`);
    }
    return { [nombre]: valor.trim() };
  }
}
