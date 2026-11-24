-- ====================================================================
-- NOVA STORE - Script de Inicialización de Base de Datos (MariaDB / MySQL)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS novastore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE novastore;

-- --------------------------------------------------------------------
-- Tabla: categorias
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Tabla: productos
-- Cumple con todos los requisitos del Módulo 1 (Gestión de Productos):
-- - Código único
-- - Nombre, descripción, categoría, precio, cantidad disponible (stock)
-- - Umbral configurable para inventario bajo
-- - Imagen (ruta / URL)
-- - Fechas de creación, actualización y eliminación
-- - Estado activo/eliminado (Soft Delete)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    categoria VARCHAR(100) NOT NULL,
    precio INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    umbral_inventario_bajo INT NOT NULL DEFAULT 5,
    imagen VARCHAR(500) NULL,
    etiqueta VARCHAR(50) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_codigo (codigo),
    INDEX idx_categoria (categoria),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Categorías iniciales de la tienda
-- --------------------------------------------------------------------
INSERT INTO categorias (nombre, slug) VALUES
('Tecnología', 'tecnologia'),
('Audio', 'audio'),
('Accesorios', 'accesorios'),
('Calzado', 'calzado'),
('Belleza', 'belleza'),
('Fotografía', 'fotografia'),
('Ofertas', 'ofertas')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- --------------------------------------------------------------------
-- Productos semilla iniciales (sincronizados con el catálogo existente)
-- --------------------------------------------------------------------
INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta, activo) VALUES
('PRD-001', 'Audífonos inalámbricos', 'Audífonos inalámbricos con cancelación de ruido y batería de larga duración.', 'Audio', 129900, 15, 5, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop', 'Nuevo', 1),
('PRD-002', 'Reloj clásico', 'Reloj de pulso minimalista con correa de cuero genuino.', 'Accesorios', 219900, 8, 3, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop', NULL, 1),
('PRD-003', 'Cámara instantánea', 'Cámara compacta de revelado instantáneo con flash integrado.', 'Fotografía', 389900, 4, 5, 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80&auto=format&fit=crop', 'Más vendido', 1),
('PRD-004', 'Tenis deportivos', 'Calzado ligero y transpirable para entrenamiento y running.', 'Calzado', 179900, 12, 4, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&auto=format&fit=crop', NULL, 1),
('PRD-005', 'Gafas de sol', 'Gafas de sol polarizadas con protección UV400 y montura resistente.', 'Accesorios', 89900, 20, 5, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80&auto=format&fit=crop', NULL, 1),
('PRD-006', 'Smartwatch deportivo', 'Reloj inteligente con monitor de ritmo cardíaco, GPS y resistencia al agua.', 'Tecnología', 299900, 7, 3, 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop', 'Nuevo', 1),
('PRD-007', 'Perfume floral 100 ml', 'Fragancia fresca con notas florales y duración prolongada.', 'Belleza', 159900, 0, 5, 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&q=80&auto=format&fit=crop', NULL, 1),
('PRD-008', 'Morral urbano', 'Mochila ergonómica resistente al agua con compartimiento acolchado para laptop.', 'Accesorios', 139900, 11, 4, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80&auto=format&fit=crop', NULL, 1),
('PRD-009', 'Cable Tipo C Ugreen', 'Cable reforzado de carga rápida y transferencia de datos.', 'Tecnología', 38445, 25, 5, 'https://http2.mlstatic.com/D_Q_NP_773249-MLA100002856027_112025-F.webp', 'Nuevo', 1),
('PRD-010', 'Air Jordan 1 Travis Scott', 'Edición especial de colección con diseño prémium.', 'Calzado', 6293765, 2, 2, 'https://cdn-images.farfetch-contents.com/14/07/70/10/14077010_18662963_600.jpg', 'Recien Sacadas del Nike Store', 1)
ON DUPLICATE KEY UPDATE codigo=VALUES(codigo);
