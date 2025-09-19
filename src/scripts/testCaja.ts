import mongoose from 'mongoose';
import { config } from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';

// Cargar variables de entorno al inicio
config();

import Caja, { 
  CategoriaCaja, 
  CategoriaIngreso, 
  TipoCosto, 
  TipoMovimiento, 
  MetodoPago,
  ICaja 
} from '../models/Caja';
import User from '../models/User';
import { getNowInLima, formatInLima } from '../utils/dateUtils';
import logger from '../utils/logger';

// Datos de prueba para el modelo Caja
const datosPruebaCaja = [
  // ENTRADAS (Ingresos)
  {
    fechaCaja: new Date('2024-09-15T10:30:00'),
    monto: 1500.00,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Venta directa de productos terminados',
    categoriaIngreso: CategoriaIngreso.VENTA_DIRECTA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BOL-001',
    observaciones: 'Cliente frecuente - pago al contado'
  },
  {
    fechaCaja: new Date('2024-09-15T14:20:00'),
    monto: 2800.50,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Servicios de operaciones especializadas',
    categoriaIngreso: CategoriaIngreso.VENTA_OPERACIONES,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-002',
    observaciones: 'Proyecto empresarial'
  },
  {
    fechaCaja: new Date('2024-09-16T09:15:00'),
    monto: 450.75,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Intereses bancarios del mes',
    categoriaIngreso: CategoriaIngreso.INGRESOS_FINANCIEROS,
    metodoPago: MetodoPago.DEPOSITO,
    observaciones: 'Rendimientos de cuenta de ahorros'
  },
  {
    fechaCaja: new Date('2024-09-16T16:45:00'),
    monto: 720.00,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Venta de material reciclable',
    categoriaIngreso: CategoriaIngreso.OTROS_INGRESOS,
    metodoPago: MetodoPago.YAPE,
    observaciones: 'Material de descarte aprovechado'
  },

  // SALIDAS (Gastos)
  {
    fechaCaja: new Date('2024-09-15T08:00:00'),
    monto: 850.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Pago de salarios semanales',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'REC-001',
    observaciones: 'Pago semanal personal operativo'
  },
  {
    fechaCaja: new Date('2024-09-15T11:30:00'),
    monto: 320.50,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Compra de materiales básicos',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BOL-101',
    observaciones: 'Materiales para producción semanal'
  },
  {
    fechaCaja: new Date('2024-09-16T13:20:00'),
    monto: 180.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Gastos de combustible',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'FAC-201',
    observaciones: 'Combustible para vehículos de reparto'
  },
  {
    fechaCaja: new Date('2024-09-16T15:45:00'),
    monto: 95.25,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Material de oficina',
    categoria: CategoriaCaja.ADMINISTRATIVO,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.PLIN,
    comprobante: 'BOL-102',
    observaciones: 'Papelería y útiles de oficina'
  },
  {
    fechaCaja: new Date('2024-09-17T10:15:00'),
    monto: 250.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Comisiones bancarias',
    categoria: CategoriaCaja.FINANZAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.DEPOSITO,
    observaciones: 'Mantenimiento de cuentas y transferencias'
  },
  {
    fechaCaja: new Date('2024-09-17T14:30:00'),
    monto: 420.80,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificación por ventas',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'REC-002',
    observaciones: 'Incentivo mensual equipo de ventas'
  }
];

async function crearUsuarioPrueba() {
  try {
    // Buscar si ya existe un usuario de prueba
    let usuarioPrueba = await User.findOne({ email: 'test@example.com' });
    
    if (!usuarioPrueba) {
      usuarioPrueba = new User({
        clerkId: 'test_user_clerk_id',
        name: 'Usuario de Prueba',
        email: 'test@example.com'
      });
      await usuarioPrueba.save();
      logger.info('Usuario de prueba creado:', usuarioPrueba._id);
    } else {
      logger.info('Usuario de prueba existente encontrado:', usuarioPrueba._id);
    }
    
    return usuarioPrueba;
  } catch (error) {
    logger.error('Error al crear usuario de prueba:', error);
    throw error;
  }
}

async function insertarDatosCaja() {
  try {
    // Conectar a la base de datos
    await connectDB();
    logger.info('Conectado a MongoDB');

    // Crear usuario de prueba
    const usuarioPrueba = await crearUsuarioPrueba();

    // Limpiar registros de prueba anteriores
    await Caja.deleteMany({ 
      usuario: usuarioPrueba._id,
      descripcion: { $regex: /prueba|test/i }
    });
    logger.info('Registros de prueba anteriores eliminados');

    // Insertar nuevos datos de prueba
    const registrosCreados = [];
    
    for (const datosCaja of datosPruebaCaja) {
      const nuevoCaja = new Caja({
        ...datosCaja,
        usuario: usuarioPrueba._id
      });
      
      const registroGuardado = await nuevoCaja.save();
      registrosCreados.push(registroGuardado);
      
      logger.info(`Registro creado: ${registroGuardado._id} - ${registroGuardado.descripcion}`);
    }

    // Mostrar resumen
    logger.info(`\n=== RESUMEN DE DATOS INSERTADOS ===`);
    logger.info(`Total registros creados: ${registrosCreados.length}`);
    
    const ingresos = registrosCreados.filter(r => r.tipoMovimiento === TipoMovimiento.ENTRADA);
    const salidas = registrosCreados.filter(r => r.tipoMovimiento === TipoMovimiento.SALIDA);
    
    const totalIngresos = ingresos.reduce((sum, r) => sum + r.monto, 0);
    const totalSalidas = salidas.reduce((sum, r) => sum + r.monto, 0);
    const balance = totalIngresos - totalSalidas;
    
    logger.info(`Ingresos: ${ingresos.length} registros - S/ ${totalIngresos.toFixed(2)}`);
    logger.info(`Salidas: ${salidas.length} registros - S/ ${totalSalidas.toFixed(2)}`);
    logger.info(`Balance: S/ ${balance.toFixed(2)}`);
    
    // Mostrar desglose por categorías
    logger.info(`\n=== DESGLOSE POR CATEGORÍAS ===`);
    
    // Ingresos por categoría
    const ingresosPorCategoria = ingresos.reduce((acc, r) => {
      const cat = r.categoriaIngreso || 'sin_categoria';
      acc[cat] = (acc[cat] || 0) + r.monto;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('Ingresos por categoría:');
    Object.entries(ingresosPorCategoria).forEach(([cat, monto]) => {
      logger.info(`  ${cat}: S/ ${monto.toFixed(2)}`);
    });
    
    // Salidas por tipo de costo
    const salidasPorTipoCosto = salidas.reduce((acc, r) => {
      const tipo = r.tipoCosto || 'sin_tipo';
      acc[tipo] = (acc[tipo] || 0) + r.monto;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('Salidas por tipo de costo:');
    Object.entries(salidasPorTipoCosto).forEach(([tipo, monto]) => {
      logger.info(`  ${tipo}: S/ ${monto.toFixed(2)}`);
    });
    
    // Métodos de pago
    const porMetodoPago = registrosCreados.reduce((acc, r) => {
      const metodo = r.metodoPago;
      acc[metodo] = (acc[metodo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('Distribución por método de pago:');
    Object.entries(porMetodoPago).forEach(([metodo, cantidad]) => {
      logger.info(`  ${metodo}: ${cantidad} transacciones`);
    });

    return registrosCreados;

  } catch (error) {
    logger.error('Error al insertar datos de caja:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    logger.info('=== INICIANDO SCRIPT DE PRUEBA PARA CAJA ===');
    logger.info(`Fecha actual en Lima: ${formatInLima(getNowInLima())}`);
    
    const registros = await insertarDatosCaja();
    
    logger.info('\n=== SCRIPT COMPLETADO EXITOSAMENTE ===');
    logger.info('Puedes revisar los datos insertados en la base de datos');
    logger.info('Usa las rutas GET /api/caja para consultar los movimientos');
    
  } catch (error) {
    logger.error('Error en script principal:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

export { insertarDatosCaja, crearUsuarioPrueba };