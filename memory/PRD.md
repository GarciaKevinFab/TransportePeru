# TransportePeru SaaS - PRD (Product Requirements Document)

## Información General
- **Nombre:** TransportePeru SaaS
- **Descripción:** Sistema de Gestión de Transportes y Flota para empresas de transporte en Perú
- **Tecnologías:** FastAPI (Backend), React (Frontend), MongoDB (Database), TailwindCSS + shadcn/ui (Styling)
- **Preview URL:** https://fleet-manager-pe.preview.emergentagent.com

## Credenciales de Prueba
- **Admin:** admin@transperu.com / admin123
- **Chofer:** DNI 12345678 / PIN 123456

---

## Módulos Implementados

### 1. ✅ Autenticación
- Login de administradores (email/password)
- Login de choferes (DNI/PIN)
- JWT tokens para sesiones
- Roles: owner, admin, operaciones, flota, mantenimiento, almacen, contabilidad, chofer

### 2. ✅ Dashboard
- **Dashboard Admin:** KPIs completos (vehículos, viajes, alertas, documentos, disponibilidad de flota, choferes, OTs)
- **Dashboard Chofer:** Vista simplificada con viajes asignados, acciones rápidas
- Vista personalizada según rol del usuario

### 3. ✅ Gestión de Vehículos
- CRUD completo de vehículos (tractos y carretas)
- Edición por admin en modal
- Estados: disponible, en_viaje, en_mantenimiento, fuera_servicio
- Configuración de 6 llantas por vehículo

### 4. ✅ Gestión de Documentos
- Matriz de documentos por vehículo/chofer
- Tipos de documentos configurables
- Alertas de vencimiento
- Estados: vigente, por_vencer, vencido

### 5. ✅ Gestión de Viajes
- CRUD completo con edición y eliminación por admin
- Estados: programado, en_curso, completado, cancelado
- Asignación de tracto, carreta, chofer
- Control de gastos por viaje

### 6. ✅ Gestión de Combustible
- Vales de combustible
- Cargas de combustible con foto
- **OCR:** Extracción automática de datos desde foto del vale usando Gemini Vision
- KPIs de consumo

### 7. ✅ Gestión de Llantas
- Inventario de llantas
- Esquema visual de llantas (6 por tracto, 6 por carreta)
- Montaje/desmontaje
- Alertas de desgaste

### 8. ✅ Mantenimiento
- Órdenes de trabajo (OT)
- CRUD con edición y eliminación por admin
- Estados: abierta, en_proceso, completada
- Tipos: correctivo, preventivo
- Prioridades: baja, normal, alta, urgente

### 9. ✅ Inventario
- Gestión de repuestos y partes
- Niveles de stock
- Alertas de stock bajo

### 10. ✅ Incidentes
- Reporte de incidentes
- Estados: reportado, en_revision, resuelto
- Tipos: accidente, averia, robo, otro

### 11. ✅ Viáticos/Liquidaciones
- Gestión de gastos de viaje
- Estados de liquidación
- Aprobación de gastos

### 12. ✅ Checklist del Chofer
- Asistente paso a paso (wizard)
- Firma digital del chofer
- Captura de fotos

### 13. ✅ Reportes
- Exportación a PDF y Excel
- Reportes por módulo

### 14. ✅ Configuración
- Configuración general de la empresa
- Tipos de documentos
- Plantillas de checklist
- Configuración de alertas

### 15. ✅ Notificaciones
- Popover de notificaciones en el header
- Marcado como leído
- Historial de notificaciones

### 16. ✅ Usuarios
- CRUD completo con edición y eliminación por admin
- Gestión de roles
- Reset de PIN para choferes

---

## Funcionalidades Técnicas

### Backend
- FastAPI con async/await
- MongoDB con motor
- JWT para autenticación
- Endpoints RESTful completos
- OCR con Gemini Vision (emergentintegrations)
- Subida de archivos

### Frontend
- React con hooks
- React Router para navegación
- Axios para API calls
- TailwindCSS + shadcn/ui
- date-fns para fechas
- react-signature-canvas para firmas

### PWA (Base)
- manifest.json configurado
- service-worker.js básico
- Hook useOffline

---

## Tareas Pendientes (Backlog)

### P1 - Importantes
1. **Notificaciones Push Reales:** Implementar Web Push con service worker completo
2. **Integración S3 Completa:** Subida de archivos a AWS S3 (boto3 instalado, endpoints creados)
3. **Refactorización Backend:** Dividir server.py (+4800 líneas) en routers modulares

### P2 - Mejoras
1. **PWA Offline Completa:** Sincronización de datos offline con IndexedDB
2. **Dashboard Chofer:** Mejorar vista con más acciones y estado del viaje
3. **Reportes Avanzados:** Gráficos y más filtros

### P3 - Futuras
1. **Integración GPS:** Tracking de vehículos en tiempo real
2. **App Móvil Nativa:** React Native para choferes
3. **Facturación:** Integración con SUNAT

---

## Última Actualización
- **Fecha:** 2025-02-19
- **Versión:** 1.5.0
- **Testing:** iteration_5.json - 94-100% success rate
