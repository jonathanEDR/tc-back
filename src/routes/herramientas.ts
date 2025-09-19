import express, { Request, Response } from 'express';
import { z } from 'zod';
import CatalogoGasto, { 
  CategoriaGasto, 
  TipoGasto, 
  EstadoGasto, 
  ICatalogoGasto 
} from '../models/CatalogoGastos';
import { requireAuth } from '../middleware/clerkAuth';
import User from '../models/User';
import { TipoCosto } from '../models/Caja';
import {
  buscarGastosPorTipoCosto,
  sugerirTipoCostoPorGasto,
  buscarGastosPorTexto,
  obtenerEstadisticasSincronizacion
} from '../utils/sincronizacionGastos';

const router = express.Router();

// Schemas de validación con Zod
const crearGastoSchema = z.object({
  nombre: z.string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  descripcion: z.string()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .optional(),
  categoriaGasto: z.enum([
    CategoriaGasto.MANO_OBRA,
    CategoriaGasto.MATERIA_PRIMA,
    CategoriaGasto.OTROS_GASTOS
  ]),
  tipoGasto: z.enum([
    TipoGasto.FIJO,
    TipoGasto.VARIABLE,
    TipoGasto.OCASIONAL
  ]),
  montoEstimado: z.number()
    .min(0, "El monto estimado no puede ser negativo")
    .max(999999999, "El monto estimado no puede exceder 999,999,999")
    .optional(),
  estado: z.enum([
    EstadoGasto.ACTIVO,
    EstadoGasto.INACTIVO,
    EstadoGasto.ARCHIVADO
  ]).default(EstadoGasto.ACTIVO),
  observaciones: z.string()
    .max(1000, "Las observaciones no pueden exceder 1000 caracteres")
    .optional(),
  etiquetas: z.array(z.string().max(50, "Cada etiqueta no puede exceder 50 caracteres"))
    .max(10, "No se pueden agregar más de 10 etiquetas")
    .optional()
});

const actualizarGastoSchema = crearGastoSchema.partial();

const filtrosSchema = z.object({
  categoriaGasto: z.enum([
    CategoriaGasto.MANO_OBRA,
    CategoriaGasto.MATERIA_PRIMA,
    CategoriaGasto.OTROS_GASTOS
  ]).optional(),
  tipoGasto: z.enum([
    TipoGasto.FIJO,
    TipoGasto.VARIABLE,
    TipoGasto.OCASIONAL
  ]).optional(),
  estado: z.enum([
    EstadoGasto.ACTIVO,
    EstadoGasto.INACTIVO,
    EstadoGasto.ARCHIVADO
  ]).optional(),
  search: z.string().optional(),
  etiqueta: z.string().optional(),
  montoMin: z.number().min(0).optional(),
  montoMax: z.number().min(0).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

// **GET /herramientas/catalogo** - Obtener lista de gastos con filtros y paginación
router.get('/catalogo', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedQuery = filtrosSchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      montoMin: req.query.montoMin ? parseFloat(req.query.montoMin as string) : undefined,
      montoMax: req.query.montoMax ? parseFloat(req.query.montoMax as string) : undefined
    });

    const { 
      categoriaGasto, 
      tipoGasto, 
      estado, 
      search, 
      etiqueta, 
      montoMin, 
      montoMax, 
      page, 
      limit 
    } = validatedQuery;

    // Construir query de filtros
    const query: any = {};
    
    if (categoriaGasto) query.categoriaGasto = categoriaGasto;
    if (tipoGasto) query.tipoGasto = tipoGasto;
    if (estado) query.estado = estado;
    if (etiqueta) query.etiquetas = { $in: [etiqueta] };
    
    // Filtro por monto
    if (montoMin !== undefined || montoMax !== undefined) {
      query.montoEstimado = {};
      if (montoMin !== undefined) query.montoEstimado.$gte = montoMin;
      if (montoMax !== undefined) query.montoEstimado.$lte = montoMax;
    }
    
    // Filtro de búsqueda por texto
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { etiquetas: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Ejecutar consulta con paginación
    const skip = (page - 1) * limit;
    
    const [gastos, total] = await Promise.all([
      CatalogoGasto.find(query)
        .sort({ nombre: 1 })
        .skip(skip)
        .limit(limit)
        .populate('creadoPor', 'name email clerkId'),
      CatalogoGasto.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        gastos,
        total,
        page,
        totalPages
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo catálogo de gastos:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de filtros inválidos',
        errors: error.issues
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/catalogo/activos** - Obtener solo gastos activos (para selects)
router.get('/catalogo/activos', requireAuth, async (req: Request, res: Response) => {
  try {
    const gastos = await CatalogoGasto.find({ estado: EstadoGasto.ACTIVO }).sort({ nombre: 1 });
    
    res.json({
      success: true,
      data: gastos
    });

  } catch (error: any) {
    console.error('Error obteniendo gastos activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/catalogo/categoria/:categoria** - Obtener gastos por categoría
router.get('/catalogo/categoria/:categoria', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoria } = req.params;
    
    // Validar que la categoría sea válida
    if (!Object.values(CategoriaGasto).includes(categoria as CategoriaGasto)) {
      return res.status(400).json({
        success: false,
        message: 'Categoría inválida'
      });
    }

    const gastos = await CatalogoGasto.find({ 
      categoriaGasto: categoria as CategoriaGasto, 
      estado: EstadoGasto.ACTIVO 
    }).sort({ nombre: 1 });
    
    res.json({
      success: true,
      data: gastos
    });

  } catch (error: any) {
    console.error('Error obteniendo gastos por categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/catalogo/buscar/:texto** - Búsqueda por texto
router.get('/catalogo/buscar/:texto', requireAuth, async (req: Request, res: Response) => {
  try {
    const { texto } = req.params;
    
    if (!texto || texto.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El texto de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const gastos = await CatalogoGasto.find({
      $and: [
        { estado: EstadoGasto.ACTIVO },
        {
          $or: [
            { nombre: { $regex: texto, $options: 'i' } },
            { descripcion: { $regex: texto, $options: 'i' } },
            { etiquetas: { $in: [new RegExp(texto, 'i')] } }
          ]
        }
      ]
    }).sort({ nombre: 1 });
    
    res.json({
      success: true,
      data: gastos
    });

  } catch (error: any) {
    console.error('Error en búsqueda de gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/catalogo/:id** - Obtener un gasto específico
router.get('/catalogo/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const gasto = await CatalogoGasto.findById(id).populate('creadoPor', 'name email clerkId');
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    res.json({
      success: true,
      data: gasto
    });

  } catch (error: any) {
    console.error('Error obteniendo gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **POST /herramientas/catalogo** - Crear nuevo gasto
router.post('/catalogo', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = crearGastoSchema.parse(req.body);
    
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Buscar el usuario en nuestra base de datos
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    
    const nuevoGasto = new CatalogoGasto({
      ...validatedData,
      creadoPor: user._id // Usar el ID de MongoDB del usuario
    });

    const gastoGuardado = await nuevoGasto.save();
    await gastoGuardado.populate('creadoPor', 'name email clerkId');

    res.status(201).json({
      success: true,
      data: gastoGuardado,
      message: 'Gasto creado exitosamente'
    });

  } catch (error: any) {
    console.error('Error creando gasto:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.issues
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un gasto con ese nombre'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **PUT /herramientas/catalogo/:id** - Actualizar gasto
router.put('/catalogo/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = actualizarGastoSchema.parse(req.body);
    
    const gastoActualizado = await CatalogoGasto.findByIdAndUpdate(
      id,
      validatedData,
      { new: true, runValidators: true }
    ).populate('creadoPor', 'name email clerkId');

    if (!gastoActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    res.json({
      success: true,
      data: gastoActualizado,
      message: 'Gasto actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('Error actualizando gasto:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.issues
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **DELETE /herramientas/catalogo/:id** - Eliminar gasto (soft delete - cambiar a archivado)
router.delete('/catalogo/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const gastoArchivado = await CatalogoGasto.findByIdAndUpdate(
      id,
      { estado: EstadoGasto.ARCHIVADO },
      { new: true }
    ).populate('creadoPor', 'name email clerkId');

    if (!gastoArchivado) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    res.json({
      success: true,
      data: gastoArchivado,
      message: 'Gasto archivado exitosamente'
    });

  } catch (error: any) {
    console.error('Error archivando gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/resumen/estadisticas** - Obtener resumen estadístico
router.get('/resumen/estadisticas', requireAuth, async (req: Request, res: Response) => {
  try {
    // Resumen general
    const totalGastos = await CatalogoGasto.countDocuments({ estado: EstadoGasto.ACTIVO });
    
    // Resumen por categoría
    const gastosPorCategoria = await CatalogoGasto.aggregate([
      { $match: { estado: EstadoGasto.ACTIVO } },
      {
        $group: {
          _id: '$categoriaGasto',
          cantidad: { $sum: 1 },
          montoEstimadoTotal: { $sum: { $ifNull: ['$montoEstimado', 0] } }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);

    // Resumen por tipo
    const gastosPorTipo = await CatalogoGasto.aggregate([
      { $match: { estado: EstadoGasto.ACTIVO } },
      {
        $group: {
          _id: '$tipoGasto',
          cantidad: { $sum: 1 },
          montoEstimadoTotal: { $sum: { $ifNull: ['$montoEstimado', 0] } }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalGastos,
        gastosPorCategoria,
        gastosPorTipo
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== NUEVAS RUTAS DE SINCRONIZACIÓN =====

// **GET /herramientas/sincronizacion/por-tipo-costo/:tipoCosto** - Buscar gastos por tipo de costo
router.get('/sincronizacion/por-tipo-costo/:tipoCosto', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tipoCosto } = req.params;
    
    // Validar que el tipo de costo sea válido
    if (!Object.values(TipoCosto).includes(tipoCosto as TipoCosto)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de costo inválido',
        tiposValidos: Object.values(TipoCosto)
      });
    }

    const query = z.object({
      soloActivos: z.string().optional().transform(val => val === 'true'),
      incluirMontoEstimado: z.string().optional().transform(val => val === 'true'),
      limite: z.string().optional().transform(val => val ? parseInt(val) : undefined)
    }).safeParse(req.query);

    if (!query.success) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros de consulta inválidos',
        errors: query.error.issues
      });
    }

    const sugerencias = await buscarGastosPorTipoCosto(tipoCosto as TipoCosto, {
      soloActivos: query.data.soloActivos ?? true,
      incluirMontoEstimado: query.data.incluirMontoEstimado,
      limite: query.data.limite ?? 10
    });

    res.json({
      success: true,
      data: {
        tipoCosto,
        sugerencias,
        total: sugerencias.length
      }
    });

  } catch (error: any) {
    console.error('Error buscando gastos por tipo de costo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/sincronizacion/sugerir-tipo/:gastoId** - Sugerir tipo de costo para un gasto
router.get('/sincronizacion/sugerir-tipo/:gastoId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { gastoId } = req.params;
    
    const gasto = await CatalogoGasto.findById(gastoId).lean();
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    const sugerencia = sugerirTipoCostoPorGasto(gasto);

    res.json({
      success: true,
      data: {
        gasto: {
          _id: gasto._id,
          nombre: gasto.nombre,
          categoriaGasto: gasto.categoriaGasto,
          etiquetas: gasto.etiquetas
        },
        sugerencia
      }
    });

  } catch (error: any) {
    console.error('Error sugiriendo tipo de costo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/sincronizacion/buscar/:texto** - Búsqueda inteligente con sugerencias de tipo
router.get('/sincronizacion/buscar/:texto', requireAuth, async (req: Request, res: Response) => {
  try {
    const { texto } = req.params;
    
    if (!texto || texto.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El texto de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const query = z.object({
      tipoCostoFiltro: z.enum([TipoCosto.MANO_OBRA, TipoCosto.MATERIA_PRIMA, TipoCosto.OTROS_GASTOS]).optional()
    }).safeParse(req.query);

    if (!query.success) {
      return res.status(400).json({
        success: false,
        message: 'Filtro de tipo de costo inválido',
        errors: query.error.issues
      });
    }

    const resultados = await buscarGastosPorTexto(texto, query.data.tipoCostoFiltro);

    res.json({
      success: true,
      data: {
        textoBuscado: texto,
        tipoCostoFiltro: query.data.tipoCostoFiltro || null,
        resultados,
        total: resultados.length
      }
    });

  } catch (error: any) {
    console.error('Error en búsqueda inteligente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/sincronizacion/estadisticas** - Estadísticas de sincronización
router.get('/sincronizacion/estadisticas', requireAuth, async (req: Request, res: Response) => {
  try {
    const estadisticas = await obtenerEstadisticasSincronizacion();

    res.json({
      success: true,
      data: estadisticas
    });

  } catch (error: any) {
    console.error('Error obteniendo estadísticas de sincronización:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /herramientas/sincronizacion/mapeo** - Obtener mapeo configurado
router.get('/sincronizacion/mapeo', requireAuth, async (req: Request, res: Response) => {
  try {
    const { MAPEO_TIPO_COSTO_CATEGORIA } = await import('../utils/sincronizacionGastos');
    
    res.json({
      success: true,
      data: {
        mapeo: MAPEO_TIPO_COSTO_CATEGORIA,
        tiposCosto: Object.values(TipoCosto),
        categoriasCatalogo: Object.values(CategoriaGasto)
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo mapeo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;