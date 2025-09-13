import { Schema, model, Types } from 'mongoose';

// Enumeraciones
export enum CategoriaCaja {
  FINANZAS = 'finanzas',
  OPERACIONES = 'operaciones',
  VENTAS = 'ventas',
  ADMINISTRATIVO = 'administrativo'
}

// Nuevas categorías específicas para ingresos
export enum CategoriaIngreso {
  VENTA_DIRECTA = 'venta_directa',
  VENTA_OPERACIONES = 'venta_operaciones',
  INGRESOS_FINANCIEROS = 'ingresos_financieros',
  OTROS_INGRESOS = 'otros_ingresos'
}

export enum TipoCosto {
  MANO_OBRA = 'mano_obra',
  MATERIA_PRIMA = 'materia_prima',
  OTROS_GASTOS = 'otros_gastos'
}

export enum TipoMovimiento {
  ENTRADA = 'entrada',
  SALIDA = 'salida'
}

// Nuevos métodos de pago
export enum MetodoPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  YAPE = 'yape',
  PLIN = 'plin',
  DEPOSITO = 'deposito',
  CHEQUE = 'cheque',
  TARJETA = 'tarjeta'
}

// Interface principal
export interface ICaja {
  _id?: Types.ObjectId;
  fechaCaja: Date; // Fecha principal del movimiento
  monto: number;
  tipoMovimiento: TipoMovimiento;
  descripcion: string;
  // Para salidas
  categoria?: CategoriaCaja;
  tipoCosto?: TipoCosto;
  // Para ingresos
  categoriaIngreso?: CategoriaIngreso;
  // Método de pago (para ambos)
  metodoPago: MetodoPago;
  usuario: Types.ObjectId;
  comprobante?: string;
  observaciones?: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

// Esquema Mongoose
const cajaSchema = new Schema<ICaja>({
  fechaCaja: {
    type: Date,
    required: [true, 'La fecha es obligatoria'],
    validate: {
      validator: function(value: Date) {
        const today = new Date();
        const twoYearsAgo = new Date();
        const oneYearAhead = new Date();
        twoYearsAgo.setFullYear(today.getFullYear() - 2);
        oneYearAhead.setFullYear(today.getFullYear() + 1);
        return value >= twoYearsAgo && value <= oneYearAhead;
      },
      message: 'La fecha debe estar entre 2 años atrás y 1 año adelante'
    }
  },
  monto: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0.01, 'El monto debe ser mayor a 0'],
    max: [999999999, 'El monto no puede exceder 999,999,999']
  },
  tipoMovimiento: {
    type: String,
    enum: Object.values(TipoMovimiento),
    required: [true, 'El tipo de movimiento es obligatorio']
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    minlength: [5, 'La descripción debe tener al menos 5 caracteres'],
    maxlength: [200, 'La descripción no puede exceder 200 caracteres'],
    trim: true
  },
  // Campos para SALIDAS
  categoria: {
    type: String,
    enum: Object.values(CategoriaCaja),
    required: function(this: ICaja) {
      return this.tipoMovimiento === TipoMovimiento.SALIDA;
    },
    validate: {
      validator: function(this: ICaja, value: string) {
        // Solo requerido para salidas
        if (this.tipoMovimiento === TipoMovimiento.SALIDA) {
          return value && Object.values(CategoriaCaja).includes(value as CategoriaCaja);
        }
        return true;
      },
      message: 'La categoría es obligatoria para salidas'
    }
  },
  tipoCosto: {
    type: String,
    enum: Object.values(TipoCosto),
    required: function(this: ICaja) {
      return this.tipoMovimiento === TipoMovimiento.SALIDA;
    },
    validate: {
      validator: function(this: ICaja, value: string) {
        // Solo requerido para salidas
        if (this.tipoMovimiento === TipoMovimiento.SALIDA) {
          return value && Object.values(TipoCosto).includes(value as TipoCosto);
        }
        return true;
      },
      message: 'El tipo de costo es obligatorio para salidas'
    }
  },
  // Campos para INGRESOS
  categoriaIngreso: {
    type: String,
    enum: Object.values(CategoriaIngreso),
    required: function(this: ICaja) {
      return this.tipoMovimiento === TipoMovimiento.ENTRADA;
    },
    validate: {
      validator: function(this: ICaja, value: string) {
        // Solo requerido para ingresos
        if (this.tipoMovimiento === TipoMovimiento.ENTRADA) {
          return value && Object.values(CategoriaIngreso).includes(value as CategoriaIngreso);
        }
        return true;
      },
      message: 'La categoría de ingreso es obligatoria para entradas'
    }
  },
  // Método de pago (para ambos tipos)
  metodoPago: {
    type: String,
    enum: Object.values(MetodoPago),
    required: [true, 'El método de pago es obligatorio']
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es obligatorio']
  },
  comprobante: {
    type: String,
    maxlength: [50, 'El comprobante no puede exceder 50 caracteres'],
    trim: true
  },
  observaciones: {
    type: String,
    maxlength: [500, 'Las observaciones no pueden exceder 500 caracteres'],
    trim: true
  }
}, {
  timestamps: true, // Agrega automáticamente createdAt y updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar performance
cajaSchema.index({ fecha: -1 });
cajaSchema.index({ usuario: 1 });
cajaSchema.index({ categoria: 1 });
cajaSchema.index({ categoriaIngreso: 1 });
cajaSchema.index({ tipoCosto: 1 });
cajaSchema.index({ metodoPago: 1 });
cajaSchema.index({ tipoMovimiento: 1 });

// Virtual para formatear el monto (actualizado para Perú)
cajaSchema.virtual('montoFormateado').get(function() {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(this.monto);
});

// Middleware pre-save para validaciones adicionales
cajaSchema.pre('save', function(next) {
  // Convertir descripción a formato título
  if (this.descripcion) {
    this.descripcion = this.descripcion.charAt(0).toUpperCase() + this.descripcion.slice(1).toLowerCase();
  }
  
  // Validación cruzada: asegurar que los campos correctos estén presentes
  if (this.tipoMovimiento === TipoMovimiento.SALIDA) {
    if (!this.categoria || !this.tipoCosto) {
      return next(new Error('Para salidas son obligatorios: categoría y tipo de costo'));
    }
    // Limpiar campos de ingreso si es salida
    this.categoriaIngreso = undefined;
  } else if (this.tipoMovimiento === TipoMovimiento.ENTRADA) {
    if (!this.categoriaIngreso) {
      return next(new Error('Para ingresos es obligatoria la categoría de ingreso'));
    }
    // Limpiar campos de salida si es ingreso
    this.categoria = undefined;
    this.tipoCosto = undefined;
  }
  
  next();
});

export default model<ICaja>('Caja', cajaSchema);