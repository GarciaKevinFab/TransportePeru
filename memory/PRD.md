# TransportePeru SaaS - PRD (Product Requirements Document)

## Información General
- **Nombre:** TransportePeru SaaS
- **Descripción:** Sistema de Gestión de Transportes y Flota para empresas de transporte en Perú
- **Tecnologías:** FastAPI (Backend), React (Frontend), MongoDB (Database), TailwindCSS + shadcn/ui (Styling)
- **Preview URL:** https://fleet-manager-pe.preview.emergentagent.com

## Credenciales de Prueba
- **Admin:** admin@transperu.com / admin123
- **Chofer:** DNI 12345678 / PIN 123456

## URLs de Acceso
- **Panel Admin:** /login
- **App Chofer:** /driver/login

---

## Módulos Implementados

### 1. ✅ Autenticación
- Login de administradores (email/password)
- Login de choferes (DNI/PIN) 
- JWT tokens para sesiones
- Roles: owner, admin, operaciones, flota, mantenimiento, almacen, contabilidad, chofer

### 2. ✅ Dashboard Personalizado por Rol
- **Dashboard Admin:** KPIs completos (vehículos, viajes, alertas, documentos, disponibilidad de flota, choferes, OTs)
- **Dashboard Chofer:** Vista simplificada con viajes asignados, acciones rápidas

### 3. ✅ App Móvil para Choferes (PWA)
- Login dedicado con DNI/PIN
- Home con viaje activo y próximos viajes
- Registro de combustible con OCR
- Reporte de incidentes con fotos y ubicación
- Checklist de salida
- Navegación inferior optimizada para móvil

### 4. ✅ Gestión de Vehículos
- CRUD completo con edición por admin
- Estados: disponible, en_viaje, en_mantenimiento, fuera_servicio
- Configuración de 6 llantas por vehículo

### 5. ✅ Gestión de Documentos
- Matriz de documentos por vehículo/chofer
- Alertas de vencimiento

### 6. ✅ Gestión de Viajes
- CRUD completo con edición y eliminación por admin
- Estados: programado, en_curso, completado, cancelado

### 7. ✅ Gestión de Combustible
- Vales de combustible
- Cargas con foto y OCR (Gemini Vision)
- KPIs de consumo

### 8. ✅ Gestión de Llantas
- Inventario y esquema visual (6 llantas por vehículo)

### 9. ✅ Mantenimiento
- Órdenes de trabajo con edición por admin

### 10. ✅ Inventario
- Gestión de repuestos

### 11. ✅ Incidentes
- Reporte con fotos y geolocalización

### 12. ✅ Viáticos/Liquidaciones
- Gestión de gastos de viaje

### 13. ✅ Checklist del Chofer
- Asistente paso a paso con firma digital

### 14. ✅ Reportes
- Exportación a PDF y Excel

### 15. ✅ Notificaciones
- Popover en header con historial

### 16. ✅ Usuarios
- CRUD con edición por admin

---

## Integraciones

### ✅ OCR con Gemini Vision
- Extracción automática de datos de vales de combustible
- Usa emergentintegrations con EMERGENT_LLM_KEY

### 🟡 AWS S3 (Preparado)
- boto3 instalado
- Endpoints de upload configurados
- Requiere credenciales AWS para producción

---

## Tareas Pendientes (Backlog)

### P1 - Importantes
1. **Notificaciones Push Reales:** Web Push con service worker
2. **Credenciales S3:** Configurar AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY
3. **Refactorización Backend:** Dividir server.py en routers modulares

### P2 - Mejoras
1. **PWA Offline Completa:** Sincronización con IndexedDB
2. **GPS Tracking:** Tracking en tiempo real

---

## Última Actualización
- **Fecha:** 2025-02-19
- **Versión:** 1.6.0
- **Nuevas funcionalidades:** App Móvil Chofer, Integración S3 preparada
