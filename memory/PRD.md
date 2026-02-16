# TransportePeru SaaS - PRD (Product Requirements Document)

## Fecha de Inicio: Enero 2026

---

## 1. Problema Original

SaaS completo de Gestión de Transportes y Flota para Perú (carga pesada), inspirado en funcionalidades tipo CloudFleet pero con UI/branding/código 100% original.

### Stack Técnico
- **Backend**: FastAPI + MongoDB (adaptado del requisito original Django/PostgreSQL)
- **Frontend**: React + Tailwind + shadcn/ui
- **Autenticación**: JWT con refresh tokens
- **Almacenamiento**: Local (S3 opcional)

### Decisiones del Usuario
1. MongoDB + FastAPI (entorno actual) ✓
2. Almacenamiento local ✓
3. Jobs síncronos para MVP ✓
4. JWT con refresh tokens ✓
5. Orden de implementación propuesto ✓

---

## 2. User Personas

| Rol | Descripción | Acceso Principal |
|-----|-------------|------------------|
| **Owner/Admin** | Gerencia, acceso total | Todo el sistema |
| **Operaciones** | Coordinadores de viajes | Viajes, monitoreo, asignación |
| **Flota** | Gestión de vehículos | Vehículos, documentos, llantas |
| **Mantenimiento** | Técnicos y mecánicos | OT, llantas, inspecciones |
| **Almacén** | Control de inventario | Stock, compras |
| **Contabilidad** | Finanzas | Anticipos, liquidaciones |
| **Chofer** | Conductores (PWA) | Viajes asignados, checklist, gastos |

---

## 3. Requisitos Core (Implementados)

### 3.1 Autenticación y RBAC ✅
- Login Admin: email + password
- Login Chofer: DNI (8 dígitos) + PIN (6 dígitos)
- Lockout: 5 intentos fallidos = bloqueo 15 min
- JWT con access_token + refresh_token
- Permisos por rol en cada endpoint

### 3.2 Gestión de Vehículos ✅
- Tipos: Tracto y Carreta
- CRUD completo con validaciones
- Estados: disponible, en_viaje, en_mantenimiento, fuera_servicio
- Historial de enganche (tracto + carreta)
- Configuración de llantas por tipo

### 3.3 Documentos y Vencimientos ✅
- Tipos de documento configurables
- Matriz visual (Excel-like) por vehículo/chofer
- Estados: vigente, por_vencer, vencido, pendiente
- Reglas de bloqueo configurables
- Alertas por días configurables (60/30/15/7/3/1)

### 3.4 Viajes ✅
- Programación y asignación
- Estados: programado, en_curso, completado, cancelado
- Validación de bloqueos al asignar
- Registro de km inicio/fin

### 3.5 Esquema de Llantas ✅
- Representación gráfica del vehículo
- Configuraciones: Tracto 6 llantas, Carreta 6 llantas
- Montaje/desmontaje con registro
- Inspecciones con profundidades y presión
- Alertas por desgaste y profundidad crítica

---

## 4. Lo Implementado (MVP Fase 1)

### Backend (FastAPI)
- [x] Modelos: Company, User, Vehicle, Document, Trip, Tire, etc.
- [x] Auth: login dual (admin/chofer), JWT refresh
- [x] CRUD completo para todas las entidades principales
- [x] Endpoints especiales: matrix documentos, dashboard KPIs
- [x] Seed data para demo

### Frontend (React)
- [x] Login page con tabs Admin/Chofer
- [x] Dashboard con KPIs y widgets
- [x] Página de vehículos con filtros y CRUD
- [x] Matriz de documentos tipo Excel
- [x] Esquema gráfico de llantas interactivo
- [x] Gestión de viajes
- [x] Gestión de usuarios
- [x] Layout responsive con sidebar colapsable

### Diseño
- Estética "Logistics Command Center"
- Colores: Slate-900 (sidebar), Orange-500 (accent)
- Tipografía: Barlow Condensed (headings), Inter (body)
- Sin gradientes, estilo industrial/profesional

---

## 5. Backlog Priorizado

### P0 - Crítico (Próxima iteración)
- [ ] Checklist pre-viaje del chofer
- [ ] Anticipos y rendición de gastos
- [ ] Combustible: vales y cargas
- [ ] PWA para choferes

### P1 - Alta Prioridad
- [ ] Órdenes de trabajo (mantenimiento)
- [ ] Alertas automáticas (job diario)
- [ ] Bloqueos operacionales automáticos
- [ ] Rotación y alineación de llantas
- [ ] Exportación PDF/Excel

### P2 - Media Prioridad
- [ ] Inventario y kardex
- [ ] Órdenes de compra
- [ ] Incidentes/multas/siniestros
- [ ] Reportes avanzados con KPIs
- [ ] Dashboard de rentabilidad

### P3 - Baja Prioridad
- [ ] Integración GPS
- [ ] Notificaciones push
- [ ] App móvil nativa
- [ ] Multi-idioma

---

## 6. Credenciales Demo

```
Admin:
  Email: admin@transperu.com
  Password: admin123

Chofer:
  DNI: 12345678
  PIN: 123456
```

---

## 7. Próximos Pasos

1. **Implementar Checklist del Chofer**
   - Plantilla configurable por tipo de vehículo
   - Campos: sí/no, texto, fotos, firma
   - Resultado: OK/OBSERVADO/CRÍTICO
   - Bloqueo de inicio si crítico

2. **Sistema de Viáticos**
   - Registro de anticipos
   - Gastos con foto de comprobante
   - Liquidación y cierre

3. **Módulo de Combustible**
   - Vales con límite y vigencia
   - Registro de cargas
   - Conciliación vale vs carga real

4. **PWA para Chofer**
   - Interfaz simplificada
   - Acceso offline básico
   - Cámara para fotos

---

*Documento actualizado: Enero 2026*
