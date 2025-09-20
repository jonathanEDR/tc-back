import { Schema, model, Types } from 'mongoose';

// Enumeraciones para el catálogo de gastos
export enum CategoriaGasto {
  MANO_OBRA = 'mano_obra',
  MATERIA_PRIMA = 'materia_prima',
  OTROS_GASTOS = 'otros_gastos'
}

export enum TipoGasto {
  FIJO = 'fijo',           // Gastos que se repiten mensualmente
  VARIABLE = 'variable',    // Gastos que varían según la operación
  OCASIONAL = 'ocasional'   // Gastos esporádicos
}

export enum EstadoGasto {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
  ARCHIVADO = 'archivado'
}

// Interface principal para el catálogo de gastos
export interface ICatalogoGasto {
  _id?: Types.ObjectId;
  nombre: string;
  descripcion?: string;
  categoriaGasto: CategoriaGasto;
  tipoGasto: TipoGasto;
  montoEstimado?: number; // Monto estimado o promedio del gasto
  estado: EstadoGasto;
  observaciones?: string;
  etiquetas?: string[]; // Para facilitar búsquedas
  creadoPor: Types.ObjectId; // Usuario que creó el registro
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

// Schema de Mongoose
const catalogoGastoSchema = new Schema<ICatalogoGasto>({
  nombre: {
    type: String,
    required: [true, 'El nombre del gasto es obligatorio'],
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
    trim: true,
    index: true // Para búsquedas rápidas
  },
  descripcion: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
    trim: true
  },
  categoriaGasto: {
    type: String,
    enum: Object.values(CategoriaGasto),
    required: [true, 'La categoría de gasto es obligatoria'],
    index: true
  },
  tipoGasto: {
    type: String,
    enum: Object.values(TipoGasto),
    required: [true, 'El tipo de gasto es obligatorio'],
    index: true
  },
  montoEstimado: {
    type: Number,
    min: [0, 'El monto estimado no puede ser negativo'],
    max: [999999999, 'El monto estimado no puede exceder 999,999,999']
  },
  estado: {
    type: String,
    enum: Object.values(EstadoGasto),
    default: EstadoGasto.ACTIVO,
    required: [true, 'El estado es obligatorio'],
    index: true
  },
  observaciones: {
    type: String,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres'],
    trim: true
  },
  etiquetas: [{
    type: String,
    trim: true,
    maxlength: [50, 'Cada etiqueta no puede exceder 50 caracteres']
  }],
  creadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario creador es obligatorio'],
    index: true
  }
}, {
  timestamps: true, // Agrega automáticamente createdAt y updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para mejorar performance
catalogoGastoSchema.index({ categoriaGasto: 1, estado: 1 });
catalogoGastoSchema.index({ tipoGasto: 1, estado: 1 });
catalogoGastoSchema.index({ nombre: 'text', descripcion: 'text' }); // Índice de texto para búsquedas

// Índice único compuesto para prevenir duplicados por usuario
catalogoGastoSchema.index({ nombre: 1, creadoPor: 1 }, { unique: true });

// Virtual para formatear el monto estimado
catalogoGastoSchema.virtual('montoEstimadoFormateado').get(function() {
  if (!this.montoEstimado) return 'No especificado';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(this.montoEstimado);
});

// Virtual para obtener información del usuario creador
catalogoGastoSchema.virtual('infoCreador', {
  ref: 'User',
  localField: 'creadoPor',
  foreignField: '_id',
  justOne: true
});

// Middleware pre-save para validaciones y transformaciones
catalogoGastoSchema.pre('save', function(next) {
  // Convertir nombre a formato título
  if (this.nombre) {
    this.nombre = this.nombre.charAt(0).toUpperCase() + this.nombre.slice(1).toLowerCase();
  }
  
  // Limpiar etiquetas vacías y duplicadas
  if (this.etiquetas && this.etiquetas.length > 0) {
    this.etiquetas = [...new Set(this.etiquetas.filter(tag => tag && tag.trim().length > 0))];
  }
  
  next();
});

// Middleware pre-find para popular automáticamente la información del usuario
catalogoGastoSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function() {
  this.populate('creadoPor', 'name email clerkId');
});

// Métodos estáticos para consultas comunes
catalogoGastoSchema.statics.buscarActivos = function() {
  return this.find({ estado: EstadoGasto.ACTIVO }).sort({ nombre: 1 });
};

catalogoGastoSchema.statics.buscarPorCategoria = function(categoriaGasto: CategoriaGasto) {
  return this.find({ categoriaGasto, estado: EstadoGasto.ACTIVO }).sort({ nombre: 1 });
};

catalogoGastoSchema.statics.buscarPorTexto = function(texto: string) {
  return this.find({
    $and: [
      { estado: EstadoGasto.ACTIVO },
      {
        $or: [
          { $text: { $search: texto } },
          { nombre: { $regex: texto, $options: 'i' } },
          { descripcion: { $regex: texto, $options: 'i' } },
          { etiquetas: { $in: [new RegExp(texto, 'i')] } }
        ]
      }
    ]
  }).sort({ score: { $meta: 'textScore' }, nombre: 1 });
};

export default model<ICatalogoGasto>('CatalogoGasto', catalogoGastoSchema);