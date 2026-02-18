# TransportePeru SaaS - PRD (Product Requirements Document)

## 1. Visión del Producto

**TransportePeru SaaS** es un sistema de gestión integral para empresas de transporte de carga terrestre en Perú. El sistema es multi-tenant, permitiendo que múltiples empresas de transporte utilicen la misma plataforma de manera aislada.

## 2. Stack Tecnológico

- **Backend**: FastAPI + Python 3.x
- **Base de Datos**: MongoDB (motor async)
- **Frontend**: React 18 + TailwindCSS + shadcn/ui
- **Autenticación**: JWT con refresh tokens
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

## 5. Módulos Implementados

### 5.1 Autenticación (✅ Completo)
- Login dual: Admin (email/password) + Chofer (DNI/PIN)
- JWT con refresh tokens
- Bloqueo de cuenta tras 5 intentos fallidos
- Force password change

### 5.2 Vehículos (✅ Completo)
- Tipos: Tracto y Carreta
- Estados: Disponible, En Viaje, En Mantenimiento, Fuera de Servicio
- Configuración de llantas por vehículo
- Historial de acoplamiento tracto-carreta

### 5.3 Documentos (✅ Completo)
- Tipos de documento configurables (SOAT, Revisión Técnica, etc.)
- Alertas automáticas de vencimiento
- Reglas de bloqueo operativo
- Matriz de documentos con estados

### 5.4 Viajes (✅ Completo)
- Programación de viajes
- Asignación de tracto, carreta y chofer
- Validación de bloqueos operativos
- Estados: Programado, En Curso, Completado, Cancelado

### 5.5 Combustible (✅ Completo)
- Gestión de vales de combustible
- Registro de cargas con odómetro
- KPIs de rendimiento (km/galón)
- Conciliación de vales

### 5.6 Llantas (✅ Completo)
- Inventario de llantas con serial DOT
- Montaje/desmontaje con registro de km
- Inspecciones con profundidad y presión
- Historial de vida (VN, R1, R2)
- Esquema visual por vehículo

### 5.7 Mantenimiento (✅ Completo)
- Planes de mantenimiento preventivo
- Órdenes de trabajo (correctivo/preventivo)
- Consumo de inventario desde OTs
- Registro de downtime

### 5.8 Inventario (✅ Completo)
- Kardex de repuestos y consumibles
- Stock mínimo/máximo con alertas
- Movimientos (entrada, salida, ajuste, consumo OT)
- Gestión de proveedores

### 5.9 Incidentes (✅ Completo)
- Tipos: Incidente, Multa, Siniestro
- Severidad: Baja, Media, Alta, Crítica
- Generación automática desde checklist crítico
- Vinculación con OTs para resolución

### 5.10 Viáticos y Liquidación (✅ Completo)
- Anticipos de viaje
- Registro de gastos por categoría (alimentación, hospedaje, peajes, etc.)
- Cálculo automático de saldo
- Flujo de liquidación (pendiente → en revisión → cerrado)

### 5.11 Checklist del Chofer (✅ Completo)
- Wizard de 5 pasos: Información, Inspección, Llantas, Fotos, Firma
- Checklist configurable por tipo de vehículo
- Captura de geolocalización
- Bloqueo de viaje si hay items críticos
- Generación automática de incidencias

### 5.12 Dashboard (✅ Completo)
- KPIs principales: Vehículos disponibles, Viajes activos, Alertas
- Matriz de documentos resumida
- Disponibilidad de flota
- Órdenes de trabajo pendientes

## 6. API Endpoints Principales

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
│   ├── models/           # Modelos Pydantic (por refactorizar)
│   ├── routers/          # Routers modulares (por refactorizar)
│   └── utils/            # Utilidades
├── frontend/
│   ├── src/
│   │   ├── pages/        # Páginas React
│   │   ├── components/   # Componentes UI (shadcn)
│   │   ├── context/      # AuthContext
│   │   ├── layouts/      # MainLayout
│   │   └── services/     # API client
│   └── package.json
├── memory/
│   └── PRD.md           # Este documento
└── test_reports/
    └── iteration_*.json  # Reportes de pruebas
```

## 10. Changelog

### 2025-02-16 (Sesión Actual)
- ✅ Implementado módulo completo de Viáticos y Liquidación
- ✅ Implementado Checklist del Chofer con wizard de 5 pasos
- ✅ Creada página de gestión de Llantas (TiresPage)
- ✅ Creada página de Incidentes (IssuesPage)
- ✅ Actualizado menú de navegación con todos los módulos
- ✅ Corregidos bugs de doble prefijo /api en llamadas a API
- ✅ Agregado endpoint POST /api/trip/{id}/checklist

### Anteriores
- Fase 1 MVP completada: Auth, Dashboard, Vehículos, Documentos, Viajes
- Expandido backend con todos los modelos y endpoints
- Creadas páginas de Combustible, Mantenimiento, Inventario

## 11. Tareas Pendientes (Backlog)

### P1 - Próximas
- [ ] **Refactorización del Backend**: Dividir server.py (3700+ líneas) en routers modulares
- [ ] **Página de Reportes**: Implementar exportación PDF/Excel
- [ ] **Página de Configuración**: Gestión de tipos de documento, plantillas de checklist

### P2 - Futuras
- [ ] **PWA del Chofer**: Implementar service worker para capacidad offline
- [ ] **Integración S3**: Para almacenamiento de fotos y documentos
- [ ] **Notificaciones Push**: Alertas en tiempo real
- [ ] **Integración GPS**: Tracking de vehículos en tiempo real

### P3 - Mejoras
- [ ] Dashboard personalizado por rol
- [ ] Gráficos avanzados con tendencias
- [ ] Sistema de comentarios en incidentes
- [ ] Historial de auditoría visible

## 12. Notas Técnicas

### MongoDB
- Todas las respuestas excluyen `_id` para evitar errores de serialización
- Los ObjectId se convierten a string antes de retornar

### Autenticación
- Access token expira en 30 minutos
- Refresh token expira en 7 días
- Los tokens se almacenan en localStorage

### Frontend
- Hot reload habilitado (no requiere restart manual)
- Componentes shadcn/ui en `/app/frontend/src/components/ui/`
- Estilos personalizados en App.css con variables CSS
