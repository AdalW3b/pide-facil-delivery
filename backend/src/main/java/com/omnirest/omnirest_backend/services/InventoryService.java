package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.ControlInventario;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CuentaPublicaPrincipal;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Las existencias de ingredientes y productos terminados, por sucursal.
 *
 * Todo cambio pasa por {@link #aplicar}: ahi se respeta el modo de control de
 * la sucursal, se deja el movimiento en el historial y se avisa si algo queda
 * por debajo de su minimo o en negativo.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InventoryService {

    private final BranchIngredientStockRepository branchIngredientStockRepository;
    private final BranchProductStockRepository branchProductStockRepository;
    private final RecipeItemRepository recipeItemRepository;
    private final BranchRepository branchRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductRepository productRepository;
    private final MovimientoInventarioRepository movimientoRepository;
    private final ProductoAgotadoRepository agotadoRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Lo que gasta un platillo de un ingrediente, en la unidad en que se lleva
     * el inventario: la receta dice 250 g y la carne se lleva en kg -> 0.25.
     * La receta se guarda tal como se escribio; esta es la unica conversion.
     */
    static BigDecimal consumoPorPlatillo(RecipeItem receta) {
        Ingredient ingrediente = receta.getIngredient();
        String unidadInventario = ingrediente != null ? ingrediente.getUnitOfMeasure() : null;
        try {
            return Unidades.convertir(receta.getQuantity(), receta.getRecipeUnit(), unidadInventario);
        } catch (IllegalArgumentException e) {
            // Receta vieja con unidades que no se pueden convertir (p. ej. g contra pieza):
            // se descuenta la cantidad tal cual, como antes, para no frenar la venta.
            return receta.getQuantity() != null ? receta.getQuantity() : BigDecimal.ZERO;
        }
    }

    /** El modo de control de la sucursal. Si no se encuentra, AVISAR: no frenar la venta. */
    @Transactional(readOnly = true)
    public ControlInventario modo(UUID branchId) {
        if (branchId == null) return ControlInventario.AVISAR;
        return branchRepository.findById(branchId)
                .map(Branch::getControlInventario)
                .filter(java.util.Objects::nonNull)
                .orElse(ControlInventario.AVISAR);
    }

    public ControlInventario cambiarModo(UUID branchId, ControlInventario modo) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        branch.setControlInventario(modo);
        branchRepository.save(branch);
        log.info("Sucursal {}: control de inventario en {}", branchId, modo);
        return modo;
    }

    // ------------------------------------------------------------------
    // Ventas y cancelaciones
    // ------------------------------------------------------------------

    /**
     * Descuenta del inventario lo que gasta una linea del pedido y lo deja
     * anotado en la linea, para devolver exactamente eso si se cancela. Un combo
     * no tiene receta propia: gasta lo de sus platillos (4 combos con 2 tacos
     * cada uno = 8 tacos).
     */
    public void venderLinea(OrderItem item, UUID branchId) {
        Product producto = item.getProduct();
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 0;
        if (producto == null || cantidad <= 0) return;

        exigirQueNoSeHayaAcabado(producto, branchId);
        ControlInventario modo = modo(branchId);
        UUID orderId = item.getOrder() != null ? item.getOrder().getId() : null;

        if (!Combos.esCombo(producto)) {
            consumir(producto, cantidad, item, branchId, modo, orderId);
            return;
        }

        Combos.validarVigente(producto);
        if (producto.getComboItems() == null || producto.getComboItems().isEmpty()) {
            throw new IllegalStateException("El combo " + producto.getName() + " no tiene platillos.");
        }
        for (ComboItem parte : producto.getComboItems()) {
            if (!Boolean.TRUE.equals(parte.getProducto().getActive())) {
                throw new IllegalStateException("El combo " + producto.getName() + " no está disponible: "
                        + parte.getProducto().getName() + " está desactivado.");
            }
            exigirQueNoSeHayaAcabado(parte.getProducto(), branchId);
        }
        for (ComboItem parte : producto.getComboItems()) {
            Product platillo = parte.getProducto();
            consumir(platillo, parte.getCantidad() * cantidad, item, branchId, modo, orderId);
            item.getComponentes().add(OrderItemComponente.builder()
                    .orderItem(item)
                    .productId(platillo.getId())
                    .nombre(platillo.getName())
                    .cantidad(parte.getCantidad())
                    .build());
        }
    }

    /** Lo que se usa en pruebas y en ventas sueltas: descuenta sin anotar en una linea. */
    public void checkAndDeductStock(Product product, UUID branchId, int quantitySold) {
        if (quantitySold <= 0 || product == null || branchId == null) return;
        consumir(product, quantitySold, null, branchId, modo(branchId), null);
    }

    private void consumir(Product producto, int cantidad, OrderItem item, UUID branchId,
                          ControlInventario modo, UUID orderId) {
        if (modo == ControlInventario.APAGADO || branchId == null) return;
        boolean bloquear = modo == ControlInventario.BLOQUEAR;
        String nota = "Venta: " + cantidad + " × " + producto.getName();

        if (Boolean.TRUE.equals(producto.getIsRecipe())) {
            List<RecipeItem> receta = producto.getRecipeItems() != null && !producto.getRecipeItems().isEmpty()
                    ? producto.getRecipeItems()
                    : recipeItemRepository.findByProductId(producto.getId());
            for (RecipeItem renglon : receta) {
                Ingredient ingrediente = renglon.getIngredient();
                BigDecimal total = consumoPorPlatillo(renglon).multiply(BigDecimal.valueOf(cantidad));
                if (total.signum() <= 0) continue;
                aplicarIngrediente(branchId, ingrediente, total.negate(), TipoMovimiento.VENTA, bloquear,
                        orderId, nota, null, null, "Stock insuficiente del ingrediente: " + ingrediente.getName());
                anotar(item, ingrediente.getId(), null, total);
            }
        } else if (Boolean.TRUE.equals(producto.getTrackStock())) {
            aplicarProducto(branchId, producto, -cantidad, TipoMovimiento.VENTA, bloquear, orderId, nota,
                    "Ya no quedan suficientes " + producto.getName() + ".");
            anotar(item, null, producto.getId(), BigDecimal.valueOf(cantidad));
        }
    }

    private void anotar(OrderItem item, UUID ingredientId, UUID productId, BigDecimal cantidad) {
        if (item == null) return;
        item.getConsumos().add(OrderItemConsumo.builder()
                .orderItem(item).ingredientId(ingredientId).productId(productId).cantidad(cantidad).build());
    }

    public void devolverLinea(OrderItem item, UUID branchId) {
        devolverLinea(item, branchId, false, null);
    }

    /**
     * Devuelve al inventario lo que desconto la linea. Si la cocina ya lo habia
     * preparado, la comida se tiro: se registra la devolucion y enseguida la
     * merma, para que el historial explique a donde se fue.
     */
    public void devolverLinea(OrderItem item, UUID branchId, boolean yaPreparado, String motivo) {
        if (item == null || item.getProduct() == null || item.getQuantity() == null || branchId == null) return;
        UUID orderId = item.getOrder() != null ? item.getOrder().getId() : null;
        String nota = "Cancelado: " + item.getQuantity() + " × " + item.getProduct().getName();
        String notaMerma = "Se canceló ya preparado: " + item.getQuantity() + " × " + item.getProduct().getName()
                + (motivo != null && !motivo.isBlank() ? " (" + motivo.trim() + ")" : "");

        if (item.getConsumos() != null && !item.getConsumos().isEmpty()) {
            for (OrderItemConsumo c : item.getConsumos()) {
                devolverUno(branchId, c.getIngredientId(), c.getProductId(), c.getCantidad(), yaPreparado, orderId, nota, notaMerma);
            }
            return;
        }

        // Lineas vendidas antes de que se anotara el consumo: se devuelve con la
        // receta de hoy, como antes. Si ya estaba preparada no se devuelve nada.
        if (yaPreparado) return;
        if (item.getComponentes() == null || item.getComponentes().isEmpty()) {
            restoreStock(item.getProduct(), branchId, item.getQuantity());
            return;
        }
        for (OrderItemComponente parte : item.getComponentes()) {
            if (parte.getProductId() == null) continue; // El platillo ya se borro del catalogo.
            productRepository.findById(parte.getProductId()).ifPresent(platillo ->
                    restoreStock(platillo, branchId, parte.getCantidad() * item.getQuantity()));
        }
    }

    private void devolverUno(UUID branchId, UUID ingredientId, UUID productId, BigDecimal cantidad,
                             boolean yaPreparado, UUID orderId, String nota, String notaMerma) {
        if (cantidad == null || cantidad.signum() <= 0) return;
        if (ingredientId != null) {
            ingredientRepository.findById(ingredientId).ifPresent(ing -> {
                aplicarIngrediente(branchId, ing, cantidad, TipoMovimiento.CANCELACION, false, orderId, nota, null, null, null);
                if (yaPreparado) {
                    aplicarIngrediente(branchId, ing, cantidad.negate(), TipoMovimiento.MERMA, false, orderId, notaMerma, null, null, null);
                }
            });
        } else if (productId != null) {
            productRepository.findById(productId).ifPresent(p -> {
                aplicarProducto(branchId, p, cantidad.intValue(), TipoMovimiento.CANCELACION, false, orderId, nota, null);
                if (yaPreparado) {
                    aplicarProducto(branchId, p, -cantidad.intValue(), TipoMovimiento.MERMA, false, orderId, notaMerma, null);
                }
            });
        }
    }

    /**
     * Descuenta lo que gastan los adicionales de una linea: "Carne extra" en
     * 2 platillos saca dos porciones de pastor. Usa lo congelado en la linea,
     * que es tambien lo que se devuelve si se cancela.
     */
    public void descontarAdicionales(OrderItem item, UUID branchId) {
        if (item == null || item.getAdicionales() == null || branchId == null) return;
        ControlInventario modo = modo(branchId);
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        UUID orderId = item.getOrder() != null ? item.getOrder().getId() : null;
        for (OrderItemAdicional a : item.getAdicionales()) {
            if (a.getIngredientId() == null || a.getCantidadIngrediente() == null) continue;
            if (modo == ControlInventario.APAGADO) {
                // No se desconto: que al cancelar tampoco se devuelva.
                a.setCantidadIngrediente(null);
                continue;
            }
            Ingredient ingrediente = ingredientRepository.findById(a.getIngredientId()).orElse(null);
            if (ingrediente == null) continue;
            BigDecimal total = a.getCantidadIngrediente().multiply(BigDecimal.valueOf(cantidad));
            aplicarIngrediente(branchId, ingrediente, total.negate(), TipoMovimiento.VENTA,
                    modo == ControlInventario.BLOQUEAR, orderId, "Adicional: " + a.getNombre(), null, null,
                    "No alcanza " + ingrediente.getName() + " para " + a.getNombre()
                            + ". Márcalo como agotado o repón el inventario.");
        }
    }

    public void devolverAdicionales(OrderItem item, UUID branchId) {
        devolverAdicionales(item, branchId, false, null);
    }

    /** Devuelve al inventario lo que se desconto por los adicionales de una linea. */
    public void devolverAdicionales(OrderItem item, UUID branchId, boolean yaPreparado, String motivo) {
        if (item == null || item.getAdicionales() == null || branchId == null) return;
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        UUID orderId = item.getOrder() != null ? item.getOrder().getId() : null;
        for (OrderItemAdicional a : item.getAdicionales()) {
            if (a.getIngredientId() == null || a.getCantidadIngrediente() == null) continue;
            BigDecimal total = a.getCantidadIngrediente().multiply(BigDecimal.valueOf(cantidad));
            devolverUno(branchId, a.getIngredientId(), null, total, yaPreparado, orderId,
                    "Cancelado (adicional): " + a.getNombre(),
                    "Adicional cancelado ya preparado: " + a.getNombre()
                            + (motivo != null && !motivo.isBlank() ? " (" + motivo.trim() + ")" : ""));
        }
    }

    /** Devuelve existencias de un producto con la receta de hoy (lineas viejas sin consumo anotado). */
    public void restoreStock(Product product, UUID branchId, int quantityRestored) {
        if (quantityRestored <= 0 || product == null || branchId == null) return;
        String nota = "Cancelado: " + quantityRestored + " × " + product.getName();
        if (Boolean.TRUE.equals(product.getIsRecipe())) {
            List<RecipeItem> receta = product.getRecipeItems() != null && !product.getRecipeItems().isEmpty()
                    ? product.getRecipeItems()
                    : recipeItemRepository.findByProductId(product.getId());
            for (RecipeItem renglon : receta) {
                BigDecimal total = consumoPorPlatillo(renglon).multiply(BigDecimal.valueOf(quantityRestored));
                aplicarIngrediente(branchId, renglon.getIngredient(), total, TipoMovimiento.CANCELACION, false, null, nota, null, null, null);
            }
        } else if (Boolean.TRUE.equals(product.getTrackStock())) {
            aplicarProducto(branchId, product, quantityRestored, TipoMovimiento.CANCELACION, false, null, nota, null);
        }
    }

    // ------------------------------------------------------------------
    // Movimientos a mano: entradas, mermas, conteos y ajustes
    // ------------------------------------------------------------------

    /**
     * Deja la existencia en un numero exacto (conteo fisico o ajuste). Lo que
     * se registra es la diferencia, para que el historial cuadre.
     */
    public BigDecimal fijarIngrediente(UUID branchId, Ingredient ingrediente, BigDecimal nuevo, TipoMovimiento tipo, String nota) {
        BigDecimal actual = saldoIngrediente(branchId, ingrediente.getId());
        BigDecimal delta = nuevo.subtract(actual);
        return aplicarIngrediente(branchId, ingrediente, delta, tipo, false, null, nota, null, null, null);
    }

    public BigDecimal fijarProducto(UUID branchId, Product producto, int nuevo, TipoMovimiento tipo, String nota) {
        int actual = saldoProducto(branchId, producto.getId()).intValue();
        return aplicarProducto(branchId, producto, nuevo - actual, tipo, false, null, nota, null);
    }

    /** Entrada o merma de un ingrediente; la cantidad ya viene en la unidad del inventario. */
    public BigDecimal moverIngrediente(UUID branchId, Ingredient ingrediente, BigDecimal delta, TipoMovimiento tipo,
                                      String nota, BigDecimal costoUnitario, String proveedor) {
        return aplicarIngrediente(branchId, ingrediente, delta, tipo, false, null, nota, costoUnitario, proveedor, null);
    }

    public BigDecimal moverProducto(UUID branchId, Product producto, int delta, TipoMovimiento tipo, String nota) {
        return aplicarProducto(branchId, producto, delta, tipo, false, null, nota, null);
    }

    /** Compatibilidad con los ajustes viejos del panel: fija el numero y lo registra como ajuste. */
    public void setAbsoluteStock(UUID itemId, UUID branchId, Number newStock, boolean isIngredient) {
        if (itemId == null || branchId == null || newStock == null) return;
        if (isIngredient) {
            Ingredient ingrediente = ingredientRepository.findById(itemId)
                    .orElseThrow(() -> new IllegalArgumentException("Ingredient not found: " + itemId));
            fijarIngrediente(branchId, ingrediente, new BigDecimal(newStock.toString()), TipoMovimiento.AJUSTE, "Ajuste");
        } else {
            Product producto = productRepository.findById(itemId)
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + itemId));
            fijarProducto(branchId, producto, newStock.intValue(), TipoMovimiento.AJUSTE, "Ajuste");
        }
    }

    // ------------------------------------------------------------------
    // El unico lugar donde cambian las existencias
    // ------------------------------------------------------------------

    /**
     * Suma (o resta, si delta es negativo) al ingrediente en la sucursal, deja
     * el movimiento y avisa si queda bajo su minimo o en negativo.
     *
     * @param bloquear   si falta, rechazar con {@code mensajeFalta} en vez de dejar negativo.
     * @return el saldo con que quedo.
     */
    private BigDecimal aplicarIngrediente(UUID branchId, Ingredient ingrediente, BigDecimal delta, TipoMovimiento tipo,
                                          boolean bloquear, UUID orderId, String nota, BigDecimal costoUnitario,
                                          String proveedor, String mensajeFalta) {
        UUID id = ingrediente.getId();
        if (delta.signum() < 0) {
            int hecho = branchIngredientStockRepository.subtractStockAtomic(branchId, id, delta.negate());
            if (hecho == 0) {
                if (bloquear) {
                    throw new IllegalStateException(mensajeFalta != null ? mensajeFalta
                            : "No alcanza " + ingrediente.getName() + ".");
                }
                sumarForzado(branchId, ingrediente, delta);
            }
        } else if (delta.signum() > 0) {
            sumarForzado(branchId, ingrediente, delta);
        }
        BigDecimal saldo = saldoIngrediente(branchId, id);
        registrar(MovimientoInventario.builder()
                .branchId(branchId).ingredientId(id).tipo(tipo).cantidad(delta).saldo(saldo)
                .costoUnitario(costoUnitario).proveedor(proveedor).nota(recortar(nota))
                .orderId(orderId).usuario(quien()).build());
        if (delta.signum() < 0) {
            avisarSiQuedaPoco(branchId, ingrediente, saldo.subtract(delta), saldo);
        }
        return saldo;
    }

    private void sumarForzado(UUID branchId, Ingredient ingrediente, BigDecimal delta) {
        int hecho = branchIngredientStockRepository.addStockAtomic(branchId, ingrediente.getId(), delta);
        if (hecho == 0) {
            // La sucursal nunca habia tenido este ingrediente: se crea su renglon.
            Branch branch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
            branchIngredientStockRepository.save(BranchIngredientStock.builder()
                    .id(new BranchIngredientStockKey(branchId, ingrediente.getId()))
                    .branch(branch)
                    .ingredient(ingrediente)
                    .stock(delta)
                    .build());
        }
    }

    private BigDecimal aplicarProducto(UUID branchId, Product producto, int delta, TipoMovimiento tipo, boolean bloquear,
                                       UUID orderId, String nota, String mensajeFalta) {
        UUID id = producto.getId();
        if (delta < 0) {
            int hecho = branchProductStockRepository.subtractStockAtomic(branchId, id, -delta);
            if (hecho == 0) {
                if (bloquear) {
                    throw new IllegalStateException(mensajeFalta != null ? mensajeFalta
                            : "Operación rechazada: Stock insuficiente o producto no encontrado en la sucursal.");
                }
                sumarForzadoProducto(branchId, producto, delta);
            }
        } else if (delta > 0) {
            sumarForzadoProducto(branchId, producto, delta);
        }
        BigDecimal saldo = saldoProducto(branchId, id);
        registrar(MovimientoInventario.builder()
                .branchId(branchId).productId(id).tipo(tipo).cantidad(BigDecimal.valueOf(delta)).saldo(saldo)
                .nota(recortar(nota)).orderId(orderId).usuario(quien()).build());
        if (delta < 0 && saldo.signum() < 0 && saldo.subtract(BigDecimal.valueOf(delta)).signum() >= 0) {
            avisar(branchId, producto.getName() + " quedó en negativo (" + saldo.stripTrailingZeros().toPlainString()
                    + "): revisa el inventario.");
        }
        return saldo;
    }

    private void sumarForzadoProducto(UUID branchId, Product producto, int delta) {
        int hecho = branchProductStockRepository.addStockAtomic(branchId, producto.getId(), delta);
        if (hecho == 0) {
            Branch branch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
            branchProductStockRepository.save(BranchProductStock.builder()
                    .id(new BranchProductStockKey(branchId, producto.getId()))
                    .branch(branch)
                    .product(producto)
                    .stock(delta)
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public BigDecimal saldoIngrediente(UUID branchId, UUID ingredientId) {
        return branchIngredientStockRepository.saldo(branchId, ingredientId).orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public BigDecimal saldoProducto(UUID branchId, UUID productId) {
        return branchProductStockRepository.saldo(branchId, productId).map(BigDecimal::valueOf).orElse(BigDecimal.ZERO);
    }

    private void registrar(MovimientoInventario movimiento) {
        movimientoRepository.save(movimiento);
    }

    /**
     * "Queda poco de Carne: 0.8 kg (mínimo 2 kg)" o "quedó en negativo". Solo al
     * cruzar la raya, no en cada venta: si no, el gerente recibe un aviso por taco.
     */
    private void avisarSiQuedaPoco(UUID branchId, Ingredient ingrediente, BigDecimal antes, BigDecimal despues) {
        String unidad = ingrediente.getUnitOfMeasure() != null ? " " + ingrediente.getUnitOfMeasure() : "";
        if (antes.signum() >= 0 && despues.signum() < 0) {
            avisar(branchId, ingrediente.getName() + " quedó en negativo (" + legible(despues) + unidad
                    + "): se vendió más de lo que había registrado. Revisa el inventario.");
            return;
        }
        BigDecimal minimo = ingrediente.getMinimo();
        if (minimo != null && minimo.signum() > 0 && antes.compareTo(minimo) >= 0 && despues.compareTo(minimo) < 0) {
            avisar(branchId, "Queda poco de " + ingrediente.getName() + ": " + legible(despues) + unidad
                    + " (mínimo " + legible(minimo) + unidad + ").");
        }
    }

    /** Al canal de avisos del panel: lo ven el gerente y el administrador. */
    private void avisar(UUID branchId, String mensaje) {
        try {
            Object aviso = Map.of("type", "INVENTARIO", "message", mensaje, "assignedUserIds", List.of());
            messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/alerts", aviso);
        } catch (Exception e) {
            log.warn("No se pudo mandar el aviso de inventario: {}", e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // Agotados
    // ------------------------------------------------------------------

    /** Un "se acabó" marcado hoy frena la venta en cualquier modo. */
    private void exigirQueNoSeHayaAcabado(Product producto, UUID branchId) {
        if (branchId == null || producto.getId() == null) return;
        boolean agotado = agotadoRepository.findById(new ProductoAgotado.Clave(branchId, producto.getId()))
                .filter(a -> !a.getDesde().toLocalDate().isBefore(Combos.hoy()))
                .isPresent();
        if (agotado) {
            throw new IllegalStateException(producto.getName() + " se acabó por hoy.");
        }
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    /** Quien hizo el cambio: el empleado, o de donde vino la venta. */
    private static String quien() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        Object p = auth.getPrincipal();
        if (p instanceof CustomUserDetails u) return u.getUsername();
        if (p instanceof CuentaPublicaPrincipal c) return c.esRepartidor() ? "Repartidor" : "Cliente";
        return null;
    }

    private static String legible(BigDecimal n) {
        return n.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String recortar(String texto) {
        if (texto == null) return null;
        return texto.length() > 300 ? texto.substring(0, 300) : texto;
    }
}
