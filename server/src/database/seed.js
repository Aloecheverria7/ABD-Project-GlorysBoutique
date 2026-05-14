import bcrypt from 'bcryptjs';
import {
  Categoria,
  Configuracion,
  Inventario,
  Producto,
  ProductoProveedor,
  ProductoVariante,
  Proveedor,
  Role,
  Subcategoria,
  TipoCliente,
  TipoPago,
  Usuario
} from '../models/index.js';

export async function seedDatabase() {
  await Configuracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, tasa_cambio_usd: 36.62 }
  });

  await Role.bulkCreate([
    { id: 1, nombre: 'admin' },
    { id: 2, nombre: 'vendedor' }
  ], { ignoreDuplicates: true });

  const seedUsers = [
    { id: 1, username: 'admin', plain: '123', rol_id: 1 },
    { id: 2, username: 'user1', plain: '123', rol_id: 2 }
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

  await Categoria.bulkCreate([
    { id: 1, nombre: 'Ropa' },
    { id: 2, nombre: 'Accesorios' },
    { id: 3, nombre: 'Calzado' }
  ], { ignoreDuplicates: true });

  await Subcategoria.bulkCreate([
    { id: 1, categoria_id: 1, nombre: 'Blusas' },
    { id: 2, categoria_id: 1, nombre: 'Vestidos' },
    { id: 3, categoria_id: 2, nombre: 'Bolsos' },
    { id: 4, categoria_id: 3, nombre: 'Sandalias' }
  ], { ignoreDuplicates: true });

  await Proveedor.bulkCreate([
    { id: 1, nombre: 'Proveedor Principal', telefono: '555-0101', direccion: 'Centro comercial' },
    { id: 2, nombre: 'Distribuidora Modas', telefono: '555-0202', direccion: 'Av. Bolivar' }
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
}
