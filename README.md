# NovaStore — Tienda en Línea & Módulo de Gestión de Productos

Proyecto web con carrito de compras y arquitectura lista para conectar con base de datos MariaDB / MySQL y desarrollar módulos de gestión.

---

## 🚀 Guía Rápida de Instalación y Puesta en Marcha

Sigue estos 4 pasos para tener el proyecto corriendo en tu computadora:

### 1. Clonar el repositorio e instalar dependencias
```bash
npm install
```

### 2. Montar la Base de Datos en MariaDB
El repositorio incluye el script SQL completo en la carpeta [`database/init.sql`](database/init.sql).

* **Opción A (Desde phpMyAdmin / DBeaver / HeidiSQL):**
  1. Abre phpMyAdmin o tu cliente SQL.
  2. Ve a la pestaña **Importar**.
  3. Selecciona el archivo `database/init.sql` y dale a **Ejecutar**.
  *(El script crea automáticamente la base de datos `novastore`, las tablas `categorias` y `productos`, e inserta los datos iniciales).*

* **Opción B (Desde la terminal MySQL/MariaDB):**
  ```bash
  mysql -u root -p < database/init.sql
  ```

### 3. Configurar las Variables de Entorno (`.env`)
En la raíz del proyecto existe un archivo `.env.example`. Crea tu archivo `.env` (si aún no existe) y ajusta tus credenciales:

```ini
PORT=3000

# Conexión a MariaDB
DB_HOST=localhost
DB_PORT=3306        # Si usas XAMPP y cambiaste a 3307, cámbialo aquí
DB_USER=root
DB_PASSWORD=tu_password_aqui
DB_NAME=novastore

# Umbral de inventario bajo
UMBRAL_INVENTARIO_BAJO=5
```

> **Nota de Seguridad:** El archivo `.env` está protegido en `.gitignore` para no filtrar tus contraseñas en GitHub.

### 4. Iniciar el Servidor
```bash
npm start
```
O en modo desarrollo con recarga automática:
```bash
npm run dev
```

El servidor estará corriendo en: `http://localhost:3000`

---

## 📡 Endpoints del Backend Listos para Implementar

El backend ([`server.js`](server.js)) ya tiene implementadas y parametrizadas las rutas para el **Módulo 1: Gestión de Productos**:

| Método | Endpoint | Descripción | Parámetros / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/productos` | Lista productos activos | Query opcional: `?q=texto` (busca por nombre o código), `?categoria=Audio` |
| `GET` | `/api/productos/:id` | Detalle de un producto | `id` en URL |
| `POST` | `/api/productos` | Registrar producto | JSON con `codigo`, `nombre`, `descripcion`, `categoria`, `precio`, `cantidad`, `umbral_inventario_bajo`, `imagen`, `etiqueta` |
| `PUT` | `/api/productos/:id` | Editar producto existente | JSON con campos a actualizar |
| `DELETE`| `/api/productos/:id`| Eliminación lógica (Soft Delete) | `id` en URL (marca `activo = 0` y registra fecha) |
| `GET` | `/api/categorias` | Lista de categorías de la tienda | Ninguno |
| `GET` | `/api/config` | Configuración de umbrales | Retorna valores de descuentos e inventario bajo |

---

## 🗄️ Estructura de la Base de Datos (`novastore`)

### Tabla `productos`
* `id`: Identificador numérico autoincremental.
* `codigo`: Código único del producto (validado contra duplicados).
* `nombre`: Nombre del producto.
* `descripcion`: Descripción detallada.
* `categoria`: Categoría asociada.
* `precio`: Precio en COP.
* `cantidad`: Stock disponible.
* `umbral_inventario_bajo`: Umbral configurable para alertar stock bajo (por defecto `5`).
* `imagen`: URL o ruta local de la imagen.
* `etiqueta`: Etiqueta comercial (`Nuevo`, `Más vendido`, etc.).
* `activo`: `1` para activo, `0` para eliminado lógicamente.
* `fecha_creacion`: Timestamp de registro.
* `fecha_actualizacion`: Timestamp de última edición.
* `fecha_eliminacion`: Timestamp de cuando fue eliminado lógicamente.
