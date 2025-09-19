import mongoose from 'mongoose';
import { config } from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';

// Cargar variables de entorno al inicio
config();

import CatalogoGasto, { 
  CategoriaGasto, 
  TipoGasto, 
  EstadoGasto,
  ICatalogoGasto 
} from '../models/CatalogoGastos';
import User from '../models/User';
import { getNowInLima, formatInLima } from '../utils/dateUtils';
import logger from '../utils/logger';

// Datos de prueba para el Catálogo de Gastos
// Organizados por las nuevas categorías: MANO_OBRA, MATERIA_PRIMA, OTROS_GASTOS
const datosPruebaCatalogo = [
  // ===== GASTOS DE MANO_OBRA =====
  {
    nombre: 'Salarios Personal Operativo',
    descripcion: 'Pagos regulares al personal de operaciones y producción',
    categoriaGasto: CategoriaGasto.MANO_OBRA,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 3500.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['personal', 'operaciones', 'salarios'],
    observaciones: 'Incluye salarios base y bonificaciones operativas'
  },
  {
    nombre: 'Bonificaciones por Productividad',
    descripcion: 'Incentivos variables basados en metas de producción',
    categoriaGasto: CategoriaGasto.MANO_OBRA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 800.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['bonificaciones', 'productividad', 'incentivos'],
    observaciones: 'Pagos mensuales según cumplimiento de objetivos'
  },
  {
    nombre: 'Horas Extras Personal',
    descripcion: 'Pagos por tiempo adicional trabajado',
    categoriaGasto: CategoriaGasto.MANO_OBRA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 450.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['horas_extras', 'personal', 'tiempo_adicional'],
    observaciones: 'Cálculo según horas trabajadas fuera del horario regular'
  },
  {
    nombre: 'Servicios de Consultoría',
    descripcion: 'Contratación de servicios especializados externos',
    categoriaGasto: CategoriaGasto.MANO_OBRA,
    tipoGasto: TipoGasto.OCASIONAL,
    montoEstimado: 1200.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['consultoria', 'servicios_externos', 'especialistas'],
    observaciones: 'Expertos en procesos técnicos específicos'
  },
  {
    nombre: 'Capacitación Personal',
    descripcion: 'Cursos y entrenamiento para el personal',
    categoriaGasto: CategoriaGasto.MANO_OBRA,
    tipoGasto: TipoGasto.OCASIONAL,
    montoEstimado: 680.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['capacitacion', 'entrenamiento', 'desarrollo'],
    observaciones: 'Programas de desarrollo profesional'
  },

  // ===== GASTOS DE MATERIA_PRIMA =====
  {
    nombre: 'Materiales de Construcción',
    descripcion: 'Cemento, hierro, ladrillos y materiales básicos',
    categoriaGasto: CategoriaGasto.MATERIA_PRIMA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 2800.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['construccion', 'materiales_basicos', 'cemento', 'hierro'],
    observaciones: 'Materiales principales para proyectos de construcción'
  },
  {
    nombre: 'Insumos Químicos',
    descripcion: 'Productos químicos necesarios para procesos productivos',
    categoriaGasto: CategoriaGasto.MATERIA_PRIMA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 650.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['quimicos', 'insumos', 'produccion'],
    observaciones: 'Reactivos y productos químicos para tratamiento'
  },
  {
    nombre: 'Materiales de Embalaje',
    descripcion: 'Cajas, bolsas, cintas y materiales de empaque',
    categoriaGasto: CategoriaGasto.MATERIA_PRIMA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 320.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['embalaje', 'empaque', 'logistica'],
    observaciones: 'Materiales para empaque y envío de productos'
  },
  {
    nombre: 'Herramientas y Repuestos',
    descripcion: 'Herramientas de trabajo y repuestos para maquinaria',
    categoriaGasto: CategoriaGasto.MATERIA_PRIMA,
    tipoGasto: TipoGasto.OCASIONAL,
    montoEstimado: 890.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['herramientas', 'repuestos', 'maquinaria'],
    observaciones: 'Mantenimiento preventivo y correctivo de equipos'
  },
  {
    nombre: 'Materia Prima Industrial',
    descripcion: 'Insumos principales para la producción',
    categoriaGasto: CategoriaGasto.MATERIA_PRIMA,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 1500.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['materia_prima', 'produccion', 'industrial'],
    observaciones: 'Materiales directos para la fabricación'
  },

  // ===== OTROS_GASTOS =====
  {
    nombre: 'Combustible Vehículos',
    descripcion: 'Gasolina y diesel para vehículos de la empresa',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 750.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['combustible', 'transporte', 'vehiculos'],
    observaciones: 'Combustible para reparto y traslados'
  },
  {
    nombre: 'Servicios Públicos',
    descripcion: 'Electricidad, agua, gas y servicios básicos',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 980.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['servicios_publicos', 'electricidad', 'agua', 'gas'],
    observaciones: 'Servicios básicos mensual de las instalaciones'
  },
  {
    nombre: 'Internet y Telefonía',
    descripcion: 'Servicios de comunicación e internet empresarial',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 280.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['internet', 'telefonia', 'comunicaciones'],
    observaciones: 'Plan empresarial de comunicaciones'
  },
  {
    nombre: 'Mantenimiento de Equipos',
    descripcion: 'Servicios de mantenimiento preventivo y correctivo',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.VARIABLE,
    montoEstimado: 560.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['mantenimiento', 'equipos', 'reparaciones'],
    observaciones: 'Mantenimiento de maquinaria y equipos de trabajo'
  },
  {
    nombre: 'Material de Oficina',
    descripcion: 'Papelería, útiles de escritorio y suministros de oficina',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 150.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['oficina', 'papeleria', 'suministros'],
    observaciones: 'Suministros administrativos mensuales'
  },
  {
    nombre: 'Seguros Empresariales',
    descripcion: 'Pólizas de seguro para equipos, vehículos e instalaciones',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 420.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['seguros', 'polizas', 'proteccion'],
    observaciones: 'Seguros contra todo riesgo'
  },
  {
    nombre: 'Alquiler de Oficina',
    descripcion: 'Renta mensual de las instalaciones',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 1200.00,
    estado: EstadoGasto.ACTIVO,
    etiquetas: ['alquiler', 'oficina', 'instalaciones'],
    observaciones: 'Costo fijo mensual del local'
  },

  // ===== GASTOS ARCHIVADOS (para testing) =====
  {
    nombre: 'Software Obsoleto',
    descripcion: 'Licencias de software que ya no se utilizan',
    categoriaGasto: CategoriaGasto.OTROS_GASTOS,
    tipoGasto: TipoGasto.FIJO,
    montoEstimado: 200.00,
    estado: EstadoGasto.ARCHIVADO,
    etiquetas: ['software', 'obsoleto', 'licencias'],
    observaciones: 'Software descontinuado en la empresa'
  }
];

async function obtenerUsuarioPrueba() {
  try {
    // Buscar el usuario de prueba (debería existir del script de caja)
    let usuarioPrueba = await User.findOne({ email: 'test@example.com' });
    
    if (!usuarioPrueba) {
      // Si no existe, crearlo
      usuarioPrueba = new User({
        clerkId: 'test_user_clerk_id',
        name: 'Usuario de Prueba',
        email: 'test@example.com'
      });
      await usuarioPrueba.save();
      logger.info('Usuario de prueba creado para catálogo:', usuarioPrueba._id);
    } else {
      logger.info('Usuario de prueba encontrado:', usuarioPrueba._id);
    }
    
    return usuarioPrueba;
  } catch (error) {
    logger.error('Error al obtener usuario de prueba:', error);
    throw error;
  }
}

async function insertarDatosCatalogo() {
  try {
    // Conectar a la base de datos
    await connectDB();
    logger.info('Conectado a MongoDB');

    // Obtener usuario de prueba
    const usuarioPrueba = await obtenerUsuarioPrueba();

    // Limpiar registros de prueba anteriores
    await CatalogoGasto.deleteMany({ 
      creadoPor: usuarioPrueba._id
    });
    logger.info('Registros de catálogo anteriores eliminados');

    // Insertar nuevos datos de prueba
    const registrosCreados = [];
    
    for (const datosCatalogo of datosPruebaCatalogo) {
      const nuevoCatalogo = new CatalogoGasto({
        ...datosCatalogo,
        creadoPor: usuarioPrueba._id
      });
      
      const registroGuardado = await nuevoCatalogo.save();
      registrosCreados.push(registroGuardado);
      
      logger.info(`Catálogo creado: ${registroGuardado._id} - ${registroGuardado.nombre}`);
    }

    // Mostrar resumen
    logger.info(`\n=== RESUMEN DE CATÁLOGO INSERTADO ===`);
    logger.info(`Total registros creados: ${registrosCreados.length}`);
    
    // Agrupar por categoría
    const porCategoria = registrosCreados.reduce((acc, r) => {
      const cat = r.categoriaGasto;
      acc[cat] = (acc[cat] || []).concat(r);
      return acc;
    }, {} as Record<string, typeof registrosCreados>);
    
    logger.info('\n=== DISTRIBUCIÓN POR CATEGORÍA DE GASTO ===');
    Object.entries(porCategoria).forEach(([categoria, registros]) => {
      logger.info(`${categoria}: ${registros.length} gastos`);
      registros.forEach(r => {
        logger.info(`  - ${r.nombre} (${r.tipoGasto}) - S/ ${r.montoEstimado?.toFixed(2) || '0.00'}`);
      });
    });
    
    // Agrupar por tipo de gasto
    const porTipo = registrosCreados.reduce((acc, r) => {
      const tipo = r.tipoGasto;
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('\n=== DISTRIBUCIÓN POR TIPO DE GASTO ===');
    Object.entries(porTipo).forEach(([tipo, cantidad]) => {
      logger.info(`${tipo}: ${cantidad} gastos`);
    });
    
    // Calcular totales estimados
    const totalEstimado = registrosCreados
      .filter(r => r.estado === EstadoGasto.ACTIVO && r.montoEstimado)
      .reduce((sum, r) => sum + (r.montoEstimado || 0), 0);
    
    logger.info(`\n=== ESTIMACIÓN FINANCIERA ===`);
    logger.info(`Total estimado mensual (gastos activos): S/ ${totalEstimado.toFixed(2)}`);
    
    // Mostrar mapeo directo con TipoCosto de Caja
    logger.info(`\n=== MAPEO DIRECTO CON TIPOS DE COSTO DE CAJA ===`);
    
    logger.info('MANO_OBRA:');
    const manoObra = registrosCreados.filter(r => r.categoriaGasto === CategoriaGasto.MANO_OBRA);
    manoObra.forEach(r => logger.info(`  - ${r.nombre}`));
    
    logger.info('MATERIA_PRIMA:');
    const materiaPrima = registrosCreados.filter(r => r.categoriaGasto === CategoriaGasto.MATERIA_PRIMA);
    materiaPrima.forEach(r => logger.info(`  - ${r.nombre}`));
    
    logger.info('OTROS_GASTOS:');
    const otrosGastos = registrosCreados.filter(r => r.categoriaGasto === CategoriaGasto.OTROS_GASTOS);
    otrosGastos.forEach(r => logger.info(`  - ${r.nombre}`));

    logger.info(`\n=== NUEVAS CATEGORÍAS CONFIGURADAS ===`);
    logger.info('Las categorías ahora mapean directamente con los tipos de costo de Caja:');
    logger.info('- MANO_OBRA: Gastos relacionados con personal y servicios humanos');
    logger.info('- MATERIA_PRIMA: Materiales, insumos y elementos para producción');
    logger.info('- OTROS_GASTOS: Servicios generales, operación y gastos indirectos');

    return registrosCreados;

  } catch (error) {
    logger.error('Error al insertar datos de catálogo:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    logger.info('=== INICIANDO SCRIPT DE PRUEBA PARA CATÁLOGO DE GASTOS ===');
    logger.info('Configuración actualizada con nuevas categorías: MANO_OBRA, MATERIA_PRIMA, OTROS_GASTOS');
    logger.info(`Fecha actual en Lima: ${formatInLima(getNowInLima())}`);
    
    const registros = await insertarDatosCatalogo();
    
    logger.info('\n=== SCRIPT COMPLETADO EXITOSAMENTE ===');
    logger.info('✅ Catálogo actualizado con las nuevas categorías');
    logger.info('✅ Mapeo directo con tipos de costo de Caja configurado');
    logger.info('Puedes revisar los datos insertados en la base de datos');
    logger.info('Usa las rutas GET /api/herramientas/catalogos para consultar el catálogo');
    
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

export { insertarDatosCatalogo, obtenerUsuarioPrueba };