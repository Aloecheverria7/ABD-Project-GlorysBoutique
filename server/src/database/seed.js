/**
 * @file Carga de datos de ejemplo (seed) para la base de datos: configuracion, roles, usuarios,
 * tipos de cliente y pago, categorias, subcategorias, proveedores, productos, variantes, inventario,
 * clientes y ventas de muestra. Las inserciones evitan duplicados.
 */
import bcrypt from 'bcryptjs';
import {
  Categoria,
  Cliente,
  Configuracion,
  Denominacion,
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
} from '../models/index.js';

/**
 * Inserta los datos iniciales de la aplicacion: configuracion, roles, usuarios de prueba (contrasena 123),
 * tipos de cliente y pago, categorias, subcategorias, proveedores, productos, relaciones producto-proveedor,
 * variantes, inventario y clientes. Tambien genera ventas de ejemplo. Las inserciones ignoran duplicados.
 *
 * @returns {Promise<void>} Promesa que se resuelve cuando el seed termina.
 */
export async function seedDatabase() {
  await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: 36.62, caja_base: 5000 }
  });

  await Role.bulkCreate([
    { id: 1, nombre: 'admin' },
    { id: 2, nombre: 'vendedor' }
  ], { ignoreDuplicates: true });

  // 3 cuentas del equipo (admin) + dueno (admin) + empleado (vendedor). Contrasena: 123.
  const seedUsers = [
    { id: 1, username: 'admin1', plain: '123', rol_id: 1 },
    { id: 2, username: 'admin2', plain: '123', rol_id: 1 },
    { id: 3, username: 'admin3', plain: '123', rol_id: 1 },
    { id: 4, username: 'dueno', plain: '123', rol_id: 1 },
    { id: 5, username: 'empleado', plain: '123', rol_id: 2 }
  ];

  for (const seed of seedUsers) {
    const existing = await Usuario.findByPk(seed.id);
    if (existing) continue;
    await Usuario.create({
      id: seed.id,
      username: seed.username,
      password: await bcrypt.hash(seed.plain, 10),
      rol_id: seed.rol_id,
      activo: true
    });
  }

  await TipoCliente.bulkCreate([
    { id: 1, nombre: 'Regular' },
    { id: 2, nombre: 'VIP' }
  ], { ignoreDuplicates: true });

  await TipoPago.bulkCreate([
    { id: 1, nombre: 'Efectivo', es_credito: false },
    { id: 2, nombre: 'Tarjeta', es_credito: false },
    { id: 3, nombre: 'Transferencia', es_credito: false },
    { id: 4, nombre: 'Credito', es_credito: true }
  ], { ignoreDuplicates: true });

  // Denominaciones del cordoba nicaragüense (NIO): billetes y monedas en circulacion.
  // Son la base para registrar el efectivo de la apertura de caja y desglosar el vuelto en el POS.
  await Denominacion.bulkCreate([
    { id: 1, valor: 1000, tipo: 'billete', moneda: 'NIO' },
    { id: 2, valor: 500, tipo: 'billete', moneda: 'NIO' },
    { id: 3, valor: 200, tipo: 'billete', moneda: 'NIO' },
    { id: 4, valor: 100, tipo: 'billete', moneda: 'NIO' },
    { id: 5, valor: 50, tipo: 'billete', moneda: 'NIO' },
    { id: 6, valor: 20, tipo: 'billete', moneda: 'NIO' },
    { id: 7, valor: 10, tipo: 'billete', moneda: 'NIO' },
    { id: 8, valor: 5, tipo: 'moneda', moneda: 'NIO' },
    { id: 9, valor: 1, tipo: 'moneda', moneda: 'NIO' },
    { id: 10, valor: 0.5, tipo: 'moneda', moneda: 'NIO' }
  ], { ignoreDuplicates: true });

  await Categoria.bulkCreate([
    { id: 1, nombre: 'Ropa' },
    { id: 2, nombre: 'Accesorios' },
    { id: 3, nombre: 'Calzado' },
    { id: 4, nombre: 'Lenceria' },
    { id: 5, nombre: 'Belleza' },
    { id: 6, nombre: 'Ninos' }
  ], { ignoreDuplicates: true });

  await Subcategoria.bulkCreate([
    { id: 1, categoria_id: 1, nombre: 'Blusas' },
    { id: 2, categoria_id: 1, nombre: 'Vestidos' },
    { id: 3, categoria_id: 2, nombre: 'Bolsos' },
    { id: 4, categoria_id: 3, nombre: 'Sandalias' },
    { id: 5, categoria_id: 1, nombre: 'Pantalones' },
    { id: 6, categoria_id: 1, nombre: 'Faldas' },
    { id: 7, categoria_id: 1, nombre: 'Chaquetas' },
    { id: 8, categoria_id: 2, nombre: 'Cinturones' },
    { id: 9, categoria_id: 2, nombre: 'Joyeria' },
    { id: 10, categoria_id: 2, nombre: 'Lentes' },
    { id: 11, categoria_id: 3, nombre: 'Tacones' },
    { id: 12, categoria_id: 3, nombre: 'Tenis' },
    { id: 13, categoria_id: 4, nombre: 'Brasieres' },
    { id: 14, categoria_id: 4, nombre: 'Pijamas' },
    { id: 15, categoria_id: 5, nombre: 'Maquillaje' },
    { id: 16, categoria_id: 5, nombre: 'Perfumes' },
    { id: 17, categoria_id: 6, nombre: 'Ropa nina' },
    { id: 18, categoria_id: 6, nombre: 'Ropa nino' }
  ], { ignoreDuplicates: true });

  await Proveedor.bulkCreate([
    { id: 1, nombre: 'Proveedor Principal', telefono: '5550101', direccion: 'Centro comercial' },
    { id: 2, nombre: 'Distribuidora Modas', telefono: '5550202', direccion: 'Av. Bolivar' }
  ], { ignoreDuplicates: true });

  await Producto.bulkCreate([
    {
      id: 1,
      nombre: 'Blusa floral',
      descripcion: 'Blusa fresca para uso diario',
      precio_base: 850.00,
      precio_usd: 24.99,
      categoria_id: 1,
      subcategoria_id: 1
    },
    {
      id: 2,
      nombre: 'Vestido elegante',
      descripcion: 'Vestido de noche con corte moderno',
      precio_base: 2150.00,
      precio_usd: 59.99,
      categoria_id: 1,
      subcategoria_id: 2
    },
    {
      id: 3,
      nombre: 'Bolso casual',
      descripcion: 'Bolso mediano para uso diario',
      precio_base: 1250.00,
      precio_usd: 34.50,
      categoria_id: 2,
      subcategoria_id: 3
    }
  ], { ignoreDuplicates: true });

  await ProductoProveedor.bulkCreate([
    { producto_id: 1, proveedor_id: 1, costo: 450.00, moneda_costo: 'NIO' },
    { producto_id: 1, proveedor_id: 2, costo: 12.00, moneda_costo: 'USD' },
    { producto_id: 2, proveedor_id: 1, costo: 1200.00, moneda_costo: 'NIO' },
    { producto_id: 3, proveedor_id: 2, costo: 650.00, moneda_costo: 'NIO' }
  ], { ignoreDuplicates: true });

  await ProductoVariante.bulkCreate([
    { id: 1, producto_id: 1, color: 'Rosa', talla: 'M' },
    { id: 2, producto_id: 1, color: 'Blanco', talla: 'S' },
    { id: 3, producto_id: 2, color: 'Negro', talla: 'M' },
    { id: 4, producto_id: 3, color: 'Cafe', talla: 'Unica' }
  ], { ignoreDuplicates: true });

  await Inventario.bulkCreate([
    { id: 1, producto_variante_id: 1, cantidad: 12 },
    { id: 2, producto_variante_id: 2, cantidad: 8 },
    { id: 3, producto_variante_id: 3, cantidad: 5 },
    { id: 4, producto_variante_id: 4, cantidad: 10 }
  ], { ignoreDuplicates: true });

  await Cliente.bulkCreate([
    { id: 1, nombre: 'Maria Lopez', telefono: '88112233', cedula: '001-150792-1004M', tipo_cliente_id: 2 },
    { id: 2, nombre: 'Ana Gutierrez', telefono: '85667788', cedula: '401-220488-0007K', tipo_cliente_id: 1 },
    { id: 3, nombre: 'Carla Mendoza', telefono: '84551122', cedula: '201-031195-1002J', tipo_cliente_id: 1 }
  ], { ignoreDuplicates: true });

  await seedSampleSales();
}

/**
 * Genera ventas de ejemplo con sus detalles y descuenta el inventario correspondiente, para que el
 * historial y los reportes no esten vacios al iniciar. No hace nada si ya existe alguna venta.
 *
 * @returns {Promise<void>} Promesa que se resuelve cuando se crean las ventas de muestra.
 */
// Ventas de ejemplo para que el historial y los reportes no esten vacios al iniciar.
// Solo se generan si todavia no existe ninguna venta.
async function seedSampleSales() {
  const ventasExistentes = await Venta.count();
  if (ventasExistentes > 0) return;

  const samples = [
    {
      cliente_id: 1,
      cliente_nombre: 'Maria Lopez',
      usuario_id: 5,
      tipo_pago_id: 1,
      moneda: 'NIO',
      items: [{ producto_variante_id: 1, cantidad: 1, precio_unitario: 850.0 }]
    },
    {
      cliente_id: null,
      cliente_nombre: 'Cliente ocasional',
      usuario_id: 5,
      tipo_pago_id: 1,
      moneda: 'NIO',
      items: [{ producto_variante_id: 4, cantidad: 1, precio_unitario: 1250.0 }]
    },
    {
      cliente_id: 2,
      cliente_nombre: 'Ana Gutierrez',
      usuario_id: 4,
      tipo_pago_id: 2,
      moneda: 'NIO',
      items: [
        { producto_variante_id: 2, cantidad: 2, precio_unitario: 850.0 },
        { producto_variante_id: 3, cantidad: 1, precio_unitario: 2150.0 }
      ]
    }
  ];

  for (const sample of samples) {
    const total = sample.items.reduce(
      (sum, item) => sum + Number(item.cantidad) * Number(item.precio_unitario),
      0
    );

    const venta = await Venta.create({
      cliente_id: sample.cliente_id,
      cliente_nombre: sample.cliente_nombre,
      usuario_id: sample.usuario_id,
      tipo_pago_id: sample.tipo_pago_id,
      total,
      moneda: sample.moneda
    });

    await DetalleVenta.bulkCreate(sample.items.map((item) => ({
      venta_id: venta.id,
      producto_variante_id: item.producto_variante_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    })));

    for (const item of sample.items) {
      const inventory = await Inventario.findOne({
        where: { producto_variante_id: item.producto_variante_id }
      });
      if (inventory) {
        await inventory.update({
          cantidad: Math.max(0, Number(inventory.cantidad) - Number(item.cantidad))
        });
      }
    }
  }
}
