// ====================================================================
// NOVA STORE - Servidor Backend (Node.js + Express + MariaDB / MySQL)
// Módulo 1: Gestión de Productos
// Módulo 2: Carrito de Compras (Validación de stock y Checkout)
// Módulo 3: Consulta de Pedidos
// ====================================================================

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Cargar variables de entorno desde .env si existe (Node 20.6+)
try {
    if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile();
    }
} catch (e) {
    // Si no existe .env, se usarán los valores por defecto
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Constantes de negocio
const UMBRAL_DESCUENTO = 250000;
const PORCENTAJE_DESCUENTO = 0.15;
const UMBRAL_ENVIO_GRATIS = 40000;
const ADICIONAL_ENVIO = 15000;
const UMBRAL_INVENTARIO_BAJO = Number(process.env.UMBRAL_INVENTARIO_BAJO) || 5;

// Asegurar directorio de subida de imágenes seguro y no ejecutable
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares para habilitar CORS (útil si se abre desde Live Server u otro puerto)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middlewares para procesar JSON y servir archivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res) => {
        // Prevenir ejecución de scripts en carpeta de uploads
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));

// --------------------------------------------------------------------
// Pool de conexiones a MariaDB / MySQL
// --------------------------------------------------------------------
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'novastore',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let tablasPedidosVerificadas = false;
async function asegurarTablasPedidos() {
    if (tablasPedidosVerificadas) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo_pedido VARCHAR(50) NOT NULL UNIQUE,
            subtotal INT NOT NULL,
            descuento INT NOT NULL DEFAULT 0,
            envio INT NOT NULL DEFAULT 0,
            total INT NOT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_codigo_pedido (codigo_pedido),
            INDEX idx_fecha_creacion (fecha_creacion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS detalle_pedidos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido_id INT NOT NULL,
            producto_id INT NOT NULL,
            codigo_producto VARCHAR(50) NOT NULL,
            nombre_producto VARCHAR(150) NOT NULL,
            precio_unitario INT NOT NULL,
            cantidad INT NOT NULL,
            subtotal_linea INT NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id),
            INDEX idx_pedido_id (pedido_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tablasPedidosVerificadas = true;
}

// --------------------------------------------------------------------
// GESTIÓN Y VALIDACIÓN DE IMÁGENES (MULTER + MAGIC BYTES)
// --------------------------------------------------------------------

/**
 * Valida la firma binaria real (magic bytes) del archivo para asegurar
 * que corresponda efectivamente a JPG, PNG o WEBP y no a un script renombrado.
 */
function validarTipoRealImagen(buffer) {
    if (!buffer || buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }

    // WEBP: RIFF (bytes 0-3) .... WEBP (bytes 8-11)
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return 'image/webp';
    }

    return null;
}

// Configuración de almacenamiento Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `prod_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Límite de 2MB
    fileFilter: (req, file, cb) => {
        const permitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (permitidos.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'));
        }
    }
});

// --------------------------------------------------------------------
// RUTAS API — MÓDULO 1: GESTIÓN DE PRODUCTOS
// --------------------------------------------------------------------

// 1. Endpoint para subir imágenes con Drag & Drop o selector de archivos
app.post('/api/upload', (req, res) => {
    upload.single('imagen')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen excede el tamaño máximo permitido de 2 MB.' });
            }
            return res.status(400).json({ error: `Error al subir imagen: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se envió ningún archivo de imagen.' });
        }

        // Validación de contenido real del archivo (no confiar solo en la extensión)
        try {
            const buffer = fs.readFileSync(req.file.path);
            const tipoReal = validarTipoRealImagen(buffer);

            if (!tipoReal) {
                // Borrar archivo no seguro de inmediato
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    error: 'El contenido del archivo no corresponde a una imagen válida (JPG, PNG o WEBP).'
                });
            }

            res.json({
                mensaje: 'Imagen subida exitosamente',
                url: `/uploads/${req.file.filename}`,
                tamano: req.file.size
            });
        } catch (errorValidacion) {
            console.error('Error al validar archivo de imagen:', errorValidacion);
            try { fs.unlinkSync(req.file.path); } catch (e) {}
            return res.status(500).json({ error: 'Error al verificar la seguridad de la imagen.' });
        }
    });
});

// 2. Obtener configuración general de la tienda
app.get('/api/config', (req, res) => {
    res.json({
        umbral_descuento: UMBRAL_DESCUENTO,
        porcentaje_descuento: PORCENTAJE_DESCUENTO,
        umbral_envio_gratis: UMBRAL_ENVIO_GRATIS,
        adicional_envio: ADICIONAL_ENVIO,
        umbral_inventario_bajo: UMBRAL_INVENTARIO_BAJO,
        limite_tamano_imagen_mb: 2
    });
});

// 3. Obtener lista de categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const [categorias] = await pool.query('SELECT id, nombre, slug FROM categorias ORDER BY nombre ASC');
        res.json(categorias);
    } catch (error) {
        console.error('Error al consultar categorías:', error);
        res.status(500).json({ error: 'Error al obtener las categorías de la base de datos' });
    }
});

// 4. Consultar productos con filtros combinados (búsqueda por nombre/código y filtro por categoría)
app.get('/api/productos', async (req, res) => {
    try {
        const { q, categoria } = req.query;
        let sql = `
            SELECT id, codigo, nombre, descripcion, categoria, precio, 
                   cantidad, umbral_inventario_bajo, imagen, etiqueta, 
                   activo, fecha_creacion, fecha_actualizacion
            FROM productos 
            WHERE activo = 1
        `;
        const params = [];

        if (q && q.trim() !== '') {
            sql += ' AND (nombre LIKE ? OR codigo LIKE ?)';
            const busqueda = `%${q.trim()}%`;
            params.push(busqueda, busqueda);
        }

        if (categoria && categoria.trim() !== '' && categoria.toLowerCase() !== 'todo') {
            sql += ' AND categoria = ?';
            params.push(categoria.trim());
        }

        sql += ' ORDER BY id ASC';

        const [productos] = await pool.query(sql, params);
        res.json(productos);
    } catch (error) {
        console.error('Error al consultar productos:', error);
        res.status(500).json({ 
            error: 'Error al conectar con la base de datos. Verifica que la base de datos novastore esté inicializada y las credenciales en .env sean válidas.',
            detalle: error.message
        });
    }
});

// 5. Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [filas] = await pool.query(
            'SELECT * FROM productos WHERE id = ? AND activo = 1',
            [id]
        );

        if (filas.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(filas[0]);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al consultar el producto' });
    }
});

// 6. Registrar un nuevo producto
app.post('/api/productos', async (req, res) => {
    try {
        const { codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta } = req.body;

        // Validaciones en servidor
        if (!codigo || !codigo.trim()) {
            return res.status(400).json({ error: 'El código del producto es obligatorio.' });
        }
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
        }
        if (!categoria || !categoria.trim()) {
            return res.status(400).json({ error: 'La categoría del producto es obligatoria.' });
        }
        if (precio === undefined || precio === '' || isNaN(Number(precio)) || Number(precio) < 0) {
            return res.status(400).json({ error: 'El precio debe ser un número válido mayor o igual a cero.' });
        }
        if (cantidad === undefined || cantidad === '' || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ error: 'La cantidad disponible debe ser un número entero mayor o igual a cero.' });
        }

        const codigoLimpio = codigo.trim().toUpperCase();
        if (codigoLimpio.length > 50) {
            return res.status(400).json({ error: 'El código no puede superar los 50 caracteres.' });
        }
        if (nombre.trim().length > 150) {
            return res.status(400).json({ error: 'El nombre no puede superar los 150 caracteres.' });
        }

        // Verificar código duplicado
        const [existentes] = await pool.query('SELECT id FROM productos WHERE codigo = ?', [codigoLimpio]);
        if (existentes.length > 0) {
            return res.status(409).json({ error: `El código "${codigoLimpio}" ya está registrado en otro producto.` });
        }

        const umbralFinal = (umbral_inventario_bajo !== undefined && umbral_inventario_bajo !== '' && !isNaN(Number(umbral_inventario_bajo)))
            ? Math.max(1, Math.round(Number(umbral_inventario_bajo)))
            : UMBRAL_INVENTARIO_BAJO;

        const sql = `
            INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;

        const [resultado] = await pool.query(sql, [
            codigoLimpio,
            nombre.trim(),
            descripcion ? descripcion.trim() : null,
            categoria.trim(),
            Math.round(Number(precio)),
            Math.round(Number(cantidad)),
            umbralFinal,
            imagen ? imagen.trim() : null,
            etiqueta ? etiqueta.trim() : null
        ]);

        res.status(201).json({
            mensaje: 'Producto registrado exitosamente',
            id: resultado.insertId
        });
    } catch (error) {
        console.error('Error al registrar producto:', error);
        res.status(500).json({ error: 'Error al guardar el producto en la base de datos' });
    }
});

// 7. Editar producto existente
app.put('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta } = req.body;

        if (!codigo || !codigo.trim()) {
            return res.status(400).json({ error: 'El código del producto es obligatorio.' });
        }
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
        }
        if (!categoria || !categoria.trim()) {
            return res.status(400).json({ error: 'La categoría del producto es obligatoria.' });
        }
        if (precio === undefined || precio === '' || isNaN(Number(precio)) || Number(precio) < 0) {
            return res.status(400).json({ error: 'El precio debe ser un número válido mayor o igual a cero.' });
        }
        if (cantidad === undefined || cantidad === '' || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ error: 'La cantidad disponible debe ser un número entero mayor o igual a cero.' });
        }

        const codigoLimpio = codigo.trim().toUpperCase();
        if (codigoLimpio.length > 50) {
            return res.status(400).json({ error: 'El código no puede superar los 50 caracteres.' });
        }
        if (nombre.trim().length > 150) {
            return res.status(400).json({ error: 'El nombre no puede superar los 150 caracteres.' });
        }

        // Verificar si el código ya lo usa OTRO producto
        const [duplicados] = await pool.query('SELECT id FROM productos WHERE codigo = ? AND id != ?', [codigoLimpio, id]);
        if (duplicados.length > 0) {
            return res.status(409).json({ error: `El código "${codigoLimpio}" ya está en uso por otro producto.` });
        }

        const umbralFinal = (umbral_inventario_bajo !== undefined && umbral_inventario_bajo !== '' && !isNaN(Number(umbral_inventario_bajo)))
            ? Math.max(1, Math.round(Number(umbral_inventario_bajo)))
            : UMBRAL_INVENTARIO_BAJO;

        const sql = `
            UPDATE productos 
            SET codigo = ?, nombre = ?, descripcion = ?, categoria = ?, precio = ?, 
                cantidad = ?, umbral_inventario_bajo = ?, imagen = ?, etiqueta = ?
            WHERE id = ? AND activo = 1
        `;

        const [resultado] = await pool.query(sql, [
            codigoLimpio,
            nombre.trim(),
            descripcion ? descripcion.trim() : null,
            categoria.trim(),
            Math.round(Number(precio)),
            Math.round(Number(cantidad)),
            umbralFinal,
            imagen ? imagen.trim() : null,
            etiqueta ? etiqueta.trim() : null,
            id
        ]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado o inactivo.' });
        }

        res.json({ mensaje: 'Producto actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
});

// 8. Eliminación lógica (Soft Delete)
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE productos SET activo = 0, fecha_eliminacion = NOW() WHERE id = ? AND activo = 1',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado o ya eliminado.' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente (eliminación lógica)' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al procesar la eliminación del producto' });
    }
});

// ====================================================================
// RUTAS API — MÓDULO 2: CARRITO DE COMPRAS (VALIDACIÓN DE STOCK Y COMPRA)
// ====================================================================

/**
 * [MÓDULO 2] Normaliza y agrupa los ítems enviados desde el carrito,
 * validando que cada ID y cantidad solicitada sean enteros positivos.
 */
function normalizarItemsCarrito(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'El carrito está vacío o tiene un formato inválido.' };
    }

    const mapaCantidades = new Map();
    for (const item of items) {
        const id = Number(item?.id);
        const cantidad = Number(item?.cantidad);

        if (!Number.isInteger(id) || id <= 0) {
            return { error: 'Uno de los productos del carrito tiene un identificador inválido.' };
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return { error: 'La cantidad solicitada de cada producto debe ser un entero mayor a cero.' };
        }

        mapaCantidades.set(id, (mapaCantidades.get(id) || 0) + cantidad);
    }

    const normalizados = Array.from(mapaCantidades.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([id, cantidad]) => ({ id, cantidad }));

    return { items: normalizados };
}

// 9. Validar existencias disponibles para los productos del carrito
app.post('/api/carrito/validar', async (req, res) => {
    try {
        const { error: errorNormalizacion, items } = normalizarItemsCarrito(req.body?.items);
        if (errorNormalizacion) {
            return res.status(400).json({ valido: false, error: errorNormalizacion, errores: [errorNormalizacion] });
        }

        const ids = items.map((i) => i.id);
        const [productos] = await pool.query(
            'SELECT id, codigo, nombre, precio, cantidad, imagen, activo FROM productos WHERE id IN (?)',
            [ids]
        );

        const mapaProductos = new Map(productos.map((p) => [p.id, p]));
        const errores = [];
        const itemsValidados = [];

        for (const item of items) {
            const producto = mapaProductos.get(item.id);
            if (!producto || producto.activo !== 1) {
                errores.push(`El producto con ID ${item.id} ya no está disponible en el catálogo.`);
                itemsValidados.push({
                    id: item.id,
                    disponible: false,
                    stock_disponible: 0,
                    cantidad_solicitada: item.cantidad,
                    cantidad_ajustada: 0
                });
                continue;
            }

            if (producto.cantidad <= 0) {
                errores.push(`"${producto.nombre}" se encuentra agotado (0 unidades disponibles).`);
            } else if (item.cantidad > producto.cantidad) {
                errores.push(
                    `Stock insuficiente para "${producto.nombre}": solicitaste ${item.cantidad}, pero solo hay ${producto.cantidad} disponible${producto.cantidad === 1 ? '' : 's'}.`
                );
            }

            itemsValidados.push({
                id: producto.id,
                codigo: producto.codigo,
                nombre: producto.nombre,
                precio: producto.precio,
                imagen: producto.imagen,
                disponible: producto.cantidad > 0,
                stock_disponible: producto.cantidad,
                cantidad_solicitada: item.cantidad,
                cantidad_ajustada: Math.min(item.cantidad, producto.cantidad)
            });
        }

        res.json({
            valido: errores.length === 0,
            errores,
            items: itemsValidados
        });
    } catch (error) {
        console.error('Error al validar carrito:', error);
        res.status(500).json({ valido: false, error: 'Error al validar las existencias del carrito.' });
    }
});

// 10. Confirmar compra: valida stock con bloqueo transaccional, descuenta existencias y registra el pedido
app.post('/api/pedidos', async (req, res) => {
    let conn;
    try {
        const { error: errorNormalizacion, items } = normalizarItemsCarrito(req.body?.items);
        if (errorNormalizacion) {
            return res.status(400).json({ error: errorNormalizacion });
        }

        await asegurarTablasPedidos();

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const ids = items.map((i) => i.id);
        const [productos] = await conn.query(
            'SELECT id, codigo, nombre, precio, cantidad, activo FROM productos WHERE id IN (?) ORDER BY id ASC FOR UPDATE',
            [ids]
        );

        const mapaProductos = new Map(productos.map((p) => [p.id, p]));
        const errores = [];
        const lineasPedido = [];

        for (const item of items) {
            const producto = mapaProductos.get(item.id);
            if (!producto || producto.activo !== 1) {
                errores.push(`El producto con ID ${item.id} ya no está disponible en el catálogo.`);
                continue;
            }
            if (producto.cantidad <= 0) {
                errores.push(`"${producto.nombre}" está agotado (0 existencias).`);
                continue;
            }
            if (item.cantidad > producto.cantidad) {
                errores.push(
                    `No hay suficientes existencias de "${producto.nombre}". Solicitado: ${item.cantidad}, disponible: ${producto.cantidad}.`
                );
                continue;
            }

            lineasPedido.push({
                producto_id: producto.id,
                codigo_producto: producto.codigo,
                nombre_producto: producto.nombre,
                precio_unitario: producto.precio,
                cantidad: item.cantidad,
                subtotal_linea: producto.precio * item.cantidad
            });
        }

        if (errores.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                error: errores[0],
                detalles: errores
            });
        }

        const subtotal = lineasPedido.reduce((acc, l) => acc + l.subtotal_linea, 0);
        const descuento = subtotal >= UMBRAL_DESCUENTO ? Math.round(subtotal * PORCENTAJE_DESCUENTO) : 0;
        const envio = subtotal >= UMBRAL_ENVIO_GRATIS ? 0 : ADICIONAL_ENVIO;
        const total = subtotal - descuento + envio;

        const codigoTemporal = `TMP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const [resPedido] = await conn.query(
            'INSERT INTO pedidos (codigo_pedido, subtotal, descuento, envio, total) VALUES (?, ?, ?, ?, ?)',
            [codigoTemporal, subtotal, descuento, envio, total]
        );

        const pedidoId = resPedido.insertId;
        const codigoPedido = `PED-${String(pedidoId).padStart(5, '0')}`;
        await conn.query('UPDATE pedidos SET codigo_pedido = ? WHERE id = ?', [codigoPedido, pedidoId]);

        for (const linea of lineasPedido) {
            await conn.query(
                `INSERT INTO detalle_pedidos (pedido_id, producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad, subtotal_linea)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    pedidoId,
                    linea.producto_id,
                    linea.codigo_producto,
                    linea.nombre_producto,
                    linea.precio_unitario,
                    linea.cantidad,
                    linea.subtotal_linea
                ]
            );

            await conn.query(
                'UPDATE productos SET cantidad = cantidad - ? WHERE id = ?',
                [linea.cantidad, linea.producto_id]
            );
        }

        const [[pedidoCreado]] = await conn.query(
            'SELECT id, codigo_pedido, subtotal, descuento, envio, total, fecha_creacion FROM pedidos WHERE id = ?',
            [pedidoId]
        );

        await conn.commit();

        res.status(201).json({
            mensaje: `Pedido ${codigoPedido} registrado con éxito`,
            pedido: {
                ...pedidoCreado,
                items: lineasPedido
            }
        });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (e) {}
        }
        console.error('Error al procesar el pedido:', error);
        res.status(500).json({ error: 'Error al procesar la compra en la base de datos.' });
    } finally {
        if (conn) conn.release();
    }
});

// ====================================================================
// RUTAS API — MÓDULO 3: CONSULTA DE PEDIDOS
// ====================================================================

/**
 * [MÓDULO 3] Adjunta a cada pedido su lista de productos incluidos y cantidades
 * consultando la tabla detalle_pedidos en una única consulta parametrizada.
 */
async function adjuntarDetallesAPedidos(pedidos) {
    if (!Array.isArray(pedidos) || pedidos.length === 0) return [];

    const idsPedidos = pedidos.map((p) => p.id);
    const [detalles] = await pool.query(
        `SELECT id, pedido_id, producto_id, codigo_producto, nombre_producto,
                precio_unitario, cantidad, subtotal_linea
         FROM detalle_pedidos
         WHERE pedido_id IN (?)
         ORDER BY id ASC`,
        [idsPedidos]
    );

    const mapaDetalles = new Map();
    for (const det of detalles) {
        if (!mapaDetalles.has(det.pedido_id)) {
            mapaDetalles.set(det.pedido_id, []);
        }
        mapaDetalles.get(det.pedido_id).push(det);
    }

    return pedidos.map((pedido) => {
        const items = mapaDetalles.get(pedido.id) || [];
        const cantidad_total_productos = items.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
        return {
            ...pedido,
            cantidad_total_productos,
            items
        };
    });
}

// 11. Consultar todos los pedidos registrados (con filtro opcional ?q= por código de pedido o producto)
app.get('/api/pedidos', async (req, res) => {
    try {
        await asegurarTablasPedidos();

        const { q } = req.query;
        let sql = `
            SELECT DISTINCT p.id, p.codigo_pedido, p.subtotal, p.descuento, p.envio, p.total, p.fecha_creacion
            FROM pedidos p
        `;
        const params = [];

        if (q && q.trim() !== '') {
            const busqueda = `%${q.trim()}%`;
            sql += `
                LEFT JOIN detalle_pedidos dp ON dp.pedido_id = p.id
                WHERE p.codigo_pedido LIKE ?
                   OR CAST(p.id AS CHAR) LIKE ?
                   OR dp.nombre_producto LIKE ?
                   OR dp.codigo_producto LIKE ?
            `;
            params.push(busqueda, busqueda, busqueda, busqueda);
        }

        sql += ' ORDER BY p.fecha_creacion DESC, p.id DESC';

        const [pedidos] = await pool.query(sql, params);
        const pedidosCompletos = await adjuntarDetallesAPedidos(pedidos);
        res.json(pedidosCompletos);
    } catch (error) {
        console.error('Error al consultar pedidos:', error);
        res.status(500).json({ error: 'Error al consultar los pedidos registrados en la base de datos.' });
    }
});

// 12. Consultar un pedido específico por ID numérico o código (ej. PED-00001)
app.get('/api/pedidos/:identificador', async (req, res) => {
    try {
        await asegurarTablasPedidos();

        const { identificador } = req.params;
        const esNumero = /^\d+$/.test(identificador);
        const [pedidos] = await pool.query(
            esNumero
                ? 'SELECT id, codigo_pedido, subtotal, descuento, envio, total, fecha_creacion FROM pedidos WHERE id = ?'
                : 'SELECT id, codigo_pedido, subtotal, descuento, envio, total, fecha_creacion FROM pedidos WHERE codigo_pedido = ?',
            [esNumero ? Number(identificador) : identificador.trim().toUpperCase()]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }

        const [pedidoCompleto] = await adjuntarDetallesAPedidos(pedidos);
        res.json(pedidoCompleto);
    } catch (error) {
        console.error('Error al consultar el pedido:', error);
        res.status(500).json({ error: 'Error al consultar el detalle del pedido.' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Servidor NovaStore listo en: http://localhost:${PORT}`);
    console.log(` Conectando a MariaDB: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'novastore'}`);
    console.log(`=======================================================`);
});
