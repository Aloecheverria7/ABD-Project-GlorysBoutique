DROP DATABASE IF EXISTS glorysboutique_BD;
CREATE DATABASE glorysboutique_BD CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE glorysboutique_BD;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL
);

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol_id INT,
  activo TINYINT(1) DEFAULT 1,
  CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE TABLE tipos_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20),
  cedula VARCHAR(50) UNIQUE,
  tipo_cliente_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clientes_tipos FOREIGN KEY (tipo_cliente_id) REFERENCES tipos_cliente(id)
);

CREATE TABLE proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20),
  direccion VARCHAR(255)
);

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE subcategorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT,
  nombre VARCHAR(100) NOT NULL,
  CONSTRAINT fk_subcategorias_categorias FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  categoria_id INT,
  subcategoria_id INT,
  proveedor_id INT,
  CONSTRAINT fk_productos_categorias FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT fk_productos_subcategorias FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id),
  CONSTRAINT fk_productos_proveedores FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

CREATE TABLE producto_variantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  color VARCHAR(50),
  talla VARCHAR(20),
  CONSTRAINT fk_variantes_productos FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_variante_id INT NOT NULL UNIQUE,
  cantidad INT DEFAULT 0,
  CONSTRAINT fk_inventario_variantes FOREIGN KEY (producto_variante_id) REFERENCES producto_variantes(id) ON DELETE CASCADE
);

CREATE TABLE tipos_pago (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL
);

CREATE TABLE ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  usuario_id INT,
  tipo_pago_id INT,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ventas_clientes FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_ventas_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_ventas_tipos_pago FOREIGN KEY (tipo_pago_id) REFERENCES tipos_pago(id)
);

CREATE TABLE detalle_ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_variante_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_detalle_ventas FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_variantes FOREIGN KEY (producto_variante_id) REFERENCES producto_variantes(id)
);

CREATE TABLE bitacora (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(100),
  accion VARCHAR(20),
  registro_id INT,
  usuario VARCHAR(100),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$

CREATE TRIGGER trg_validar_stock
BEFORE INSERT ON detalle_ventas
FOR EACH ROW
BEGIN
  DECLARE stock_actual INT DEFAULT 0;

  SELECT COALESCE((
    SELECT cantidad
    FROM inventario
    WHERE producto_variante_id = NEW.producto_variante_id
  ), 0) INTO stock_actual;

  IF stock_actual IS NULL OR NEW.cantidad > stock_actual THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente';
  END IF;
END$$

CREATE TRIGGER trg_descuento_inventario
AFTER INSERT ON detalle_ventas
FOR EACH ROW
BEGIN
  UPDATE inventario
  SET cantidad = cantidad - NEW.cantidad
  WHERE producto_variante_id = NEW.producto_variante_id;
END$$

CREATE TRIGGER trg_bitacora_clientes_insert
AFTER INSERT ON clientes
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('clientes', 'INSERT', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_clientes_update
AFTER UPDATE ON clientes
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('clientes', 'UPDATE', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_clientes_delete
AFTER DELETE ON clientes
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('clientes', 'DELETE', OLD.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_productos_insert
AFTER INSERT ON productos
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('productos', 'INSERT', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_productos_update
AFTER UPDATE ON productos
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('productos', 'UPDATE', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_productos_delete
AFTER DELETE ON productos
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('productos', 'DELETE', OLD.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_bitacora_ventas_insert
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, accion, registro_id, usuario)
  VALUES ('ventas', 'INSERT', NEW.id, CURRENT_USER());
END$$

CREATE PROCEDURE sp_login(IN p_username VARCHAR(100), IN p_password VARCHAR(255))
BEGIN
  SELECT id, username, rol_id
  FROM usuarios
  WHERE username = p_username
    AND password = p_password
    AND activo = 1;
END$$

CREATE PROCEDURE sp_crear_cliente(
  IN p_nombre VARCHAR(150),
  IN p_telefono VARCHAR(20),
  IN p_cedula VARCHAR(50),
  IN p_tipo_cliente_id INT
)
BEGIN
  INSERT INTO clientes (nombre, telefono, cedula, tipo_cliente_id)
  VALUES (p_nombre, p_telefono, p_cedula, p_tipo_cliente_id);
END$$

DELIMITER ;

CREATE VIEW vw_ventas_resumen AS
SELECT
  v.id,
  c.nombre AS cliente,
  u.username AS usuario,
  tp.nombre AS tipo_pago,
  v.total,
  v.fecha
FROM ventas v
LEFT JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN usuarios u ON v.usuario_id = u.id
LEFT JOIN tipos_pago tp ON v.tipo_pago_id = tp.id;

CREATE VIEW vw_inventario AS
SELECT
  i.id,
  pv.id AS producto_variante_id,
  p.nombre AS producto,
  pv.color,
  pv.talla,
  i.cantidad
FROM inventario i
JOIN producto_variantes pv ON i.producto_variante_id = pv.id
JOIN productos p ON pv.producto_id = p.id;

INSERT INTO roles (nombre) VALUES ('admin'), ('vendedor');
INSERT INTO usuarios (username, password, rol_id) VALUES ('admin', '123', 1), ('user1', '123', 2);
INSERT INTO tipos_cliente (nombre) VALUES ('Regular'), ('VIP');
INSERT INTO tipos_pago (nombre) VALUES ('Efectivo'), ('Tarjeta');
INSERT INTO categorias (nombre) VALUES ('Ropa'), ('Accesorios'), ('Calzado');
INSERT INTO subcategorias (categoria_id, nombre) VALUES (1, 'Blusas'), (1, 'Vestidos'), (2, 'Bolsos'), (3, 'Sandalias');
INSERT INTO proveedores (nombre, telefono, direccion) VALUES ('Proveedor Principal', '555-0101', 'Centro comercial');

INSERT INTO productos (nombre, descripcion, precio_base, categoria_id, subcategoria_id, proveedor_id)
VALUES
  ('Blusa floral', 'Blusa fresca para uso diario', 24.99, 1, 1, 1),
  ('Vestido elegante', 'Vestido de noche con corte moderno', 59.99, 1, 2, 1),
  ('Bolso casual', 'Bolso mediano para uso diario', 34.50, 2, 3, 1);

INSERT INTO producto_variantes (producto_id, color, talla)
VALUES
  (1, 'Rosa', 'M'),
  (1, 'Blanco', 'S'),
  (2, 'Negro', 'M'),
  (3, 'Cafe', 'Unica');

INSERT INTO inventario (producto_variante_id, cantidad)
VALUES (1, 12), (2, 8), (3, 5), (4, 10);
