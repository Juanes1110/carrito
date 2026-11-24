//===========================CODIGO CARRITO COMPLETADO=================================
/*
Nombres: 
    Juan Esteban Colorado 
    Daniel Alexander Cobo
*/
//===========================3. Se declara el umbral para el descuento, en este caso 250.000===========================
const umbral_descuento = 250000
const porcentaje_descuento = 0.15

//===========================4. Se declara el umbral para el envio gratuito y su tarifa (si no cumple el umbral)===========================
const umbral_envio_gratis = 40000
const adicional_envio = 15000
const spanEnvio = document.getElementById("envio")
//========================================================================================================================

const grillaProductos = document.getElementById("grilla-productos")
const listaCarrito = document.querySelector("#lista-carrito")
const carritoVacio = document.querySelector("#carrito-vacio")
const contadorCarrito = document.getElementById("contador-carrito")
const spanSubtotal = document.getElementById("subtotal")
const spanDescuento = document.getElementById("descuento")
const filaDescuento = document.getElementById("fila-descuento")
const spanTotal = document.querySelector("#total")
const cajaPromo = document.getElementById("promo")
const textoPromo = document.getElementById("promo-texto")
const barraProgreso = document.getElementById("progreso-barra")
const btnVaciar = document.getElementById("vaciar-carrito")
const btnPagar = document.querySelector("#btn-pagar")
const toast = document.getElementById("toast")


const CLAVE_STORAGE = "novastore_carrito"
let carrito = cargarCarrito()

const formatoPesos = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
})

function formatear(valor){
    return formatoPesos.format(valor)
}

function cargarCarrito(){
    try{
        const datos = localStorage.getItem(CLAVE_STORAGE)
        return datos ? JSON.parse(datos) : []
    }catch(error){
        return[]
    }    
}

function agregarProducto(producto){
    const existente = carrito.find((item)=> item.id === producto.id)

    if(existente){
        existente.cantidad++
    }else{
        carrito.push({... producto,cantidad: 1})
    }

    actualizar()
}

function calcularTotales(){
    const cantidad = carrito.reduce((suma, item) => suma + item.cantidad,0)
    const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0)
    const aplicaDescuento = subtotal >= umbral_descuento
//===========================4. Se calcula si se aplica el envio gratis===========================
    const aplicaEnvioGratis = subtotal >= umbral_envio_gratis
    const envio = (cantidad > 0 && !aplicaEnvioGratis) ? adicional_envio : 0
//==============================================================================================================
    const descuento = aplicaDescuento ? Math.round(subtotal * porcentaje_descuento) : 0
    const total = subtotal - descuento + envio

    return {subtotal, descuento, envio, total, cantidad, aplicaDescuento}
}

function renderizarResumen(){
    const {subtotal, descuento, envio, total, cantidad, aplicaDescuento} = calcularTotales()
    spanSubtotal.textContent = formatear(subtotal)
    spanDescuento.textContent = `-${formatear(descuento)}`
    spanTotal.textContent = formatear(total)
    carritoVacio.hidden = carrito.length>0
//===========================3. Recuadro verde que solo aparece cuando supere 250.000===========================
    filaDescuento.hidden = !aplicaDescuento
    const spanAhorro = document.getElementById("ahorro")
    spanAhorro.textContent = formatear(descuento)
    cajaPromo.hidden = !aplicaDescuento
//===========================4. Se calcula si se aplica el envio gratis===========================
    spanEnvio.textContent = envio === 0 ? "Gratis": formatear(envio)
//==============================================================================================================
    contadorCarrito.textContent = cantidad
    carrito.hidden = carrito.length > 0
}

function cambiarCantidad(id, cambio){
    const item = carrito.find((p) => p.id === id)
    if(!item) return

    item.cantidad += cambio
    if(item.cantidad <= 0){
        eliminarProducto(id)
        return
    }
    actualizar()
    
}

//===========================1.Boton de aumentar y disminuir productos funcional===========================
//Este evento se dispara cuando se hace click en los botones + o -
listaCarrito.addEventListener("click",(evento) =>{
    const boton = evento.target.closest("[data-accion]")
    if(!boton) return

    const id = boton.dataset.id
    const accion = boton.dataset.accion

    if(accion === "sumar"){
        cambiarCantidad(id, 1)
    }else if(accion === "restar"){
        cambiarCantidad(id, -1)
    }else if(accion === "eliminar"){// Con esta logica se elimina el producto del carrito cuando llega a 0
        eliminarProducto(id)
    }
})

//===========================2. Boton de Vaciar Carrito funcional===========================
btnVaciar.addEventListener("click",vaciarCarrito)


function eliminarProducto(id){
    carrito = carrito.filter((p)=> p.id !== id)
    actualizar()
}

function vaciarCarrito(){
    carrito = []
    actualizar()
}
function renderizarLista(){
    listaCarrito.innerHTML =""

    carrito.forEach((item)=>{
        const li = document.createElement("li")
        li.className = "item-carrito"
        li.innerHTML = `
        <img class= "item-carrito__imagen" src="${item.imagen}" alt="${item.nombre}">
        <div>
            <p class = "item-carrito__nombre">${item.nombre}</p>
            <p class = "item-carrito__precio">${formatear(item.precio)} c/u</p>
            <div class = "cantidad">
                <button class="cantidad__btn" data-accion="restar" data-id="${item.id}" aria-label="Restar uno">-</button>
                <span class = " cantidad__valor">${item.cantidad}</span>
                <button class="cantidad__btn" data-accion="sumar" data-id="${item.id}" aria-label="Sumar uno">+</button>
            </div>
        </div>
        <div class = "item-carrito__lateral">
            <p class = "item-carrito__total">${formatear(item.precio * item.cantidad)}</p>
            <button class = "item-carrito__eliminar" data-accion="eliminar" data-id="${item.id}" aria-label="Eliminar producto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6"></path><path d="M14 11v6"></path>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
            </button>
        </div>


        

        `
        listaCarrito.appendChild(li)

    })
}

function actualizar(){
    try { localStorage.setItem(CLAVE_STORAGE, JSON.stringify(carrito)) } catch(e) {}
    renderizarLista()
    renderizarResumen()
}
//==========================EVENTOS=============================

//1. Agregar Producto al carrito
grillaProductos.addEventListener("click",(evento)=>{
    const boton = evento.target.closest(".btn-agregar")
    if(!boton) return


    const tarjeta = boton.closest(".producto")
    const producto ={
            id : tarjeta.dataset.id,
            nombre :  tarjeta.dataset.nombre,
            precio : Number(tarjeta.dataset.precio),
            imagen : tarjeta.dataset.imagen,
        }

        agregarProducto(producto)

        //mensaje visual del boton
        boton.textContent = "Agregado al carrito ^^"
        boton.classList.add("boton--agregado")
        setTimeout(()=>{
            boton.textContent = "Agregar al Carrito"
            boton.classList.remove("boton--agregado")
        },1000)
})

actualizar()