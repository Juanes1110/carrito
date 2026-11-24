// ====================================================================
// NOVA STORE - Servidor Backend (Node.js + Express + MariaDB / MySQL)
// ====================================================================

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

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

// Middlewares para procesar JSON y servir archivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// --------------------------------------------------------------------
// RUTAS API — MÓDULO 1: GESTIÓN DE PRODUCTOS
// --------------------------------------------------------------------

// 1. Obtener configuración general de la tienda
app.get('/api/config', (req, res) => {
    res.json({
        umbral_descuento: UMBRAL_DESCUENTO,
        porcentaje_descuento: PORCENTAJE_DESCUENTO,
        umbral_envio_gratis: UMBRAL_ENVIO_GRATIS,
        adicional_envio: ADICIONAL_ENVIO,
        umbral_inventario_bajo: UMBRAL_INVENTARIO_BAJO
    });
});

// 2. Obtener lista de categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const [categorias] = await pool.query('SELECT id, nombre, slug FROM categorias ORDER BY nombre ASC');
        res.json(categorias);
    } catch (error) {
        console.error('Error al consultar categorías:', error);
        res.status(500).json({ error: 'Error al obtener las categorías' });
    }
});

// 3. Consultar productos con filtros combinados (búsqueda por nombre/código y filtro por categoría)
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
        res.status(500).json({ error: 'Error al obtener los productos de la base de datos' });
    }
});

// 4. Obtener un producto por ID
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

// 5. Registrar un nuevo producto
app.post('/api/productos', async (req, res) => {
    try {
        const { codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta } = req.body;

        // Validaciones básicas en servidor
        if (!codigo || !nombre || !categoria || precio === undefined || cantidad === undefined) {
            return res.status(400).json({ error: 'Los campos código, nombre, categoría, precio y cantidad son obligatorios.' });
        }

        if (Number(precio) < 0 || Number(cantidad) < 0) {
            return res.status(400).json({ error: 'El precio y la cantidad no pueden ser negativos.' });
        }

        // Verificar código duplicado
        const [existentes] = await pool.query('SELECT id FROM productos WHERE codigo = ?', [codigo.trim()]);
        if (existentes.length > 0) {
            return res.status(409).json({ error: `El código "${codigo}" ya está registrado en otro producto.` });
        }

        const sql = `
            INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;

        const [resultado] = await pool.query(sql, [
            codigo.trim(),
            nombre.trim(),
            descripcion ? descripcion.trim() : null,
            categoria.trim(),
            Math.round(Number(precio)),
            Math.round(Number(cantidad)),
            umbral_inventario_bajo !== undefined ? Math.round(Number(umbral_inventario_bajo)) : UMBRAL_INVENTARIO_BAJO,
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

// 6. Editar producto existente
app.put('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, categoria, precio, cantidad, umbral_inventario_bajo, imagen, etiqueta } = req.body;

        if (!codigo || !nombre || !categoria || precio === undefined || cantidad === undefined) {
            return res.status(400).json({ error: 'Los campos código, nombre, categoría, precio y cantidad son obligatorios.' });
        }

        if (Number(precio) < 0 || Number(cantidad) < 0) {
            return res.status(400).json({ error: 'El precio y la cantidad no pueden ser negativos.' });
        }

        // Verificar si el código ya lo usa OTRO producto
        const [duplicados] = await pool.query('SELECT id FROM productos WHERE codigo = ? AND id != ?', [codigo.trim(), id]);
        if (duplicados.length > 0) {
            return res.status(409).json({ error: `El código "${codigo}" ya está en uso por otro producto.` });
        }

        const sql = `
            UPDATE productos 
            SET codigo = ?, nombre = ?, descripcion = ?, categoria = ?, precio = ?, 
                cantidad = ?, umbral_inventario_bajo = ?, imagen = ?, etiqueta = ?
            WHERE id = ? AND activo = 1
        `;

        const [resultado] = await pool.query(sql, [
            codigo.trim(),
            nombre.trim(),
            descripcion ? descripcion.trim() : null,
            categoria.trim(),
            Math.round(Number(precio)),
            Math.round(Number(cantidad)),
            umbral_inventario_bajo !== undefined ? Math.round(Number(umbral_inventario_bajo)) : UMBRAL_INVENTARIO_BAJO,
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

// 7. Eliminación lógica (Soft Delete)
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Servidor NovaStore listo en: http://localhost:${PORT}`);
    console.log(` Conectando a MariaDB: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'novastore'}`);
    console.log(`=======================================================`);
});
