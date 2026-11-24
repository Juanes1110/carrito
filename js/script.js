// ====================================================================
// NOVA STORE - Carrito de Compras & Módulo 1: Gestión de Productos
// Nombres: Juan Esteban Colorado & Daniel Alexander Cobo
// ====================================================================

// --------------------------------------------------------------------
// SECCIÓN 1: CARRITO DE COMPRAS (Lógica original preservada)
// --------------------------------------------------------------------
const umbral_descuento = 250000;
const porcentaje_descuento = 0.15;
const umbral_envio_gratis = 40000;
const adicional_envio = 15000;

const grillaProductos = document.getElementById("grilla-productos");
const listaCarrito = document.querySelector("#lista-carrito");
const carritoVacio = document.querySelector("#carrito-vacio");
const contadorCarrito = document.getElementById("contador-carrito");
const spanSubtotal = document.getElementById("subtotal");
const spanDescuento = document.getElementById("descuento");
const filaDescuento = document.getElementById("fila-descuento");
const spanTotal = document.querySelector("#total");
const cajaPromo = document.getElementById("promo");
const spanEnvio = document.getElementById("envio");
const btnVaciar = document.getElementById("vaciar-carrito");
const btnPagar = document.querySelector("#btn-pagar");
const toast = document.getElementById("toast");

const CLAVE_STORAGE = "novastore_carrito";
let carrito = cargarCarrito();

const formatoPesos = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

function formatear(valor) {
    return formatoPesos.format(valor || 0);
}

function cargarCarrito() {
    try {
        const datos = localStorage.getItem(CLAVE_STORAGE);
        return datos ? JSON.parse(datos) : [];
    } catch (error) {
        return [];
    }
}

function agregarProducto(producto) {
    const existente = carrito.find((item) => item.id == producto.id);

    if (existente) {
        existente.cantidad++;
    } else {
        carrito.push({ ...producto, cantidad: 1 });
    }

    actualizarCarrito();
    mostrarToast(`"${producto.nombre}" agregado al carrito`, "exito");
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

    const spanAhorro = document.getElementById("ahorro");
    if (spanAhorro) spanAhorro.textContent = formatear(descuento);
    if (cajaPromo) cajaPromo.hidden = !aplicaDescuento;
    if (spanEnvio) spanEnvio.textContent = envio === 0 ? "Gratis" : formatear(envio);
    if (contadorCarrito) contadorCarrito.textContent = cantidad;
}

function cambiarCantidad(id, cambio) {
    const item = carrito.find((p) => p.id == id);
    if (!item) return;

    item.cantidad += cambio;
    if (item.cantidad <= 0) {
        eliminarProductoCarrito(id);
        return;
    }
    actualizarCarrito();
}

function eliminarProductoCarrito(id) {
    carrito = carrito.filter((p) => p.id != id);
    actualizarCarrito();
}

function vaciarCarrito() {
    carrito = [];
    actualizarCarrito();
    mostrarToast("Carrito vaciado", "alerta");
}

function renderizarListaCarrito() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = "";

    carrito.forEach((item) => {
        const li = document.createElement("li");
        li.className = "item-carrito";
        li.innerHTML = `
            <img class="item-carrito__imagen" src="${item.imagen || 'https://via.placeholder.com/80?text=Sin+Foto'}" alt="${item.nombre}">
            <div>
                <p class="item-carrito__nombre">${item.nombre}</p>
                <p class="item-carrito__precio">${formatear(item.precio)} c/u</p>
                <div class="cantidad">
                    <button class="cantidad__btn" data-accion="restar" data-id="${item.id}" aria-label="Restar uno">−</button>
                    <span class="cantidad__valor">${item.cantidad}</span>
                    <button class="cantidad__btn" data-accion="sumar" data-id="${item.id}" aria-label="Sumar uno">+</button>
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

// Eventos del carrito
if (listaCarrito) {
    listaCarrito.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-accion]");
        if (!boton) return;

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
    btnVaciar.addEventListener("click", vaciarCarrito);
}

// --------------------------------------------------------------------
// SECCIÓN 2: MÓDULO 1 — GESTIÓN DE PRODUCTOS (CRUD, API & DRAG & DROP)
// --------------------------------------------------------------------

// Base URL para API (permite funcionar si se abre desde Live Server en puerto 5500 o similar)
const API_BASE = (window.location.protocol === 'file:' || (window.location.port !== '3000' && window.location.port !== ''))
    ? 'http://localhost:3000'
    : '';

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

// Helper para Toast Notifications
let timeoutToast = null;
function mostrarToast(mensaje, tipo = "exito") {
    if (!toast) return;
    clearTimeout(timeoutToast);
    toast.textContent = mensaje;
    toast.className = `toast activo toast--${tipo}`;
    timeoutToast = setTimeout(() => {
        toast.classList.remove("activo");
    }, 3500);
}

// 1. Cargar Configuración de Umbrales del Servidor
async function cargarConfiguracion() {
    try {
        const respuesta = await fetch(`${API_BASE}/api/config`);
        if (respuesta.ok) {
            const config = await respuesta.json();
            umbralBajoGlobal = config.umbral_inventario_bajo || 5;
            if (inputProductoUmbral) inputProductoUmbral.value = umbralBajoGlobal;
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
        renderizarCatalogo(productos);
    } catch (error) {
        console.error('Error al cargar catálogo:', error);
        grillaProductos.innerHTML = `
            <div class="grilla-vacia">
                <div class="grilla-vacia__icono">⚠️</div>
                <h3 class="grilla-vacia__titulo">No se pudieron cargar los productos</h3>
                <p class="grilla-vacia__texto">${error.message}</p>
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

        const article = document.createElement("article");
        article.className = "producto";
        article.dataset.id = p.id;
        article.dataset.codigo = p.codigo;
        article.dataset.nombre = p.nombre;
        article.dataset.precio = p.precio;
        article.dataset.imagen = imagenSrc;
        article.dataset.categoria = p.categoria;

        article.innerHTML = `
            <div class="producto__imagen">
                <img src="${imagenSrc}" alt="${p.nombre}" loading="lazy">
                ${p.etiqueta ? `<span class="etiqueta">${p.etiqueta}</span>` : ''}
            </div>
            <div class="producto__info">
                <div class="producto__meta">
                    <span class="producto__codigo">${p.codigo}</span>
                    <span class="badge-stock ${estadoClase}">${estadoTexto}</span>
                </div>
                <p class="producto__categoria">${p.categoria}</p>
                <h3 class="producto__nombre">${p.nombre}</h3>
                <p class="producto__descripcion">${p.descripcion || 'Sin descripción detallada.'}</p>
                <div class="producto__precio-stock">
                    <p class="producto__precio">${formatear(p.precio)}</p>
                </div>
                <button class="boton boton--primario btn-agregar" type="button" ${estaAgotado ? 'disabled title="Producto agotado"' : ''}>
                    ${estaAgotado ? 'Agotado' : 'Agregar al carrito'}
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

        const esEdicion = Boolean(id);
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

        // C) Botón Agregar al Carrito (mantiene compatibilidad completa)
        const botonAgregar = evento.target.closest(".btn-agregar");
        if (botonAgregar && !botonAgregar.disabled) {
            const tarjeta = botonAgregar.closest(".producto");
            const producto = {
                id: tarjeta.dataset.id,
                nombre: tarjeta.dataset.nombre,
                precio: Number(tarjeta.dataset.precio),
                imagen: tarjeta.dataset.imagen
            };

            agregarProducto(producto);

            // Feedback visual del botón
            const textoOriginal = botonAgregar.textContent;
            botonAgregar.textContent = "Agregado ^^";
            botonAgregar.classList.add("boton--agregado");
            setTimeout(() => {
                botonAgregar.textContent = textoOriginal;
                botonAgregar.classList.remove("boton--agregado");
            }, 1000);
        }
    });
}

// 9. Asignar Eventos de Modales
function inicializarEventosModales() {
    if (btnNuevoProducto) btnNuevoProducto.addEventListener("click", abrirModalCrear);
    if (btnCerrarModal) btnCerrarModal.addEventListener("click", cerrarModalProducto);
    if (btnCancelarProducto) btnCancelarProducto.addEventListener("click", cerrarModalProducto);
    if (formProducto) formProducto.addEventListener("submit", guardarProducto);

    if (btnCerrarModalEliminar) btnCerrarModalEliminar.addEventListener("click", cerrarModalEliminar);
    if (btnCancelarEliminar) btnCancelarEliminar.addEventListener("click", cerrarModalEliminar);
    if (btnConfirmarEliminar) btnConfirmarEliminar.addEventListener("click", confirmarEliminacion);

    // Cerrar con Escape
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modalProducto && !modalProducto.hidden) cerrarModalProducto();
            if (modalEliminar && !modalEliminar.hidden) cerrarModalEliminar();
        }
    });

    // Cerrar al hacer clic en el backdrop
    [modalProducto, modalEliminar].forEach((modal) => {
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    if (modal === modalProducto) cerrarModalProducto();
                    if (modal === modalEliminar) cerrarModalEliminar();
                }
            });
        }
    });
}

// --------------------------------------------------------------------
// INICIALIZACIÓN GENERAL AL CARGAR EL DOM
// --------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    actualizarCarrito();
    inicializarDragAndDrop();
    inicializarBuscadorYFiltros();
    inicializarEventosGrilla();
    inicializarEventosModales();

    await cargarConfiguracion();
    await cargarProductos();
});

// En caso de que el script cargue después de DOMContentLoaded
if (document.readyState === "complete" || document.readyState === "interactive") {
    actualizarCarrito();
}
