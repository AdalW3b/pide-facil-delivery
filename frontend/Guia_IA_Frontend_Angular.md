# Guía de Generación IA: Frontend Core (Angular + Tailwind CSS) - Pide Facil

Este documento contiene los **Prompts Secuenciales** (Workflows) y las **Reglas Arquitectónicas** para generar el frontend administrativo multitenant. El objetivo es construir un código altamente modular, con algoritmos de renderizado eficientes y reactividad de última generación.

## ⚙️ CÓMO CONFIGURAR TU ENTORNO IA (Antigravity/Cursor)

### 1. RULES (Reglas Globales - Mantener siempre activas a nivel Workspace)
Copia este bloque en la configuración de **Rules** de tu IA:

```text
# Frontend Rules (Angular 17+ & Tailwind CSS)
1. ARQUITECTURA: Usa estrictamente Standalone Components (cero NgModules). Divide en `core` (servicios singleton, interceptores, guards), `shared` (UI, pipes) y `features` (login, dashboard).
2. REACTIVIDAD & RENDIMIENTO: Usa `Signals` (`signal`, `computed`, `effect`) para el manejo de estado local y global. Configura SIEMPRE `ChangeDetectionStrategy.OnPush` en todos los componentes.
3. CONTROL FLOW: Usa la nueva sintaxis de Angular (`@if`, `@for` con `track`, `@switch`) en lugar de directivas estructurales (`*ngIf`, `*ngFor`).
4. ESTILOS: Usa clases utilitarias de Tailwind CSS. Diseña con un enfoque "Mobile-First", pero asegúrate de que las vistas de cuadrícula (grids) escalen perfectamente para aprovechar monitores Ultrawide en escritorios administrativos.
5. SEGURIDAD & HTTP: Todo request debe llevar el JWT vía un Interceptor funcional. Protege las rutas con `CanActivateFn` basados en Signals.
6. CÓDIGO LIMPIO: No generes código boilerplate. Implementa algoritmos de filtrado/búsqueda optimizados en el cliente usando `computed`.
```

---

## 🚀 WORKFLOWS: PROMPTS DE GENERACIÓN SECUENCIAL
Usa estos prompts uno por uno en el chat de tu IA para ir construyendo el frontend por capas.

### Paso 1: Estructura Core e Interceptores
**Prompt para la IA:**
> "Genera la capa Core del frontend Pide Facil. 
> 1. Crea un `AuthService` usando Signals que maneje el login (`POST /api/v1/auth/login`), guarde el JWT en `localStorage` y decodifique el payload para exponer el rol y el branch_id del usuario actual a través de un Signal computado.
> 2. Crea un interceptor HTTP funcional (`auth.interceptor.ts`) que adjunte el JWT (Bearer) a cada petición saliente. Si el servidor responde 401/403, debe limpiar el localStorage y redirigir al login.
> 3. Implementa dos functional guards: `authGuard` (verifica si hay token) y `roleGuard` (verifica si el usuario tiene el nivel requerido, ej. BRANCH_MANAGER). Configúralos para usarse en el enrutador."

### Paso 2: Autenticación (Login Feature)
**Prompt para la IA:**
> "Genera el componente standalone `LoginComponent` dentro de la carpeta `features/auth`.
> Requisitos:
> - UI moderna, limpia y minimalista usando Tailwind CSS.
> - Formulario reactivo (`ReactiveFormsModule`) para `username` y `password` con validaciones de campos requeridos.
> - Manejo de estado visual (ej. botón en estado 'cargando' mientras se espera la respuesta HTTP) usando Signals.
> - Al recibir un login exitoso del `AuthService`, debe redirigir al `/dashboard`.
> Asegúrate de aplicar `ChangeDetectionStrategy.OnPush`."

### Paso 3: Layout Administrativo (Navegación)
**Prompt para la IA:**
> "Crea el componente `AdminLayoutComponent` dentro de `core/layout`. 
> Este será el contenedor principal de las rutas protegidas.
> Requisitos:
> - Una barra lateral (Sidebar) colapsable con Tailwind, que contenga enlaces a: 'Mapa de Mesas', 'Catálogo', y 'Configuración WhatsApp'.
> - El enlace a 'Configuración WhatsApp' solo debe renderizarse (`@if`) si el Signal del `AuthService` indica que el usuario es `BRANCH_MANAGER` o superior.
> - Un Header superior que muestre el nombre del usuario y un botón para cerrar sesión.
> - Incluye un `<router-outlet>` principal que escale fluidamente en monitores anchos (ultrawide). El código HTML debe ser semántico y optimizado."

### Paso 4: Mapa de Mesas y Estado (Dashboard Feature)
**Prompt para la IA:**
> "Genera el `DashboardComponent` dentro de `features/tables`. Este es el corazón visual.
> Requisitos:
> - Llama al backend para obtener las mesas de la sucursal actual y guárdalas en un `WritableSignal`.
> - Renderiza una cuadrícula de mesas usando CSS Grid de Tailwind (`grid-cols-2 md:grid-cols-4 xl:grid-cols-6`).
> - Cada mesa debe ser un sub-componente "dumb" `TableCardComponent` que reciba el objeto de la mesa vía `@Input()` y muestre un color distinto según el Enum (`AVAILABLE` = verde, `OCCUPIED` = rojo).
> - Algoritmo UI: Implementa un campo de texto que permita filtrar instantáneamente las mesas por su número. La lógica del filtro debe vivir en un `computed` derivado del Signal principal de mesas, garantizando complejidad computacional mínima (O(N)) y renderizado instantáneo."

### Paso 5: Panel Lateral de Órdenes (Gestión de Pedidos)
**Prompt para la IA:**
> "Dentro del `DashboardComponent`, al hacer clic en una mesa `OCCUPIED`, se debe abrir un panel lateral (Slide-over) para gestionar su orden activa.
> Requisitos:
> - Crea el componente `OrderPanelComponent`.
> - Debe consumir los endpoints `/api/v1/webhooks/orders/{orderId}/bill` para mostrar la cuenta actual y un listado de los `order_items`.
> - UI: Lista limpia de productos, con precio total sumado.
> - Acciones: Incluye un botón para 'Agregar Producto' y otro botón destructivo (rojo) para 'Cerrar Mesa', que llame al endpoint respectivo y emita un evento al padre para refrescar la cuadrícula de mesas."

### Paso 6: Configuración del Bot (Baileys/n8n)
**Prompt para la IA:**
> "Genera el `WhatsappConfigComponent` dentro de `features/settings`.
> Requisitos:
> - Interfaz para que el Gerente de Sucursal pueda solicitar y escanear el código QR del microservicio de Baileys.
> - Un botón que dispare el servicio HTTP para generar el QR. 
> - Un contenedor central (`@if`) que muestre la imagen en Base64 o el string SVG del QR devuelto por el backend.
> - Mantén el diseño estricto y profesional. Maneja explícitamente los estados 'cargando', 'qr_listo', y 'error' con Signals, asegurando que la UI responda fluidamente."
