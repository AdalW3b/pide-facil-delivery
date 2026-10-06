package com.omnirest.omnirest_backend.services.asistente;

import com.omnirest.omnirest_backend.dtos.PedidoDomicilioPanelDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AnalyticsService;
import com.omnirest.omnirest_backend.services.CajaService;
import com.omnirest.omnirest_backend.services.DeliveryService;
import com.omnirest.omnirest_backend.services.OperacionesInventarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lo que el asistente puede consultar del restaurante. Todo es de solo
 * lectura y reusa los servicios del panel.
 *
 * El restaurante y la sucursal salen de la sesión del usuario, nunca de lo
 * que pida el modelo; cada herramienta exige el mismo permiso que su pantalla,
 * y al modelo solo se le ofrecen las que el usuario puede usar. Nada lleva
 * teléfonos ni nombres de clientes.
 */
@Component
@RequiredArgsConstructor
public class HerramientasAsistente {

    /** Lo más largo que se le pasa al modelo de un resultado. */
    static final int MAX_CARACTERES = 12_000;
    static final int MAX_DIAS = 92;

    private final AnalyticsService analyticsService;
    private final OperacionesInventarioService inventarioService;
    private final CajaService cajaService;
    private final DeliveryService deliveryService;

    /** De quién es la pregunta y sobre qué sucursal. */
    public record Contexto(CustomUserDetails usuario, UUID restaurantId, UUID branchId) {
    }

    private record Definicion(ProveedorLlm.Herramienta herramienta, Set<String> permisos,
                              Function<Peticion, Object> ejecutar) {
    }

    private record Peticion(Contexto ctx, JsonNode args) {
    }

    private static final Map<String, Object> RANGO = Map.of(
            "type", "object",
            "properties", Map.of(
                    "desde", Map.of("type", "string", "description", "Fecha inicial AAAA-MM-DD. Por omisión, hace 7 días."),
                    "hasta", Map.of("type", "string", "description", "Fecha final AAAA-MM-DD, incluida. Por omisión, hoy.")),
            "required", List.of());

    private static final Set<String> VENTAS = Set.of("SUPER_ADMIN", "BRANCH_MANAGER");

    private List<Definicion> definiciones() {
        return List.of(
                new Definicion(new ProveedorLlm.Herramienta("resumen_ventas",
                        "Resumen de ventas de la sucursal en un periodo: total vendido de comida, cuentas, ticket promedio, "
                                + "pedidos, cancelados, costo, utilidad bruta y margen, con el % de cambio contra el periodo "
                                + "anterior del mismo largo. Incluye las ventas por canal (salón, domicilio, para llevar, Rappi...). "
                                + "Los campos que dicen 'Today' son del periodo pedido.", RANGO),
                        VENTAS, p -> {
                            LocalDate[] r = rango(p.args());
                            Map<String, Object> salida = new LinkedHashMap<>();
                            salida.put("periodo", r[0] + " a " + r[1]);
                            salida.put("resumen", analyticsService.getAnalyticsSummary(p.ctx().restaurantId(), p.ctx().branchId(), r[0], r[1]));
                            salida.put("porCanal", analyticsService.getVentasPorCanal(p.ctx().restaurantId(), p.ctx().branchId(), r[0], r[1]));
                            return salida;
                        }),
                new Definicion(new ProveedorLlm.Herramienta("ventas_por_dia",
                        "Ventas día por día de la sucursal en un periodo.", RANGO),
                        VENTAS, p -> {
                            LocalDate[] r = rango(p.args());
                            return analyticsService.getDailySales(p.ctx().restaurantId(), p.ctx().branchId(), r[0], r[1]);
                        }),
                new Definicion(new ProveedorLlm.Herramienta("platillos_vendidos",
                        "Platillos vendidos en un periodo, del más vendido al menos: piezas, ingreso, costo unitario, "
                                + "utilidad y margen. costoCompleto=false si al platillo le falta costo capturado.", RANGO),
                        VENTAS, p -> {
                            LocalDate[] r = rango(p.args());
                            return analyticsService.getTopSellingProducts(p.ctx().restaurantId(), p.ctx().branchId(), r[0], r[1], 40);
                        }),
                new Definicion(new ProveedorLlm.Herramienta("horas_pico",
                        "Pedidos y ventas por hora del día en un periodo, para ver las horas de más trabajo.", RANGO),
                        VENTAS, p -> {
                            LocalDate[] r = rango(p.args());
                            return analyticsService.getPeakHours(p.ctx().restaurantId(), p.ctx().branchId(), r[0], r[1]);
                        }),
                new Definicion(new ProveedorLlm.Herramienta("inventario",
                        "Existencias de la sucursal (ingredientes y productos): cantidad, unidad, mínimo, costo y zona. "
                                + "Con solo_bajo_minimo=true regresa solo lo que está en o debajo de su mínimo.",
                        Map.of("type", "object",
                                "properties", Map.of("solo_bajo_minimo", Map.of("type", "boolean",
                                        "description", "true para solo lo que hay que comprar.")),
                                "required", List.of())),
                        Set.of("SUPER_ADMIN", "INVENTORY_READ", "CATALOG_READ"), p -> {
                            boolean bajo = p.args().path("solo_bajo_minimo").asBoolean(false);
                            return inventarioService.existencias(p.ctx().branchId()).stream()
                                    .filter(a -> a.activo())
                                    .filter(a -> !bajo || (a.minimo() != null && a.existencia() != null
                                            && a.existencia().compareTo(a.minimo()) <= 0))
                                    .map(a -> {
                                        Map<String, Object> m = new LinkedHashMap<>();
                                        m.put("nombre", a.nombre());
                                        m.put("tipo", a.tipo());
                                        m.put("existencia", a.existencia());
                                        m.put("unidad", a.unidad());
                                        m.put("minimo", a.minimo());
                                        m.put("costo", a.costo());
                                        m.put("zona", a.zona());
                                        return m;
                                    })
                                    .toList();
                        }),
                new Definicion(new ProveedorLlm.Herramienta("cierres_de_caja",
                        "Los últimos cierres de caja (arqueos) de la sucursal: cuánto debía haber, cuánto se contó y la diferencia.",
                        Map.of("type", "object", "properties", Map.of(), "required", List.of())),
                        Set.of("SUPER_ADMIN", "CAJA_OPERAR"), p ->
                        cajaService.historial(p.ctx().branchId()).stream().limit(15).toList()),
                new Definicion(new ProveedorLlm.Herramienta("pedidos_activos",
                        "Pedidos a domicilio, para llevar y de mostrador que siguen abiertos: estado, origen, minutos desde "
                                + "que entraron, total y si falta cobrarlos.",
                        Map.of("type", "object", "properties", Map.of(), "required", List.of())),
                        Set.of("SUPER_ADMIN", "ORDERS_READ"), p ->
                        deliveryService.listarPedidos(p.ctx().branchId(), true, null).stream()
                                .map(HerramientasAsistente::pedidoSinDatosPersonales)
                                .toList()));
    }

    /** Las herramientas que este usuario puede usar. */
    public List<ProveedorLlm.Herramienta> para(CustomUserDetails usuario) {
        Set<String> permisos = permisos(usuario);
        return definiciones().stream()
                .filter(d -> d.permisos().stream().anyMatch(permisos::contains))
                .map(Definicion::herramienta)
                .toList();
    }

    /**
     * Ejecuta lo que pidió el modelo. Un error (fecha mala, sin permiso) vuelve
     * como resultado con error para que el modelo lo explique, no como excepción.
     */
    public ProveedorLlm.Resultado ejecutar(ProveedorLlm.Llamada llamada, Contexto ctx) {
        Definicion d = definiciones().stream()
                .filter(x -> x.herramienta().nombre().equals(llamada.nombre()))
                .findFirst()
                .orElse(null);
        if (d == null) {
            return new ProveedorLlm.Resultado(llamada, "No existe la herramienta " + llamada.nombre() + ".", true);
        }
        if (d.permisos().stream().noneMatch(permisos(ctx.usuario())::contains)) {
            return new ProveedorLlm.Resultado(llamada, "El usuario no tiene permiso para consultar esto.", true);
        }
        try {
            JsonNode args = HttpJson.JSON.readTree(llamada.argumentosJson() == null || llamada.argumentosJson().isBlank()
                    ? "{}" : llamada.argumentosJson());
            String json = HttpJson.JSON.writeValueAsString(d.ejecutar().apply(new Peticion(ctx, args)));
            if (json.length() > MAX_CARACTERES) {
                json = json.substring(0, MAX_CARACTERES) + " …(recortado: pide un periodo más corto)";
            }
            return new ProveedorLlm.Resultado(llamada, json, false);
        } catch (IllegalArgumentException e) {
            return new ProveedorLlm.Resultado(llamada, e.getMessage(), true);
        } catch (Exception e) {
            return new ProveedorLlm.Resultado(llamada, "No se pudo consultar: " + e.getMessage(), true);
        }
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    static Set<String> permisos(CustomUserDetails u) {
        if (u == null || u.authorities() == null) return Set.of();
        return u.authorities().stream().map(a -> a.getAuthority()).collect(Collectors.toSet());
    }

    /** El periodo pedido, con valores por omisión y un tope para no mandar meses de datos. */
    static LocalDate[] rango(JsonNode args) {
        LocalDate hoy = LocalDate.now();
        LocalDate hasta = fecha(args.path("hasta").asString(null), hoy);
        LocalDate desde = fecha(args.path("desde").asString(null), hasta.minusDays(6));
        if (desde.isAfter(hasta)) {
            throw new IllegalArgumentException("La fecha inicial es posterior a la final.");
        }
        if (ChronoUnit.DAYS.between(desde, hasta) > MAX_DIAS) {
            throw new IllegalArgumentException("El periodo es muy largo: pide como máximo " + MAX_DIAS + " días.");
        }
        return new LocalDate[]{desde, hasta};
    }

    private static LocalDate fecha(String texto, LocalDate porOmision) {
        if (texto == null || texto.isBlank()) return porOmision;
        try {
            return LocalDate.parse(texto.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("La fecha " + texto + " no tiene el formato AAAA-MM-DD.");
        }
    }

    /** El pedido sin teléfono, nombre ni dirección del cliente. */
    static Map<String, Object> pedidoSinDatosPersonales(PedidoDomicilioPanelDTO p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("codigo", p.turno() != null ? p.turno() : p.tokenSeguimiento());
        m.put("tipo", p.orderType());
        m.put("estado", p.deliveryStatus());
        m.put("cocina", p.kitchenStatus());
        m.put("origen", p.origen());
        m.put("consumo", p.consumo());
        m.put("creadoEn", p.creadoEn());
        m.put("minutosEstimados", p.minutosEstimados());
        m.put("total", p.total());
        m.put("porCobrar", p.porCobrar());
        m.put("platillos", p.items() != null ? p.items().size() : 0);
        m.put("repartidorAsignado", p.repartidorNombre() != null);
        return m;
    }
}
