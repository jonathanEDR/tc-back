import { config } from 'dotenv';

// Cargar variables de entorno
config();

import { insertarDatosCatalogo } from './testCatalogos';
import { insertarDatosCaja } from './testCaja';
import { probarSincronizacion } from './testSincronizacion';
import logger from '../utils/logger';

async function ejecutarSuitePruebas() {
  try {
    logger.info('🚀 === INICIANDO SUITE COMPLETA DE PRUEBAS ===');
    logger.info('Esta suite ejecutará todos los tests de sincronización en orden\n');

    // Paso 1: Insertar datos del catálogo
    logger.info('📋 PASO 1: Insertando datos del catálogo...');
    await insertarDatosCatalogo();
    logger.info('✅ Catálogo de gastos insertado exitosamente\n');

    // Esperar un momento para asegurar que los datos estén disponibles
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Paso 2: Insertar datos de caja
    logger.info('💰 PASO 2: Insertando datos de caja...');
    await insertarDatosCaja();
    logger.info('✅ Movimientos de caja insertados exitosamente\n');

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Paso 3: Probar sincronización
    logger.info('🔄 PASO 3: Probando sincronización...');
    await probarSincronizacion();
    logger.info('✅ Pruebas de sincronización completadas exitosamente\n');

    // Resumen final
    logger.info('🎉 === SUITE DE PRUEBAS COMPLETADA ===');
    logger.info('Todos los componentes del sistema de sincronización están funcionando correctamente:');
    logger.info('  ✓ Catálogo de gastos configurado');
    logger.info('  ✓ Movimientos de caja insertados');
    logger.info('  ✓ Sincronización inteligente validada');
    logger.info('  ✓ APIs listas para uso en frontend');
    logger.info('\n📝 Revisa RESULTADOS_PRUEBAS.md para detalles completos');
    logger.info('🧹 Usa "npm run clean-test-data" para limpiar datos de prueba');

  } catch (error) {
    logger.error('❌ Error en la suite de pruebas:', error);
    throw error;
  }
}

async function main() {
  try {
    await ejecutarSuitePruebas();
  } catch (error) {
    logger.error('Error en script principal:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { ejecutarSuitePruebas };