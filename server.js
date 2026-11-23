
const express = require('express')

const mysql = require('mysql2/promise')
const path = require('path')

const app = express()
const PORT = 3307

const UMBRAL_DESCUENTO = 250000
const PORCENTAJE_DESCUENTO = 0.15

app.use(express.json())
app.use(express.static(path.json(__dirname,'public')))

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'aezakmi123',
    database: 'novastore',
    waitForConnections: true,
    connectionLimit: 10
})

app.get('/api/productos', async(req,res)=>{
    const [productos] =await pool.query(
    'SELECT id, nombre, categoria, precio, imagen, etiqueta FROM productos ORDER by id'
    )
})