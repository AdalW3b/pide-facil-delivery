package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.dtos.ComprasDTOs;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Las compras como llegan del proveedor: quien surtio, el folio y la fecha de
 * la nota, como se pago, el IVA, y cada articulo en la presentacion en que
 * llego ("2 cajas de 24").
 *
 * El IVA se recupera, asi que al inventario entra el costo sin IVA; lo que sale
 * de la caja (o se le debe al proveedor) es el total con IVA.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComprasService {

    /** IVA general en Mexico. */
    static final BigDecimal TASA_IVA = new BigDecimal("0.16");
    /** Plazo si el proveedor no tiene dias de credito capturados. */
    private static final int PLAZO_CREDITO_DEFAULT = 15;
    private static final Set<String> FORMAS_PAGO = Set.of("CAJA", "TRANSFERENCIA", "CREDITO");
    private static final Set<String> DIAS = Set.of("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM");

    private final BranchRepository branchRepository;
    private final ProveedorRepository proveedorRepository;
    private final PresentacionCompraRepository presentacionRepository;
    private final CompraRepository compraRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductRepository productRepository;
    private final MovimientoInventarioRepository movimientoRepository;
    private final InventoryService inventoryService;
    private final CajaService cajaService;

    // ------------------------------------------------------------------
    // Proveedores
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ComprasDTOs.Proveedor> proveedores(UUID branchId) {
        UUID restaurantId = restauranteDe(branchId);
        List<Proveedor> lista = proveedorRepository.findByRestaurantIdOrderByNombreAsc(restaurantId);
        Map<UUID, BigDecimal> debemos = new HashMap<>();
        if (!lista.isEmpty()) {
            for (Object[] f : compraRepository.adeudos(lista.stream().map(Proveedor::getId).toList())) {
                debemos.put((UUID) f[0], (BigDecimal) f[1]);
            }
        }
        Map<UUID, String> nombres = nombresDe(restaurantId);
        return lista.stream().map(p -> aDto(p, debemos.getOrDefault(p.getId(), BigDecimal.ZERO), nombres)).toList();
    }

    @Transactional
    public ComprasDTOs.Proveedor guardarProveedor(UUID branchId, UUID id, ComprasDTOs.GuardarProveedor datos) {
        UUID restaurantId = restauranteDe(branchId);
        String nombre = datos.nombre().trim();
        Proveedor p;
        if (id == null) {
            if (proveedorRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
                throw new IllegalArgumentException("Ya existe el proveedor " + nombre + ".");
            }
            p = Proveedor.builder().restaurantId(restaurantId).build();
        } else {
            p = proveedor(id, restaurantId);
            if (!p.getNombre().equalsIgnoreCase(nombre)
                    && proveedorRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
                throw new IllegalArgumentException("Ya existe el proveedor " + nombre + ".");
            }
        }
        p.setNombre(nombre);
        p.setContacto(limpiar(datos.contacto()));
        p.setTelefono(limpiar(datos.telefono()));
        p.setDiasCredito(datos.diasCredito() != null ? datos.diasCredito() : 0);
        p.setDiasVisita(diasValidos(datos.diasVisita()));
        p.setNotas(limpiar(datos.notas()));
        if (datos.surte() != null) {
            p.getArticulos().clear();
            Set<UUID> vistos = new HashSet<>();
            for (ComprasDTOs.ArticuloRef a : datos.surte()) {
                if (!vistos.add(a.id())) continue;
                if (esProducto(a.tipo())) {
                    producto(a.id(), restaurantId);
                    p.getArticulos().add(ProveedorArticulo.builder().proveedor(p).productId(a.id()).build());
                } else {
                    ingrediente(a.id(), restaurantId);
                    p.getArticulos().add(ProveedorArticulo.builder().proveedor(p).ingredientId(a.id()).build());
                }
            }
        }
        p = proveedorRepository.save(p);
        return aDto(p, BigDecimal.ZERO, nombresDe(restaurantId));
    }

    /** Un proveedor con compras no se borra: se desactiva y deja de ofrecerse. */
    @Transactional
    public void activarProveedor(UUID branchId, UUID id, boolean activo) {
        Proveedor p = proveedor(id, restauranteDe(branchId));
        p.setActivo(activo);
        proveedorRepository.save(p);
    }

    // ------------------------------------------------------------------
    // Presentaciones
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ComprasDTOs.Presentacion> presentaciones(UUID branchId) {
        return presentacionRepository.delRestaurante(restauranteDe(branchId)).stream().map(ComprasService::aDto).toList();
    }

    @Transactional
    public ComprasDTOs.Presentacion crearPresentacion(UUID branchId, ComprasDTOs.NuevaPresentacion datos) {
        UUID restaurantId = restauranteDe(branchId);
        PresentacionCompra.PresentacionCompraBuilder b = PresentacionCompra.builder()
                .nombre(datos.nombre().trim())
                .factor(datos.factor().setScale(3, RoundingMode.HALF_UP));
        if (esProducto(datos.tipo())) {
            producto(datos.articuloId(), restaurantId);
            if (datos.factor().stripTrailingZeros().scale() > 0) {
                throw new IllegalArgumentException("Un producto se cuenta por pieza: lo que trae la presentación va en piezas enteras.");
            }
            b.productId(datos.articuloId());
        } else {
            ingrediente(datos.articuloId(), restaurantId);
            b.ingredientId(datos.articuloId());
        }
        return aDto(presentacionRepository.save(b.build()));
    }

    @Transactional
    public void borrarPresentacion(UUID branchId, UUID id) {
        UUID restaurantId = restauranteDe(branchId);
        PresentacionCompra pc = presentacion(id, restaurantId);
        presentacionRepository.delete(pc);
    }

    // ------------------------------------------------------------------
    // Ultimo precio pagado
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ComprasDTOs.UltimoPrecio> ultimosPrecios(UUID branchId) {
        return movimientoRepository.ultimosPrecios(branchId).stream()
                .map(f -> new ComprasDTOs.UltimoPrecio(
                        f.getIngredientId() != null ? "INGREDIENTE" : "PRODUCTO",
                        f.getIngredientId() != null ? f.getIngredientId() : f.getProductId(),
                        f.getCostoUnitario(), f.getCreadoEn(), f.getProveedor()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Registrar, listar y anular compras
    // ------------------------------------------------------------------

    /** Lo calculado de un renglon antes de moverlo al inventario. */
    private record Linea(Ingredient ingrediente, Product producto, BigDecimal cantidad, BigDecimal importe, String descripcion) {
    }

    @Transactional
    public ComprasDTOs.Resultado registrar(UUID branchId, ComprasDTOs.NuevaCompra datos) {
        UUID restaurantId = restauranteDe(branchId);
        String formaPago = datos.formaPago().trim().toUpperCase();
        if (!FORMAS_PAGO.contains(formaPago)) {
            throw new IllegalArgumentException("La forma de pago es efectivo de caja, transferencia o crédito.");
        }
        String iva = datos.iva() == null || datos.iva().isBlank() ? "SIN" : datos.iva().trim().toUpperCase();
        if (!Set.of("INCLUIDO", "APARTE", "SIN").contains(iva)) {
            throw new IllegalArgumentException("El IVA va incluido, aparte o sin IVA.");
        }
        LocalDate hoy = Combos.hoy();
        LocalDate fecha = datos.fecha() != null ? datos.fecha() : hoy;
        if (fecha.isAfter(hoy)) {
            throw new IllegalArgumentException("La fecha de la nota no puede ser futura.");
        }

        Proveedor proveedor = null;
        String nombreProveedor = limpiar(datos.proveedor());
        if (datos.proveedorId() != null) {
            proveedor = proveedor(datos.proveedorId(), restaurantId);
            nombreProveedor = proveedor.getNombre();
        }

        // Primero se arma todo: si un renglon esta mal, no se mueve nada.
        List<Linea> lineas = new ArrayList<>();
        for (ComprasDTOs.RenglonCompra r : datos.renglones()) {
            lineas.add(linea(r, restaurantId));
        }
        BigDecimal suma = lineas.stream().map(Linea::importe).reduce(BigDecimal.ZERO, BigDecimal::add);
        Totales t = totales(suma, iva);

        String folio = limpiar(datos.folio());
        Compra compra = compraRepository.save(Compra.builder()
                .branchId(branchId)
                .proveedor(nombreProveedor)
                .proveedorId(proveedor != null ? proveedor.getId() : null)
                .folio(folio)
                .fecha(fecha)
                .formaPago(formaPago)
                .iva(iva)
                .subtotal(t.subtotal())
                .ivaMonto(t.iva())
                .total(t.total())
                .nota(limpiar(datos.nota()))
                .usuario(quien())
                .detalle(recortar(lineas.stream().map(Linea::descripcion).collect(Collectors.joining(" · ")), 1000))
                .build());

        String concepto = "Compra" + (nombreProveedor != null ? " a " + nombreProveedor : "") + (folio != null ? " · nota " + folio : "");
        // El efectivo sale de la caja abierta; sin caja abierta no se registra nada.
        if ("CAJA".equals(formaPago) && t.total().signum() > 0) {
            compra.setMovimientoCajaId(cajaService.salidaPorCompra(branchId, t.total(), concepto, quien()));
        }
        if ("CREDITO".equals(formaPago)) {
            int dias = proveedor != null && proveedor.getDiasCredito() != null && proveedor.getDiasCredito() > 0
                    ? proveedor.getDiasCredito() : PLAZO_CREDITO_DEFAULT;
            compra.setVence(fecha.plusDays(dias));
        } else {
            compra.setPagadaEn(LocalDateTime.now());
        }
        compraRepository.save(compra);

        // Al inventario entra el costo sin IVA (se recupera).
        for (Linea l : lineas) {
            BigDecimal sinIva = "INCLUIDO".equals(iva) ? l.importe().divide(BigDecimal.ONE.add(TASA_IVA), 4, RoundingMode.HALF_UP) : l.importe();
            BigDecimal unitario = sinIva.signum() > 0 ? sinIva.divide(l.cantidad(), 4, RoundingMode.HALF_UP) : null;
            if (l.producto() != null) {
                inventoryService.moverProducto(branchId, l.producto(), l.cantidad().intValueExact(), TipoMovimiento.ENTRADA, false,
                        concepto, unitario, compra.getId());
            } else {
                inventoryService.moverIngrediente(branchId, l.ingrediente(), l.cantidad(), TipoMovimiento.ENTRADA, false,
                        concepto, unitario, nombreProveedor, compra.getId());
            }
        }

        String pago = switch (formaPago) {
            case "CAJA" -> "Salieron " + pesos(t.total()) + " de la caja.";
            case "CREDITO" -> "Queda por pagar " + pesos(t.total()) + ", vence el " + compra.getVence() + ".";
            default -> "Pagada por transferencia.";
        };
        return new ComprasDTOs.Resultado("Compra registrada: " + lineas.size()
                + (lineas.size() == 1 ? " artículo" : " artículos") + " por " + pesos(t.total()) + ". " + pago);
    }

    @Transactional(readOnly = true)
    public List<ComprasDTOs.Compra> compras(UUID branchId) {
        List<Compra> compras = compraRepository.findTop30ByBranchIdOrderByCreadoEnDesc(branchId);
        // Las compras de antes no guardaban el detalle: se arma con sus movimientos.
        List<UUID> sinDetalle = compras.stream().filter(c -> c.getDetalle() == null).map(Compra::getId).toList();
        Map<UUID, List<String>> viejas = new HashMap<>();
        if (!sinDetalle.isEmpty()) {
            Map<UUID, String> nombres = nombresDe(restauranteDe(branchId));
            movimientoRepository.findByGrupoIdIn(sinDetalle).forEach(m -> viejas
                    .computeIfAbsent(m.getGrupoId(), k -> new ArrayList<>())
                    .add(legible(m.getCantidad()) + " " + nombres.getOrDefault(
                            m.getIngredientId() != null ? m.getIngredientId() : m.getProductId(), "¿?")));
        }
        return compras.stream().map(c -> new ComprasDTOs.Compra(
                c.getId(), c.getProveedor(), c.getProveedorId(), c.getFolio(),
                c.getFecha() != null ? c.getFecha() : c.getCreadoEn().toLocalDate(),
                c.getFormaPago(), c.getIva(), c.getSubtotal(), c.getIvaMonto(), c.getTotal(), c.getNota(),
                c.getUsuario(), c.getCreadoEn(),
                c.getDetalle() != null ? List.of(c.getDetalle().split(" · ")) : viejas.getOrDefault(c.getId(), List.of()),
                c.getVence(), c.getPagadaEn() != null, c.getAnuladaEn() != null, c.getAnuladaPor(), c.getMotivoAnulacion()))
                .toList();
    }

    /**
     * Una compra mal capturada se anula: sale del inventario lo que entro y, si
     * se pago con efectivo, el dinero regresa a la caja abierta. Queda en el
     * historial como anulada.
     */
    @Transactional
    public ComprasDTOs.Resultado anular(UUID branchId, UUID compraId, String motivo) {
        Compra c = compraRepository.findById(compraId)
                .filter(x -> x.getBranchId().equals(branchId))
                .orElseThrow(() -> new IllegalArgumentException("Esa compra no es de esta sucursal."));
        if (c.getAnuladaEn() != null) {
            throw new IllegalStateException("Esta compra ya estaba anulada.");
        }
        String nota = "Compra anulada" + (c.getProveedor() != null ? " · " + c.getProveedor() : "")
                + (c.getFolio() != null ? " · nota " + c.getFolio() : "");
        // Solo lo que entro con la compra (las anulaciones de antes no cuentan).
        for (MovimientoInventario m : movimientoRepository.findByGrupoIdIn(List.of(compraId))) {
            if (m.getTipo() != TipoMovimiento.ENTRADA || m.getCantidad().signum() <= 0) continue;
            if (m.getIngredientId() != null) {
                ingredientRepository.findById(m.getIngredientId()).ifPresent(i -> inventoryService.moverIngrediente(
                        branchId, i, m.getCantidad().negate(), TipoMovimiento.ENTRADA, false, nota, null, null, compraId));
            } else if (m.getProductId() != null) {
                productRepository.findById(m.getProductId()).ifPresent(p -> inventoryService.moverProducto(
                        branchId, p, -m.getCantidad().intValue(), TipoMovimiento.ENTRADA, false, nota, null, compraId));
            }
        }
        if ("CAJA".equals(c.getFormaPago()) && c.getMovimientoCajaId() != null && c.getTotal() != null) {
            cajaService.entradaPorCompraAnulada(branchId, c.getTotal(), nota, quien());
        }
        c.setAnuladaEn(LocalDateTime.now());
        c.setAnuladaPor(quien());
        c.setMotivoAnulacion(limpiar(motivo));
        compraRepository.save(c);
        log.info("Compra {} anulada por {}", compraId, c.getAnuladaPor());
        return new ComprasDTOs.Resultado("Compra anulada: se quitó del inventario"
                + ("CAJA".equals(c.getFormaPago()) && c.getMovimientoCajaId() != null ? " y el efectivo regresó a la caja." : "."));
    }

    // ------------------------------------------------------------------
    // Calculos
    // ------------------------------------------------------------------

    record Totales(BigDecimal subtotal, BigDecimal iva, BigDecimal total) {
    }

    /**
     * Con IVA incluido, los importes ya lo traen; aparte, se suma al final;
     * sin IVA (tasa 0 o exento), no hay.
     */
    static Totales totales(BigDecimal suma, String iva) {
        BigDecimal s = suma.setScale(2, RoundingMode.HALF_UP);
        return switch (iva) {
            case "INCLUIDO" -> {
                BigDecimal subtotal = s.divide(BigDecimal.ONE.add(TASA_IVA), 2, RoundingMode.HALF_UP);
                yield new Totales(subtotal, s.subtract(subtotal), s);
            }
            case "APARTE" -> {
                BigDecimal impuesto = s.multiply(TASA_IVA).setScale(2, RoundingMode.HALF_UP);
                yield new Totales(s, impuesto, s.add(impuesto));
            }
            default -> new Totales(s, BigDecimal.ZERO.setScale(2), s);
        };
    }

    /** El renglon ya convertido a la unidad del inventario: "2 cajas de 24" = 48 piezas. */
    private Linea linea(ComprasDTOs.RenglonCompra r, UUID restaurantId) {
        BigDecimal importe = r.importe() != null ? r.importe() : BigDecimal.ZERO;
        PresentacionCompra pres = r.presentacionId() != null ? presentacion(r.presentacionId(), restaurantId) : null;
        if (r.productId() != null) {
            Product p = producto(r.productId(), restaurantId);
            if (pres != null && !r.productId().equals(pres.getProductId())) {
                throw new IllegalArgumentException("Esa presentación no es de " + p.getName() + ".");
            }
            BigDecimal piezas = pres != null ? r.cantidad().multiply(pres.getFactor()) : r.cantidad();
            if (piezas.stripTrailingZeros().scale() > 0) {
                throw new IllegalArgumentException(p.getName() + " se cuenta por pieza: la cantidad debe dar piezas enteras.");
            }
            String como = pres != null ? legible(r.cantidad()) + " " + pres.getNombre() : legible(piezas) + " pieza" + (piezas.compareTo(BigDecimal.ONE) == 0 ? "" : "s");
            return new Linea(null, p, piezas.setScale(0, RoundingMode.UNNECESSARY), importe, como + " " + p.getName());
        }
        if (r.ingredientId() == null) throw new IllegalArgumentException("Elige un ingrediente o un producto.");
        Ingredient i = ingrediente(r.ingredientId(), restaurantId);
        BigDecimal cantidad;
        String como;
        if (pres != null) {
            if (!r.ingredientId().equals(pres.getIngredientId())) {
                throw new IllegalArgumentException("Esa presentación no es de " + i.getName() + ".");
            }
            cantidad = r.cantidad().multiply(pres.getFactor());
            como = legible(r.cantidad()) + " " + pres.getNombre();
        } else {
            String unidad = r.unidad() == null || r.unidad().isBlank() ? i.getUnitOfMeasure() : r.unidad();
            cantidad = Unidades.convertir(r.cantidad(), unidad, i.getUnitOfMeasure());
            como = legible(r.cantidad()) + " " + Unidades.canonica(unidad);
        }
        if (cantidad.signum() <= 0) throw new IllegalArgumentException("La cantidad de " + i.getName() + " debe ser mayor a cero.");
        return new Linea(i, null, cantidad, importe, como + " " + i.getName());
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private UUID restauranteDe(UUID branchId) {
        return branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."))
                .getRestaurant().getId();
    }

    private Proveedor proveedor(UUID id, UUID restaurantId) {
        Proveedor p = proveedorRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Ese proveedor ya no existe."));
        if (!p.getRestaurantId().equals(restaurantId)) throw new IllegalArgumentException("Ese proveedor no es de este restaurante.");
        return p;
    }

    private PresentacionCompra presentacion(UUID id, UUID restaurantId) {
        PresentacionCompra pc = presentacionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Esa presentación ya no existe."));
        if (pc.getIngredientId() != null) ingrediente(pc.getIngredientId(), restaurantId);
        else producto(pc.getProductId(), restaurantId);
        return pc;
    }

    private Ingredient ingrediente(UUID id, UUID restaurantId) {
        Ingredient i = ingredientRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Ese ingrediente ya no existe."));
        if (!i.getRestaurant().getId().equals(restaurantId)) throw new IllegalArgumentException("Ese ingrediente no es de este restaurante.");
        return i;
    }

    private Product producto(UUID id, UUID restaurantId) {
        Product p = productRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Ese producto ya no existe."));
        if (!p.getCategory().getRestaurant().getId().equals(restaurantId)) throw new IllegalArgumentException("Ese producto no es de este restaurante.");
        if (!Boolean.TRUE.equals(p.getTrackStock())) throw new IllegalArgumentException(p.getName() + " no lleva existencias propias.");
        return p;
    }

    private Map<UUID, String> nombresDe(UUID restaurantId) {
        Map<UUID, String> nombres = new HashMap<>();
        ingredientRepository.findByRestaurantId(restaurantId).forEach(i -> nombres.put(i.getId(), i.getName()));
        productRepository.findByCategoryRestaurantId(restaurantId).forEach(p -> nombres.put(p.getId(), p.getName()));
        return nombres;
    }

    private static ComprasDTOs.Proveedor aDto(Proveedor p, BigDecimal debemos, Map<UUID, String> nombres) {
        List<ComprasDTOs.ArticuloRef> surte = p.getArticulos().stream()
                .map(a -> a.getIngredientId() != null
                        ? new ComprasDTOs.ArticuloRef("INGREDIENTE", a.getIngredientId(), nombres.get(a.getIngredientId()))
                        : new ComprasDTOs.ArticuloRef("PRODUCTO", a.getProductId(), nombres.get(a.getProductId())))
                .toList();
        List<String> dias = p.getDiasVisita() == null || p.getDiasVisita().isBlank() ? List.of() : List.of(p.getDiasVisita().split(","));
        return new ComprasDTOs.Proveedor(p.getId(), p.getNombre(), p.getContacto(), p.getTelefono(),
                p.getDiasCredito() != null ? p.getDiasCredito() : 0, dias, p.getNotas(), Boolean.TRUE.equals(p.getActivo()),
                surte, debemos);
    }

    private static ComprasDTOs.Presentacion aDto(PresentacionCompra pc) {
        return new ComprasDTOs.Presentacion(pc.getId(), pc.getIngredientId() != null ? "INGREDIENTE" : "PRODUCTO",
                pc.getIngredientId() != null ? pc.getIngredientId() : pc.getProductId(), pc.getNombre(), pc.getFactor());
    }

    private static String diasValidos(List<String> dias) {
        if (dias == null || dias.isEmpty()) return null;
        List<String> orden = List.of("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM");
        String r = dias.stream().map(d -> d.trim().toUpperCase()).filter(DIAS::contains).distinct()
                .sorted(Comparator.comparingInt(orden::indexOf)).collect(Collectors.joining(","));
        return r.isEmpty() ? null : r;
    }

    private static boolean esProducto(String tipo) {
        return "PRODUCTO".equalsIgnoreCase(tipo);
    }

    private static String quien() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CustomUserDetails u ? u.getUsername() : null;
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String recortar(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }

    private static String legible(BigDecimal n) {
        return n.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String pesos(BigDecimal n) {
        return "$" + n.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
