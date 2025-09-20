import dotenv from 'dotenv';
import { connectDB } from '../utils/db';
import Caja from '../models/Caja';
import CatalogoGasto from '../models/CatalogoGastos';

// Cargar variables de entorno
dotenv.config();

// Script para limpiar datos duplicados en la base de datos

async function limpiarMovimientosDuplicados() {
  console.log('🧹 Iniciando limpieza de movimientos duplicados...');
  
  try {
    // Buscar duplicados basados en: fechaCaja, monto, descripcion, usuario
    const duplicados = await Caja.aggregate([
      {
        $group: {
          _id: {
            fechaCaja: '$fechaCaja',
            monto: '$monto',
            descripcion: '$descripcion',
            usuario: '$usuario'
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`📊 Encontrados ${duplicados.length} grupos de duplicados`);

    let totalEliminados = 0;

    for (const grupo of duplicados) {
      // Mantener el primero, eliminar el resto
      const idsAEliminar = grupo.ids.slice(1);
      console.log(`🗑️ Eliminando ${idsAEliminar.length} duplicados para:`, {
        fecha: grupo._id.fechaCaja,
        monto: grupo._id.monto,
        descripcion: grupo._id.descripcion
      });

      const resultado = await Caja.deleteMany({
        _id: { $in: idsAEliminar }
      });

      totalEliminados += resultado.deletedCount;
    }

    console.log(`✅ Eliminados ${totalEliminados} movimientos duplicados`);
    return totalEliminados;

  } catch (error) {
    console.error('❌ Error limpiando movimientos duplicados:', error);
    throw error;
  }
}

async function limpiarGastosCatalogoDuplicados() {
  console.log('🧹 Iniciando limpieza de gastos del catálogo duplicados...');
  
  try {
    // Buscar duplicados basados en: nombre, creadoPor
    const duplicados = await CatalogoGasto.aggregate([
      {
        $group: {
          _id: {
            nombre: '$nombre',
            creadoPor: '$creadoPor'
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`📊 Encontrados ${duplicados.length} grupos de gastos duplicados`);

    let totalEliminados = 0;

    for (const grupo of duplicados) {
      // Mantener el primero, eliminar el resto
      const idsAEliminar = grupo.ids.slice(1);
      console.log(`🗑️ Eliminando ${idsAEliminar.length} gastos duplicados para:`, {
        nombre: grupo._id.nombre
      });

      const resultado = await CatalogoGasto.deleteMany({
        _id: { $in: idsAEliminar }
      });

      totalEliminados += resultado.deletedCount;
    }

    console.log(`✅ Eliminados ${totalEliminados} gastos duplicados del catálogo`);
    return totalEliminados;

  } catch (error) {
    console.error('❌ Error limpiando gastos duplicados:', error);
    throw error;
  }
}

async function mostrarEstadisticas() {
  console.log('\n📈 ESTADÍSTICAS ACTUALES:');
  
  const totalMovimientos = await Caja.countDocuments();
  console.log(`📄 Total movimientos: ${totalMovimientos}`);
  
  const totalGastos = await CatalogoGasto.countDocuments();
  console.log(`📋 Total gastos catálogo: ${totalGastos}`);
  
  // Movimientos por usuario
  const movimientosPorUsuario = await Caja.aggregate([
    {
      $group: {
        _id: '$usuario',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'usuario'
      }
    }
  ]);

  console.log('\n👥 Movimientos por usuario:');
  for (const grupo of movimientosPorUsuario) {
    const usuario = grupo.usuario[0];
    console.log(`  - ${usuario?.name || 'Usuario desconocido'}: ${grupo.count} movimientos`);
  }

  // Gastos por usuario
  const gastosPorUsuario = await CatalogoGasto.aggregate([
    {
      $group: {
        _id: '$creadoPor',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'usuario'
      }
    }
  ]);

  console.log('\n📋 Gastos del catálogo por usuario:');
  for (const grupo of gastosPorUsuario) {
    const usuario = grupo.usuario[0];
    console.log(`  - ${usuario?.name || 'Usuario desconocido'}: ${grupo.count} gastos`);
  }
}

async function main() {
  console.log('🚀 Iniciando script de limpieza de duplicados...\n');
  
  try {
    await connectDB();
    
    // Mostrar estadísticas antes
    console.log('📊 ANTES DE LA LIMPIEZA:');
    await mostrarEstadisticas();
    
    // Limpiar duplicados
    console.log('\n🧹 INICIANDO LIMPIEZA...');
    const movimientosEliminados = await limpiarMovimientosDuplicados();
    const gastosEliminados = await limpiarGastosCatalogoDuplicados();
    
    // Mostrar estadísticas después
    console.log('\n📊 DESPUÉS DE LA LIMPIEZA:');
    await mostrarEstadisticas();
    
    console.log('\n✅ Limpieza completada exitosamente');
    console.log(`📈 Resumen:`);
    console.log(`  - Movimientos eliminados: ${movimientosEliminados}`);
    console.log(`  - Gastos eliminados: ${gastosEliminados}`);
    
  } catch (error) {
    console.error('❌ Error en el script de limpieza:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { limpiarMovimientosDuplicados, limpiarGastosCatalogoDuplicados };