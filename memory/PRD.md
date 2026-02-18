# TransportePeru SaaS - PRD (Product Requirements Document)

## 1. Visión del Producto

**TransportePeru SaaS** es un sistema de gestión integral para empresas de transporte de carga terrestre en Perú. El sistema es multi-tenant, permitiendo que múltiples empresas de transporte utilicen la misma plataforma de manera aislada.

## 2. Stack Tecnológico

- **Backend**: FastAPI + Python 3.x
- **Base de Datos**: MongoDB (motor async)
- **Frontend**: React 18 + TailwindCSS + shadcn/ui
- **Autenticación**: JWT con refresh tokens
- **Exportación**: ReportLab (PDF), OpenPyXL (Excel)
- **PWA**: Service Worker con soporte offline
- **Hosting**: Emergent Platform

## 3. Arquitectura Multi-Tenant

Cada empresa tiene su propio `company_id` que se utiliza para aislar todos los datos. Los usuarios pertenecen a una empresa y solo pueden ver/modificar datos de su empresa.

## 4. Roles y Permisos (RBAC)

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| owner | Dueño de la empresa | Acceso total |
| admin | Administrador | Acceso total excepto facturación |
| operaciones | Jefe de operaciones | Viajes, combustible, incidentes |
| flota | Encargado de flota | Vehículos, documentos, llantas |
| mantenimiento | Jefe de taller | Mantenimiento, llantas |
| almacen | Encargado de almacén | Inventario |
| contabilidad | Contador | Viáticos, reportes |
| chofer | Conductor | App móvil (checklist, gastos, incidentes) |

## 5. Módulos Implementados (100% Completo)

### 5.1 Autenticación ✅
- Login dual: Admin (email/password) + Chofer (DNI/PIN)
- JWT con refresh tokens
- Bloqueo de cuenta tras 5 intentos fallidos
- Force password change

### 5.2 Vehículos ✅
- Tipos: Tracto y Carreta
- Estados: Disponible, En Viaje, En Mantenimiento, Fuera de Servicio
- Configuración de llantas por vehículo
- Historial de acoplamiento tracto-carreta

### 5.3 Documentos ✅
- Tipos de documento configurables (SOAT, Revisión Técnica, etc.)
- Alertas automáticas de vencimiento
- Reglas de bloqueo operativo
- Matriz de documentos con estados

### 5.4 Viajes ✅
- Programación de viajes
- Asignación de tracto, carreta y chofer
- Validación de bloqueos operativos
- Estados: Programado, En Curso, Completado, Cancelado

### 5.5 Viáticos y Liquidación ✅
- Anticipos de viaje con múltiples métodos de pago
- Registro de gastos por categoría (alimentación, hospedaje, peajes, etc.)
- Cálculo automático de saldo (favor empresa / favor chofer)
- Flujo de liquidación con cierre

### 5.6 Combustible ✅
- Gestión de vales de combustible
- Registro de cargas con odómetro
- KPIs de rendimiento (km/galón)
- Conciliación de vales

### 5.7 Llantas ✅
- Inventario de llantas con serial DOT
- Montaje/desmontaje con registro de km
- Inspecciones con profundidad y presión
- Historial de vida (VN, R1, R2)
- Esquema visual por vehículo

### 5.8 Mantenimiento ✅
- Planes de mantenimiento preventivo
- Órdenes de trabajo (correctivo/preventivo)
- Consumo de inventario desde OTs
- Registro de downtime

### 5.9 Inventario ✅
- Kardex de repuestos y consumibles
- Stock mínimo/máximo con alertas
- Movimientos (entrada, salida, ajuste, consumo OT)
- Gestión de proveedores

### 5.10 Incidentes ✅
- Tipos: Incidente, Multa, Siniestro
- Severidad: Baja, Media, Alta, Crítica
- Generación automática desde checklist crítico
- Vinculación con OTs para resolución

### 5.11 Checklist del Chofer ✅
- Wizard de 5 pasos: Información, Inspección, Llantas, Fotos, Firma
- Checklist configurable por tipo de vehículo
- Captura de geolocalización
- Bloqueo de viaje si hay items críticos
- Generación automática de incidencias

### 5.12 Reportes ✅
- **Reporte de Viajes**: Total viajes, km recorridos, anticipos, gastos, balance
- **Reporte de Combustible**: Cargas, litros, gasto total, precio promedio
- **Reporte de Mantenimiento**: OTs, costo total, por estado y tipo
- **Exportación Excel**: Viajes con todos los datos
- **Exportación PDF**: Liquidación de viaje con firma

### 5.13 Configuración ✅
- **Datos de Empresa**: Nombre, RUC, dirección, teléfono, email
- **Configuración Operativa**: 
  - Requerir checklist para iniciar viaje
  - Bloquear viaje con checklist crítico
  - Crear incidencia automática
- **Tipos de Documento**: CRUD completo con reglas de bloqueo
- **Plantillas de Checklist**: CRUD completo con items personalizables

### 5.14 PWA y Offline ✅
- Manifest.json para instalación en móviles
- Service Worker con caching estratégico
- IndexedDB para datos pendientes offline
- Background sync para sincronización automática
- Página offline cuando no hay conexión

### 5.15 Dashboard ✅
- KPIs principales: Vehículos disponibles, Viajes activos, Alertas
- Matriz de documentos resumida
- Disponibilidad de flota
- Órdenes de trabajo pendientes

## 6. API Endpoints

### Autenticación
- `POST /api/auth/login` - Login admin/chofer
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Usuario actual

### Recursos Core
- `/api/vehicles` - CRUD vehículos
- `/api/documents` - CRUD documentos
- `/api/trips` - CRUD viajes
- `/api/users` - CRUD usuarios

### Módulos Especializados
- `/api/fuel/vouchers` - Vales de combustible
- `/api/fuel/loads` - Cargas de combustible
- `/api/tires` - Inventario de llantas
- `/api/tires/mount`, `/api/tires/unmount` - Montaje/desmontaje
- `/api/maintenance/work-orders` - Órdenes de trabajo
- `/api/inventory/items` - Items de inventario
- `/api/issues` - Incidentes

### Viáticos
- `/api/trips/{id}/advances` - Anticipos
- `/api/trips/{id}/expenses` - Gastos
- `/api/settlements` - Liquidaciones
- `/api/settlements/{id}/close` - Cerrar liquidación

### Checklist
- `/api/checklist-templates` - Plantillas
- `/api/trip/{id}/checklist` - Enviar checklist

### Reportes
- `/api/reports/trips` - Reporte de viajes
- `/api/reports/trips/export/excel` - Exportar viajes a Excel
- `/api/reports/settlements/export/pdf/{trip_id}` - Exportar liquidación a PDF
- `/api/reports/fuel` - Reporte de combustible
- `/api/reports/maintenance` - Reporte de mantenimiento

### Configuración
- `/api/config/company` - Datos de empresa
- `/api/config/document-types` - Tipos de documento
- `/api/config/checklist-templates` - Plantillas de checklist

## 7. Credenciales de Prueba

- **Admin**: admin@transperu.com / admin123
- **Chofer**: DNI 12345678 / PIN 123456

## 8. URLs del Sistema

- **Frontend**: https://flota-peru.preview.emergentagent.com
- **API**: https://flota-peru.preview.emergentagent.com/api

## 9. Estructura de Archivos

```
/app/
├── backend/
│   ├── server.py          # API principal (FastAPI)
│   ├── requirements.txt   # Dependencias Python
│   ├── .env              # Variables de entorno
│   ├── models/           # Modelos Pydantic
│   ├── routers/          # Routers modulares
│   └── utils/            # Utilidades
├── frontend/
│   ├── public/
│   │   ├── manifest.json # PWA manifest
│   │   ├── service-worker.js # Service Worker
│   │   └── offline.html  # Página offline
│   └── src/
│       ├── pages/        # Páginas React (15 páginas)
│       ├── components/   # Componentes UI (shadcn)
│       ├── context/      # AuthContext
│       ├── hooks/        # useOffline
│       ├── layouts/      # MainLayout
│       └── services/     # API client
├── memory/
│   └── PRD.md           # Este documento
└── test_reports/
    └── iteration_*.json  # Reportes de pruebas
```

## 10. Changelog

### 2025-02-18 (Sesión Actual)
- ✅ Implementada página de Reportes con exportación PDF/Excel
- ✅ Implementada página de Configuración completa
- ✅ Agregados endpoints de reportes y configuración
- ✅ Implementada PWA con service worker y soporte offline
- ✅ Creado componente OfflineIndicator
- ✅ Creado hook useOffline para gestión de datos offline
- ✅ Actualizado manifest.json para instalación PWA
- ✅ Testing completo: 100% backend, 100% frontend

### 2025-02-16
- ✅ Implementado módulo completo de Viáticos y Liquidación
- ✅ Implementado Checklist del Chofer con wizard de 5 pasos
- ✅ Creada página de gestión de Llantas (TiresPage)
- ✅ Creada página de Incidentes (IssuesPage)

### Anteriores
- Fase 1 MVP completada: Auth, Dashboard, Vehículos, Documentos, Viajes
- Expandido backend con todos los modelos y endpoints
- Creadas páginas de Combustible, Mantenimiento, Inventario

## 11. Estado del Sistema

✅ **SISTEMA COMPLETAMENTE FUNCIONAL**

Todas las funcionalidades solicitadas han sido implementadas y probadas:
- 15 páginas de frontend funcionando
- 50+ endpoints de API
- PWA instalable en móviles
- Soporte offline con sincronización
- Exportación PDF/Excel

## 12. Notas Técnicas

### MongoDB
- Todas las respuestas excluyen `_id` para evitar errores de serialización
- Los ObjectId se convierten a string antes de retornar

### Autenticación
- Access token expira en 30 minutos
- Refresh token expira en 7 días
- Los tokens se almacenan en localStorage

### PWA
- Service Worker maneja caching con estrategia network-first
- IndexedDB almacena datos pendientes de sincronización
- Background Sync envía datos cuando vuelve la conexión

### Exportación
- PDF generado con ReportLab (tablas, estilos, firmas)
- Excel generado con OpenPyXL (estilos, bordes, anchos automáticos)
