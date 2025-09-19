import mongoose from 'mongoose';
import { config } from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';

// Cargar variables de entorno al inicio
config();

import { 
  buscarGastosPorTipoCosto, 
  sugerirTipoCostoPorGasto,
  buscarGastosPorTexto,
  obtenerEstadisticasSincronizacion,
  MAPEO_TIPO_COSTO_CATEGORIA
} from '../utils/sincronizacionGastos';
import { TipoCosto } from '../models/Caja';
import CatalogoGasto from '../models/CatalogoGastos';
import { insertarDatosCatalogo } from './testCatalogos';
import { insertarDatosCaja } from './testCaja';
import logger from '../utils/logger';

async function probarSincronizacion() {
  try {
    await connectDB();
    logger.info('=== PROBANDO SINCRONIZACIÓN ENTRE CAJA Y CATÁLOGO ===\n');

    // Asegurarse de que hay datos de prueba
    logger.info('1. Verificando datos de prueba...');
    const totalCatalogo = await CatalogoGasto.countDocuments();
    if (totalCatalogo === 0) {
      logger.info('No hay datos en catálogo, insertando datos de prueba...');
      await insertarDatosCatalogo();
    }

    // 1. Probar búsqueda por tipo de costo
    logger.info('\n=== 2. BÚSQUEDA POR TIPO DE COSTO ===');
    
    for (const tipoCosto of Object.values(TipoCosto)) {
      logger.info(`\n--- Gastos para ${tipoCosto.toUpperCase()} ---`);
      
      const sugerencias = await buscarGastosPorTipoCosto(tipoCosto, {
        soloActivos: true,
        limite: 5
      });
      
      if (sugerencias.length > 0) {
        sugerencias.forEach(sug => {
          logger.info(`  ✓ ${sug.nombre} (${sug.categoria})`);
          logger.info(`    Relevancia: ${sug.relevancia}% | Estimado: S/ ${sug.montoEstimado?.toFixed(2) || 'N/A'}`);
        });
      } else {
        logger.info('  No se encontraron gastos para este tipo de costo');
      }
    }

    // 2. Probar sugerencias inversas
    logger.info('\n=== 3. SUGERENCIAS DE TIPO DE COSTO POR GASTO ===');
    
    const gastosAleatorios = await CatalogoGasto.find({ estado: 'activo' }).limit(5).lean();
    
    gastosAleatorios.forEach(gasto => {
      const sugerencia = sugerirTipoCostoPorGasto(gasto);
      logger.info(`\n--- ${gasto.nombre} ---`);
      logger.info(`  Categoría: ${gasto.categoriaGasto}`);
      logger.info(`  Etiquetas: ${gasto.etiquetas?.join(', ') || 'Ninguna'}`);
      logger.info(`  ➜ Tipo sugerido: ${sugerencia.tipoCosto}`);
      logger.info(`  ➜ Confianza: ${sugerencia.confianza}%`);
      logger.info(`  ➜ Razón: ${sugerencia.razon}`);
    });

    // 3. Probar búsqueda por texto
    logger.info('\n=== 4. BÚSQUEDA POR TEXTO ===');
    
    const terminosBusqueda = ['combustible', 'personal', 'materiales', 'oficina'];
    
    for (const termino of terminosBusqueda) {
      logger.info(`\n--- Búsqueda: "${termino}" ---`);
      
      const resultados = await buscarGastosPorTexto(termino);
      
      if (resultados.length > 0) {
        resultados.slice(0, 3).forEach(res => {
          logger.info(`  ✓ ${res.nombre}`);
          logger.info(`    Tipo sugerido: ${res.tipoCostoSugerido} (${res.relevancia}%)`);
        });
      } else {
        logger.info('  No se encontraron resultados');
      }
    }

    // 4. Probar búsqueda filtrada por tipo de costo
    logger.info('\n=== 5. BÚSQUEDA FILTRADA POR TIPO DE COSTO ===');
    
    const resultadosFiltrados = await buscarGastosPorTexto('servicios', TipoCosto.MANO_OBRA);
    logger.info(`\nBúsqueda "servicios" filtrada por MANO_OBRA:`);
    resultadosFiltrados.forEach(res => {
      logger.info(`  ✓ ${res.nombre} (relevancia: ${res.relevancia}%)`);
    });

    // 5. Estadísticas generales
    logger.info('\n=== 6. ESTADÍSTICAS DE SINCRONIZACIÓN ===');
    
    const stats = await obtenerEstadisticasSincronizacion();
    
    logger.info(`\nTotal gastos en catálogo: ${stats.totalGastosCatalogo}`);
    logger.info(`Total gastos activos: ${stats.totalGastosActivos}`);
    
    logger.info('\nDistribución por tipo de costo:');
    Object.entries(stats.distribucionPorTipoCosto).forEach(([tipo, cantidad]) => {
      const porcentaje = stats.totalGastosActivos > 0 
        ? ((cantidad / stats.totalGastosActivos) * 100).toFixed(1)
        : '0';
      logger.info(`  ${tipo}: ${cantidad} gastos (${porcentaje}%)`);
    });
    
    if (stats.categoriasOrfanas.length > 0) {
      logger.info('\nCategorías sin mapeo claro:');
      stats.categoriasOrfanas.forEach(cat => {
        logger.info(`  - ${cat}`);
      });
    }

    // 6. Mostrar mapeo configurado
    logger.info('\n=== 7. MAPEO CONFIGURADO ===');
    
    Object.entries(MAPEO_TIPO_COSTO_CATEGORIA).forEach(([tipoCosto, categoria]) => {
      logger.info(`\n${tipoCosto.toUpperCase()}:`);
      logger.info(`  - ${categoria}`);
    });

    // 7. Casos de uso prácticos
    logger.info('\n=== 8. CASOS DE USO PRÁCTICOS ===');
    
    logger.info('\n--- Escenario: Usuario quiere registrar "Pago de salarios" ---');
    const saladosResults = await buscarGastosPorTexto('salarios');
    if (saladosResults.length > 0) {
      const mejorOpcion = saladosResults[0];
      logger.info(`Mejor opción: ${mejorOpcion.nombre}`);
      logger.info(`Tipo sugerido: ${mejorOpcion.tipoCostoSugerido}`);
      logger.info(`ID del catálogo: ${mejorOpcion._id}`);
      logger.info(`Monto estimado: S/ ${mejorOpcion.montoEstimado?.toFixed(2) || 'N/A'}`);
    }

    logger.info('\n--- Escenario: Usuario selecciona MATERIA_PRIMA ---');
    const materiaPrimaOptions = await buscarGastosPorTipoCosto(TipoCosto.MATERIA_PRIMA, {
      soloActivos: true,
      limite: 3
    });
    logger.info('Opciones disponibles:');
    materiaPrimaOptions.forEach((opcion, index) => {
      logger.info(`${index + 1}. ${opcion.nombre} - S/ ${opcion.montoEstimado?.toFixed(2) || 'N/A'}`);
    });

    logger.info('\n=== PRUEBA DE SINCRONIZACIÓN COMPLETADA ===');

  } catch (error) {
    logger.error('Error en prueba de sincronización:', error);
    throw error;
  }
}

async function main() {
  try {
    await probarSincronizacion();
  } catch (error) {
    logger.error('Error en script principal:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { probarSincronizacion };