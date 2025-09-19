import { config } from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';

// Cargar variables de entorno
config();

import Caja from '../models/Caja';
import CatalogoGasto from '../models/CatalogoGastos';
import User from '../models/User';
import logger from '../utils/logger';

async function limpiarDatosPrueba() {
  try {
    await connectDB();
    logger.info('=== INICIANDO LIMPIEZA DE DATOS DE PRUEBA ===');

    // Buscar usuario de prueba
    const usuarioPrueba = await User.findOne({ email: 'test@example.com' });
    
    if (!usuarioPrueba) {
      logger.info('No se encontró usuario de prueba - no hay datos que limpiar');
      return;
    }

    logger.info(`Usuario de prueba encontrado: ${usuarioPrueba._id}`);

    // Limpiar movimientos de caja del usuario de prueba
    const cajaEliminada = await Caja.deleteMany({ 
      usuario: usuarioPrueba._id 
    });
    logger.info(`Movimientos de caja eliminados: ${cajaEliminada.deletedCount}`);

    // Limpiar gastos del catálogo creados por el usuario de prueba
    const catalogoEliminado = await CatalogoGasto.deleteMany({ 
      creadoPor: usuarioPrueba._id 
    });
    logger.info(`Gastos del catálogo eliminados: ${catalogoEliminado.deletedCount}`);

    // Opcional: eliminar también el usuario de prueba
    const eliminarUsuario = process.argv.includes('--delete-user');
    if (eliminarUsuario) {
      await User.deleteOne({ _id: usuarioPrueba._id });
      logger.info('Usuario de prueba eliminado');
    } else {
      logger.info('Usuario de prueba conservado (usar --delete-user para eliminarlo)');
    }

    // Mostrar resumen
    logger.info('\n=== RESUMEN DE LIMPIEZA ===');
    logger.info(`Total movimientos eliminados: ${cajaEliminada.deletedCount}`);
    logger.info(`Total gastos catálogo eliminados: ${catalogoEliminado.deletedCount}`);
    logger.info(`Usuario eliminado: ${eliminarUsuario ? 'Sí' : 'No'}`);

    // Verificar estado final
    const movimientosRestantes = await Caja.countDocuments({ usuario: usuarioPrueba._id });
    const gastosRestantes = await CatalogoGasto.countDocuments({ creadoPor: usuarioPrueba._id });
    
    logger.info('\n=== VERIFICACIÓN FINAL ===');
    logger.info(`Movimientos restantes del usuario: ${movimientosRestantes}`);
    logger.info(`Gastos restantes del usuario: ${gastosRestantes}`);

    if (movimientosRestantes === 0 && gastosRestantes === 0) {
      logger.info('✅ Limpieza completada exitosamente');
    } else {
      logger.warn('⚠️ Algunos datos pueden no haberse eliminado completamente');
    }

  } catch (error) {
    logger.error('Error durante la limpieza:', error);
    throw error;
  }
}

async function main() {
  try {
    await limpiarDatosPrueba();
  } catch (error) {
    logger.error('Error en script de limpieza:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { limpiarDatosPrueba };