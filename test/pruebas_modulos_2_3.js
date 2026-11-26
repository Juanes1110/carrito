// ====================================================================
// SUITE DE PRUEBAS AUTOMATIZADAS — MÓDULO 2 (CARRITO) Y MÓDULO 3 (PEDIDOS)
// ====================================================================

const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function ejecutarPruebasModulos2y3() {
    console.log('====================================================================');
    console.log('INICIANDO PRUEBAS — MÓDULO 2 (STOCK CARRITO) Y MÓDULO 3 (PEDIDOS)');
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

    // Crear producto temporal con stock controlado = 3 unidades
    let idProductoTemporal = null;
    const codigoTemporal = `PRD-M2M3-${Date.now()}`;

    await test('Preparación: Crear producto temporal con stock = 3', async () => {
        const res = await fetch(`${BASE_URL}/api/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: codigoTemporal,
                nombre: 'Producto Prueba Stock y Pedidos',
                descripcion: 'Producto temporal para validar Módulo 2 y Módulo 3.',
                categoria: 'Tecnología',
                precio: 50000,
                cantidad: 3,
                umbral_inventario_bajo: 2
            })
        });
        assert.strictEqual(res.status, 201, `Esperado 201, recibido ${res.status}`);
        const data = await res.json();
        assert.ok(data.id, 'Debe devolver el ID del producto temporal');
        idProductoTemporal = data.id;
    });

    // ----------------------------------------------------------------
    // MÓDULO 2: VALIDACIÓN DE EXISTENCIAS EN CARRITO
    // ----------------------------------------------------------------
    await test('Módulo 2: Validar cantidad dentro del stock disponible (POST /api/carrito/validar)', async () => {
        const res = await fetch(`${BASE_URL}/api/carrito/validar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: idProductoTemporal, cantidad: 2 }]
            })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.valido, true, 'El carrito debe ser válido cuando cantidad <= stock');
        assert.strictEqual(data.errores.length, 0);
        assert.strictEqual(data.items[0].cantidad_ajustada, 2);
    });

    await test('Módulo 2: Detectar exceso sobre existencias disponibles (POST /api/carrito/validar)', async () => {
        const res = await fetch(`${BASE_URL}/api/carrito/validar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: idProductoTemporal, cantidad: 5 }]
            })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.valido, false, 'Debe marcar valido=false si supera el stock (5 > 3)');
        assert.ok(data.errores.length > 0, 'Debe incluir mensaje de error de stock insuficiente');
        assert.strictEqual(data.items[0].stock_disponible, 3);
        assert.strictEqual(data.items[0].cantidad_ajustada, 3);
    });

    await test('Módulo 2: Bloquear compra si supera existencias (POST /api/pedidos -> 409)', async () => {
        const res = await fetch(`${BASE_URL}/api/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: idProductoTemporal, cantidad: 4 }]
            })
        });
        assert.strictEqual(res.status, 409, `Debe rechazar compra con 409 Conflict, recibido ${res.status}`);
    });

    let pedidoCreado = null;
    await test('Módulo 2: Confirmar compra válida y descontar stock en BD (POST /api/pedidos -> 201)', async () => {
        const res = await fetch(`${BASE_URL}/api/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: idProductoTemporal, cantidad: 2 }]
            })
        });
        assert.strictEqual(res.status, 201, `Esperado 201, recibido ${res.status}`);
        const data = await res.json();
        assert.ok(data.pedido && data.pedido.codigo_pedido, 'Debe retornar el pedido con codigo_pedido');
        assert.strictEqual(data.pedido.total, 100000);
        pedidoCreado = data.pedido;

        // Verificar que el stock en BD pasó de 3 a 1
        const resProd = await fetch(`${BASE_URL}/api/productos/${idProductoTemporal}`);
        const prodActualizado = await resProd.json();
        assert.strictEqual(prodActualizado.cantidad, 1, 'El stock debe haberse descontado de 3 a 1');
    });

    // ----------------------------------------------------------------
    // MÓDULO 3: CONSULTA DE PEDIDOS
    // ----------------------------------------------------------------
    await test('Módulo 3: Consultar listado de pedidos con identificador, fecha, productos, cantidades y total', async () => {
        const res = await fetch(`${BASE_URL}/api/pedidos`);
        assert.strictEqual(res.status, 200);
        const pedidos = await res.json();
        assert.ok(Array.isArray(pedidos), 'Debe retornar un arreglo de pedidos');

        const encontrado = pedidos.find((p) => p.codigo_pedido === pedidoCreado.codigo_pedido);
        assert.ok(encontrado, 'El pedido recién registrado debe aparecer en GET /api/pedidos');
        assert.ok(encontrado.fecha_creacion, 'Debe incluir fecha de realización');
        assert.strictEqual(encontrado.total, 100000, 'Debe incluir total de la compra');
        assert.ok(Array.isArray(encontrado.items) && encontrado.items.length === 1, 'Debe incluir los productos del pedido');
        assert.strictEqual(encontrado.items[0].codigo_producto, codigoTemporal);
        assert.strictEqual(encontrado.items[0].cantidad, 2);
    });

    await test('Módulo 3: Consultar pedido por código y filtro ?q= (GET /api/pedidos)', async () => {
        const resFiltro = await fetch(`${BASE_URL}/api/pedidos?q=${encodeURIComponent(pedidoCreado.codigo_pedido)}`);
        assert.strictEqual(resFiltro.status, 200);
        const lista = await resFiltro.json();
        assert.strictEqual(lista.length, 1);
        assert.strictEqual(lista[0].codigo_pedido, pedidoCreado.codigo_pedido);

        const resDetalle = await fetch(`${BASE_URL}/api/pedidos/${encodeURIComponent(pedidoCreado.codigo_pedido)}`);
        assert.strictEqual(resDetalle.status, 200);
        const detalle = await resDetalle.json();
        assert.strictEqual(detalle.codigo_pedido, pedidoCreado.codigo_pedido);
    });

    // Limpieza lógica del producto temporal
    await test('Limpieza: Eliminar lógicamente producto temporal', async () => {
        if (!idProductoTemporal) return;
        const res = await fetch(`${BASE_URL}/api/productos/${idProductoTemporal}`, { method: 'DELETE' });
        assert.strictEqual(res.status, 200);
    });

    console.log('\n====================================================================');
    console.log(`RESULTADO DE LA SUITE (M2 y M3): ${pasadas}/${total} pruebas pasadas (${fallidas} fallidas)`);
    console.log('====================================================================');

    if (fallidas > 0) {
        process.exit(1);
    }
}

ejecutarPruebasModulos2y3().catch((e) => {
    console.error('Error fatal ejecutando pruebas de Módulos 2 y 3:', e);
    process.exit(1);
});
