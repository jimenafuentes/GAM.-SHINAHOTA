# ============================================================
# recreate_db.py - Script de Recreación Completa de Base de Datos
# ============================================================
# Este script se utiliza para restablecer completamente la base de datos,
# útil en desarrollo cuando se cambia el esquema de modelos o se desea
# realizar una limpieza de datos limpia (Limpieza de Estado Inicial).
#
# Advertencia: Esto ELIMINARÁ todos los datos existentes en 'sistema_weg'.
#
# Uso: python recreate_db.py
# ============================================================

import psycopg2

try:
    # 1. Conexión al servidor local de PostgreSQL.
    #    Nos conectamos a la BD por defecto 'postgres'.
    conn = psycopg2.connect(
        host='localhost',
        user='postgres',
        password='12345',
        dbname='postgres'
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    # 2. Termina las conexiones activas a la base de datos 'sistema_weg'.
    #    Esto es crucial para evitar errores de tipo "Database is being accessed by other users",
    #    que ocurre si el servidor de Django u otro pgAdmin tiene la conexión abierta.
    cur.execute("""
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'sistema_web'
          AND pid <> pg_backend_pid();
    """)
    print("Conexiones activas a 'sistema_weg' terminadas.")

    # 3. Elimina la base de datos si existe de forma permanente.
    cur.execute("DROP DATABASE IF EXISTS sistema_weg")
    print("Base de datos 'sistema_weg' eliminada si existía.")

    # 4. Crea una base de datos totalmente vacía.
    cur.execute("CREATE DATABASE sistema_weg")
    print("Base de datos 'sistema_weg' creada exitosamente.")

    # 5. Cierra los recursos de conexión.
    conn.close()
except Exception as e:
    print(f"Error recreando base de datos: {e}")
