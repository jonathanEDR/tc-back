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

// Datos de prueba diversificados para múltiples meses y categorías
const datosPruebaDiversos = [
  // ===== JULIO 2024 =====
  // OPERACIONES - Mano de Obra
  {
    fechaCaja: new Date('2024-07-05T09:30:00'),
    monto: 850.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Salarios Personal Operativo',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'REC-001-JUL',
    observaciones: 'Pago quincenal personal operativo'
  },
  {
    fechaCaja: new Date('2024-07-12T14:20:00'),
    monto: 420.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificaciones por Productividad',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BON-001-JUL',
    observaciones: 'Incentivos cumplimiento metas julio'
  },
  {
    fechaCaja: new Date('2024-07-18T11:15:00'),
    monto: 680.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Servicios de Consultoría',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-CON-001',
    observaciones: 'Consultor procesos industriales'
  },

  // OPERACIONES - Materia Prima
  {
    fechaCaja: new Date('2024-07-08T10:45:00'),
    monto: 1200.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Materiales de Construcción',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-MAT-001',
    observaciones: 'Cemento, hierro para proyecto A'
  },
  {
    fechaCaja: new Date('2024-07-15T16:30:00'),
    monto: 450.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Insumos Químicos',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'BOL-QUI-001',
    observaciones: 'Reactivos para tratamiento'
  },
  {
    fechaCaja: new Date('2024-07-22T13:45:00'),
    monto: 320.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Materiales de Embalaje',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BOL-EMB-001',
    observaciones: 'Cajas y materiales de empaque'
  },

  // OPERACIONES - Otros Gastos
  {
    fechaCaja: new Date('2024-07-25T08:20:00'),
    monto: 380.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Mantenimiento de Equipos',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-MAN-001',
    observaciones: 'Mantenimiento preventivo maquinaria'
  },

  // VENTAS - Mano de Obra
  {
    fechaCaja: new Date('2024-07-10T15:10:00'),
    monto: 320.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificación por Ventas',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.YAPE,
    comprobante: 'BON-VEN-001',
    observaciones: 'Comisión equipo ventas julio'
  },
  {
    fechaCaja: new Date('2024-07-28T12:30:00'),
    monto: 280.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Capacitación Personal',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-CAP-001',
    observaciones: 'Curso técnicas de venta'
  },

  // VENTAS - Otros Gastos
  {
    fechaCaja: new Date('2024-07-20T14:50:00'),
    monto: 180.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Combustible Vehículos',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'BOL-COM-001',
    observaciones: 'Combustible vehículos reparto'
  },

  // ===== AGOSTO 2024 =====
  // OPERACIONES
  {
    fechaCaja: new Date('2024-08-05T09:15:00'),
    monto: 920.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Salarios Personal Operativo',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'REC-002-AGO',
    observaciones: 'Pago quincenal agosto'
  },
  {
    fechaCaja: new Date('2024-08-12T11:40:00'),
    monto: 1400.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Materiales de Construcción',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-MAT-002',
    observaciones: 'Materiales proyecto B - agosto'
  },
  {
    fechaCaja: new Date('2024-08-18T15:25:00'),
    monto: 520.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Herramientas y Repuestos',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'FAC-HER-001',
    observaciones: 'Repuestos para maquinaria'
  },
  {
    fechaCaja: new Date('2024-08-22T10:30:00'),
    monto: 350.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Horas Extras Personal',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'REC-EXT-001',
    observaciones: 'Horas extras proyecto urgente'
  },

  // VENTAS
  {
    fechaCaja: new Date('2024-08-08T16:20:00'),
    monto: 480.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificación por Ventas',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.YAPE,
    comprobante: 'BON-VEN-002',
    observaciones: 'Comisión récord ventas agosto'
  },
  {
    fechaCaja: new Date('2024-08-25T13:15:00'),
    monto: 220.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Combustible Vehículos',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'BOL-COM-002',
    observaciones: 'Combustible rutas de venta'
  },

  // ADMINISTRATIVO
  {
    fechaCaja: new Date('2024-08-15T09:45:00'),
    monto: 150.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Material de Oficina',
    categoria: CategoriaCaja.ADMINISTRATIVO,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.PLIN,
    comprobante: 'BOL-OFI-001',
    observaciones: 'Papelería y útiles agosto'
  },
  {
    fechaCaja: new Date('2024-08-28T14:30:00'),
    monto: 280.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Internet y Telefonía',
    categoria: CategoriaCaja.ADMINISTRATIVO,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-INT-001',
    observaciones: 'Plan empresarial agosto'
  },

  // FINANZAS
  {
    fechaCaja: new Date('2024-08-20T11:50:00'),
    monto: 180.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Comisiones Bancarias',
    categoria: CategoriaCaja.FINANZAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.DEPOSITO,
    comprobante: 'EST-BAN-001',
    observaciones: 'Comisiones y mantenimiento cuentas'
  },

  // ===== SEPTIEMBRE 2024 (Datos existentes + nuevos) =====
  // OPERACIONES
  {
    fechaCaja: new Date('2024-09-02T08:30:00'),
    monto: 980.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Salarios Personal Operativo',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'REC-003-SEP',
    observaciones: 'Primera quincena septiembre'
  },
  {
    fechaCaja: new Date('2024-09-10T12:15:00'),
    monto: 1650.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Materia Prima Industrial',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MATERIA_PRIMA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-IND-001',
    observaciones: 'Insumos principales producción'
  },
  {
    fechaCaja: new Date('2024-09-18T15:45:00'),
    monto: 420.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificaciones por Productividad',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BON-002-SEP',
    observaciones: 'Incentivos meta septiembre'
  },

  // VENTAS
  {
    fechaCaja: new Date('2024-09-05T10:20:00'),
    monto: 380.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Bonificación por Ventas',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.MANO_OBRA,
    metodoPago: MetodoPago.YAPE,
    comprobante: 'BON-VEN-003',
    observaciones: 'Comisión inicio septiembre'
  },
  {
    fechaCaja: new Date('2024-09-20T14:10:00'),
    monto: 250.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Combustible Vehículos',
    categoria: CategoriaCaja.VENTAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TARJETA,
    comprobante: 'BOL-COM-003',
    observaciones: 'Combustible rutas comerciales'
  },

  // ADMINISTRATIVO
  {
    fechaCaja: new Date('2024-09-12T11:30:00'),
    monto: 1200.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Alquiler de Oficina',
    categoria: CategoriaCaja.ADMINISTRATIVO,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'REC-ALQ-001',
    observaciones: 'Renta mensual septiembre'
  },
  {
    fechaCaja: new Date('2024-09-25T16:00:00'),
    monto: 420.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Seguros Empresariales',
    categoria: CategoriaCaja.ADMINISTRATIVO,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'POL-SEG-001',
    observaciones: 'Póliza trimestral renovación'
  },

  // FINANZAS
  {
    fechaCaja: new Date('2024-09-15T13:25:00'),
    monto: 320.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Comisiones Bancarias',
    categoria: CategoriaCaja.FINANZAS,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.DEPOSITO,
    comprobante: 'EST-BAN-002',
    observaciones: 'Comisiones operaciones septiembre'
  },

  // OPERACIONES - Servicios Públicos
  {
    fechaCaja: new Date('2024-09-08T09:40:00'),
    monto: 980.00,
    tipoMovimiento: TipoMovimiento.SALIDA,
    descripcion: 'Servicios Públicos',
    categoria: CategoriaCaja.OPERACIONES,
    tipoCosto: TipoCosto.OTROS_GASTOS,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-SER-001',
    observaciones: 'Electricidad, agua, gas septiembre'
  },

  // ===== ALGUNOS INGRESOS PARA BALANCE =====
  {
    fechaCaja: new Date('2024-07-15T10:30:00'),
    monto: 2500.00,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Venta directa de productos terminados',
    categoriaIngreso: CategoriaIngreso.VENTA_DIRECTA,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-VEN-001',
    observaciones: 'Venta julio cliente empresarial'
  },
  {
    fechaCaja: new Date('2024-08-12T14:20:00'),
    monto: 3200.00,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Servicios de operaciones especializadas',
    categoriaIngreso: CategoriaIngreso.VENTA_OPERACIONES,
    metodoPago: MetodoPago.TRANSFERENCIA,
    comprobante: 'FAC-VEN-002',
    observaciones: 'Proyecto especializado agosto'
  },
  {
    fechaCaja: new Date('2024-09-18T16:45:00'),
    monto: 2800.00,
    tipoMovimiento: TipoMovimiento.ENTRADA,
    descripcion: 'Venta directa de productos terminados',
    categoriaIngreso: CategoriaIngreso.VENTA_DIRECTA,
    metodoPago: MetodoPago.EFECTIVO,
    comprobante: 'BOL-VEN-003',
    observaciones: 'Venta septiembre local'
  }
];

async function crearUsuarioPrueba() {
  try {
    // Buscar si ya existe un usuario de prueba
    let usuarioPrueba = await User.findOne({ email: 'test@example.com' });
    
    if (!usuarioPrueba) {
      usuarioPrueba = new User({
        clerkId: 'test_user_clerk_id_diverso',
        name: 'Usuario de Prueba Diverso',
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

async function insertarDatosDiversos() {
  try {
    // Conectar a la base de datos
    await connectDB();
    logger.info('Conectado a MongoDB');

    // Crear usuario de prueba
    const usuarioPrueba = await crearUsuarioPrueba();

    // Limpiar TODOS los registros de prueba anteriores
    await Caja.deleteMany({ usuario: usuarioPrueba._id });
    logger.info('Todos los registros de prueba anteriores eliminados');

    // Insertar nuevos datos de prueba diversificados
    const registrosCreados = [];
    
    for (const datosCaja of datosPruebaDiversos) {
      const nuevoCaja = new Caja({
        ...datosCaja,
        usuario: usuarioPrueba._id
      });
      
      const registroGuardado = await nuevoCaja.save();
      registrosCreados.push(registroGuardado);
      
      logger.info(`Registro creado: ${registroGuardado._id} - ${registroGuardado.descripcion}`);
    }

    // Mostrar resumen detallado
    logger.info(`\n=== RESUMEN DE DATOS DIVERSIFICADOS INSERTADOS ===`);
    logger.info(`Total registros creados: ${registrosCreados.length}`);
    
    const ingresos = registrosCreados.filter(r => r.tipoMovimiento === TipoMovimiento.ENTRADA);
    const salidas = registrosCreados.filter(r => r.tipoMovimiento === TipoMovimiento.SALIDA);
    
    const totalIngresos = ingresos.reduce((sum, r) => sum + r.monto, 0);
    const totalSalidas = salidas.reduce((sum, r) => sum + r.monto, 0);
    const balance = totalIngresos - totalSalidas;
    
    logger.info(`Ingresos: ${ingresos.length} registros - S/ ${totalIngresos.toFixed(2)}`);
    logger.info(`Salidas: ${salidas.length} registros - S/ ${totalSalidas.toFixed(2)}`);
    logger.info(`Balance: S/ ${balance.toFixed(2)}`);
    
    // Análisis por MESES
    logger.info(`\n=== ANÁLISIS POR MESES ===`);
    const porMeses = registrosCreados.reduce((acc, r) => {
      const fecha = new Date(r.fechaCaja);
      const mesAno = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
      acc[mesAno] = acc[mesAno] || { ingresos: 0, salidas: 0, cantidad: 0 };
      
      if (r.tipoMovimiento === TipoMovimiento.ENTRADA) {
        acc[mesAno].ingresos += r.monto;
      } else {
        acc[mesAno].salidas += r.monto;
      }
      acc[mesAno].cantidad += 1;
      return acc;
    }, {} as Record<string, { ingresos: number, salidas: number, cantidad: number }>);
    
    Object.entries(porMeses).forEach(([mes, datos]) => {
      const balance = datos.ingresos - datos.salidas;
      logger.info(`${mes}: ${datos.cantidad} mov. | Ingresos: S/ ${datos.ingresos.toFixed(2)} | Salidas: S/ ${datos.salidas.toFixed(2)} | Balance: S/ ${balance.toFixed(2)}`);
    });

    // Análisis por CATEGORÍAS DE CAJA
    logger.info(`\n=== ANÁLISIS POR CATEGORÍAS DE CAJA ===`);
    const porCategoriaCaja = salidas.reduce((acc, r) => {
      const cat = r.categoria || 'sin_categoria';
      acc[cat] = acc[cat] || { cantidad: 0, monto: 0, descripciones: new Set() };
      acc[cat].cantidad += 1;
      acc[cat].monto += r.monto;
      acc[cat].descripciones.add(r.descripcion);
      return acc;
    }, {} as Record<string, { cantidad: number, monto: number, descripciones: Set<string> }>);
    
    Object.entries(porCategoriaCaja).forEach(([cat, datos]) => {
      logger.info(`${cat}: ${datos.cantidad} gastos - S/ ${datos.monto.toFixed(2)} - ${datos.descripciones.size} tipos diferentes`);
      datos.descripciones.forEach(desc => logger.info(`  - ${desc}`));
    });

    // Análisis por TIPOS DE COSTO
    logger.info(`\n=== ANÁLISIS POR TIPOS DE COSTO ===`);
    const porTipoCosto = salidas.reduce((acc, r) => {
      const tipo = r.tipoCosto || 'sin_tipo';
      acc[tipo] = acc[tipo] || { cantidad: 0, monto: 0, descripciones: new Set() };
      acc[tipo].cantidad += 1;
      acc[tipo].monto += r.monto;
      acc[tipo].descripciones.add(r.descripcion);
      return acc;
    }, {} as Record<string, { cantidad: number, monto: number, descripciones: Set<string> }>);
    
    Object.entries(porTipoCosto).forEach(([tipo, datos]) => {
      logger.info(`${tipo}: ${datos.cantidad} gastos - S/ ${datos.monto.toFixed(2)} - ${datos.descripciones.size} tipos diferentes`);
      datos.descripciones.forEach(desc => logger.info(`  - ${desc}`));
    });

    // Análisis RANKING DE DESCRIPCIONES (para el nuevo gráfico)
    logger.info(`\n=== RANKING DE DESCRIPCIONES DE GASTOS ===`);
    const rankingDescripciones = salidas.reduce((acc, r) => {
      const desc = r.descripcion;
      acc[desc] = acc[desc] || { cantidad: 0, monto: 0 };
      acc[desc].cantidad += 1;
      acc[desc].monto += r.monto;
      return acc;
    }, {} as Record<string, { cantidad: number, monto: number }>);
    
    const rankingOrdenado = Object.entries(rankingDescripciones)
      .sort(([,a], [,b]) => b.monto - a.monto)
      .slice(0, 10);
    
    logger.info('Top 10 gastos por descripción:');
    rankingOrdenado.forEach(([desc, datos], index) => {
      logger.info(`${index + 1}. ${desc}: S/ ${datos.monto.toFixed(2)} (${datos.cantidad} mov.)`);
    });

    logger.info(`\n=== DATOS PREPARADOS PARA GRÁFICOS ===`);
    logger.info('✅ Datos distribuidos en 3 meses (Jul-Sep 2024)');
    logger.info('✅ Todas las categorías de caja representadas');
    logger.info('✅ Todos los tipos de costo incluidos');
    logger.info('✅ Múltiples descripciones únicas para ranking');
    logger.info('✅ Datos listos para probar filtros por período');

    return registrosCreados;

  } catch (error) {
    logger.error('Error al insertar datos diversificados:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    logger.info('=== INICIANDO SCRIPT DE PRUEBA DIVERSIFICADO PARA CAJA ===');
    logger.info('Datos de JULIO, AGOSTO y SEPTIEMBRE 2024');
    logger.info('Incluye todas las categorías, tipos y múltiples descripciones');
    logger.info(`Fecha actual en Lima: ${formatInLima(getNowInLima())}`);
    
    const registros = await insertarDatosDiversos();
    
    logger.info('\n=== SCRIPT COMPLETADO EXITOSAMENTE ===');
    logger.info('✅ Base de datos poblada con datos diversificados');
    logger.info('✅ Listo para probar gráficos con diferentes períodos');
    logger.info('✅ Ranking de gastos por descripción disponible');
    logger.info('\n📊 RECOMENDACIONES PARA PRUEBAS:');
    logger.info('1. Probar período SEMANA (Sep 15-21) - datos concentrados');
    logger.info('2. Probar período MES (Todo septiembre) - datos variados');
    logger.info('3. Probar período ANUAL (Todo 2024) - máxima diversidad');
    logger.info('4. Verificar ranking de descripciones por monto');
    logger.info('5. Comprobar distribución por categorías y tipos');
    
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

export { insertarDatosDiversos, crearUsuarioPrueba };