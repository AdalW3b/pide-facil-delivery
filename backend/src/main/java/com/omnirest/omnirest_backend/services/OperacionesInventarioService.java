package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.*;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Lo que se hace en la pantalla de Inventario: ver existencias de ingredientes
 * y productos terminados juntos, registrar compras, contar por zona, hacer
 * preparaciones, pasar mercancia entre sucursales y ver el reporte.
 *
 * Todo mueve existencias por {@link InventoryService}, asi que cada cambio
 * queda en el historial con quien, cuando y por que.
 */
@Service
@RequiredArgsConstructor
public class OperacionesInventarioService {

    /** El reporte sugiere comprar para cubrir estos dias. */
    private static final int DIAS_DE_COBERTURA = 7;

    private final InventoryService inventoryService;
    private final BranchRepository branchRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductRepository productRepository;
    private final RecipeItemRepository recipeItemRepository;
    private final BranchIngredientStockRepository ingredienteStockRepository;
    private final BranchProductStockRepository productoStockRepository;
    private final MovimientoInventarioRepository movimientoRepository;
    private final CompraRepository compraRepository;
    private final SecurityValidationService securityValidationService;
    private final ZonaInventarioRepository zonaRepository;

    // ------------------------------------------------------------------
    // Existencias: ingredientes y productos terminados en una sola lista
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Articulo> existencias(UUID branchId) {
        Branch branch = sucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();
        Map<UUID, BigDecimal> stockIng = ingredienteStockRepository.findByBranchId(branchId).stream()
                .collect(Collectors.toMap(s -> s.getId().getIngredientId(), BranchIngredientStock::getStock, (a, b) -> a));
        Map<UUID, Integer> stockProd = productoStockRepository.findByBranchId(branchId).stream()
                .collect(Collectors.toMap(s -> s.getId().getProductId(), BranchProductStock::getStock, (a, b) -> a));
        Map<UUID, Integer> usos = recipeItemRepository.usosPorIngrediente(restaurantId).stream()
                .collect(Collectors.toMap(f -> (UUID) f[0], f -> ((Number) f[1]).intValue()));

        List<Articulo> lista = new ArrayList<>();
        for (Ingredient i : ingredientRepository.findByRestaurantId(restaurantId)) {
            lista.add(new Articulo("INGREDIENTE", i.getId(), i.getName(), i.getUnitOfMeasure(),
                    stockIng.getOrDefault(i.getId(), BigDecimal.ZERO), i.getMinimo(), Costos.deIngrediente(i),
                    i.getZona() != null ? i.getZona().getId() : null, i.getZona() != null ? i.getZona().getNombre() : null,
                    !Boolean.FALSE.equals(i.getActive()), usos.getOrDefault(i.getId(), 0),
                    Boolean.TRUE.equals(i.getEsPreparado())));
        }
        for (Product p : productRepository.findByCategoryRestaurantId(restaurantId)) {
            if (!Boolean.TRUE.equals(p.getTrackStock())) continue;
            lista.add(new Articulo("PRODUCTO", p.getId(), p.getName(), "pieza",
                    BigDecimal.valueOf(stockProd.getOrDefault(p.getId(), 0)),
                    p.getMinimo() != null ? BigDecimal.valueOf(p.getMinimo()) : null, p.getCostoPromedio(),
                    p.getZona() != null ? p.getZona().getId() : null, p.getZona() != null ? p.getZona().getNombre() : null,
                    !Boolean.FALSE.equals(p.getActive()), 0, false));
        }
        lista.sort(Comparator.comparing(Articulo::nombre, String.CASE_INSENSITIVE_ORDER));
        return lista;
    }

    /** Minimo, zona y costo de un articulo. */
    @Transactional
    public void actualizar(UUID branchId, String tipo, UUID id, ActualizarArticulo datos) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        ZonaInventario zona = datos.zonaId() == null ? null : zona(datos.zonaId(), restaurantId);
        if ("PRODUCTO".equals(tipo)) {
            Product p = producto(id, restaurantId);
            if (datos.minimo() != null && datos.minimo().stripTrailingZeros().scale() > 0) {
                throw new IllegalArgumentException("El mínimo de un producto va en piezas enteras.");
            }
            p.setMinimo(datos.minimo() == null || datos.minimo().signum() == 0 ? null : datos.minimo().intValue());
            p.setZona(zona);
            p.setCostoPromedio(datos.costo() == null || datos.costo().signum() == 0 ? null : datos.costo());
            productRepository.save(p);
            return;
        }
        Ingredient i = ingrediente(id, restaurantId);
        i.setMinimo(datos.minimo() == null || datos.minimo().signum() == 0 ? null : datos.minimo());
        i.setZona(zona);
        i.setCostoPromedio(datos.costo() == null || datos.costo().signum() == 0 ? null : datos.costo());
        ingredientRepository.save(i);
    }

    // ------------------------------------------------------------------
    // Zonas dadas de alta
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Zona> zonas(UUID branchId) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        return zonaRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(restaurantId).stream()
                .map(z -> new Zona(z.getId(), z.getNombre(), z.getOrden(), zonaRepository.articulosEn(z.getId())))
                .toList();
    }

    @Transactional
    public Zona crearZona(UUID branchId, NuevaZona datos) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        String nombre = datos.nombre().trim();
        if (zonaRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
            throw new IllegalArgumentException("Ya existe la zona " + nombre + ".");
        }
        int orden = datos.orden() != null ? datos.orden()
                : zonaRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(restaurantId).size();
        ZonaInventario z = zonaRepository.save(ZonaInventario.builder().restaurantId(restaurantId).nombre(nombre).orden(orden).build());
        return new Zona(z.getId(), z.getNombre(), z.getOrden(), 0);
    }

    @Transactional
    public Zona renombrarZona(UUID branchId, UUID zonaId, NuevaZona datos) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        ZonaInventario z = zona(zonaId, restaurantId);
        String nombre = datos.nombre().trim();
        if (!z.getNombre().equalsIgnoreCase(nombre) && zonaRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
            throw new IllegalArgumentException("Ya existe la zona " + nombre + ".");
        }
        z.setNombre(nombre);
        if (datos.orden() != null) z.setOrden(datos.orden());
        zonaRepository.save(z);
        return new Zona(z.getId(), z.getNombre(), z.getOrden(), zonaRepository.articulosEn(z.getId()));
    }

    /** Borra la zona; sus articulos quedan sin zona. */
    @Transactional
    public void borrarZona(UUID branchId, UUID zonaId) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        zonaRepository.delete(zona(zonaId, restaurantId));
    }

    private ZonaInventario zona(UUID id, UUID restaurantId) {
        ZonaInventario z = zonaRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Esa zona ya no existe."));
        if (!z.getRestaurantId().equals(restaurantId)) throw new IllegalArgumentException("Esa zona no es de esta sucursal.");
        return z;
    }

    // ------------------------------------------------------------------
    // Compras
    // ------------------------------------------------------------------

    /** Una nota del proveedor con varios renglones: cada uno entra al inventario con su costo. */
    @Transactional
    public Lote registrarCompra(UUID branchId, NuevaCompra compra) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        String proveedor = limpiar(compra.proveedor());
        Compra hecha = compraRepository.save(Compra.builder()
                .branchId(branchId).proveedor(proveedor).nota(limpiar(compra.nota())).usuario(quien()).build());

        BigDecimal total = BigDecimal.ZERO;
        for (Renglon r : compra.renglones()) {
            if (r.cantidad().signum() <= 0) throw new IllegalArgumentException("Cada renglón lleva una cantidad mayor a cero.");
            BigDecimal pagado = r.costoTotal() != null && r.costoTotal().signum() > 0 ? r.costoTotal() : null;
            if (pagado != null) total = total.add(pagado);
            String nota = "Compra" + (proveedor != null ? " a " + proveedor : "");
            if (r.productId() != null) {
                Product p = producto(r.productId(), restaurantId);
                int piezas = piezas(r.cantidad());
                inventoryService.moverProducto(branchId, p, piezas, TipoMovimiento.ENTRADA, false, nota,
                        pagado != null ? pagado.divide(BigDecimal.valueOf(piezas), 4, RoundingMode.HALF_UP) : null, hecha.getId());
            } else {
                Ingredient i = ingrediente(r.ingredientId(), restaurantId);
                BigDecimal cantidad = convertir(r.cantidad(), r.unidad(), i);
                inventoryService.moverIngrediente(branchId, i, cantidad, TipoMovimiento.ENTRADA, false, nota,
                        pagado != null ? pagado.divide(cantidad, 4, RoundingMode.HALF_UP) : null, proveedor, hecha.getId());
            }
        }
        hecha.setTotal(total.signum() > 0 ? total : null);
        compraRepository.save(hecha);
        return new Lote(compra.renglones().size(), "Compra registrada: " + compra.renglones().size()
                + (compra.renglones().size() == 1 ? " artículo" : " artículos")
                + (total.signum() > 0 ? " por $" + total.setScale(2, RoundingMode.HALF_UP) : "") + ".");
    }

    @Transactional(readOnly = true)
    public List<CompraHecha> compras(UUID branchId) {
        List<Compra> compras = compraRepository.findTop30ByBranchIdOrderByCreadoEnDesc(branchId);
        Map<UUID, List<MovimientoInventario>> porCompra = movimientoRepository
                .findByGrupoIdIn(compras.stream().map(Compra::getId).toList()).stream()
                .collect(Collectors.groupingBy(MovimientoInventario::getGrupoId));
        Map<UUID, String> nombres = nombresDe(sucursal(branchId).getRestaurant().getId());
        return compras.stream()
                .map(c -> new CompraHecha(c.getId(), c.getProveedor(), c.getNota(), c.getTotal(), c.getUsuario(), c.getCreadoEn(),
                        porCompra.getOrDefault(c.getId(), List.of()).stream()
                                .map(m -> legible(m.getCantidad()) + " " + nombres.getOrDefault(
                                        m.getIngredientId() != null ? m.getIngredientId() : m.getProductId(), "¿?"))
                                .toList()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Conteo fisico
    // ------------------------------------------------------------------

    /** Lo que se conto: cada renglon deja la existencia en ese numero y registra la diferencia. */
    @Transactional
    public Lote registrarConteo(UUID branchId, NuevoConteo conteo) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        UUID grupo = UUID.randomUUID();
        String nota = limpiar(conteo.nota()) != null ? limpiar(conteo.nota()) : "Conteo físico";
        int diferencias = 0;
        for (Renglon r : conteo.renglones()) {
            if (r.productId() != null) {
                Product p = producto(r.productId(), restaurantId);
                int antes = inventoryService.saldoProducto(branchId, p.getId()).intValue();
                int ahora = piezas(r.cantidad());
                if (antes != ahora) diferencias++;
                inventoryService.fijarProducto(branchId, p, ahora, TipoMovimiento.CONTEO, nota, grupo);
            } else {
                Ingredient i = ingrediente(r.ingredientId(), restaurantId);
                BigDecimal ahora = convertir(r.cantidad(), r.unidad(), i);
                if (inventoryService.saldoIngrediente(branchId, i.getId()).compareTo(ahora) != 0) diferencias++;
                inventoryService.fijarIngrediente(branchId, i, ahora, TipoMovimiento.CONTEO, nota, grupo);
            }
        }
        return new Lote(conteo.renglones().size(), "Conteo guardado: " + conteo.renglones().size()
                + (conteo.renglones().size() == 1 ? " artículo, " : " artículos, ")
                + (diferencias == 0 ? "todo cuadró." : diferencias + (diferencias == 1 ? " con diferencia." : " con diferencias.")));
    }

    // ------------------------------------------------------------------
    // Transferencias entre sucursales
    // ------------------------------------------------------------------

    /** Sale de esta sucursal y entra a la otra. No deja la de origen en negativo. */
    @Transactional
    public Lote transferir(UUID branchId, NuevaTransferencia t) {
        Branch origen = sucursal(branchId);
        Branch destino = sucursal(t.destinoId());
        if (origen.getId().equals(destino.getId())) {
            throw new IllegalArgumentException("Elige una sucursal distinta a esta.");
        }
        if (!origen.getRestaurant().getId().equals(destino.getRestaurant().getId())) {
            throw new IllegalArgumentException("Solo se puede pasar mercancía entre sucursales del mismo restaurante.");
        }
        securityValidationService.validateUserAccessToBranch(destino.getId());
        UUID restaurantId = origen.getRestaurant().getId();
        UUID grupo = UUID.randomUUID();
        String extra = limpiar(t.nota()) != null ? " · " + limpiar(t.nota()) : "";
        for (Renglon r : t.renglones()) {
            if (r.cantidad().signum() <= 0) throw new IllegalArgumentException("Cada renglón lleva una cantidad mayor a cero.");
            if (r.productId() != null) {
                Product p = producto(r.productId(), restaurantId);
                int piezas = piezas(r.cantidad());
                inventoryService.moverProducto(origen.getId(), p, -piezas, TipoMovimiento.TRANSFERENCIA, true,
                        "A " + destino.getName() + extra, null, grupo);
                inventoryService.moverProducto(destino.getId(), p, piezas, TipoMovimiento.TRANSFERENCIA, false,
                        "De " + origen.getName() + extra, null, grupo);
            } else {
                Ingredient i = ingrediente(r.ingredientId(), restaurantId);
                BigDecimal cantidad = convertir(r.cantidad(), r.unidad(), i);
                inventoryService.moverIngrediente(origen.getId(), i, cantidad.negate(), TipoMovimiento.TRANSFERENCIA, true,
                        "A " + destino.getName() + extra, null, null, grupo);
                inventoryService.moverIngrediente(destino.getId(), i, cantidad, TipoMovimiento.TRANSFERENCIA, false,
                        "De " + origen.getName() + extra, null, null, grupo);
            }
        }
        return new Lote(t.renglones().size(), "Se pasaron " + t.renglones().size()
                + (t.renglones().size() == 1 ? " artículo" : " artículos") + " a " + destino.getName() + ".");
    }

    // ------------------------------------------------------------------
    // Preparaciones
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Preparacion preparacion(UUID branchId, UUID preparadoId) {
        Ingredient p = ingrediente(preparadoId, sucursal(branchId).getRestaurant().getId());
        return aPreparacion(p);
    }

    @Transactional(readOnly = true)
    public List<Preparacion> preparaciones(UUID branchId) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        return ingredientRepository.findByRestaurantId(restaurantId).stream()
                .filter(i -> Boolean.TRUE.equals(i.getEsPreparado()))
                .sorted(Comparator.comparing(Ingredient::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::aPreparacion)
                .toList();
    }

    /**
     * La receta de una tanda y cuanto rinde. Los componentes son ingredientes
     * sueltos: un preparado no se hace con otro preparado, para que no haya
     * recetas que se contengan a si mismas.
     */
    @Transactional
    public Preparacion guardarPreparacion(UUID branchId, UUID preparadoId, Preparacion datos) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        Ingredient p = ingrediente(preparadoId, restaurantId);
        List<PreparacionComponente> nuevos = new ArrayList<>();
        Set<UUID> vistos = new HashSet<>();
        for (Componente c : datos.componentes()) {
            Ingredient comp = ingrediente(c.componenteId(), restaurantId);
            if (comp.getId().equals(p.getId())) throw new IllegalArgumentException("Una preparación no puede llevarse a sí misma.");
            if (Boolean.TRUE.equals(comp.getEsPreparado())) {
                throw new IllegalArgumentException(comp.getName() + " también es una preparación: usa sus ingredientes sueltos.");
            }
            if (!vistos.add(comp.getId())) throw new IllegalArgumentException(comp.getName() + " está dos veces.");
            String unidad = c.unidad() == null || c.unidad().isBlank() ? comp.getUnitOfMeasure() : Unidades.canonica(c.unidad());
            if (!Unidades.compatibles(unidad, Unidades.canonica(comp.getUnitOfMeasure()))) {
                throw new IllegalArgumentException(comp.getName() + " se lleva en " + comp.getUnitOfMeasure()
                        + ": no se puede escribir en " + unidad + ".");
            }
            nuevos.add(PreparacionComponente.builder().preparado(p).componente(comp).cantidad(c.cantidad()).unidad(unidad).build());
        }
        if (ingredientRepository.usadoComoComponente(p.getId())) {
            throw new IllegalArgumentException(p.getName() + " se usa dentro de otra preparación: no puede ser preparación también.");
        }
        p.setEsPreparado(true);
        p.setRinde(datos.rinde());
        p.getComponentes().clear();
        p.getComponentes().addAll(nuevos);
        ingredientRepository.save(p);
        return aPreparacion(p);
    }

    @Transactional
    public void quitarPreparacion(UUID branchId, UUID preparadoId) {
        Ingredient p = ingrediente(preparadoId, sucursal(branchId).getRestaurant().getId());
        p.setEsPreparado(false);
        p.setRinde(null);
        p.getComponentes().clear();
        ingredientRepository.save(p);
    }

    /**
     * Se hizo una preparacion: salen sus ingredientes en proporcion a lo que se
     * hizo y entra lo preparado, con su costo. "Hice 3 l de salsa" con una
     * receta que rinde 1.5 l = dos tandas.
     */
    @Transactional
    public Lote producir(UUID branchId, Producir orden) {
        UUID restaurantId = sucursal(branchId).getRestaurant().getId();
        Ingredient p = ingrediente(orden.preparadoId(), restaurantId);
        if (!Boolean.TRUE.equals(p.getEsPreparado()) || p.getRinde() == null || p.getComponentes().isEmpty()) {
            throw new IllegalArgumentException(p.getName() + " no tiene receta de preparación.");
        }
        BigDecimal tandas = orden.cantidad().divide(p.getRinde(), 6, RoundingMode.HALF_UP);
        UUID grupo = UUID.randomUUID();
        String nota = "Preparación: " + legible(orden.cantidad()) + " " + p.getUnitOfMeasure() + " de " + p.getName()
                + (limpiar(orden.nota()) != null ? " · " + limpiar(orden.nota()) : "");

        BigDecimal costoTotal = BigDecimal.ZERO;
        boolean conCosto = true;
        for (PreparacionComponente c : p.getComponentes()) {
            BigDecimal usa = Costos.enUnidadDe(c).multiply(tandas).setScale(3, RoundingMode.HALF_UP);
            inventoryService.moverIngrediente(branchId, c.getComponente(), usa.negate(), TipoMovimiento.PRODUCCION, false,
                    nota, null, null, grupo);
            if (c.getComponente().getCostoPromedio() == null) conCosto = false;
            else costoTotal = costoTotal.add(usa.multiply(c.getComponente().getCostoPromedio()));
        }
        BigDecimal costoUnitario = conCosto ? costoTotal.divide(orden.cantidad(), 4, RoundingMode.HALF_UP) : null;
        BigDecimal saldo = inventoryService.moverIngrediente(branchId, p, orden.cantidad(), TipoMovimiento.PRODUCCION, false,
                nota, costoUnitario, null, grupo);
        return new Lote(p.getComponentes().size() + 1, p.getName() + " quedó en " + legible(saldo) + " " + p.getUnitOfMeasure() + ".");
    }

    private Preparacion aPreparacion(Ingredient p) {
        return new Preparacion(p.getId(), p.getName(), p.getUnitOfMeasure(), p.getRinde(),
                p.getComponentes().stream()
                        .map(c -> new Componente(c.getComponente().getId(), c.getComponente().getName(), c.getCantidad(), c.getUnidad()))
                        .toList(),
                Costos.dePreparacion(p));
    }

    // ------------------------------------------------------------------
    // Reporte de consumo y merma
    // ------------------------------------------------------------------

    /**
     * Cuanto se consumio y se tiro en el periodo, cuanto costo, cuantos dias
     * alcanza lo que hay y cuanto conviene comprar para una semana.
     */
    @Transactional(readOnly = true)
    public Reporte reporte(UUID branchId, LocalDate desde, LocalDate hasta) {
        LocalDate fin = hasta != null ? hasta : Combos.hoy();
        LocalDate inicio = desde != null ? desde : fin.minusDays(6);
        if (inicio.isAfter(fin)) throw new IllegalArgumentException("La fecha inicial va antes de la final.");
        LocalDateTime d = inicio.atStartOfDay();
        LocalDateTime h = fin.plusDays(1).atStartOfDay();
        long dias = Math.max(1, ChronoUnit.DAYS.between(inicio, fin) + 1);

        Map<UUID, Map<TipoMovimiento, BigDecimal>> sumas = new HashMap<>();
        for (Object[] f : movimientoRepository.sumasPorTipo(branchId, d, h)) {
            UUID id = f[0] != null ? (UUID) f[0] : (UUID) f[1];
            sumas.computeIfAbsent(id, k -> new EnumMap<>(TipoMovimiento.class))
                    .merge((TipoMovimiento) f[2], (BigDecimal) f[3], BigDecimal::add);
        }

        BigDecimal totalConsumo = BigDecimal.ZERO;
        BigDecimal totalMerma = BigDecimal.ZERO;
        List<RenglonReporte> renglones = new ArrayList<>();
        for (Articulo a : existencias(branchId)) {
            Map<TipoMovimiento, BigDecimal> s = sumas.getOrDefault(a.id(), Map.of());
            // Consumo: lo vendido menos lo cancelado, mas lo que se uso en preparaciones.
            BigDecimal consumo = s.getOrDefault(TipoMovimiento.VENTA, BigDecimal.ZERO)
                    .add(s.getOrDefault(TipoMovimiento.CANCELACION, BigDecimal.ZERO)).negate();
            BigDecimal produccion = s.getOrDefault(TipoMovimiento.PRODUCCION, BigDecimal.ZERO);
            if (produccion.signum() < 0) consumo = consumo.add(produccion.negate());
            BigDecimal merma = s.getOrDefault(TipoMovimiento.MERMA, BigDecimal.ZERO).negate();
            BigDecimal entradas = s.getOrDefault(TipoMovimiento.ENTRADA, BigDecimal.ZERO);
            if (consumo.signum() == 0 && merma.signum() == 0 && entradas.signum() == 0
                    && (a.minimo() == null || a.existencia().compareTo(a.minimo()) >= 0)) {
                continue; // sin movimiento y sin problema: no estorba en el reporte
            }
            BigDecimal diario = consumo.divide(BigDecimal.valueOf(dias), 3, RoundingMode.HALF_UP);
            BigDecimal alcanza = diario.signum() > 0 ? a.existencia().divide(diario, 1, RoundingMode.HALF_UP) : null;
            BigDecimal objetivo = diario.multiply(BigDecimal.valueOf(DIAS_DE_COBERTURA))
                    .add(a.minimo() != null ? a.minimo() : BigDecimal.ZERO);
            BigDecimal sugerido = objetivo.subtract(a.existencia()).max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
            BigDecimal costoConsumo = a.costo() != null ? consumo.multiply(a.costo()).setScale(2, RoundingMode.HALF_UP) : null;
            BigDecimal costoMerma = a.costo() != null ? merma.multiply(a.costo()).setScale(2, RoundingMode.HALF_UP) : null;
            if (costoConsumo != null) totalConsumo = totalConsumo.add(costoConsumo);
            if (costoMerma != null) totalMerma = totalMerma.add(costoMerma);
            renglones.add(new RenglonReporte(a.tipo(), a.id(), a.nombre(), a.unidad(), a.existencia(), a.minimo(),
                    entradas, consumo, merma, a.costo(), costoConsumo, costoMerma, diario, alcanza, sugerido));
        }
        renglones.sort(Comparator.comparing((RenglonReporte r) -> r.costoConsumo() != null ? r.costoConsumo() : BigDecimal.ZERO)
                .reversed());
        return new Reporte(d, h, totalConsumo, totalMerma, renglones);
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private Branch sucursal(UUID id) {
        return branchRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
    }

    private Ingredient ingrediente(UUID id, UUID restaurantId) {
        if (id == null) throw new IllegalArgumentException("Elige un ingrediente o un producto.");
        Ingredient i = ingredientRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Ese ingrediente ya no existe."));
        if (!i.getRestaurant().getId().equals(restaurantId)) throw new IllegalArgumentException("Ese ingrediente no es de esta sucursal.");
        return i;
    }

    private Product producto(UUID id, UUID restaurantId) {
        Product p = productRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Ese producto ya no existe."));
        if (!p.getCategory().getRestaurant().getId().equals(restaurantId)) throw new IllegalArgumentException("Ese producto no es de esta sucursal.");
        if (!Boolean.TRUE.equals(p.getTrackStock())) throw new IllegalArgumentException(p.getName() + " no lleva existencias propias.");
        return p;
    }

    private static int piezas(BigDecimal cantidad) {
        if (cantidad.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("Los productos se cuentan por pieza: escribe números enteros.");
        }
        return cantidad.intValue();
    }

    private static BigDecimal convertir(BigDecimal cantidad, String unidad, Ingredient i) {
        return unidad == null || unidad.isBlank() ? cantidad : Unidades.convertir(cantidad, unidad, i.getUnitOfMeasure());
    }

    private Map<UUID, String> nombresDe(UUID restaurantId) {
        Map<UUID, String> nombres = new HashMap<>();
        ingredientRepository.findByRestaurantId(restaurantId).forEach(i -> nombres.put(i.getId(), i.getName()));
        productRepository.findByCategoryRestaurantId(restaurantId).forEach(p -> nombres.put(p.getId(), p.getName()));
        return nombres;
    }

    private static String quien() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CustomUserDetails u ? u.getUsername() : null;
    }

    private static String legible(BigDecimal n) {
        return n.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
