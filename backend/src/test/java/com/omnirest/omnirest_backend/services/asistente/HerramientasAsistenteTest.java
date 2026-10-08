package com.omnirest.omnirest_backend.services.asistente;

import com.omnirest.omnirest_backend.dtos.PedidoDomicilioPanelDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AnalyticsService;
import com.omnirest.omnirest_backend.services.CajaService;
import com.omnirest.omnirest_backend.services.DeliveryService;
import com.omnirest.omnirest_backend.services.OperacionesInventarioService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** El asistente solo consulta lo que el usuario puede ver, de su sucursal, sin datos de clientes. */
class HerramientasAsistenteTest {

    private final AnalyticsService analytics = mock(AnalyticsService.class);
    private final OperacionesInventarioService inventario = mock(OperacionesInventarioService.class);
    private final CajaService caja = mock(CajaService.class);
    private final DeliveryService delivery = mock(DeliveryService.class);
    private final com.omnirest.omnirest_backend.services.FlujoService flujo = mock(com.omnirest.omnirest_backend.services.FlujoService.class);
    private final com.omnirest.omnirest_backend.services.ComprasService compras = mock(com.omnirest.omnirest_backend.services.ComprasService.class);
    private final com.omnirest.omnirest_backend.services.GastosService gastos = mock(com.omnirest.omnirest_backend.services.GastosService.class);
    private final HerramientasAsistente herramientas = new HerramientasAsistente(analytics, inventario, caja, delivery, flujo, compras, gastos);

    private final UUID restaurante = UUID.randomUUID();
    private final UUID sucursal = UUID.randomUUID();

    private CustomUserDetails usuario(String rol, String... permisos) {
        return new CustomUserDetails(UUID.randomUUID(), "u", "x", rol, "/", restaurante, sucursal,
                Arrays.stream(permisos).map(SimpleGrantedAuthority::new).toList());
    }

    private static List<String> nombres(List<ProveedorLlm.Herramienta> hs) {
        return hs.stream().map(ProveedorLlm.Herramienta::nombre).toList();
    }

    @Test
    @DisplayName("Al modelo solo se le ofrecen las herramientas que el usuario puede usar")
    void segunPermisos() {
        assertEquals(10, herramientas.para(usuario("SUPER_ADMIN", "SUPER_ADMIN")).size());

        List<String> mesero = nombres(herramientas.para(usuario("Mesero", "ORDERS_READ", "TABLES_READ")));
        assertEquals(List.of("pedidos_activos"), mesero, "un mesero no ve ventas, inventario ni caja");

        List<String> almacen = nombres(herramientas.para(usuario("Almacén", "INVENTORY_READ")));
        assertEquals(List.of("compras_por_pagar", "inventario"), almacen, "el almacén ve lo que se debe, no el dinero del negocio");
    }

    @Test
    @DisplayName("Aunque el modelo pida una herramienta sin permiso, no se ejecuta")
    void sinPermisoNoEjecuta() {
        var ctx = new HerramientasAsistente.Contexto(usuario("Mesero", "ORDERS_READ"), restaurante, sucursal);
        ProveedorLlm.Resultado r = herramientas.ejecutar(new ProveedorLlm.Llamada("1", "cierres_de_caja", "{}"), ctx);
        assertTrue(r.esError());
        verifyNoInteractions(caja);

        ProveedorLlm.Resultado inventado = herramientas.ejecutar(new ProveedorLlm.Llamada("2", "borrar_todo", "{}"), ctx);
        assertTrue(inventado.esError());
    }

    @Test
    @DisplayName("Consulta siempre la sucursal de la sesión, aunque el modelo mande otra cosa")
    void sucursalDeLaSesion() {
        var ctx = new HerramientasAsistente.Contexto(usuario("SUPER_ADMIN", "SUPER_ADMIN"), restaurante, sucursal);
        herramientas.ejecutar(new ProveedorLlm.Llamada("1", "resumen_ventas",
                "{\"desde\":\"2026-10-01\",\"hasta\":\"2026-10-03\",\"branchId\":\"" + UUID.randomUUID() + "\"}"), ctx);
        verify(analytics).getAnalyticsSummary(restaurante, sucursal, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3));
    }

    @Test
    @DisplayName("Fechas: por omisión la última semana; mal escritas o de más de 92 días se rechazan")
    void fechas() {
        var ctx = new HerramientasAsistente.Contexto(usuario("SUPER_ADMIN", "SUPER_ADMIN"), restaurante, sucursal);
        herramientas.ejecutar(new ProveedorLlm.Llamada("1", "ventas_por_dia", "{}"), ctx);
        verify(analytics).getDailySales(restaurante, sucursal, LocalDate.now().minusDays(6), LocalDate.now());

        assertTrue(herramientas.ejecutar(new ProveedorLlm.Llamada("2", "ventas_por_dia", "{\"desde\":\"ayer\"}"), ctx).esError());
        assertTrue(herramientas.ejecutar(new ProveedorLlm.Llamada("3", "ventas_por_dia",
                "{\"desde\":\"2026-01-01\",\"hasta\":\"2026-10-01\"}"), ctx).esError());
        assertTrue(herramientas.ejecutar(new ProveedorLlm.Llamada("4", "ventas_por_dia",
                "{\"desde\":\"2026-10-05\",\"hasta\":\"2026-10-01\"}"), ctx).esError());
    }

    @Test
    @DisplayName("Inventario bajo mínimo filtra; los pedidos salen sin teléfono, nombre ni dirección")
    void inventarioYPedidos() {
        when(inventario.existencias(sucursal)).thenReturn(List.of(
                new com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Articulo("INGREDIENTE", UUID.randomUUID(),
                        "Tortilla", "kg", new BigDecimal("2"), new BigDecimal("5"), BigDecimal.TEN, null, null, true, 3, false),
                new com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Articulo("INGREDIENTE", UUID.randomUUID(),
                        "Queso", "kg", new BigDecimal("9"), new BigDecimal("5"), BigDecimal.TEN, null, null, true, 3, false)));
        var ctx = new HerramientasAsistente.Contexto(usuario("SUPER_ADMIN", "SUPER_ADMIN"), restaurante, sucursal);
        String json = herramientas.ejecutar(new ProveedorLlm.Llamada("1", "inventario", "{\"solo_bajo_minimo\":true}"), ctx).contenido();
        assertTrue(json.contains("Tortilla"));
        assertFalse(json.contains("Queso"));

        PedidoDomicilioPanelDTO p = mock(PedidoDomicilioPanelDTO.class);
        when(p.turno()).thenReturn("A-023");
        when(p.total()).thenReturn(new BigDecimal("150"));
        Map<String, Object> limpio = HerramientasAsistente.pedidoSinDatosPersonales(p);
        assertEquals("A-023", limpio.get("codigo"));
        assertFalse(limpio.keySet().stream().anyMatch(k -> k.toLowerCase().contains("telefono")
                || k.toLowerCase().contains("cliente") || k.toLowerCase().contains("direccion")));
    }
}
