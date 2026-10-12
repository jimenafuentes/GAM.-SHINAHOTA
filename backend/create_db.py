# ============================================================
# create_db.py - Script de Creación Inicial de Base de Datos
# ============================================================
# Este script de Python se conecta directamente al gestor PostgreSQL
# para inicializar la base de datos "sistema_weg". Evita que el usuario
# deba crear la base de datos manualmente a través de pgAdmin o consola SQL.
#
# Uso: python create_db.py
# ============================================================

import psycopg2

try:
    # 1. Establece la conexión inicial con el se
    # Servidor local de PostgreSQL.
    # Se conecta a la base de datos por defecto 'postgres' para poder operar.
    conn = psycopg2.connect(
        host='localhost',
        user='postgres',
        password='12345',
        dbname='postgres'
    )
    
    # 2. Habilita autocommit para poder ejecutar comandos de definición de
    #    esquema (como CREATE DATABASE) que no pueden ejecutarse dentro de transacciones.
    conn.autocommit = True
    cur = conn.cursor()
    
    # 3. Verifica mediante una consulta de catálogo si la base de datos ya existe.
    cur.execute("SELECT 1 FROM pg_database WHERE datname='sistema_weg'")
    exists = cur.fetchone()
    
    # 4. Si no existe, la crea físicamente.
    if not exists:
        cur.execute("CREATE DATABASE sistema_web")
        print("Base de datos 'sistema_web' creada exitosamente")
    else:
        print("Base de datos 'sistema_web' ya existe")
        
    # 5. Cierra los recursos de conexión de base de datos
    conn.close()
except Exception as e:
    print(f"Error al intentar crear la base de datos: {e}")
