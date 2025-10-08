import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/clerkAuth';
import Caja, { CategoriaCaja, CategoriaIngreso, TipoCosto, TipoMovimiento, MetodoPago, ICaja } from '../models/Caja';
import User from '../models/User';
import { 
  getNowInLima, 
  formatInLima, 
  getStartOfDayInLima, 
  getEndOfDayInLima,
  getTodayRangeInLima,
  formatters,
  dateRanges,
  DATE_FORMATS
} from '../utils/dateUtils';
import {
  buscarGastosPorTipoCosto,
  buscarGastosPorTexto
} from '../utils/sincronizacionGastos';

const router = express.Router();

// Función utilitaria para auto-registrar usuarios
async function autoRegisterUser(userId: string): Promise<any> {
  console.log('[CAJA] Usuario no encontrado en BD, creando automáticamente para clerkId:', userId);
  
  try {
    // Obtener información del usuario desde Clerk
    const { clerkClient } = await import('@clerk/clerk-sdk-node');
    const clerkUser = await clerkClient.users.getUser(userId);
    
    // Verificar si ya existe un usuario con este email
    const existingUserByEmail = await User.findOne({ 
      email: clerkUser.emailAddresses?.[0]?.emailAddress 
    });
    
    if (existingUserByEmail) {
      // Si existe un usuario con este email, actualizamos su clerkId
      console.log('[CAJA] Usuario existente encontrado con email, actualizando clerkId...');
      existingUserByEmail.clerkId = userId;
      const updatedUser = await existingUserByEmail.save();
      console.log('[CAJA] ClerkId actualizado para usuario existente:', updatedUser._id);
      return updatedUser;
    } else {
      // Crear nuevo usuario en la BD
      const newUser = new User({
        clerkId: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Usuario',
        email: clerkUser.emailAddresses?.[0]?.emailAddress || `user_${userId}@example.com`
      });
      
      await newUser.save();
      console.log('[CAJA] Usuario auto-registrado:', newUser._id);
      return newUser;
    }
  } catch (autoRegisterError) {
    console.error('[CAJA] Error en auto-registro:', autoRegisterError);
    throw autoRegisterError;
  }
}

// Esquemas de validación con Zod

// Schema base común
const baseMovimientoSchema = z.object({
  fechaCaja: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Fecha inválida"
  }), // Fecha principal del movimiento
  monto: z.number().min(0.01, "El monto debe ser mayor a 0").max(999999999, "Monto muy alto"),
  tipoMovimiento: z.enum([TipoMovimiento.ENTRADA, TipoMovimiento.SALIDA]),
  descripcion: z.string().min(5, "Descripción muy corta").max(200, "Descripción muy larga"),
  metodoPago: z.enum([
    MetodoPago.EFECTIVO,
    MetodoPago.TRANSFERENCIA,
    MetodoPago.YAPE,
    MetodoPago.PLIN,
    MetodoPago.DEPOSITO,
    MetodoPago.CHEQUE,
    MetodoPago.TARJETA
  ]),
  comprobante: z.string().max(50, "Comprobante muy largo").optional(),
  observaciones: z.string().max(500, "Observaciones muy largas").optional()
});

// Schema para SALIDAS
const crearSalidaSchema = baseMovimientoSchema.extend({
  tipoMovimiento: z.literal(TipoMovimiento.SALIDA),
  categoria: z.enum([
    CategoriaCaja.FINANZAS,
    CategoriaCaja.OPERACIONES,
    CategoriaCaja.VENTAS,
    CategoriaCaja.ADMINISTRATIVO
  ]),
  tipoCosto: z.enum([
    TipoCosto.MANO_OBRA,
    TipoCosto.MATERIA_PRIMA,
    TipoCosto.OTROS_GASTOS
  ]),
  catalogoGastoId: z.string().optional() // ID del catálogo de gastos si proviene del catálogo
});

// Schema para INGRESOS
const crearIngresoSchema = baseMovimientoSchema.extend({
  tipoMovimiento: z.literal(TipoMovimiento.ENTRADA),
  categoriaIngreso: z.enum([
    CategoriaIngreso.APERTURA_CAJA,
    CategoriaIngreso.VENTA_DIRECTA,
    CategoriaIngreso.VENTA_OPERACIONES,
    CategoriaIngreso.INGRESOS_FINANCIEROS,
    CategoriaIngreso.OTROS_INGRESOS
  ])
});

// Schema discriminado que valida según el tipo de movimiento
const crearMovimientoSchema = z.discriminatedUnion('tipoMovimiento', [
  crearIngresoSchema,
  crearSalidaSchema
]);

// Schema para actualización (todos los campos opcionales excepto el tipo de movimiento que determina la validación)
const actualizarMovimientoSchema = z.object({
  fecha: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Fecha inválida"
  }).optional(),
  monto: z.number().min(0.01, "El monto debe ser mayor a 0").max(999999999, "Monto muy alto").optional(),
  tipoMovimiento: z.enum([TipoMovimiento.ENTRADA, TipoMovimiento.SALIDA]).optional(),
  descripcion: z.string().min(5, "Descripción muy corta").max(200, "Descripción muy larga").optional(),
  metodoPago: z.enum([
    MetodoPago.EFECTIVO,
    MetodoPago.TRANSFERENCIA,
    MetodoPago.YAPE,
    MetodoPago.PLIN,
    MetodoPago.DEPOSITO,
    MetodoPago.CHEQUE,
    MetodoPago.TARJETA
  ]).optional(),
  // Campos para salidas
  categoria: z.enum([
    CategoriaCaja.FINANZAS,
    CategoriaCaja.OPERACIONES,
    CategoriaCaja.VENTAS,
    CategoriaCaja.ADMINISTRATIVO
  ]).optional(),
  tipoCosto: z.enum([
    TipoCosto.MANO_OBRA,
    TipoCosto.MATERIA_PRIMA,
    TipoCosto.OTROS_GASTOS
  ]).optional(),
  // Campos para ingresos
  categoriaIngreso: z.enum([
    CategoriaIngreso.APERTURA_CAJA,
    CategoriaIngreso.VENTA_DIRECTA,
    CategoriaIngreso.VENTA_OPERACIONES,
    CategoriaIngreso.INGRESOS_FINANCIEROS,
    CategoriaIngreso.OTROS_INGRESOS
  ]).optional(),
  comprobante: z.string().max(50, "Comprobante muy largo").optional(),
  observaciones: z.string().max(500, "Observaciones muy largas").optional()
});

const filtrosSchema = z.object({
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  // Filtros para salidas
  categoria: z.enum([
    CategoriaCaja.FINANZAS,
    CategoriaCaja.OPERACIONES,
    CategoriaCaja.VENTAS,
    CategoriaCaja.ADMINISTRATIVO
  ]).optional(),
  tipoCosto: z.enum([
    TipoCosto.MANO_OBRA,
    TipoCosto.MATERIA_PRIMA,
    TipoCosto.OTROS_GASTOS
  ]).optional(),
  // Filtros para ingresos
  categoriaIngreso: z.enum([
    CategoriaIngreso.APERTURA_CAJA,
    CategoriaIngreso.VENTA_DIRECTA,
    CategoriaIngreso.VENTA_OPERACIONES,
    CategoriaIngreso.INGRESOS_FINANCIEROS,
    CategoriaIngreso.OTROS_INGRESOS
  ]).optional(),
  // Filtros comunes
  metodoPago: z.enum([
    MetodoPago.EFECTIVO,
    MetodoPago.TRANSFERENCIA,
    MetodoPago.YAPE,
    MetodoPago.PLIN,
    MetodoPago.DEPOSITO,
    MetodoPago.CHEQUE,
    MetodoPago.TARJETA
  ]).optional(),
  tipoMovimiento: z.enum([TipoMovimiento.ENTRADA, TipoMovimiento.SALIDA]).optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

// POST /api/caja - Crear nuevo movimiento
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('[CAJA] POST /api/caja - Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Buscar el usuario en nuestra base de datos
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      try {
        user = await autoRegisterUser(userId);
      } catch (autoRegisterError) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado y no se pudo auto-registrar' });
      }
    }

    console.log('[CAJA] Validando datos con Zod...');
    const datosValidados = crearMovimientoSchema.parse(req.body);
    console.log('[CAJA] Datos validados:', JSON.stringify(datosValidados, null, 2));

    // Usar fechaCaja directamente como la fecha principal del movimiento
    const fechaCajaDate = new Date(datosValidados.fechaCaja);

    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no válido'
      });
    }

    const nuevoMovimiento = new Caja({
      ...datosValidados,
      fechaCaja: fechaCajaDate,
      usuario: user._id
    });

    console.log('[CAJA] Creando movimiento en BD:', JSON.stringify(nuevoMovimiento.toObject(), null, 2));
    const movimientoGuardado = await nuevoMovimiento.save();
    await movimientoGuardado.populate('usuario', 'clerkId name email');

    res.status(201).json({
      success: true,
      data: movimientoGuardado,
      message: 'Movimiento creado exitosamente'
    });

  } catch (error: any) {
    console.error('Error creando movimiento:', error);
    
    if (error.name === 'ValidationError') {
      console.error('Mongoose validation error:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
    }

    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.issues);
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

// GET /api/caja - Listar movimientos con filtros
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('[CAJA] GET /api/caja - Iniciando...');
    console.log('[CAJA] req.user:', (req as any).user);
    
    const userId = (req as any).user?.userId;
    console.log('[CAJA] userId extraído:', userId);
    
    if (!userId) {
      console.log('[CAJA] Error: No userId');
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    console.log('[CAJA] Buscando usuario en BD...');
    console.log('[CAJA] Query: { clerkId:', JSON.stringify(userId), '}');
    console.log('[CAJA] Tipo de userId:', typeof userId);
    
    // Debug: ver todos los usuarios para comparar
    const todosLosUsuarios = await User.find({}, 'clerkId name email');
    console.log('[CAJA] Todos los usuarios en BD:', JSON.stringify(todosLosUsuarios, null, 2));
    
    let user = await User.findOne({ clerkId: userId });
    console.log('[CAJA] Usuario encontrado:', user ? { id: user._id, name: user.name, clerkId: user.clerkId } : 'NO ENCONTRADO');
    
    if (!user) {
      try {
        user = await autoRegisterUser(userId);
      } catch (autoRegisterError) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado y no se pudo auto-registrar' });
      }
    }

    console.log('[CAJA] Validando filtros...');
    const filtros = filtrosSchema.parse(req.query);
    console.log('[CAJA] Filtros válidos:', filtros);

    // ✅ CONSULTA GLOBAL: Construir query para mostrar movimientos de todos los usuarios
    const query: any = {
      // Comentado para permitir ver movimientos de todos los usuarios
      // usuario: user._id // ORIGINAL: Solo mostrar movimientos del usuario autenticado
    };

    // Filtros de fecha
    if (filtros.fechaInicio || filtros.fechaFin) {
      query.fechaCaja = {};
      if (filtros.fechaInicio) {
        query.fechaCaja.$gte = new Date(filtros.fechaInicio);
      }
      if (filtros.fechaFin) {
        query.fechaCaja.$lte = new Date(filtros.fechaFin);
      }
    }

    // Otros filtros
    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.categoriaIngreso) query.categoriaIngreso = filtros.categoriaIngreso;
    if (filtros.tipoCosto) query.tipoCosto = filtros.tipoCosto;
    if (filtros.tipoMovimiento) query.tipoMovimiento = filtros.tipoMovimiento;
    if (filtros.metodoPago) query.metodoPago = filtros.metodoPago;

    // Búsqueda en descripción
    if (filtros.search) {
      query.descripcion = { $regex: filtros.search, $options: 'i' };
    }

    // Paginación
    const page = parseInt(filtros.page || '1');
    const limit = parseInt(filtros.limit || '10');
    const skip = (page - 1) * limit;

    console.log('[CAJA] Query construido:', query);
    console.log('[CAJA] Paginación: page =', page, 'limit =', limit);

    // Ejecutar consultas
    console.log('[CAJA] Ejecutando consultas a BD...');
    const [movimientos, total] = await Promise.all([
      Caja.find(query)
        .populate('usuario', 'clerkId name email')
        .sort({ fechaCaja: -1 })
        .skip(skip)
        .limit(limit),
      Caja.countDocuments(query)
    ]);

    // Calcular resumen - DE TODOS LOS USUARIOS
    const resumenQuery: any = {
      // Comentado para permitir resumen global
      // usuario: user._id // ORIGINAL: Solo calcular resumen del usuario autenticado
    };
    if (filtros.fechaInicio || filtros.fechaFin) {
      resumenQuery.fechaCaja = query.fechaCaja;
    }

    const resumen = await Caja.aggregate([
      { $match: resumenQuery },
      {
        $group: {
          _id: '$tipoMovimiento',
          total: { $sum: '$monto' }
        }
      }
    ]);

    const totalEntradas = resumen.find(r => r._id === TipoMovimiento.ENTRADA)?.total || 0;
    const totalSalidas = resumen.find(r => r._id === TipoMovimiento.SALIDA)?.total || 0;
    const balance = totalEntradas - totalSalidas;

    res.json({
      success: true,
      data: {
        movimientos,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      },
      resumen: {
        totalEntradas,
        totalSalidas,
        balance
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo movimientos:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros inválidos',
        errors: error.issues
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/caja/:id - Obtener detalle de movimiento
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const movimiento = await Caja.findOne({
      _id: req.params.id,
      usuario: user._id
    }).populate('usuario', 'clerkId name email');

    if (!movimiento) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
    }

    res.json({
      success: true,
      data: movimiento
    });

  } catch (error: any) {
    console.error('Error obteniendo movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/caja/:id - Actualizar movimiento
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const datosValidados = actualizarMovimientoSchema.parse(req.body);

    // Convertir fecha si viene en el request
    const datosActualizacion: any = { ...datosValidados };
    if (datosValidados.fecha) {
      datosActualizacion.fecha = new Date(datosValidados.fecha);
    }

    const movimientoActualizado = await Caja.findOneAndUpdate(
      { _id: req.params.id, usuario: user._id },
      datosActualizacion,
      { new: true, runValidators: true }
    ).populate('usuario', 'clerkId name email');

    if (!movimientoActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
    }

    res.json({
      success: true,
      data: movimientoActualizado,
      message: 'Movimiento actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('Error actualizando movimiento:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
    }

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

// DELETE /api/caja/:id - Eliminar movimiento
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const movimientoEliminado = await Caja.findOneAndDelete({
      _id: req.params.id,
      usuario: user._id
    });

    if (!movimientoEliminado) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Movimiento eliminado exitosamente'
    });

  } catch (error: any) {
    console.error('Error eliminando movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/caja/reportes/resumen - Obtener resumen por categorías y tipos
router.get('/reportes/resumen', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const { fechaInicio, fechaFin } = req.query;
    
    const query: any = { usuario: user._id };
    if (fechaInicio || fechaFin) {
      query.fechaCaja = {};
      if (fechaInicio) query.fechaCaja.$gte = new Date(fechaInicio as string);
      if (fechaFin) query.fechaCaja.$lte = new Date(fechaFin as string);
    }

    // Resumen por categoría
    const resumenPorCategoria = await Caja.aggregate([
      { $match: query },
      {
        $group: {
          _id: { categoria: '$categoria', tipoMovimiento: '$tipoMovimiento' },
          total: { $sum: '$monto' },
          cantidad: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.categoria',
          entradas: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipoMovimiento', TipoMovimiento.ENTRADA] }, '$total', 0]
            }
          },
          salidas: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipoMovimiento', TipoMovimiento.SALIDA] }, '$total', 0]
            }
          },
          cantidadMovimientos: { $sum: '$cantidad' }
        }
      }
    ]);

    // Resumen por tipo de costo
    const resumenPorTipo = await Caja.aggregate([
      { $match: query },
      {
        $group: {
          _id: { tipoCosto: '$tipoCosto', tipoMovimiento: '$tipoMovimiento' },
          total: { $sum: '$monto' },
          cantidad: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.tipoCosto',
          entradas: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipoMovimiento', TipoMovimiento.ENTRADA] }, '$total', 0]
            }
          },
          salidas: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipoMovimiento', TipoMovimiento.SALIDA] }, '$total', 0]
            }
          },
          cantidadMovimientos: { $sum: '$cantidad' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        porCategoria: resumenPorCategoria,
        porTipoCosto: resumenPorTipo
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

// ===== NUEVAS RUTAS DE ASISTENCIA PARA CREACIÓN DE GASTOS =====

// **GET /api/caja/asistente/sugerencias-por-tipo/:tipoCosto** - Sugerencias de gastos del catálogo por tipo
router.get('/asistente/sugerencias-por-tipo/:tipoCosto', requireAuth, async (req, res) => {
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

    const sugerencias = await buscarGastosPorTipoCosto(tipoCosto as TipoCosto, {
      soloActivos: true,
      incluirMontoEstimado: true,
      limite: 8
    });

    res.json({
      success: true,
      data: {
        tipoCosto,
        sugerencias: sugerencias.map(sug => ({
          _id: sug._id,
          nombre: sug.nombre,
          categoria: sug.categoria,
          montoEstimado: sug.montoEstimado,
          relevancia: sug.relevancia
        })),
        total: sugerencias.length
      },
      message: `Encontradas ${sugerencias.length} sugerencias para ${tipoCosto}`
    });

  } catch (error: any) {
    console.error('Error obteniendo sugerencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **GET /api/caja/asistente/buscar-gasto/:texto** - Búsqueda inteligente de gastos para caja
router.get('/asistente/buscar-gasto/:texto', requireAuth, async (req, res) => {
  try {
    const { texto } = req.params;
    
    if (!texto || texto.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El texto de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const { tipoCosto } = req.query;
    const tipoCostoFiltro = tipoCosto && Object.values(TipoCosto).includes(tipoCosto as TipoCosto) 
      ? tipoCosto as TipoCosto 
      : undefined;

    const resultados = await buscarGastosPorTexto(texto, tipoCostoFiltro);

    res.json({
      success: true,
      data: {
        textoBuscado: texto,
        tipoCostoFiltro: tipoCostoFiltro || null,
        resultados: resultados.map(res => ({
          _id: res._id,
          nombre: res.nombre,
          categoria: res.categoria,
          montoEstimado: res.montoEstimado,
          tipoCostoSugerido: res.tipoCostoSugerido,
          relevancia: res.relevancia
        })),
        total: resultados.length
      },
      message: `Encontrados ${resultados.length} resultados para "${texto}"`
    });

  } catch (error: any) {
    console.error('Error en búsqueda de gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// **POST /api/caja/asistente/crear-desde-catalogo** - Crear movimiento de caja usando un gasto del catálogo
router.post('/asistente/crear-desde-catalogo', requireAuth, async (req, res) => {
  try {
    console.log('[CAJA] POST /asistente/crear-desde-catalogo - Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Schema específico para crear desde catálogo
    const crearDesdeCatalogoSchema = z.object({
      catalogoGastoId: z.string().min(1, "ID del catálogo es obligatorio"),
      fechaCaja: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Fecha inválida"
      }),
      monto: z.number().min(0.01, "El monto debe ser mayor a 0").max(999999999, "Monto muy alto"),
      metodoPago: z.enum([
        MetodoPago.EFECTIVO,
        MetodoPago.TRANSFERENCIA,
        MetodoPago.YAPE,
        MetodoPago.PLIN,
        MetodoPago.DEPOSITO,
        MetodoPago.CHEQUE,
        MetodoPago.TARJETA
      ]),
      descripcionPersonalizada: z.string().min(5, "Descripción muy corta").max(200, "Descripción muy larga").optional(),
      categoria: z.enum([
        CategoriaCaja.FINANZAS,
        CategoriaCaja.OPERACIONES,
        CategoriaCaja.VENTAS,
        CategoriaCaja.ADMINISTRATIVO
      ]),
      tipoCosto: z.enum([
        TipoCosto.MANO_OBRA,
        TipoCosto.MATERIA_PRIMA,
        TipoCosto.OTROS_GASTOS
      ]),
      comprobante: z.string().max(50, "Comprobante muy largo").optional(),
      observaciones: z.string().max(500, "Observaciones muy largas").optional()
    });

    const validatedData = crearDesdeCatalogoSchema.parse(req.body);

    // Verificar que el gasto del catálogo existe
    const { buscarGastosPorTipoCosto } = await import('../utils/sincronizacionGastos');
    const CatalogoGasto = (await import('../models/CatalogoGastos')).default;
    
    const gastoReferencia = await CatalogoGasto.findById(validatedData.catalogoGastoId);
    if (!gastoReferencia) {
      return res.status(404).json({
        success: false,
        message: 'Gasto del catálogo no encontrado'
      });
    }

    // Buscar o crear usuario
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await autoRegisterUser(userId);
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener información del usuario'
      });
    }

    // Crear el movimiento de caja
    const nuevoMovimiento = new Caja({
      fechaCaja: new Date(validatedData.fechaCaja),
      monto: validatedData.monto,
      tipoMovimiento: TipoMovimiento.SALIDA, // Siempre es salida cuando viene del catálogo
      descripcion: validatedData.descripcionPersonalizada || gastoReferencia.nombre,
      categoria: validatedData.categoria,
      tipoCosto: validatedData.tipoCosto,
      catalogoGastoId: gastoReferencia._id, // Referencia al catálogo
      metodoPago: validatedData.metodoPago,
      usuario: user._id,
      comprobante: validatedData.comprobante,
      observaciones: validatedData.observaciones
    });

    const movimientoGuardado = await nuevoMovimiento.save();
    await movimientoGuardado.populate('usuario', 'name email clerkId');

    console.log('[CAJA] Movimiento creado desde catálogo:', movimientoGuardado._id);

    res.status(201).json({
      success: true,
      data: {
        movimiento: movimientoGuardado,
        gastoReferencia: {
          _id: gastoReferencia._id,
          nombre: gastoReferencia.nombre,
          categoriaGasto: gastoReferencia.categoriaGasto
        }
      },
      message: 'Movimiento creado exitosamente desde catálogo'
    });

  } catch (error: any) {
    console.error('[CAJA] Error creando movimiento desde catálogo:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.issues
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;