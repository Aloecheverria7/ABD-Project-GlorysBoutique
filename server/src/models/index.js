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
  talla: DataTypes.STRING(20)
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
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'ventas', timestamps: false });

export const Configuracion = sequelize.define('Configuracion', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  tasa_cambio_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 36.62 },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'configuracion', timestamps: false });

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
  tipo_pago_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER,
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NIO' },
  tasa_cambio: DataTypes.DECIMAL(10, 4),
  notas: DataTypes.STRING(255),
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'abonos', timestamps: false });

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

export const models = {
  Abono,
  Categoria,
  Cliente,
  Compra,
  Configuracion,
  DetalleCompra,
  DetalleVenta,
  Inventario,
  Producto,
  ProductoProveedor,
  ProductoVariante,
  Proveedor,
  Role,
  Subcategoria,
  TipoCliente,
  TipoPago,
  Usuario,
  Venta
};
