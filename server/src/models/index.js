/**
 * @file Definicion de los modelos Sequelize del dominio (roles, usuarios, clientes, productos,
 * inventario, ventas, compras, abonos, caja, etc.), sus asociaciones y el objeto agregado de modelos.
 */
import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

export const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(50), allowNull: false }
}, { tableName: 'roles', timestamps: false });

export const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  rol_id: DataTypes.INTEGER,
  activo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'usuarios', timestamps: false });

export const TipoCliente = sequelize.define('TipoCliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false }
}, { tableName: 'tipos_cliente', timestamps: false });

export const Cliente = sequelize.define('Cliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  telefono: DataTypes.STRING(20),
  cedula: { type: DataTypes.STRING(50), unique: true },
  tipo_cliente_id: DataTypes.INTEGER,
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'clientes', timestamps: false });

export const Proveedor = sequelize.define('Proveedor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  telefono: DataTypes.STRING(20),
  direccion: DataTypes.STRING(255)
}, { tableName: 'proveedores', timestamps: false });

export const Categoria = sequelize.define('Categoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false }
}, { tableName: 'categorias', timestamps: false });

export const Subcategoria = sequelize.define('Subcategoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  categoria_id: DataTypes.INTEGER,
  nombre: { type: DataTypes.STRING(100), allowNull: false }
}, { tableName: 'subcategorias', timestamps: false });

export const Producto = sequelize.define('Producto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  descripcion: DataTypes.TEXT,
  precio_base: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  precio_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  categoria_id: DataTypes.INTEGER,
  subcategoria_id: DataTypes.INTEGER
}, { tableName: 'productos', timestamps: false });

export const ProductoProveedor = sequelize.define('ProductoProveedor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_id: { type: DataTypes.INTEGER, allowNull: false },
  proveedor_id: { type: DataTypes.INTEGER, allowNull: false },
  costo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  moneda_costo: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' }
}, {
  tableName: 'producto_proveedores',
  timestamps: false,
  indexes: [{ name: 'uq_producto_proveedor', unique: true, fields: ['producto_id', 'proveedor_id'] }]
});

export const ProductoVariante = sequelize.define('ProductoVariante', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_id: { type: DataTypes.INTEGER, allowNull: false },
  color: DataTypes.STRING(50),
  talla: DataTypes.STRING(20),
  // Unidad de manejo de la variante. Una 'paca' representa una compra al por mayor que, al
  // ingresarla, se "explota" en piezas_por_paca unidades vendibles del inventario.
  unidad: { type: DataTypes.ENUM('unidad', 'paca'), allowNull: false, defaultValue: 'unidad' },
  piezas_por_paca: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
}, { tableName: 'producto_variantes', timestamps: false });

export const Inventario = sequelize.define('Inventario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_variante_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  cantidad: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'inventario', timestamps: false });

export const TipoPago = sequelize.define('TipoPago', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(50), allowNull: false },
  es_credito: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: 'tipos_pago', timestamps: false });

export const Venta = sequelize.define('Venta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente_id: DataTypes.INTEGER,
  cliente_nombre: DataTypes.STRING(150),
  usuario_id: DataTypes.INTEGER,
  tipo_pago_id: DataTypes.INTEGER,
  // 'contado' permite pagos mixtos (efectivo + tarjeta); 'credito' genera una deuda con plan de cuotas.
  tipo_venta: { type: DataTypes.ENUM('contado', 'credito'), allowNull: false, defaultValue: 'contado' },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'ventas', timestamps: false });

export const Configuracion = sequelize.define('Configuracion', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  tasa_cambio_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 36.62 },
  caja_base: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'configuracion', timestamps: false });

export const CajaMovimiento = sequelize.define('CajaMovimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: { type: DataTypes.ENUM('entrada', 'salida'), allowNull: false },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  motivo: DataTypes.STRING(255),
  usuario_id: DataTypes.INTEGER,
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'caja_movimientos', timestamps: false });

export const DetalleVenta = sequelize.define('DetalleVenta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venta_id: { type: DataTypes.INTEGER, allowNull: false },
  producto_variante_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'detalle_ventas', timestamps: false });

export const Compra = sequelize.define('Compra', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  proveedor_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER,
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  notas: DataTypes.STRING(255),
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'compras', timestamps: false });

export const DetalleCompra = sequelize.define('DetalleCompra', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  compra_id: { type: DataTypes.INTEGER, allowNull: false },
  producto_variante_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  costo_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'detalle_compras', timestamps: false });

export const Abono = sequelize.define('Abono', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  // Deuda a la que se aplica el abono. Es opcional para conservar compatibilidad con los abonos
  // historicos (anteriores al registro explicito de deudas), que solo se asociaban al cliente.
  deuda_id: { type: DataTypes.INTEGER, allowNull: true },
  tipo_pago_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER,
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  notas: DataTypes.STRING(255),
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'abonos', timestamps: false });

// Registro explicito de deuda generado por una venta a credito. Concentra el monto financiado
// (total de la venta menos el enganche) y su plan de pagos. El saldo pendiente se obtiene restando
// los abonos asociados; cuando llega a cero la deuda pasa a 'saldada'.
export const Deuda = sequelize.define('Deuda', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venta_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  monto_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  num_cuotas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  estado: { type: DataTypes.ENUM('pendiente', 'saldada'), allowNull: false, defaultValue: 'pendiente' },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'deudas', timestamps: false });

// Cuota individual del plan de pagos de una deuda (numero de cuota, monto y vencimiento).
export const Cuota = sequelize.define('Cuota', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  deuda_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.INTEGER, allowNull: false },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  fecha_vencimiento: DataTypes.DATEONLY,
  estado: { type: DataTypes.ENUM('pendiente', 'pagada'), allowNull: false, defaultValue: 'pendiente' }
}, { tableName: 'cuotas', timestamps: false });

// Linea de pago de una venta de contado. Una venta puede liquidarse con varias lineas (pago mixto:
// efectivo + tarjeta). Para las lineas en efectivo se guarda el efectivo recibido y el vuelto.
export const VentaPago = sequelize.define('VentaPago', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venta_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo_pago_id: { type: DataTypes.INTEGER, allowNull: false },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  efectivo_recibido: DataTypes.DECIMAL(10, 2),
  vuelto: DataTypes.DECIMAL(10, 2)
}, { tableName: 'venta_pagos', timestamps: false });

// Catalogo de denominaciones de billetes y monedas. Sirve de base para registrar el efectivo
// disponible en la apertura de caja y para desglosar el vuelto en el POS.
export const Denominacion = sequelize.define('Denominacion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tipo: { type: DataTypes.ENUM('billete', 'moneda'), allowNull: false, defaultValue: 'billete' },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'denominaciones', timestamps: false });

// Apertura de caja: foto del efectivo disponible al iniciar una sesion de caja, desglosado por
// denominacion en CajaAperturaDetalle. El POS usa la apertura abierta mas reciente para calcular el vuelto.
export const CajaApertura = sequelize.define('CajaApertura', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id: DataTypes.INTEGER,
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  estado: { type: DataTypes.ENUM('abierta', 'cerrada'), allowNull: false, defaultValue: 'abierta' },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'caja_aperturas', timestamps: false });

export const CajaAperturaDetalle = sequelize.define('CajaAperturaDetalle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  apertura_id: { type: DataTypes.INTEGER, allowNull: false },
  denominacion_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'caja_apertura_detalle', timestamps: false });

// Movimiento de Kardex: bitacora de existencias por variante (ingreso, salida o ajuste) con su
// motivo y, opcionalmente, la referencia al documento que lo origino (venta, compra, perdida...).
export const KardexMovimiento = sequelize.define('KardexMovimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_variante_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM('ingreso', 'salida', 'ajuste'), allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  motivo: DataTypes.STRING(255),
  costo_unitario: DataTypes.DECIMAL(10, 2),
  referencia_tipo: DataTypes.STRING(30),
  referencia_id: DataTypes.INTEGER,
  usuario_id: DataTypes.INTEGER,
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'kardex_movimientos', timestamps: false });

// Registro de perdidas de producto (deterioro, robo, merma, etc.). Descuenta inventario y representa
// un egreso de tipo 'perdida' valorado al costo capturado.
export const Perdida = sequelize.define('Perdida', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_variante_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  costo_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  costo_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  motivo: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'otro' },
  usuario_id: DataTypes.INTEGER,
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'perdidas', timestamps: false });

// Definicion de las asociaciones entre modelos (relaciones uno a muchos, uno a uno
// y muchos a muchos) que establecen las claves foraneas y los alias usados en las consultas.
Role.hasMany(Usuario, { foreignKey: 'rol_id' });
Usuario.belongsTo(Role, { foreignKey: 'rol_id' });

TipoCliente.hasMany(Cliente, { foreignKey: 'tipo_cliente_id' });
Cliente.belongsTo(TipoCliente, { foreignKey: 'tipo_cliente_id', as: 'tipoCliente' });

Categoria.hasMany(Subcategoria, { foreignKey: 'categoria_id' });
Subcategoria.belongsTo(Categoria, { foreignKey: 'categoria_id' });

Categoria.hasMany(Producto, { foreignKey: 'categoria_id' });
Producto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'categoriaInfo' });

Subcategoria.hasMany(Producto, { foreignKey: 'subcategoria_id' });
Producto.belongsTo(Subcategoria, { foreignKey: 'subcategoria_id', as: 'subcategoriaInfo' });

Producto.belongsToMany(Proveedor, {
  through: ProductoProveedor,
  foreignKey: 'producto_id',
  otherKey: 'proveedor_id',
  as: 'proveedores'
});
Proveedor.belongsToMany(Producto, {
  through: ProductoProveedor,
  foreignKey: 'proveedor_id',
  otherKey: 'producto_id',
  as: 'productos'
});
ProductoProveedor.belongsTo(Producto, { foreignKey: 'producto_id', as: 'productoInfo' });
ProductoProveedor.belongsTo(Proveedor, { foreignKey: 'proveedor_id', as: 'proveedorInfo' });
Producto.hasMany(ProductoProveedor, { foreignKey: 'producto_id', as: 'proveedoresLink' });
Proveedor.hasMany(ProductoProveedor, { foreignKey: 'proveedor_id', as: 'productosLink' });

Producto.hasMany(ProductoVariante, { foreignKey: 'producto_id', as: 'variantes' });
ProductoVariante.belongsTo(Producto, { foreignKey: 'producto_id', as: 'productoInfo' });

ProductoVariante.hasOne(Inventario, { foreignKey: 'producto_variante_id', as: 'inventario' });
Inventario.belongsTo(ProductoVariante, { foreignKey: 'producto_variante_id', as: 'variante' });

Cliente.hasMany(Venta, { foreignKey: 'cliente_id' });
Venta.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'clienteInfo' });

Usuario.hasMany(Venta, { foreignKey: 'usuario_id' });
Venta.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

TipoPago.hasMany(Venta, { foreignKey: 'tipo_pago_id' });
Venta.belongsTo(TipoPago, { foreignKey: 'tipo_pago_id', as: 'tipoPagoInfo' });

Venta.hasMany(DetalleVenta, { foreignKey: 'venta_id', as: 'details' });
DetalleVenta.belongsTo(Venta, { foreignKey: 'venta_id' });

ProductoVariante.hasMany(DetalleVenta, { foreignKey: 'producto_variante_id' });
DetalleVenta.belongsTo(ProductoVariante, { foreignKey: 'producto_variante_id', as: 'varianteInfo' });

Proveedor.hasMany(Compra, { foreignKey: 'proveedor_id' });
Compra.belongsTo(Proveedor, { foreignKey: 'proveedor_id', as: 'proveedorInfo' });

Usuario.hasMany(Compra, { foreignKey: 'usuario_id' });
Compra.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

Compra.hasMany(DetalleCompra, { foreignKey: 'compra_id', as: 'details' });
DetalleCompra.belongsTo(Compra, { foreignKey: 'compra_id' });

ProductoVariante.hasMany(DetalleCompra, { foreignKey: 'producto_variante_id' });
DetalleCompra.belongsTo(ProductoVariante, { foreignKey: 'producto_variante_id', as: 'varianteInfo' });

Cliente.hasMany(Abono, { foreignKey: 'cliente_id', as: 'abonos' });
Abono.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'clienteInfo' });

TipoPago.hasMany(Abono, { foreignKey: 'tipo_pago_id' });
Abono.belongsTo(TipoPago, { foreignKey: 'tipo_pago_id', as: 'tipoPagoInfo' });

Usuario.hasMany(Abono, { foreignKey: 'usuario_id' });
Abono.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

Usuario.hasMany(CajaMovimiento, { foreignKey: 'usuario_id' });
CajaMovimiento.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

// Una venta a credito genera una unica deuda; la deuda guarda referencia a su venta y cliente.
Venta.hasOne(Deuda, { foreignKey: 'venta_id', as: 'deuda' });
Deuda.belongsTo(Venta, { foreignKey: 'venta_id', as: 'ventaInfo' });

Cliente.hasMany(Deuda, { foreignKey: 'cliente_id', as: 'deudas' });
Deuda.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'clienteInfo' });

Deuda.hasMany(Cuota, { foreignKey: 'deuda_id', as: 'cuotas' });
Cuota.belongsTo(Deuda, { foreignKey: 'deuda_id', as: 'deudaInfo' });

Deuda.hasMany(Abono, { foreignKey: 'deuda_id', as: 'abonosDeuda' });
Abono.belongsTo(Deuda, { foreignKey: 'deuda_id', as: 'deudaInfo' });

Venta.hasMany(VentaPago, { foreignKey: 'venta_id', as: 'pagos' });
VentaPago.belongsTo(Venta, { foreignKey: 'venta_id' });

TipoPago.hasMany(VentaPago, { foreignKey: 'tipo_pago_id' });
VentaPago.belongsTo(TipoPago, { foreignKey: 'tipo_pago_id', as: 'tipoPagoInfo' });

Usuario.hasMany(CajaApertura, { foreignKey: 'usuario_id' });
CajaApertura.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

CajaApertura.hasMany(CajaAperturaDetalle, { foreignKey: 'apertura_id', as: 'detalles' });
CajaAperturaDetalle.belongsTo(CajaApertura, { foreignKey: 'apertura_id' });

Denominacion.hasMany(CajaAperturaDetalle, { foreignKey: 'denominacion_id' });
CajaAperturaDetalle.belongsTo(Denominacion, { foreignKey: 'denominacion_id', as: 'denominacionInfo' });

ProductoVariante.hasMany(KardexMovimiento, { foreignKey: 'producto_variante_id' });
KardexMovimiento.belongsTo(ProductoVariante, { foreignKey: 'producto_variante_id', as: 'varianteInfo' });

Usuario.hasMany(KardexMovimiento, { foreignKey: 'usuario_id' });
KardexMovimiento.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

ProductoVariante.hasMany(Perdida, { foreignKey: 'producto_variante_id' });
Perdida.belongsTo(ProductoVariante, { foreignKey: 'producto_variante_id', as: 'varianteInfo' });

Usuario.hasMany(Perdida, { foreignKey: 'usuario_id' });
Perdida.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuarioInfo' });

export const models = {
  Abono,
  CajaApertura,
  CajaAperturaDetalle,
  CajaMovimiento,
  Categoria,
  Cliente,
  Compra,
  Configuracion,
  Cuota,
  Denominacion,
  DetalleCompra,
  DetalleVenta,
  Deuda,
  Inventario,
  KardexMovimiento,
  Perdida,
  Producto,
  ProductoProveedor,
  ProductoVariante,
  Proveedor,
  Role,
  Subcategoria,
  TipoCliente,
  TipoPago,
  Usuario,
  Venta,
  VentaPago
};
