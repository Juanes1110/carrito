// ====================================================================
// NOVA STORE - Lógica del Cliente (Módulo 1, Módulo 2 y Módulo 3)
// Nombres: Juan Esteban Colorado & Daniel Alexander Cobo
// ====================================================================
// ESTRUCTURA DEL ARCHIVO:
//   - SECCIÓN 0: Configuración global y utilidades compartidas
//   - SECCIÓN 1: MÓDULO 2 — Carrito de compras (validación de stock y checkout)
//   - SECCIÓN 2: MÓDULO 1 — Gestión de productos (catálogo, CRUD, búsqueda y filtros)
//   - SECCIÓN 3: MÓDULO 3 — Consulta de pedidos registrados
//   - SECCIÓN 4: Inicialización general al cargar el DOM
// ====================================================================

// --------------------------------------------------------------------
// SECCIÓN 0: CONFIGURACIÓN GLOBAL Y UTILIDADES COMPARTIDAS
// --------------------------------------------------------------------

// Base URL para API (permite funcionar si se abre desde Live Server en puerto 5500 o similar)
const API_BASE = (window.location.protocol === 'file:' || (window.location.port !== '3000' && window.location.port !== ''))
    ? 'http://localhost:3000'
    : '';

const toast = document.getElementById("toast");
let timeoutToast = null;

/**
 * Muestra una notificación flotante temporal ("exito", "alerta" o "error").
 */
function mostrarToast(mensaje, tipo = "exito") {
    if (!toast) return;
    clearTimeout(timeoutToast);
    toast.textContent = mensaje;
    toast.className = `toast activo toast--${tipo}`;
    timeoutToast = setTimeout(() => {
        toast.classList.remove("activo");
    }, 3500);
}

const formatoPesos = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

function formatear(valor) {
    return formatoPesos.format(valor || 0);
}

function escaparHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// --------------------------------------------------------------------
// SECCIÓN 1: MÓDULO 2 — CARRITO DE COMPRAS Y VALIDACIÓN DE EXISTENCIAS
// --------------------------------------------------------------------
let umbral_descuento = 250000;
let porcentaje_descuento = 0.15;
let umbral_envio_gratis = 40000;
let adicional_envio = 15000;

const grillaProductos = document.getElementById("grilla-productos");
const listaCarrito = document.querySelector("#lista-carrito");
const carritoVacio = document.querySelector("#carrito-vacio");
const contadorCarrito = document.getElementById("contador-carrito");
const spanSubtotal = document.getElementById("subtotal");
const spanDescuento = document.getElementById("descuento");
const filaDescuento = document.getElementById("fila-descuento");
const spanTotal = document.querySelector("#total");
const cajaPromo = document.getElementById("promo");
const promoTexto = document.getElementById("promo-texto");
const barraProgreso = document.getElementById("progreso-barra");
const spanEnvio = document.getElementById("envio");
const btnVaciar = document.getElementById("vaciar-carrito");
const btnPagar = document.querySelector("#btn-pagar");

const CLAVE_STORAGE = "novastore_carrito";
let carrito = cargarCarrito();
// Mapa de respaldo por ID para consultar existencias reales incluso cuando hay filtros activos
const catalogoCompletoPorId = new Map();

/**
 * [MÓDULO 2] Carga el carrito desde localStorage y sanea ítems corruptos
 * o inválidos (IDs no enteros o cantidades <= 0) para mantener la integridad.
 */
function cargarCarrito() {
    try {
        const datos = localStorage.getItem(CLAVE_STORAGE);
        const parsed = datos ? JSON.parse(datos) : [];
        if (!Array.isArray(parsed)) return [];

        const saneados = parsed
            .filter((item) => {
                const id = Number(item?.id);
                const cantidad = Number(item?.cantidad);
                return Number.isInteger(id) && id > 0 && Number.isInteger(cantidad) && cantidad > 0;
            })
            .map((item) => ({
                id: Number(item.id),
                codigo: item.codigo ? String(item.codigo) : "",
                nombre: item.nombre ? String(item.nombre) : "Producto",
                precio: Math.max(0, Number(item.precio) || 0),
                imagen: item.imagen ? String(item.imagen) : "",
                stock: Math.max(0, Number(item.stock) || 0),
                cantidad: Number(item.cantidad)
            }));

        if (saneados.length !== parsed.length) {
            localStorage.setItem(CLAVE_STORAGE, JSON.stringify(saneados));
        }
        return saneados;
    } catch (error) {
        return [];
    }
}

/**
 * [MÓDULO 2] Obtiene las existencias disponibles del producto priorizando
 * los datos actualizados del catálogo en memoria.
 */
function obtenerStockDisponible(id, fallbackStock = 0) {
    const productoEnCatalogo = catalogoCompletoPorId.get(String(id));
    if (productoEnCatalogo) {
        return Math.max(0, Number(productoEnCatalogo.cantidad) || 0);
    }
    return Math.max(0, Number(fallbackStock) || 0);
}

/**
 * [MÓDULO 2] Agrega una unidad al carrito validando que haya existencias
 * y que la cantidad acumulada no supere el stock disponible.
 */
function agregarProducto(producto) {
    const stockDisponible = obtenerStockDisponible(producto.id, producto.stock);

    if (stockDisponible <= 0) {
        mostrarToast(`"${producto.nombre}" se encuentra agotado.`, "error");
        return false;
    }

    const existente = carrito.find((item) => item.id == producto.id);
    const cantidadActual = existente ? Number(existente.cantidad) || 0 : 0;

    if (cantidadActual + 1 > stockDisponible) {
        mostrarToast(
            `No puedes agregar más unidades de "${producto.nombre}". Stock disponible: ${stockDisponible}.`,
            "alerta"
        );
        return false;
    }

    if (existente) {
        existente.cantidad = cantidadActual + 1;
        existente.stock = stockDisponible;
        existente.precio = Number(producto.precio);
        existente.nombre = producto.nombre;
        existente.imagen = producto.imagen;
    } else {
        carrito.push({
            id: Number(producto.id),
            codigo: producto.codigo || "",
            nombre: producto.nombre,
            precio: Number(producto.precio),
            imagen: producto.imagen,
            stock: stockDisponible,
            cantidad: 1
        });
    }

    actualizarCarrito();
    renderizarCatalogo(productosCache);
    animarContadorCarrito();
    mostrarToast(`"${producto.nombre}" agregado al carrito`, "exito");
    return true;
}

function animarContadorCarrito() {
    if (!contadorCarrito) return;
    contadorCarrito.classList.remove("rebote");
    void contadorCarrito.offsetWidth;
    contadorCarrito.classList.add("rebote");
}

function calcularTotales() {
    const cantidad = carrito.reduce((suma, item) => suma + item.cantidad, 0);
    const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    const aplicaDescuento = subtotal >= umbral_descuento;
    const aplicaEnvioGratis = subtotal >= umbral_envio_gratis;
    const envio = (cantidad > 0 && !aplicaEnvioGratis) ? adicional_envio : 0;
    const descuento = aplicaDescuento ? Math.round(subtotal * porcentaje_descuento) : 0;
    const total = subtotal - descuento + envio;

    return { subtotal, descuento, envio, total, cantidad, aplicaDescuento };
}

function renderizarResumen() {
    const { subtotal, descuento, envio, total, cantidad, aplicaDescuento } = calcularTotales();
    if (spanSubtotal) spanSubtotal.textContent = formatear(subtotal);
    if (spanDescuento) spanDescuento.textContent = `-${formatear(descuento)}`;
    if (spanTotal) spanTotal.textContent = formatear(total);
    if (carritoVacio) carritoVacio.hidden = carrito.length > 0;
    if (filaDescuento) filaDescuento.hidden = !aplicaDescuento;
    if (btnPagar) btnPagar.disabled = carrito.length === 0;
    if (btnVaciar) btnVaciar.hidden = carrito.length === 0;

    if (cajaPromo && promoTexto && barraProgreso) {
        if (carrito.length === 0) {
            cajaPromo.hidden = true;
        } else if (aplicaDescuento) {
            cajaPromo.hidden = false;
            cajaPromo.classList.add("activa");
            promoTexto.innerHTML = `🎉 ¡Genial! Al superar los <strong>${formatear(umbral_descuento)}</strong> estás ahorrando <strong id="ahorro">${formatear(descuento)}</strong> con el 15%`;
            barraProgreso.style.width = "100%";
        } else {
            const faltante = Math.max(0, umbral_descuento - subtotal);
            const porcentajeProgreso = Math.min(100, Math.round((subtotal / umbral_descuento) * 100));
            cajaPromo.hidden = false;
            cajaPromo.classList.remove("activa");
            promoTexto.innerHTML = `Te faltan <strong>${formatear(faltante)}</strong> para obtener el <strong>15% de descuento</strong>`;
            barraProgreso.style.width = `${porcentajeProgreso}%`;
        }
    }

    if (spanEnvio) spanEnvio.textContent = cantidad === 0 ? "Gratis" : (envio === 0 ? "Gratis" : formatear(envio));
    if (contadorCarrito) contadorCarrito.textContent = cantidad;
}

/**
 * [MÓDULO 2] Modifica la cantidad de un producto en el carrito (+1 / -1),
 * impidiendo superar las existencias disponibles y ajustando al máximo si bajó el stock.
 */
function cambiarCantidad(id, cambio) {
    const item = carrito.find((p) => p.id == id);
    if (!item) return;

    const stockDisponible = obtenerStockDisponible(item.id, item.stock);
    item.stock = stockDisponible;

    if (stockDisponible <= 0) {
        eliminarProductoCarrito(id);
        mostrarToast(`"${item.nombre}" ya no tiene existencias disponibles.`, "alerta");
        return;
    }

    let nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad <= 0) {
        eliminarProductoCarrito(id);
        return;
    }

    if (cambio > 0 && nuevaCantidad > stockDisponible) {
        mostrarToast(
            `Stock máximo alcanzado para "${item.nombre}" (${stockDisponible} disponible${stockDisponible === 1 ? "" : "s"}).`,
            "alerta"
        );
        return;
    }

    if (cambio < 0 && nuevaCantidad > stockDisponible) {
        nuevaCantidad = stockDisponible;
        mostrarToast(
            `Cantidad de "${item.nombre}" ajustada al stock disponible (${stockDisponible}).`,
            "alerta"
        );
    }

    item.cantidad = nuevaCantidad;
    actualizarCarrito();
    renderizarCatalogo(productosCache);
    animarContadorCarrito();
}

function eliminarProductoCarrito(id) {
    carrito = carrito.filter((p) => p.id != id);
    actualizarCarrito();
    renderizarCatalogo(productosCache);
}

function vaciarCarrito(silencioso = false) {
    carrito = [];
    actualizarCarrito();
    renderizarCatalogo(productosCache);
    if (!silencioso) {
        mostrarToast("Carrito vaciado", "alerta");
    }
}

function renderizarListaCarrito() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = "";

    carrito.forEach((item) => {
        const stockDisponible = obtenerStockDisponible(item.id, item.stock);
        const alcanzoLimite = item.cantidad >= stockDisponible;
        const nombreSeguro = escaparHtml(item.nombre);
        const imagenSegura = escaparHtml(item.imagen || "https://via.placeholder.com/80?text=Sin+Foto");

        const li = document.createElement("li");
        li.className = "item-carrito";
        li.innerHTML = `
            <img class="item-carrito__imagen" src="${imagenSegura}" alt="${nombreSeguro}">
            <div>
                <p class="item-carrito__nombre">${nombreSeguro}</p>
                <p class="item-carrito__precio">${formatear(item.precio)} c/u</p>
                <p class="item-carrito__stock ${alcanzoLimite ? "item-carrito__stock--limite" : ""}">
                    ${stockDisponible > 0 ? `Disponibles: ${stockDisponible}` : "Sin existencias"}
                </p>
                <div class="cantidad">
                    <button class="cantidad__btn" data-accion="restar" data-id="${item.id}" aria-label="Restar uno">−</button>
                    <span class="cantidad__valor">${item.cantidad}</span>
                    <button class="cantidad__btn" data-accion="sumar" data-id="${item.id}" aria-label="Sumar uno" ${alcanzoLimite ? 'disabled title="Stock máximo alcanzado"' : ""}>+</button>
                </div>
            </div>
            <div class="item-carrito__lateral">
                <p class="item-carrito__total">${formatear(item.precio * item.cantidad)}</p>
                <button class="item-carrito__eliminar" data-accion="eliminar" data-id="${item.id}" aria-label="Eliminar del carrito">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path><path d="M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                </button>
            </div>
        `;
        listaCarrito.appendChild(li);
    });
}

function actualizarCarrito() {
    try {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify(carrito));
    } catch (e) {}
    renderizarListaCarrito();
    renderizarResumen();
}

/**
 * [MÓDULO 2] Consulta POST /api/carrito/validar para contrastar el carrito
 * local contra la base de datos: retira productos agotados/eliminados y
 * ajusta cantidades que excedan el stock actual.
 */
async function sincronizarCarritoConServidor(mostrarNotificacion = true) {
    if (carrito.length === 0) return;

    try {
        const respuesta = await fetch(`${API_BASE}/api/carrito/validar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: carrito.map((item) => ({ id: item.id, cantidad: item.cantidad }))
            })
        });

        if (!respuesta.ok) return;
        const data = await respuesta.json();
        if (!Array.isArray(data.items)) return;

        const mapaValidados = new Map(data.items.map((item) => [String(item.id), item]));
        const nuevoCarrito = [];
        const avisos = [];

        for (const itemActual of carrito) {
            const validado = mapaValidados.get(String(itemActual.id));
            if (!validado || !validado.disponible || validado.stock_disponible <= 0) {
                avisos.push(`Se retiró "${itemActual.nombre}" porque ya no tiene existencias disponibles.`);
                continue;
            }

            // Mantener actualizado el mapa de stock en memoria aunque el producto no esté en la vista filtrada
            const productoEnMapa = catalogoCompletoPorId.get(String(validado.id));
            if (productoEnMapa) {
                productoEnMapa.cantidad = validado.stock_disponible;
                productoEnMapa.precio = Number(validado.precio);
                productoEnMapa.nombre = validado.nombre;
            }

            const imagenResuelta = validado.imagen && validado.imagen.trim() !== ""
                ? (validado.imagen.startsWith("/uploads/") ? `${API_BASE}${validado.imagen}` : validado.imagen)
                : itemActual.imagen;

            let cantidadFinal = itemActual.cantidad;
            if (cantidadFinal > validado.stock_disponible) {
                cantidadFinal = validado.stock_disponible;
                avisos.push(`Cantidad de "${validado.nombre}" ajustada a ${cantidadFinal} (stock disponible).`);
            }

            nuevoCarrito.push({
                id: validado.id,
                codigo: validado.codigo || itemActual.codigo || "",
                nombre: validado.nombre,
                precio: Number(validado.precio),
                imagen: imagenResuelta,
                stock: validado.stock_disponible,
                cantidad: cantidadFinal
            });
        }

        carrito = nuevoCarrito;
        actualizarCarrito();
        renderizarCatalogo(productosCache);

        if (mostrarNotificacion && avisos.length > 0) {
            const mensajeFinal = avisos.length === 1
                ? avisos[0]
                : `${avisos[0]} (+${avisos.length - 1} ajuste${avisos.length - 1 === 1 ? "" : "s"} adicional${avisos.length - 1 === 1 ? "" : "es"})`;
            mostrarToast(mensajeFinal, "alerta");
        }
    } catch (error) {
        console.warn("No se pudo sincronizar el carrito con el servidor:", error);
    }
}

/**
 * [MÓDULO 2] Envía el pedido al servidor (POST /api/pedidos), donde se valida
 * el stock con bloqueo transaccional, se descuenta el inventario y se registra
 * la compra para luego mostrarse también en el Módulo 3.
 */
async function finalizarCompra() {
    if (carrito.length === 0) {
        mostrarToast("Tu carrito está vacío. Agrega productos antes de comprar.", "alerta");
        return;
    }

    if (btnPagar) {
        btnPagar.disabled = true;
        btnPagar.textContent = "Procesando compra...";
    }

    try {
        const respuesta = await fetch(`${API_BASE}/api/pedidos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: carrito.map((item) => ({ id: item.id, cantidad: item.cantidad }))
            })
        });

        const resultado = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
            mostrarToast(resultado.error || "No fue posible procesar la compra.", "error");
            await sincronizarCarritoConServidor(false);
            await cargarProductos();
            return;
        }

        vaciarCarrito(true);
        await cargarProductos();
        await cargarPedidos();
        abrirModalCompraExitosa(resultado.pedido);
        mostrarToast(resultado.mensaje || "¡Compra realizada con éxito!", "exito");
    } catch (error) {
        console.error("Error al finalizar compra:", error);
        mostrarToast("Error de conexión al procesar la compra.", "error");
    } finally {
        if (btnPagar) {
            btnPagar.textContent = "Finalizar compra";
            btnPagar.disabled = carrito.length === 0;
        }
    }
}

// Eventos del carrito
if (listaCarrito) {
    listaCarrito.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-accion]");
        if (!boton || boton.disabled) return;

        const id = boton.dataset.id;
        const accion = boton.dataset.accion;

        if (accion === "sumar") {
            cambiarCantidad(id, 1);
        } else if (accion === "restar") {
            cambiarCantidad(id, -1);
        } else if (accion === "eliminar") {
            eliminarProductoCarrito(id);
        }
    });
}

if (btnVaciar) {
    btnVaciar.addEventListener("click", () => vaciarCarrito(false));
}

if (btnPagar) {
    btnPagar.addEventListener("click", finalizarCompra);
}

// --------------------------------------------------------------------
// SECCIÓN 2: MÓDULO 1 — GESTIÓN DE PRODUCTOS (CRUD, API & DRAG & DROP)
// --------------------------------------------------------------------

let productosCache = [];
let categoriaActiva = "todo";
let terminoBusqueda = "";
let umbralBajoGlobal = 5;
let archivoImagenSeleccionado = null;
let idProductoAEliminar = null;

// Elementos DOM del Módulo
const contadorProductos = document.getElementById("contador-productos");
const formBuscador = document.getElementById("form-buscador");
const inputBuscador = document.getElementById("input-buscador");
const menuCategorias = document.getElementById("menu-categorias");
const btnNuevoProducto = document.getElementById("btn-nuevo-producto");

// Modal de Producto
const modalProducto = document.getElementById("modal-producto");
const modalProductoTitulo = document.getElementById("modal-producto-titulo");
const formProducto = document.getElementById("form-producto");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnCancelarProducto = document.getElementById("btn-cancelar-producto");
const alertaErrorModal = document.getElementById("alerta-error-modal");

// Campos del formulario
const inputProductoId = document.getElementById("producto-id");
const inputProductoCodigo = document.getElementById("producto-codigo");
const selectProductoCategoria = document.getElementById("producto-categoria");
const inputProductoNombre = document.getElementById("producto-nombre");
const inputProductoPrecio = document.getElementById("producto-precio");
const inputProductoCantidad = document.getElementById("producto-cantidad");
const inputProductoUmbral = document.getElementById("producto-umbral");
const inputProductoEtiqueta = document.getElementById("producto-etiqueta");
const inputProductoDescripcion = document.getElementById("producto-descripcion");
const inputProductoImagenUrl = document.getElementById("producto-imagen-url");

// Zona Drag & Drop
const dropzoneImagen = document.getElementById("dropzone-imagen");
const inputArchivoImagen = document.getElementById("input-archivo-imagen");
const previewImagen = document.getElementById("preview-imagen");
const imgPreview = document.getElementById("img-preview");
const previewNombre = document.getElementById("preview-nombre");
const previewTamano = document.getElementById("preview-tamano");
const btnQuitarImagen = document.getElementById("btn-quitar-imagen");

// Modal de Eliminación Lógica
const modalEliminar = document.getElementById("modal-eliminar");
const btnCerrarModalEliminar = document.getElementById("btn-cerrar-modal-eliminar");
const btnCancelarEliminar = document.getElementById("btn-cancelar-eliminar");
const btnConfirmarEliminar = document.getElementById("btn-confirmar-eliminar");
const eliminarProductoNombre = document.getElementById("eliminar-producto-nombre");
const eliminarProductoCodigo = document.getElementById("eliminar-producto-codigo");

// 1. Cargar Configuración de Umbrales del Servidor (Módulo 1 y Módulo 2)
async function cargarConfiguracion() {
    try {
        const respuesta = await fetch(`${API_BASE}/api/config`);
        if (respuesta.ok) {
            const config = await respuesta.json();
            umbralBajoGlobal = config.umbral_inventario_bajo || 5;
            if (typeof config.umbral_descuento === "number") umbral_descuento = config.umbral_descuento;
            if (typeof config.porcentaje_descuento === "number") porcentaje_descuento = config.porcentaje_descuento;
            if (typeof config.umbral_envio_gratis === "number") umbral_envio_gratis = config.umbral_envio_gratis;
            if (typeof config.adicional_envio === "number") adicional_envio = config.adicional_envio;
            if (inputProductoUmbral) inputProductoUmbral.value = umbralBajoGlobal;
            renderizarResumen();
        }
    } catch (e) {
        console.warn('No se pudo cargar /api/config, usando valores por defecto:', e);
    }
}

// 2. Cargar y Renderizar Catálogo de Productos
async function cargarProductos() {
    if (!grillaProductos) return;

    grillaProductos.innerHTML = `
        <div class="grilla-vacia">
            <div class="grilla-vacia__icono">⏳</div>
            <h3 class="grilla-vacia__titulo">Cargando catálogo...</h3>
            <p class="grilla-vacia__texto">Consultando los productos de la tienda.</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        if (terminoBusqueda.trim()) params.append('q', terminoBusqueda.trim());
        if (categoriaActiva && categoriaActiva.toLowerCase() !== 'todo') params.append('categoria', categoriaActiva);

        const url = `/api/productos${params.toString() ? '?' + params.toString() : ''}`;
        const respuesta = await fetch(`${API_BASE}${url}`);

        if (!respuesta.ok) {
            const errorData = await respuesta.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${respuesta.status} al consultar productos`);
        }

        const productos = await respuesta.json();
        productosCache = productos;
        if (categoriaActiva.toLowerCase() === 'todo' && !terminoBusqueda.trim()) {
            catalogoCompletoPorId.clear();
        }
        productos.forEach((p) => catalogoCompletoPorId.set(String(p.id), p));
        renderizarCatalogo(productos);
    } catch (error) {
        console.error('Error al cargar catálogo:', error);
        grillaProductos.innerHTML = `
            <div class="grilla-vacia">
                <div class="grilla-vacia__icono">⚠️</div>
                <h3 class="grilla-vacia__titulo">No se pudieron cargar los productos</h3>
                <p class="grilla-vacia__texto">${escaparHtml(error.message)}</p>
                <button class="boton boton--primario" onclick="cargarProductos()" type="button">Reintentar</button>
            </div>
        `;
        if (contadorProductos) contadorProductos.textContent = "Error de conexión";
    }
}

function renderizarCatalogo(productos) {
    if (!grillaProductos) return;

    if (contadorProductos) {
        contadorProductos.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'}`;
    }

    if (productos.length === 0) {
        grillaProductos.innerHTML = `
            <div class="grilla-vacia">
                <div class="grilla-vacia__icono">🔍</div>
                <h3 class="grilla-vacia__titulo">No se encontraron productos</h3>
                <p class="grilla-vacia__texto">No hay productos que coincidan con la búsqueda o la categoría seleccionada.</p>
                <button class="boton boton--secundario" id="btn-limpiar-filtros" type="button">Restablecer filtros</button>
            </div>
        `;
        const btnLimpiar = document.getElementById("btn-limpiar-filtros");
        if (btnLimpiar) {
            btnLimpiar.addEventListener("click", () => {
                terminoBusqueda = "";
                if (inputBuscador) inputBuscador.value = "";
                establecerCategoriaActiva("todo");
                cargarProductos();
            });
        }
        return;
    }

    grillaProductos.innerHTML = "";

    productos.forEach((p) => {
        const umbral = p.umbral_inventario_bajo || umbralBajoGlobal;
        let estadoClase = "badge-stock--disponible";
        let estadoTexto = `Disponible (${p.cantidad} disp.)`;
        let estaAgotado = false;

        if (p.cantidad === 0) {
            estadoClase = "badge-stock--agotado";
            estadoTexto = "Agotado";
            estaAgotado = true;
        } else if (p.cantidad <= umbral) {
            estadoClase = "badge-stock--bajo";
            estadoTexto = `Stock bajo (${p.cantidad} disp.)`;
        }

        const imagenSrc = p.imagen && p.imagen.trim() !== ''
            ? (p.imagen.startsWith('/uploads/') ? `${API_BASE}${p.imagen}` : p.imagen)
            : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop';

        // [MÓDULO 2] Verifica cuántas unidades ya están en el carrito para bloquear el botón si alcanzó el stock
        const enCarrito = carrito.find((item) => item.id == p.id);
        const cantidadEnCarrito = enCarrito ? Number(enCarrito.cantidad) || 0 : 0;
        const sinCupoEnCarrito = !estaAgotado && cantidadEnCarrito >= p.cantidad;
        const textoBotonAgregar = estaAgotado
            ? 'Agotado'
            : (sinCupoEnCarrito ? `Máximo en carrito (${p.cantidad})` : 'Agregar al carrito');

        const article = document.createElement("article");
        article.className = "producto";
        article.dataset.id = p.id;
        article.dataset.codigo = p.codigo;
        article.dataset.nombre = p.nombre;
        article.dataset.precio = p.precio;
        article.dataset.stock = p.cantidad;
        article.dataset.imagen = imagenSrc;
        article.dataset.categoria = p.categoria;

        article.innerHTML = `
            <div class="producto__imagen">
                <img src="${imagenSrc}" alt="${escaparHtml(p.nombre)}" loading="lazy">
                ${p.etiqueta ? `<span class="etiqueta">${escaparHtml(p.etiqueta)}</span>` : ''}
            </div>
            <div class="producto__info">
                <div class="producto__meta">
                    <span class="producto__codigo">${escaparHtml(p.codigo)}</span>
                    <span class="badge-stock ${estadoClase}">${estadoTexto}</span>
                </div>
                <p class="producto__categoria">${escaparHtml(p.categoria)}</p>
                <h3 class="producto__nombre">${escaparHtml(p.nombre)}</h3>
                <p class="producto__descripcion">${escaparHtml(p.descripcion || 'Sin descripción detallada.')}</p>
                <div class="producto__precio-stock">
                    <p class="producto__precio">${formatear(p.precio)}</p>
                </div>
                <button class="boton boton--primario btn-agregar" type="button" ${(estaAgotado || sinCupoEnCarrito) ? `disabled title="${estaAgotado ? 'Producto agotado' : 'Ya alcanzaste las existencias disponibles en el carrito'}"` : ''}>
                    ${textoBotonAgregar}
                </button>
                <div class="producto__acciones-admin">
                    <button class="btn-admin btn-admin--editar" data-id="${p.id}" type="button" title="Editar producto" aria-label="Editar producto">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn-admin btn-admin--eliminar" data-id="${p.id}" type="button" title="Eliminar producto (lógico)" aria-label="Eliminar producto">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path><path d="M14 11v6"></path>
                        </svg>
                        Eliminar
                    </button>
                </div>
            </div>
        `;

        grillaProductos.appendChild(article);
    });
}

// 3. Manejo de Drag & Drop para Imágenes
function inicializarDragAndDrop() {
    if (!dropzoneImagen || !inputArchivoImagen) return;

    // Clic en la zona activa el input file
    dropzoneImagen.addEventListener("click", () => {
        inputArchivoImagen.click();
    });

    // Accesibilidad con teclado (Enter / Espacio)
    dropzoneImagen.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputArchivoImagen.click();
        }
    });

    // Eventos Drag & Drop
    ['dragenter', 'dragover'].forEach((nombreEvento) => {
        dropzoneImagen.addEventListener(nombreEvento, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneImagen.classList.add("arrastrando");
        });
    });

    ['dragleave', 'drop'].forEach((nombreEvento) => {
        dropzoneImagen.addEventListener(nombreEvento, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneImagen.classList.remove("arrastrando");
        });
    });

    dropzoneImagen.addEventListener("drop", (e) => {
        const archivos = e.dataTransfer.files;
        if (archivos && archivos.length > 0) {
            procesarArchivoImagen(archivos[0]);
        }
    });

    inputArchivoImagen.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            procesarArchivoImagen(e.target.files[0]);
        }
    });

    if (btnQuitarImagen) {
        btnQuitarImagen.addEventListener("click", (e) => {
            e.stopPropagation();
            limpiarImagenSeleccionada();
        });
    }

    const btnCambiarImagen = document.getElementById("btn-cambiar-imagen");
    if (btnCambiarImagen && inputArchivoImagen) {
        btnCambiarImagen.addEventListener("click", (e) => {
            e.stopPropagation();
            inputArchivoImagen.click();
        });
    }

    const btnGenerarCodigo = document.getElementById("btn-generar-codigo");
    if (btnGenerarCodigo) {
        btnGenerarCodigo.addEventListener("click", () => {
            if (inputProductoCodigo) {
                inputProductoCodigo.value = generarCodigoAutomatico();
                desmarcarCampoError(inputProductoCodigo);
                mostrarToast(`Código auto-generado: ${inputProductoCodigo.value}`, "exito");
            }
        });
    }
}

function generarCodigoAutomatico() {
    let maxNumero = 0;
    productosCache.forEach((p) => {
        if (p.codigo) {
            const match = p.codigo.match(/PRD-(\d+)/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumero) maxNumero = num;
            }
        }
    });
    const siguiente = maxNumero > 0 ? maxNumero + 1 : (productosCache.length + 1);
    return `PRD-${String(siguiente).padStart(3, '0')}`;
}

function procesarArchivoImagen(archivo) {
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxBytes = 2 * 1024 * 1024; // 2MB

    if (!tiposPermitidos.includes(archivo.type.toLowerCase())) {
        mostrarErrorModal("Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.");
        return;
    }

    if (archivo.size > maxBytes) {
        mostrarErrorModal("La imagen excede el tamaño máximo permitido de 2 MB.");
        return;
    }

    archivoImagenSeleccionado = archivo;
    ocultarErrorModal();

    // Vista previa inmediata con FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
        if (imgPreview) imgPreview.src = e.target.result;
        if (previewNombre) previewNombre.textContent = archivo.name;
        if (previewTamano) previewTamano.textContent = `${(archivo.size / 1024).toFixed(1)} KB`;
        if (previewImagen) previewImagen.hidden = false;
        if (dropzoneImagen) dropzoneImagen.hidden = true;
    };
    reader.readAsDataURL(archivo);
}

function limpiarImagenSeleccionada() {
    archivoImagenSeleccionado = null;
    if (inputArchivoImagen) inputArchivoImagen.value = "";
    if (inputProductoImagenUrl) inputProductoImagenUrl.value = "";
    if (imgPreview) imgPreview.src = "";
    if (previewImagen) previewImagen.hidden = true;
    if (dropzoneImagen) dropzoneImagen.hidden = false;
}

function mostrarVistaPreviaExistente(url) {
    if (!url || url.trim() === '') {
        limpiarImagenSeleccionada();
        return;
    }
    archivoImagenSeleccionado = null;
    if (inputProductoImagenUrl) inputProductoImagenUrl.value = url;
    const urlCompleta = url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;
    if (imgPreview) imgPreview.src = urlCompleta;
    if (previewNombre) previewNombre.textContent = "Imagen actual asignada";
    if (previewTamano) previewTamano.textContent = "Ruta guardada en base de datos";
    if (previewImagen) previewImagen.hidden = false;
    if (dropzoneImagen) dropzoneImagen.hidden = true;
}

// 4. Control de Modales (Apertura, Cierre y Reset)
function abrirModalCrear() {
    limpiarFormularioModal();
    if (modalProductoTitulo) modalProductoTitulo.textContent = "Registrar Nuevo Producto";

    // Auto-generar código único
    if (inputProductoCodigo) {
        inputProductoCodigo.value = generarCodigoAutomatico();
    }
    const btnGen = document.getElementById("btn-generar-codigo");
    if (btnGen) btnGen.style.display = "inline-flex";

    const btnGuardar = document.getElementById("btn-guardar-producto");
    if (btnGuardar) {
        btnGuardar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Nuevo Producto
        `;
    }

    if (modalProducto) modalProducto.hidden = false;
    // Foco directo al nombre ya que el código se auto-generó
    if (inputProductoNombre) inputProductoNombre.focus();
}

async function abrirModalEditar(id) {
    limpiarFormularioModal();
    if (modalProductoTitulo) modalProductoTitulo.textContent = "Editar Producto";
    const btnGen = document.getElementById("btn-generar-codigo");
    if (btnGen) btnGen.style.display = "none";

    const btnGuardar = document.getElementById("btn-guardar-producto");
    if (btnGuardar) {
        btnGuardar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem;">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Guardar Cambios
        `;
    }

    try {
        const respuesta = await fetch(`${API_BASE}/api/productos/${id}`);
        if (!respuesta.ok) throw new Error("No se pudo obtener el producto");
        const producto = await respuesta.json();

        if (inputProductoId) inputProductoId.value = producto.id;
        if (inputProductoCodigo) inputProductoCodigo.value = producto.codigo;
        if (selectProductoCategoria) selectProductoCategoria.value = producto.categoria;
        if (inputProductoNombre) inputProductoNombre.value = producto.nombre;
        if (inputProductoPrecio) inputProductoPrecio.value = producto.precio;
        if (inputProductoCantidad) inputProductoCantidad.value = producto.cantidad;
        if (inputProductoUmbral) inputProductoUmbral.value = producto.umbral_inventario_bajo || umbralBajoGlobal;
        if (inputProductoEtiqueta) inputProductoEtiqueta.value = producto.etiqueta || "";
        if (inputProductoDescripcion) inputProductoDescripcion.value = producto.descripcion || "";

        if (producto.imagen) {
            mostrarVistaPreviaExistente(producto.imagen);
        }

        if (modalProducto) modalProducto.hidden = false;
        if (inputProductoNombre) inputProductoNombre.focus();
    } catch (e) {
        console.error("Error al cargar producto para edición:", e);
        mostrarToast("No se pudo cargar la información del producto.", "error");
    }
}

function cerrarModalProducto() {
    if (modalProducto) modalProducto.hidden = true;
    limpiarFormularioModal();
}

function limpiarFormularioModal() {
    if (formProducto) formProducto.reset();
    if (inputProductoId) inputProductoId.value = "";
    if (inputProductoUmbral) inputProductoUmbral.value = umbralBajoGlobal;
    limpiarImagenSeleccionada();
    ocultarErrorModal();
    document.querySelectorAll(".campo--error").forEach((el) => el.classList.remove("campo--error"));
}

function mostrarErrorModal(mensaje) {
    if (alertaErrorModal) {
        alertaErrorModal.textContent = mensaje;
        alertaErrorModal.hidden = false;
    }
}

function ocultarErrorModal() {
    if (alertaErrorModal) {
        alertaErrorModal.textContent = "";
        alertaErrorModal.hidden = true;
    }
}

// 5. Envío y Validación del Formulario de Producto (Crear / Editar)
async function guardarProducto(e) {
    e.preventDefault();
    ocultarErrorModal();

    const id = inputProductoId ? inputProductoId.value.trim() : "";
    const codigo = inputProductoCodigo ? inputProductoCodigo.value.trim().toUpperCase() : "";
    const categoria = selectProductoCategoria ? selectProductoCategoria.value.trim() : "";
    const nombre = inputProductoNombre ? inputProductoNombre.value.trim() : "";
    const precio = inputProductoPrecio ? Number(inputProductoPrecio.value) : NaN;
    const cantidad = inputProductoCantidad ? Number(inputProductoCantidad.value) : NaN;
    const umbral = inputProductoUmbral ? Number(inputProductoUmbral.value) : umbralBajoGlobal;
    const etiqueta = inputProductoEtiqueta ? inputProductoEtiqueta.value.trim() : "";
    const descripcion = inputProductoDescripcion ? inputProductoDescripcion.value.trim() : "";
    let imagenUrl = inputProductoImagenUrl ? inputProductoImagenUrl.value.trim() : "";

    // Validaciones en cliente
    let hayErrores = false;

    if (!codigo) {
        marcarCampoError(inputProductoCodigo, "error-codigo", "El código es obligatorio.");
        hayErrores = true;
    } else {
        desmarcarCampoError(inputProductoCodigo);
    }

    if (!categoria) {
        marcarCampoError(selectProductoCategoria, "error-categoria", "Selecciona una categoría.");
        hayErrores = true;
    } else {
        desmarcarCampoError(selectProductoCategoria);
    }

    if (!nombre) {
        marcarCampoError(inputProductoNombre, "error-nombre", "El nombre es obligatorio.");
        hayErrores = true;
    } else {
        desmarcarCampoError(inputProductoNombre);
    }

    if (isNaN(precio) || precio < 0) {
        marcarCampoError(inputProductoPrecio, "error-precio", "Ingresa un precio válido no negativo.");
        hayErrores = true;
    } else {
        desmarcarCampoError(inputProductoPrecio);
    }

    if (isNaN(cantidad) || cantidad < 0) {
        marcarCampoError(inputProductoCantidad, "error-cantidad", "Ingresa una cantidad entera no negativa.");
        hayErrores = true;
    } else {
        desmarcarCampoError(inputProductoCantidad);
    }

    if (isNaN(umbral) || umbral < 1) {
        marcarCampoError(inputProductoUmbral, "error-umbral", "El umbral debe ser al menos 1.");
        hayErrores = true;
    } else {
        desmarcarCampoError(inputProductoUmbral);
    }

    if (hayErrores) {
        mostrarErrorModal("Por favor corrige los campos señalados antes de continuar.");
        return;
    }

    const esEdicion = Boolean(id);
    const btnGuardar = document.getElementById("btn-guardar-producto");
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = esEdicion ? "Guardando..." : "Agregando producto...";
    }

    try {
        // Si el usuario seleccionó o arrastró un nuevo archivo de imagen, subirlo primero
        if (archivoImagenSeleccionado) {
            const formData = new FormData();
            formData.append("imagen", archivoImagenSeleccionado);

            const respuestaUpload = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!respuestaUpload.ok) {
                const errorUpload = await respuestaUpload.json().catch(() => ({}));
                throw new Error(errorUpload.error || "Error al subir la imagen al servidor.");
            }

            const dataUpload = await respuestaUpload.json();
            imagenUrl = dataUpload.url;
        }

        const payload = {
            codigo,
            categoria,
            nombre,
            precio,
            cantidad,
            umbral_inventario_bajo: umbral,
            etiqueta: etiqueta || null,
            descripcion: descripcion || null,
            imagen: imagenUrl || null
        };

        const endpoint = esEdicion ? `/api/productos/${id}` : '/api/productos';
        const metodo = esEdicion ? 'PUT' : 'POST';

        const respuesta = await fetch(`${API_BASE}${endpoint}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
            throw new Error(resultado.error || `Error al ${esEdicion ? 'actualizar' : 'crear'} el producto.`);
        }

        cerrarModalProducto();
        mostrarToast(resultado.mensaje || `Producto ${esEdicion ? 'actualizado' : 'registrado'} con éxito`, "exito");
        await cargarProductos();
        await sincronizarCarritoConServidor(true);
    } catch (error) {
        console.error("Error al guardar producto:", error);
        mostrarErrorModal(error.message);
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = esEdicion
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Guardar Cambios`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Agregar Nuevo Producto`;
        }
    }
}

function marcarCampoError(inputEl, spanErrorId, mensaje) {
    if (!inputEl) return;
    const campo = inputEl.closest(".campo");
    if (campo) campo.classList.add("campo--error");
    const spanError = document.getElementById(spanErrorId);
    if (spanError) spanError.textContent = mensaje;
}

function desmarcarCampoError(inputEl) {
    if (!inputEl) return;
    const campo = inputEl.closest(".campo");
    if (campo) campo.classList.remove("campo--error");
}

// 6. Eliminación Lógica (Soft Delete)
function abrirModalEliminar(id) {
    const producto = productosCache.find((p) => p.id == id);
    if (!producto) return;

    idProductoAEliminar = id;
    if (eliminarProductoNombre) eliminarProductoNombre.textContent = producto.nombre;
    if (eliminarProductoCodigo) eliminarProductoCodigo.textContent = producto.codigo;
    if (modalEliminar) modalEliminar.hidden = false;
}

function cerrarModalEliminar() {
    idProductoAEliminar = null;
    if (modalEliminar) modalEliminar.hidden = true;
}

async function confirmarEliminacion() {
    if (!idProductoAEliminar) return;

    if (btnConfirmarEliminar) {
        btnConfirmarEliminar.disabled = true;
        btnConfirmarEliminar.textContent = "Eliminando...";
    }

    try {
        const respuesta = await fetch(`${API_BASE}/api/productos/${idProductoAEliminar}`, {
            method: 'DELETE'
        });

        const resultado = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
            throw new Error(resultado.error || "Error al eliminar el producto.");
        }

        cerrarModalEliminar();
        mostrarToast(resultado.mensaje || "Producto eliminado correctamente del catálogo.", "exito");
        await cargarProductos();
        await sincronizarCarritoConServidor(true);
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        mostrarToast(error.message, "error");
    } finally {
        if (btnConfirmarEliminar) {
            btnConfirmarEliminar.disabled = false;
            btnConfirmarEliminar.textContent = "Confirmar Eliminación";
        }
    }
}

// 7. Búsqueda y Filtro por Categoría Combinados
function establecerCategoriaActiva(nuevaCategoria) {
    categoriaActiva = nuevaCategoria;
    if (menuCategorias) {
        menuCategorias.querySelectorAll("a[data-categoria]").forEach((enlace) => {
            const cat = enlace.dataset.categoria;
            if (cat && cat.toLowerCase() === nuevaCategoria.toLowerCase()) {
                enlace.classList.add("activo");
            } else {
                enlace.classList.remove("activo");
            }
        });
    }
}

function inicializarBuscadorYFiltros() {
    // Buscador
    if (formBuscador) {
        formBuscador.addEventListener("submit", (e) => {
            e.preventDefault();
            if (inputBuscador) terminoBusqueda = inputBuscador.value;
            cargarProductos();
        });
    }

    if (inputBuscador) {
        let debounceTimer = null;
        inputBuscador.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                terminoBusqueda = e.target.value;
                cargarProductos();
            }, 300);
        });
    }

    // Menú de Categorías
    if (menuCategorias) {
        menuCategorias.addEventListener("click", (e) => {
            const enlace = e.target.closest("a[data-categoria]");
            if (!enlace) return;
            e.preventDefault();
            establecerCategoriaActiva(enlace.dataset.categoria);
            cargarProductos();
        });
    }
}

// 8. Inicialización de Delegación de Eventos en Tarjetas de Producto
function inicializarEventosGrilla() {
    if (!grillaProductos) return;

    grillaProductos.addEventListener("click", (evento) => {
        // A) Botón Editar
        const btnEditar = evento.target.closest(".btn-admin--editar");
        if (btnEditar) {
            evento.stopPropagation();
            abrirModalEditar(btnEditar.dataset.id);
            return;
        }

        // B) Botón Eliminar
        const btnEliminar = evento.target.closest(".btn-admin--eliminar");
        if (btnEliminar) {
            evento.stopPropagation();
            abrirModalEliminar(btnEliminar.dataset.id);
            return;
        }

        // C) [MÓDULO 2] Botón Agregar al Carrito (con validación de stock disponible)
        const botonAgregar = evento.target.closest(".btn-agregar");
        if (botonAgregar && !botonAgregar.disabled) {
            const tarjeta = botonAgregar.closest(".producto");
            const producto = {
                id: Number(tarjeta.dataset.id),
                codigo: tarjeta.dataset.codigo,
                nombre: tarjeta.dataset.nombre,
                precio: Number(tarjeta.dataset.precio),
                stock: Number(tarjeta.dataset.stock),
                imagen: tarjeta.dataset.imagen
            };

            const agregado = agregarProducto(producto);
            if (!agregado) return;

            // Feedback visual solo si el botón en el DOM sigue habilitado
            const tarjetaActual = grillaProductos.querySelector(`.producto[data-id="${producto.id}"]`);
            const botonActual = tarjetaActual ? tarjetaActual.querySelector(".btn-agregar") : null;
            if (botonActual && !botonActual.disabled) {
                const textoOriginal = botonActual.textContent;
                botonActual.textContent = "Agregado ^^";
                botonActual.classList.add("boton--agregado");
                setTimeout(() => {
                    if (botonActual.isConnected && !botonActual.disabled) {
                        botonActual.textContent = textoOriginal;
                        botonActual.classList.remove("boton--agregado");
                    }
                }, 900);
            }
        }
    });
}

// --------------------------------------------------------------------
// MÓDULO 2 (CONTINUACIÓN): MODAL DE COMPRA EXITOSA
// --------------------------------------------------------------------
const modalCompra = document.getElementById("modal-compra");
const btnCerrarModalCompra = document.getElementById("btn-cerrar-modal-compra");
const btnAceptarCompra = document.getElementById("btn-aceptar-compra");
const compraCodigoPedido = document.getElementById("compra-codigo-pedido");
const compraListaItems = document.getElementById("compra-lista-items");
const compraTotalPagado = document.getElementById("compra-total-pagado");

/**
 * [MÓDULO 2] Muestra el resumen del pedido recién confirmado en base de datos.
 */
function abrirModalCompraExitosa(pedido) {
    if (!modalCompra || !pedido) return;
    if (compraCodigoPedido) compraCodigoPedido.textContent = pedido.codigo_pedido || `#${pedido.id}`;
    if (compraTotalPagado) compraTotalPagado.textContent = formatear(pedido.total);
    if (compraListaItems) {
        compraListaItems.innerHTML = (pedido.items || []).map((item) => `
            <li>
                <span>${escaparHtml(item.nombre_producto)} &times; ${item.cantidad}</span>
                <strong>${formatear(item.subtotal_linea)}</strong>
            </li>
        `).join("");
    }
    modalCompra.hidden = false;
}

function cerrarModalCompraExitosa() {
    if (modalCompra) modalCompra.hidden = true;
}

// 9. Asignar Eventos de Modales (Módulo 1 y Módulo 2)
function inicializarEventosModales() {
    if (btnNuevoProducto) btnNuevoProducto.addEventListener("click", abrirModalCrear);
    if (btnCerrarModal) btnCerrarModal.addEventListener("click", cerrarModalProducto);
    if (btnCancelarProducto) btnCancelarProducto.addEventListener("click", cerrarModalProducto);
    if (formProducto) formProducto.addEventListener("submit", guardarProducto);

    if (btnCerrarModalEliminar) btnCerrarModalEliminar.addEventListener("click", cerrarModalEliminar);
    if (btnCancelarEliminar) btnCancelarEliminar.addEventListener("click", cerrarModalEliminar);
    if (btnConfirmarEliminar) btnConfirmarEliminar.addEventListener("click", confirmarEliminacion);

    if (btnCerrarModalCompra) btnCerrarModalCompra.addEventListener("click", cerrarModalCompraExitosa);
    if (btnAceptarCompra) btnAceptarCompra.addEventListener("click", cerrarModalCompraExitosa);

    // Cerrar con Escape
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modalProducto && !modalProducto.hidden) cerrarModalProducto();
            if (modalEliminar && !modalEliminar.hidden) cerrarModalEliminar();
            if (modalCompra && !modalCompra.hidden) cerrarModalCompraExitosa();
        }
    });

    // Cerrar al hacer clic en el backdrop
    [modalProducto, modalEliminar, modalCompra].forEach((modal) => {
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    if (modal === modalProducto) cerrarModalProducto();
                    if (modal === modalEliminar) cerrarModalEliminar();
                    if (modal === modalCompra) cerrarModalCompraExitosa();
                }
            });
        }
    });
}

// --------------------------------------------------------------------
// SECCIÓN 3: MÓDULO 3 — CONSULTA DE PEDIDOS REGISTRADOS
// --------------------------------------------------------------------
const listaPedidos = document.getElementById("lista-pedidos");
const contadorPedidos = document.getElementById("contador-pedidos");
const contadorPedidosHeader = document.getElementById("contador-pedidos-header");
const inputBuscarPedido = document.getElementById("input-buscar-pedido");
const btnActualizarPedidos = document.getElementById("btn-actualizar-pedidos");

let terminoBusquedaPedido = "";

const formatoFechaPedido = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
});

/**
 * [MÓDULO 3] Formatea la fecha de realización del pedido para mostrarla legible.
 */
function formatearFechaPedido(fechaIso) {
    if (!fechaIso) return "Fecha no disponible";
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return String(fechaIso);
    return formatoFechaPedido.format(fecha);
}

/**
 * [MÓDULO 3] Consulta en el servidor los pedidos registrados (GET /api/pedidos)
 * con filtro opcional por código de pedido o nombre de producto.
 */
async function cargarPedidos() {
    if (!listaPedidos) return;

    listaPedidos.innerHTML = `
        <div class="pedidos-vacio">
            <div class="pedidos-vacio__icono">⏳</div>
            <p>Consultando pedidos registrados...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        if (terminoBusquedaPedido.trim() !== "") {
            params.append("q", terminoBusquedaPedido.trim());
        }

        const url = `/api/pedidos${params.toString() ? "?" + params.toString() : ""}`;
        const respuesta = await fetch(`${API_BASE}${url}`);

        if (!respuesta.ok) {
            const errorData = await respuesta.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${respuesta.status} al consultar pedidos`);
        }

        const pedidos = await respuesta.json();
        renderizarPedidos(Array.isArray(pedidos) ? pedidos : []);
    } catch (error) {
        console.error("Error al cargar pedidos:", error);
        listaPedidos.innerHTML = `
            <div class="pedidos-vacio">
                <div class="pedidos-vacio__icono">⚠️</div>
                <p>${escaparHtml(error.message)}</p>
            </div>
        `;
        if (contadorPedidos) contadorPedidos.textContent = "Error al consultar";
    }
}

/**
 * [MÓDULO 3] Renderiza cada pedido mostrando:
 * - Identificador del pedido (código e ID)
 * - Fecha de realización
 * - Productos incluidos y cantidades
 * - Total de la compra
 */
function renderizarPedidos(pedidos) {
    if (!listaPedidos) return;

    if (contadorPedidos) {
        contadorPedidos.textContent = `${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"}`;
    }
    if (contadorPedidosHeader && terminoBusquedaPedido.trim() === "") {
        contadorPedidosHeader.textContent = String(pedidos.length);
    }

    if (pedidos.length === 0) {
        const hayFiltro = terminoBusquedaPedido.trim() !== "";
        listaPedidos.innerHTML = `
            <div class="pedidos-vacio">
                <div class="pedidos-vacio__icono">${hayFiltro ? "🔍" : "📦"}</div>
                <p>${hayFiltro
                    ? "No se encontraron pedidos que coincidan con tu búsqueda."
                    : "Aún no hay pedidos registrados. ¡Realiza una compra desde el carrito para verla aquí!"}</p>
            </div>
        `;
        return;
    }

    listaPedidos.innerHTML = "";

    pedidos.forEach((pedido) => {
        const items = Array.isArray(pedido.items) ? pedido.items : [];
        const codigoPedido = escaparHtml(pedido.codigo_pedido || `PED-${String(pedido.id).padStart(5, "0")}`);
        const fechaFormateada = escaparHtml(formatearFechaPedido(pedido.fecha_creacion));

        const itemsHtml = items.length > 0
            ? items.map((item) => `
                <li class="pedido-card__item">
                    <div>
                        <span class="pedido-card__item-nombre">${escaparHtml(item.nombre_producto)}</span>
                        <span class="pedido-card__item-codigo">${escaparHtml(item.codigo_producto || "")} · ${formatear(item.precio_unitario)} c/u</span>
                    </div>
                    <span class="pedido-card__item-cantidad">&times; ${Number(item.cantidad) || 0}</span>
                    <span class="pedido-card__item-subtotal">${formatear(item.subtotal_linea)}</span>
                </li>
            `).join("")
            : `<li class="pedido-card__item"><span class="pedido-card__item-nombre">Sin detalle de productos</span></li>`;

        const card = document.createElement("article");
        card.className = "pedido-card";
        card.innerHTML = `
            <header class="pedido-card__cabecera">
                <div>
                    <span class="pedido-card__codigo">${codigoPedido}</span>
                    <span class="pedido-card__id-interno">ID interno: #${Number(pedido.id)}</span>
                </div>
                <div class="pedido-card__fecha">
                    <span>Fecha de realización</span>
                    <strong>${fechaFormateada}</strong>
                </div>
            </header>

            <div class="pedido-card__cuerpo">
                <p class="pedido-card__etiqueta-items">Productos incluidos (${Number(pedido.cantidad_total_productos) || items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)} uds.)</p>
                <ul class="pedido-card__items">
                    ${itemsHtml}
                </ul>
            </div>

            <footer class="pedido-card__pie">
                <div class="pedido-card__desglose">
                    <span>Subtotal</span>
                    <span>${formatear(pedido.subtotal)}</span>
                </div>
                ${Number(pedido.descuento) > 0 ? `
                <div class="pedido-card__desglose texto-verde">
                    <span>Descuento</span>
                    <span>-${formatear(pedido.descuento)}</span>
                </div>` : ""}
                <div class="pedido-card__desglose">
                    <span>Envío</span>
                    <span>${Number(pedido.envio) === 0 ? "Gratis" : formatear(pedido.envio)}</span>
                </div>
                <div class="pedido-card__total">
                    <span>Total de la compra</span>
                    <strong>${formatear(pedido.total)}</strong>
                </div>
            </footer>
        `;

        listaPedidos.appendChild(card);
    });
}

/**
 * [MÓDULO 3] Inicializa los eventos de búsqueda y actualización de pedidos.
 */
function inicializarModuloPedidos() {
    if (btnActualizarPedidos) {
        btnActualizarPedidos.addEventListener("click", () => {
            cargarPedidos();
        });
    }

    if (inputBuscarPedido) {
        let debouncePedido = null;
        inputBuscarPedido.addEventListener("input", (e) => {
            clearTimeout(debouncePedido);
            debouncePedido = setTimeout(() => {
                terminoBusquedaPedido = e.target.value;
                cargarPedidos();
            }, 300);
        });
    }
}

// --------------------------------------------------------------------
// SECCIÓN 4: INICIALIZACIÓN GENERAL AL CARGAR EL DOM
// --------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    // Módulo 2: Render inicial del carrito desde localStorage
    actualizarCarrito();

    // Módulo 1: Eventos de formulario, drag & drop, búsqueda y tarjetas
    inicializarDragAndDrop();
    inicializarBuscadorYFiltros();
    inicializarEventosGrilla();
    inicializarEventosModales();

    // Módulo 3: Eventos de consulta de pedidos
    inicializarModuloPedidos();

    // Carga inicial de datos desde el servidor
    await cargarConfiguracion();
    await cargarProductos();
    await sincronizarCarritoConServidor(true);
    await cargarPedidos();
});
