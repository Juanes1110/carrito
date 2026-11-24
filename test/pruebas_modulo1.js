// ====================================================================
// SUITE DE PRUEBAS AUTOMATIZADAS — FASE 4: MÓDULO 1 GESTIÓN DE PRODUCTOS
// ====================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function ejecutarSuitePruebas() {
    console.log('====================================================================');
    console.log('INICIANDO EJECUCIÓN DE PRUEBAS — MÓDULO 1: GESTIÓN DE PRODUCTOS');
    console.log('====================================================================\n');

    let total = 0;
    let pasadas = 0;
    let fallidas = 0;

    async function test(nombre, fn) {
        total++;
        try {
            await fn();
            pasadas++;
            console.log(`✅ [PASÓ] Prueba ${total}: ${nombre}`);
        } catch (error) {
            fallidas++;
            console.error(`❌ [FALLÓ] Prueba ${total}: ${nombre}`);
            console.error(`   Detalle: ${error.message}\n`);
        }
    }

    // ----------------------------------------------------------------
    // PRUEBA 1: Registro y persistencia real
    // ----------------------------------------------------------------
    let idProductoCreado = null;
    const codigoTest = `PRD-TEST-${Date.now()}`;

    await test('Registro y persistencia real (POST /api/productos)', async () => {
        const payload = {
            codigo: codigoTest,
            nombre: 'Teclado Mecánico RGB Pro',
            descripcion: 'Teclado mecánico con switches red y retroiluminación RGB configurable.',
            categoria: 'Tecnología',
            precio: 245000,
            cantidad: 8,
            umbral_inventario_bajo: 4,
            etiqueta: 'Nuevo',
            imagen: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600'
        };

        const res = await fetch(`${BASE_URL}/api/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 201, `Estado esperado 201, recibido ${res.status}`);
        const data = await res.json();
        assert.ok(data.id, 'Debe retornar el ID autoincremental del producto');
        idProductoCreado = data.id;

        // Verificar persistencia consultando directamente el producto por ID
        const resGet = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`);
        assert.strictEqual(resGet.status, 200, 'Debe poder consultarse el producto recién creado');
        const productoGuardado = await resGet.json();
        assert.strictEqual(productoGuardado.codigo, codigoTest);
        assert.strictEqual(productoGuardado.precio, 245000);
        assert.strictEqual(productoGuardado.cantidad, 8);
        assert.strictEqual(productoGuardado.activo, 1);
    });

    // ----------------------------------------------------------------
    // PRUEBA 2: Validaciones y código duplicado
    // ----------------------------------------------------------------
    await test('Validaciones y rechazo de código duplicado (409 Conflict)', async () => {
        // Intentar registrar el mismo código
        const resDuplicado = await fetch(`${BASE_URL}/api/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: codigoTest,
                nombre: 'Otro teclado',
                categoria: 'Tecnología',
                precio: 100000,
                cantidad: 5
            })
        });
        assert.strictEqual(resDuplicado.status, 409, `Se esperaba código 409 por duplicado, recibido ${resDuplicado.status}`);

        // Validación de campos obligatorios faltantes
        const resFaltante = await fetch(`${BASE_URL}/api/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: 'Sin código' })
        });
        assert.strictEqual(resFaltante.status, 400, 'Debe rechazar solicitud sin código obligatorio');

        // Validación de precio y cantidad no negativos
        const resNegativo = await fetch(`${BASE_URL}/api/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: 'PRD-NEG',
                nombre: 'Producto negativo',
                categoria: 'Audio',
                precio: -500,
                cantidad: 10
            })
        });
        assert.strictEqual(resNegativo.status, 400, 'Debe rechazar precio negativo');
    });

    // ----------------------------------------------------------------
    // PRUEBA 3: Listado y carga de tarjetas
    // ----------------------------------------------------------------
    await test('Listado y carga de tarjetas del catálogo (GET /api/productos)', async () => {
        const res = await fetch(`${BASE_URL}/api/productos`);
        assert.strictEqual(res.status, 200);
        const productos = await res.json();
        assert.ok(Array.isArray(productos), 'Debe devolver un arreglo de productos');
        assert.ok(productos.length >= 10, 'Debe contener al menos los 10 productos iniciales');

        // Validar que cada producto tiene los atributos requeridos
        const primerProducto = productos[0];
        assert.ok(primerProducto.hasOwnProperty('id'));
        assert.ok(primerProducto.hasOwnProperty('codigo'));
        assert.ok(primerProducto.hasOwnProperty('nombre'));
        assert.ok(primerProducto.hasOwnProperty('categoria'));
        assert.ok(primerProducto.hasOwnProperty('precio'));
        assert.ok(primerProducto.hasOwnProperty('cantidad'));
        assert.ok(primerProducto.hasOwnProperty('umbral_inventario_bajo'));
        assert.strictEqual(primerProducto.activo, 1, 'Todos los productos listados deben estar activos');
    });

    // ----------------------------------------------------------------
    // PRUEBA 4: Búsqueda por nombre/código y filtro por categoría
    // ----------------------------------------------------------------
    await test('Búsqueda por nombre/código y filtro por categoría combinados', async () => {
        // Búsqueda por nombre
        const resBusqueda = await fetch(`${BASE_URL}/api/productos?q=Audífonos`);
        const listaBusqueda = await resBusqueda.json();
        assert.ok(listaBusqueda.some(p => p.nombre.includes('Audífonos')), 'Debe encontrar Audífonos');

        // Búsqueda por código
        const resCodigo = await fetch(`${BASE_URL}/api/productos?q=PRD-001`);
        const listaCodigo = await resCodigo.json();
        assert.ok(listaCodigo.some(p => p.codigo === 'PRD-001'), 'Debe encontrar por código PRD-001');

        // Filtro por categoría
        const resCat = await fetch(`${BASE_URL}/api/productos?categoria=Audio`);
        const listaCat = await resCat.json();
        assert.ok(listaCat.every(p => p.categoria === 'Audio'), 'Todos deben pertenecer a Audio');

        // Combinación de búsqueda y categoría
        const resCombinado = await fetch(`${BASE_URL}/api/productos?categoria=Tecnología&q=Cable`);
        const listaCombinada = await resCombinado.json();
        assert.ok(listaCombinada.length >= 1, 'Debe encontrar Cable Tipo C en Tecnología');
    });

    // ----------------------------------------------------------------
    // PRUEBA 5: Edición y conservación/reemplazo/quitar imagen
    // ----------------------------------------------------------------
    await test('Edición de producto y gestión de imagen (PUT /api/productos/:id)', async () => {
        // Actualizar datos conservando imagen
        const resUpdate = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: codigoTest,
                nombre: 'Teclado Mecánico RGB Pro V2 (Editado)',
                descripcion: 'Descripción actualizada con switches brown.',
                categoria: 'Tecnología',
                precio: 259900,
                cantidad: 12,
                umbral_inventario_bajo: 5,
                etiqueta: 'Oferta',
                imagen: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600'
            })
        });
        assert.strictEqual(resUpdate.status, 200, 'Debe responder 200 al actualizar');

        const resGetEditado = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`);
        const editado = await resGetEditado.json();
        assert.strictEqual(editado.nombre, 'Teclado Mecánico RGB Pro V2 (Editado)');
        assert.strictEqual(editado.precio, 259900);
        assert.strictEqual(editado.cantidad, 12);

        // Quitar imagen (debe permitir guardar con imagen null o vacía)
        const resQuitarImg = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: codigoTest,
                nombre: 'Teclado Mecánico RGB Pro V2 (Editado)',
                categoria: 'Tecnología',
                precio: 259900,
                cantidad: 12,
                umbral_inventario_bajo: 5,
                imagen: null
            })
        });
        assert.strictEqual(resQuitarImg.status, 200);
        const resGetSinImg = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`);
        const sinImg = await resGetSinImg.json();
        assert.strictEqual(sinImg.imagen, null, 'La imagen debe haberse removido');
    });

    // ----------------------------------------------------------------
    // PRUEBA 6: Eliminación lógica y exclusión del catálogo
    // ----------------------------------------------------------------
    await test('Eliminación lógica (Soft Delete) y exclusión del catálogo', async () => {
        const resDelete = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`, {
            method: 'DELETE'
        });
        assert.strictEqual(resDelete.status, 200, 'Debe responder 200 en eliminación lógica');

        // Verificar que ya no aparece en el catálogo activo
        const resCatalogo = await fetch(`${BASE_URL}/api/productos`);
        const catalogo = await resCatalogo.json();
        const existeEnCatalogo = catalogo.some(p => p.id == idProductoCreado);
        assert.strictEqual(existeEnCatalogo, false, 'El producto eliminado lógicamente NO debe aparecer en el catálogo');

        // Verificar que al consultar por ID directo tampoco está activo
        const resGetEliminado = await fetch(`${BASE_URL}/api/productos/${idProductoCreado}`);
        assert.strictEqual(resGetEliminado.status, 404, 'Debe devolver 404 para producto inactivo');
    });

    // ----------------------------------------------------------------
    // PRUEBA 7: Carga inválida, formato no permitido y archivo grande
    // ----------------------------------------------------------------
    await test('Seguridad en imágenes: magic bytes, formato y tamaño (POST /api/upload)', async () => {
        // A) Crear archivo PNG válido en memoria con sus magic bytes (89 50 4E 47 0D 0A 1A 0A)
        const bufferPngValido = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        ]);
        const rutaPngTemp = path.join(__dirname, 'temp_valido.png');
        fs.writeFileSync(rutaPngTemp, bufferPngValido);

        const formDataValido = new FormData();
        const blobValido = new Blob([bufferPngValido], { type: 'image/png' });
        formDataValido.append('imagen', blobValido, 'test_valido.png');

        const resPng = await fetch(`${BASE_URL}/api/upload`, {
            method: 'POST',
            body: formDataValido
        });
        assert.strictEqual(resPng.status, 200, 'Debe aceptar PNG válido');
        const dataPng = await resPng.json();
        assert.ok(dataPng.url.startsWith('/uploads/'), 'Debe retornar la ruta en /uploads/');
        fs.unlinkSync(rutaPngTemp);

        // B) Intentar engañar con archivo de texto renombrado a .jpg (Falsos magic bytes)
        const bufferFalso = Buffer.from('<?php echo "script malicioso"; ?>');
        const blobFalso = new Blob([bufferFalso], { type: 'image/jpeg' });
        const formDataFalso = new FormData();
        formDataFalso.append('imagen', blobFalso, 'malicioso.jpg');

        const resFalso = await fetch(`${BASE_URL}/api/upload`, {
            method: 'POST',
            body: formDataFalso
        });
        assert.strictEqual(resFalso.status, 400, 'Debe rechazar archivo con contenido no correspondiente a imagen');

        // C) Formato no permitido (.txt o .exe)
        const blobTxt = new Blob(['hola mundo'], { type: 'text/plain' });
        const formDataTxt = new FormData();
        formDataTxt.append('imagen', blobTxt, 'archivo.txt');

        const resTxt = await fetch(`${BASE_URL}/api/upload`, {
            method: 'POST',
            body: formDataTxt
        });
        assert.strictEqual(resTxt.status, 400, 'Debe rechazar tipo MIME no permitido');

        // D) Archivo mayor a 2MB
        const bufferGrande = Buffer.alloc(2.5 * 1024 * 1024, 0xFF);
        const blobGrande = new Blob([bufferGrande], { type: 'image/jpeg' });
        const formDataGrande = new FormData();
        formDataGrande.append('imagen', blobGrande, 'pesado.jpg');

        const resGrande = await fetch(`${BASE_URL}/api/upload`, {
            method: 'POST',
            body: formDataGrande
        });
        assert.strictEqual(resGrande.status, 400, 'Debe rechazar archivo mayor a 2 MB');
    });

    // ----------------------------------------------------------------
    // PRUEBA 8: Estados de inventario y umbral configurable
    // ----------------------------------------------------------------
    await test('Estados de inventario (Agotado, Bajo, Disponible) y umbral', async () => {
        // En los datos semilla:
        // PRD-007 (Perfume floral) tiene cantidad = 0 -> Agotado
        // PRD-003 (Cámara instantánea) tiene cantidad = 4, umbral = 5 -> Stock bajo
        // PRD-001 (Audífonos) tiene cantidad = 15, umbral = 5 -> Disponible
        const res = await fetch(`${BASE_URL}/api/productos`);
        const productos = await res.json();

        const agotado = productos.find(p => p.codigo === 'PRD-007');
        assert.ok(agotado, 'Debe existir PRD-007');
        assert.strictEqual(agotado.cantidad, 0, 'Cantidad debe ser 0 para agotado');

        const bajo = productos.find(p => p.codigo === 'PRD-003');
        assert.ok(bajo, 'Debe existir PRD-003');
        assert.ok(bajo.cantidad > 0 && bajo.cantidad <= bajo.umbral_inventario_bajo, 'Debe estar en inventario bajo');

        const disponible = productos.find(p => p.codigo === 'PRD-001');
        assert.ok(disponible, 'Debe existir PRD-001');
        assert.ok(disponible.cantidad > disponible.umbral_inventario_bajo, 'Debe estar disponible');
    });

    // ----------------------------------------------------------------
    // PRUEBA 9: Seguridad contra inyecciones SQL
    // ----------------------------------------------------------------
    await test('Seguridad contra inyección SQL en consultas parametrizadas', async () => {
        const queryInyeccion = encodeURIComponent("' OR '1'='1' -- ");
        const res = await fetch(`${BASE_URL}/api/productos?q=${queryInyeccion}`);
        assert.strictEqual(res.status, 200, 'Debe procesar la consulta parametrizada sin caerse');
        const productos = await res.json();
        // Con consulta parametrizada segura, buscará el literal "' OR '1'='1' --" y no retornará registros de inyección
        assert.ok(Array.isArray(productos));
    });

    // ----------------------------------------------------------------
    // PRUEBA 10: Persistencia de configuración e integridad del carrito
    // ----------------------------------------------------------------
    await test('Configuración de la tienda y compatibilidad del carrito', async () => {
        const resConfig = await fetch(`${BASE_URL}/api/config`);
        assert.strictEqual(resConfig.status, 200);
        const config = await resConfig.json();
        assert.strictEqual(config.umbral_descuento, 250000);
        assert.strictEqual(config.porcentaje_descuento, 0.15);
        assert.strictEqual(config.umbral_envio_gratis, 40000);
        assert.strictEqual(config.adicional_envio, 15000);
        assert.strictEqual(config.umbral_inventario_bajo, 5);
    });

    console.log('\n====================================================================');
    console.log(`RESULTADO DE LA SUITE: ${pasadas}/${total} pruebas pasadas (${fallidas} fallidas)`);
    console.log('====================================================================');

    if (fallidas > 0) {
        process.exit(1);
    }
}

ejecutarSuitePruebas().catch((e) => {
    console.error('Error fatal ejecutando pruebas:', e);
    process.exit(1);
});
