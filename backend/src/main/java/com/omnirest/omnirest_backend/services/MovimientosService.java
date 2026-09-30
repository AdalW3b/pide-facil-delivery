package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.MovimientoInventario;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.dtos.InventarioDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.IngredientRepository;
import com.omnirest.omnirest_backend.repositories.MovimientoInventarioRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * Entradas de mercancia, mermas y conteos fisicos capturados en el panel, y el
 * historial de cada existencia.
 */
@Service
@RequiredArgsConstructor
public class MovimientosService {

    private final InventoryService inventoryService;
    private final BranchRepository branchRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductRepository productRepository;
    private final MovimientoInventarioRepository movimientoRepository;

    @Transactional
    public InventarioDTOs.Resultado registrar(UUID branchId, InventarioDTOs.NuevoMovimiento m) {
        if ((m.ingredientId() == null) == (m.productId() == null)) {
            throw new IllegalArgumentException("Elige un ingrediente o un producto.");
        }
        TipoMovimiento tipo = m.tipo();
        if (tipo != TipoMovimiento.ENTRADA && tipo != TipoMovimiento.MERMA && tipo != TipoMovimiento.CONTEO) {
            throw new IllegalArgumentException("Solo se capturan entradas, mermas y conteos.");
        }
        if (tipo != TipoMovimiento.CONTEO && m.cantidad().signum() <= 0) {
            throw new IllegalArgumentException("Escribe una cantidad mayor a cero.");
        }
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        UUID restaurantId = branch.getRestaurant().getId();
        String nota = limpiar(m.nota());

        if (m.ingredientId() != null) {
            Ingredient ing = ingredientRepository.findById(m.ingredientId())
                    .orElseThrow(() -> new IllegalArgumentException("Ese ingrediente ya no existe."));
            if (!ing.getRestaurant().getId().equals(restaurantId)) {
                throw new IllegalArgumentException("Ese ingrediente no es de esta sucursal.");
            }
            // "500 g" de un ingrediente que se lleva en kg entra como 0.5.
            BigDecimal cantidad = m.unidad() == null || m.unidad().isBlank()
                    ? m.cantidad()
                    : Unidades.convertir(m.cantidad(), m.unidad(), ing.getUnitOfMeasure());

            BigDecimal saldo = switch (tipo) {
                case ENTRADA -> inventoryService.moverIngrediente(branchId, ing, cantidad, tipo,
                        nota != null ? nota : "Entrada de mercancía", costoUnitario(m.costoTotal(), cantidad), limpiar(m.proveedor()));
                case MERMA -> inventoryService.moverIngrediente(branchId, ing, cantidad.negate(), tipo,
                        nota != null ? nota : "Merma", null, null);
                default -> inventoryService.fijarIngrediente(branchId, ing, cantidad, tipo,
                        nota != null ? nota : "Conteo físico");
            };
            return new InventarioDTOs.Resultado(saldo, ing.getName() + " quedó en " + legible(saldo)
                    + (ing.getUnitOfMeasure() != null ? " " + ing.getUnitOfMeasure() : "") + ".");
        }

        Product p = productRepository.findById(m.productId())
                .orElseThrow(() -> new IllegalArgumentException("Ese producto ya no existe."));
        if (!p.getCategory().getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("Ese producto no es de esta sucursal.");
        }
        if (!Boolean.TRUE.equals(p.getTrackStock())) {
            throw new IllegalArgumentException(p.getName() + " no lleva existencias propias.");
        }
        if (m.cantidad().stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("Los productos se cuentan por pieza: escribe un número entero.");
        }
        int cantidad = m.cantidad().intValue();
        BigDecimal saldo = switch (tipo) {
            case ENTRADA -> inventoryService.moverProducto(branchId, p, cantidad, tipo, nota != null ? nota : "Entrada de mercancía");
            case MERMA -> inventoryService.moverProducto(branchId, p, -cantidad, tipo, nota != null ? nota : "Merma");
            default -> inventoryService.fijarProducto(branchId, p, cantidad, tipo, nota != null ? nota : "Conteo físico");
        };
        return new InventarioDTOs.Resultado(saldo, p.getName() + " quedó en " + legible(saldo) + ".");
    }

    @Transactional(readOnly = true)
    public List<InventarioDTOs.Movimiento> historial(UUID branchId, UUID ingredientId, UUID productId) {
        List<MovimientoInventario> lista = ingredientId != null
                ? movimientoRepository.findTop100ByBranchIdAndIngredientIdOrderByCreadoEnDesc(branchId, ingredientId)
                : movimientoRepository.findTop100ByBranchIdAndProductIdOrderByCreadoEnDesc(branchId, productId);
        return lista.stream()
                .map(x -> new InventarioDTOs.Movimiento(x.getId(), x.getTipo(), x.getCantidad(), x.getSaldo(),
                        x.getCostoUnitario(), x.getProveedor(), x.getNota(), x.getUsuario(), x.getOrderId(), x.getCreadoEn()))
                .toList();
    }

    private static BigDecimal costoUnitario(BigDecimal costoTotal, BigDecimal cantidad) {
        if (costoTotal == null || costoTotal.signum() <= 0 || cantidad.signum() <= 0) return null;
        return costoTotal.divide(cantidad, 4, RoundingMode.HALF_UP);
    }

    private static String legible(BigDecimal n) {
        return n.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
