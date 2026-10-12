from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.usuarios.models import Departamento
from apps.materiales.models import Categoria, Proveedor, Material
from apps.activos.models import ActivoFijo
import random
from datetime import date

Usuario = get_user_model()


class Command(BaseCommand):
    help = 'Carga datos iniciales para el Sistema WEG - Alcaldía de Shinahota'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('>>> Cargando datos iniciales...'))

        # Departamentos
        departamentos_data = [
            'Activos Fijos', 'Administración', 'Finanzas', 'Obras Públicas',
            'Educación', 'Salud', 'Sistemas', 'Recursos Humanos', 'Secretaría',
            'Desarrollo Productivo', 'Urbanismo y Catastro', 'Contabilidad y Presupuesto'
        ]
        departamentos = {}
        for nombre in departamentos_data:
            dep, _ = Departamento.objects.get_or_create(nombre=nombre)
            departamentos[nombre] = dep
        self.stdout.write(f'  OK {len(departamentos)} departamentos creados')

        # Usuarios
        if not Usuario.objects.filter(email='admin@shinahota.bo').exists():
            Usuario.objects.create_superuser(
                email='admin@shinahota.bo',
                password='12345',
                nombre='Administrador',
                apellido='Sistema',
                rol='ADMIN',
                departamento=departamentos['Activos Fijos']
            )
        if not Usuario.objects.filter(email='jefe@shinahota.bo').exists():
            u = Usuario.objects.create_user(
                email='jefe@shinahota.bo',
                password='12345',
                nombre='Juan',
                apellido='Mamani',
                rol='JEFE_ALMACEN',
                departamento=departamentos['Activos Fijos'],
                ci='1234567'
            )
        if not Usuario.objects.filter(email='solicitante@shinahota.bo').exists():
            Usuario.objects.create_user(
                email='solicitante@shinahota.bo',
                password='12345',
                nombre='María',
                apellido='Quispe',
                rol='SOLICITANTE',
                departamento=departamentos['Educación'],
                ci='7654321'
            )
        if not Usuario.objects.filter(email='auditor@shinahota.bo').exists():
            Usuario.objects.create_user(
                email='auditor@shinahota.bo',
                password='12345',
                nombre='Carlos',
                apellido='Flores',
                rol='AUDITOR',
                departamento=departamentos['Finanzas'],
                ci='9876543'
            )
        self.stdout.write('  OK Usuarios creados')

        # Categorías
        cats_data = [
            'Útiles de Escritorio', 'Material de Limpieza', 'Herramientas',
            'Equipos de Cómputo', 'Material de Construcción', 'Mobiliario',
            'Material Eléctrico', 'Material Médico'
        ]
        categorias = {}
        for nombre in cats_data:
            cat, _ = Categoria.objects.get_or_create(nombre=nombre)
            categorias[nombre] = cat
        self.stdout.write(f'  OK {len(categorias)} categorias creadas')

        # Proveedores
        proveedores_data = [
            {'nombre': 'Distribuidora El Progreso', 'nit': '1234567', 'telefono': '73456789'},
            {'nombre': 'Suministros Bolivia S.R.L.', 'nit': '9876543', 'telefono': '65432187'},
            {'nombre': 'TecnoBolivia', 'nit': '5555555', 'telefono': '71111222'},
        ]
        proveedores = []
        for p in proveedores_data:
            prov, _ = Proveedor.objects.get_or_create(nombre=p['nombre'], defaults=p)
            proveedores.append(prov)
        self.stdout.write(f'  OK {len(proveedores)} proveedores creados')

        # Materiales
        materiales_data = [
            {'codigo': 'MAT-001', 'nombre': 'Resma de papel A4', 'categoria': 'Útiles de Escritorio', 'unidad_medida': 'RESMA', 'stock_actual': 50, 'stock_minimo': 10, 'precio_unitario': 35},
            {'codigo': 'MAT-002', 'nombre': 'Bolígrafos BIC', 'categoria': 'Útiles de Escritorio', 'unidad_medida': 'CAJA', 'stock_actual': 20, 'stock_minimo': 5, 'precio_unitario': 12},
            {'codigo': 'MAT-003', 'nombre': 'Detergente en polvo 1kg', 'categoria': 'Material de Limpieza', 'unidad_medida': 'UNIDAD', 'stock_actual': 30, 'stock_minimo': 10, 'precio_unitario': 18},
            {'codigo': 'MAT-004', 'nombre': 'Escoba', 'categoria': 'Material de Limpieza', 'unidad_medida': 'UNIDAD', 'stock_actual': 8, 'stock_minimo': 3, 'precio_unitario': 25},
            {'codigo': 'MAT-005', 'nombre': 'Cable UTP Cat6 (metro)', 'categoria': 'Material Eléctrico', 'unidad_medida': 'MT', 'stock_actual': 200, 'stock_minimo': 50, 'precio_unitario': 4.5},
            {'codigo': 'MAT-006', 'nombre': 'Toner HP LaserJet', 'categoria': 'Equipos de Cómputo', 'unidad_medida': 'UNIDAD', 'stock_actual': 3, 'stock_minimo': 2, 'precio_unitario': 280},
            {'codigo': 'MAT-007', 'nombre': 'Cinta adhesiva 18mm', 'categoria': 'Útiles de Escritorio', 'unidad_medida': 'UNIDAD', 'stock_actual': 40, 'stock_minimo': 10, 'precio_unitario': 5},
            {'codigo': 'MAT-008', 'nombre': 'Marcador permanente Pilot', 'categoria': 'Útiles de Escritorio', 'unidad_medida': 'CAJA', 'stock_actual': 0, 'stock_minimo': 3, 'precio_unitario': 24},
        ]
        for m in materiales_data:
            cat_nombre = m.pop('categoria')
            if not Material.objects.filter(codigo=m['codigo']).exists():
                Material.objects.create(
                    categoria=categorias[cat_nombre],
                    proveedor=random.choice(proveedores),
                    **m
                )
        self.stdout.write(f'  OK {len(materiales_data)} materiales creados')

        # Activos Fijos
        jefe = Usuario.objects.filter(rol='JEFE_ALMACEN').first()
        activos_data = [
            {'codigo_patrimonial': 'AF-2024-001', 'nombre': 'Computadora de Escritorio HP', 'tipo': 'TECNOLOGIA', 'estado': 'BUENO', 'valor_adquisicion': 4500, 'fecha_adquisicion': date(2023, 3, 15)},
            {'codigo_patrimonial': 'AF-2024-002', 'nombre': 'Impresora Multifuncional Epson', 'tipo': 'TECNOLOGIA', 'estado': 'BUENO', 'valor_adquisicion': 2800, 'fecha_adquisicion': date(2023, 5, 20)},
            {'codigo_patrimonial': 'AF-2024-003', 'nombre': 'Escritorio de Madera', 'tipo': 'MUEBLE', 'estado': 'REGULAR', 'valor_adquisicion': 1200, 'fecha_adquisicion': date(2021, 1, 10)},
            {'codigo_patrimonial': 'AF-2024-004', 'nombre': 'Silla Ergonómica', 'tipo': 'MUEBLE', 'estado': 'BUENO', 'valor_adquisicion': 850, 'fecha_adquisicion': date(2023, 8, 5)},
            {'codigo_patrimonial': 'AF-2024-005', 'nombre': 'Vehículo Toyota Hilux 2022', 'tipo': 'VEHICULO', 'estado': 'BUENO', 'valor_adquisicion': 85000, 'fecha_adquisicion': date(2022, 6, 1)},
        ]
        for a in activos_data:
            if not ActivoFijo.objects.filter(codigo_patrimonial=a['codigo_patrimonial']).exists():
                ActivoFijo.objects.create(
                    departamento=departamentos['Activos Fijos'],
                    responsable=jefe,
                    vida_util_anios=5,
                    porcentaje_depreciacion=20,
                    **a
                )
        self.stdout.write(f'  OK {len(activos_data)} activos fijos creados')

        self.stdout.write(self.style.SUCCESS('\nDatos iniciales cargados exitosamente!'))
        self.stdout.write('\nCREDENCIALES DE ACCESO:')
        self.stdout.write('  Admin:          admin@shinahota.bo / 12345')
        self.stdout.write('  Jefe Almacen:   jefe@shinahota.bo / 12345')
        self.stdout.write('  Solicitante:    solicitante@shinahota.bo / 12345')
        self.stdout.write('  Auditor:        auditor@shinahota.bo / 12345')
