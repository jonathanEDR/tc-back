import { Types } from 'mongoose';
import CatalogoGasto, { CategoriaGasto, TipoGasto } from '../models/CatalogoGastos';
import { TipoCosto } from '../models/Caja';
import logger from './logger';

/**
 * Mapeo directo entre TipoCosto de Caja y CategoriaGasto del Catálogo
 * Ahora las categorías mapean 1:1 con los tipos de costo
 */
export const MAPEO_TIPO_COSTO_CATEGORIA = {
  [TipoCosto.MANO_OBRA]: CategoriaGasto.MANO_OBRA,
  [TipoCosto.MATERIA_PRIMA]: CategoriaGasto.MATERIA_PRIMA,
  [TipoCosto.OTROS_GASTOS]: CategoriaGasto.OTROS_GASTOS
} as const;

/**
 * Mapeo inverso: de CategoriaGasto a TipoCosto
 */
export const MAPEO_CATEGORIA_TIPO_COSTO = {
  [CategoriaGasto.MANO_OBRA]: TipoCosto.MANO_OBRA,
  [CategoriaGasto.MATERIA_PRIMA]: TipoCosto.MATERIA_PRIMA,
  [CategoriaGasto.OTROS_GASTOS]: TipoCosto.OTROS_GASTOS
} as const;

/**
 * Etiquetas que sugieren automáticamente un TipoCosto específico
 */
export const ETIQUETAS_SUGERIDAS = {
  [TipoCosto.MANO_OBRA]: [
    'personal', 'salarios', 'bonificaciones', 'horas_extras', 
    'consultoria', 'servicios_externos', 'especialistas',
    'incentivos', 'comisiones'
  ],
  [TipoCosto.MATERIA_PRIMA]: [
    'materiales', 'construccion', 'insumos', 'quimicos',
    'herramientas', 'repuestos', 'maquinaria', 'equipos',
    'materiales_basicos', 'embalaje', 'empaque'
  ],
  [TipoCosto.OTROS_GASTOS]: [
    'combustible', 'transporte', 'servicios_publicos', 
    'electricidad', 'agua', 'gas', 'internet', 'telefonia',
    'mantenimiento', 'reparaciones', 'oficina', 'suministros',
    'seguros', 'capacitacion', 'entrenamiento'
  ]
} as const;

/**
 * Interface para representar una sugerencia de gasto del catálogo
 */
export interface SugerenciaGastoCatalogo {
  _id: Types.ObjectId;
  nombre: string;
  categoria: CategoriaGasto;
  tipoGasto: TipoGasto;
  montoEstimado?: number;
  tipoCostoSugerido: TipoCosto;
  relevancia: number; // 0-100, basado en la coincidencia
}

/**
 * Busca gastos del catálogo que coincidan con un TipoCosto específico
 */
export async function buscarGastosPorTipoCosto(
  tipoCosto: TipoCosto,
  filtros?: {
    soloActivos?: boolean;
    incluirMontoEstimado?: boolean;
    limite?: number;
  }
): Promise<SugerenciaGastoCatalogo[]> {
  try {
    const categoriaPermitida = MAPEO_TIPO_COSTO_CATEGORIA[tipoCosto];
    
    // Construir query - ahora es mapeo directo 1:1
    const query: any = {
      categoriaGasto: categoriaPermitida
    };
    
    if (filtros?.soloActivos !== false) {
      query.estado = 'activo';
    }
    
    if (filtros?.incluirMontoEstimado) {
      query.montoEstimado = { $exists: true, $gt: 0 };
    }
    
    // Buscar en la base de datos
    let gastosQuery = CatalogoGasto.find(query);
    
    if (filtros?.limite) {
      gastosQuery = gastosQuery.limit(filtros.limite);
    }
    
    const gastos = await gastosQuery.sort({ nombre: 1 }).lean();
    
    // Convertir a sugerencias con relevancia
    const sugerencias: SugerenciaGastoCatalogo[] = gastos.map(gasto => {
      let relevancia = 80; // Base alta por mapeo directo
      
      // Aumentar relevancia por etiquetas coincidentes
      const etiquetasRelevantes = ETIQUETAS_SUGERIDAS[tipoCosto];
      if (gasto.etiquetas) {
        const coincidencias = gasto.etiquetas.filter(tag => 
          etiquetasRelevantes.some(etiquetaRel => 
            tag.toLowerCase().includes(etiquetaRel.toLowerCase()) ||
            etiquetaRel.toLowerCase().includes(tag.toLowerCase())
          )
        ).length;
        relevancia += Math.min(coincidencias * 5, 20);
      }
      
      return {
        _id: gasto._id,
        nombre: gasto.nombre,
        categoria: gasto.categoriaGasto,
        tipoGasto: gasto.tipoGasto,
        montoEstimado: gasto.montoEstimado,
        tipoCostoSugerido: tipoCosto,
        relevancia: Math.min(relevancia, 100)
      };
    });
    
    // Ordenar por relevancia
    return sugerencias.sort((a, b) => b.relevancia - a.relevancia);
    
  } catch (error) {
    logger.error('Error al buscar gastos por tipo de costo:', error);
    throw error;
  }
}

/**
 * Sugiere un TipoCosto basado en un gasto del catálogo
 */
export function sugerirTipoCostoPorGasto(gasto: {
  categoriaGasto: CategoriaGasto;
  etiquetas?: string[];
}): {
  tipoCosto: TipoCosto;
  confianza: number; // 0-100
  razon: string;
} {
  // Mapeo directo por categoría (siempre funciona ahora)
  const tipoCostoDirecto = MAPEO_CATEGORIA_TIPO_COSTO[gasto.categoriaGasto];
  
  let confianza = 80; // Base alta por mapeo directo
  let razon = `Categoría '${gasto.categoriaGasto}' mapea directamente a '${tipoCostoDirecto}'`;
  
  // Aumentar confianza por etiquetas relevantes
  const etiquetasRelevantes = ETIQUETAS_SUGERIDAS[tipoCostoDirecto];
  if (gasto.etiquetas && gasto.etiquetas.length > 0) {
    const coincidencias = gasto.etiquetas.filter(tag => 
      etiquetasRelevantes.some(etiquetaRel => 
        tag.toLowerCase().includes(etiquetaRel.toLowerCase()) ||
        etiquetaRel.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    if (coincidencias.length > 0) {
      confianza = Math.min(95, confianza + (coincidencias.length * 5));
      razon += ` y etiquetas relevantes: ${coincidencias.join(', ')}`;
    }
  }
  
  return {
    tipoCosto: tipoCostoDirecto,
    confianza,
    razon
  };
}

/**
 * Busca gastos del catálogo por texto libre
 */
export async function buscarGastosPorTexto(
  texto: string,
  tipoCostoFiltro?: TipoCosto
): Promise<SugerenciaGastoCatalogo[]> {
  try {
    const query: any = {
      estado: 'activo',
      $or: [
        { nombre: { $regex: texto, $options: 'i' } },
        { descripcion: { $regex: texto, $options: 'i' } },
        { etiquetas: { $in: [new RegExp(texto, 'i')] } }
      ]
    };
    
    // Si se especifica un tipo de costo, filtrar por categorías relacionadas
    if (tipoCostoFiltro) {
      const categoriaPermitida = MAPEO_TIPO_COSTO_CATEGORIA[tipoCostoFiltro];
      query.categoriaGasto = categoriaPermitida;
    }
    
    const gastos = await CatalogoGasto.find(query).limit(10).lean();
    
    return gastos.map(gasto => {
      const sugerencia = sugerirTipoCostoPorGasto(gasto);
      return {
        _id: gasto._id,
        nombre: gasto.nombre,
        categoria: gasto.categoriaGasto,
        tipoGasto: gasto.tipoGasto,
        montoEstimado: gasto.montoEstimado,
        tipoCostoSugerido: sugerencia.tipoCosto,
        relevancia: sugerencia.confianza
      };
    }).sort((a, b) => b.relevancia - a.relevancia);
    
  } catch (error) {
    logger.error('Error al buscar gastos por texto:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de sincronización entre Caja y CatalogoGastos
 */
export async function obtenerEstadisticasSincronizacion(): Promise<{
  totalGastosCatalogo: number;
  totalGastosActivos: number;
  distribucionPorTipoCosto: Record<TipoCosto, number>;
  categoriasOrfanas: CategoriaGasto[]; // Categorías sin mapeo claro
}> {
  try {
    const totalGastosCatalogo = await CatalogoGasto.countDocuments();
    const totalGastosActivos = await CatalogoGasto.countDocuments({ estado: 'activo' });
    
    // Contar gastos activos por categoría
    const gastosPorCategoria = await CatalogoGasto.aggregate([
      { $match: { estado: 'activo' } },
      { $group: { _id: '$categoriaGasto', count: { $sum: 1 } } }
    ]);
    
    // Mapear a tipos de costo (ahora es 1:1)
    const distribucionPorTipoCosto: Record<TipoCosto, number> = {
      [TipoCosto.MANO_OBRA]: 0,
      [TipoCosto.MATERIA_PRIMA]: 0,
      [TipoCosto.OTROS_GASTOS]: 0
    };
    
    const categoriasEncontradas = new Set<CategoriaGasto>();
    
    gastosPorCategoria.forEach(({ _id: categoriaGasto, count }) => {
      categoriasEncontradas.add(categoriaGasto);
      const tipoCosto = MAPEO_CATEGORIA_TIPO_COSTO[categoriaGasto as CategoriaGasto];
      if (tipoCosto) {
        distribucionPorTipoCosto[tipoCosto] += count;
      }
    });
    
    // Las categorías huérfanas ya no existen con el mapeo 1:1
    const categoriasOrfanas: CategoriaGasto[] = [];
    
    return {
      totalGastosCatalogo,
      totalGastosActivos,
      distribucionPorTipoCosto,
      categoriasOrfanas
    };
    
  } catch (error) {
    logger.error('Error al obtener estadísticas de sincronización:', error);
    throw error;
  }
}