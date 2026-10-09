package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ComprasDTOs;
import com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.PedidoProveedorRepository;
import com.omnirest.omnirest_backend.repositories.ProveedorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Pedirle al proveedor: lo que conviene comprar se separa por quien lo surte,
 * se arma el mensaje de WhatsApp y, cuando llega, se recibe como compra (ver
 * {@link ComprasService#registrar}).
 */
@Service
@RequiredArgsConstructor
public class PedidosProveedorService {

    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", Locale.forLanguageTag("es-MX"));

    private final BranchRepository branchRepository;
    private final ProveedorRepository proveedorRepository;
    private final PedidoProveedorRepository pedidoRepository;
    private final ComprasService compras;
    private final OperacionesInventarioService operaciones;
    private final ColaWhatsapp colaWhatsapp;

    /** Lo que conviene pedir para una semana y quien lo surte. */
    @Transactional(readOnly = true)
    public List<ComprasDTOs.Sugerido> sugerencias(UUID branchId) {
        UUID restaurantId = compras.restauranteDe(branchId);
        Map<UUID, List<UUID>> quienSurte = new HashMap<>();
        for (Proveedor p : proveedorRepository.findByRestaurantIdOrderByNombreAsc(restaurantId)) {
            if (!Boolean.TRUE.equals(p.getActivo())) continue;
            for (ProveedorArticulo a : p.getArticulos()) {
                UUID id = a.getIngredientId() != null ? a.getIngredientId() : a.getProductId();
                quienSurte.computeIfAbsent(id, k -> new ArrayList<>()).add(p.getId());
            }
        }
        List<ComprasDTOs.Sugerido> lista = new ArrayList<>();
        for (OperacionesInventarioDTOs.RenglonReporte r : operaciones.reporte(branchId, null, null).renglones()) {
            if (r.esPreparado() || r.sugerido() == null || r.sugerido().signum() <= 0) continue;
            lista.add(new ComprasDTOs.Sugerido(r.tipo(), r.id(), r.nombre(), r.unidad(), r.existencia(), r.sugerido(),
                    quienSurte.getOrDefault(r.id(), List.of())));
        }
        return lista;
    }

    @Transactional(readOnly = true)
    public List<ComprasDTOs.Pedido> pedidos(UUID branchId) {
        Branch sucursal = sucursal(branchId);
        List<PedidoProveedor> lista = pedidoRepository.findTop40ByBranchIdOrderByCreadoEnDesc(branchId);
        Map<UUID, Proveedor> proveedores = new HashMap<>();
        proveedorRepository.findAllById(lista.stream().map(PedidoProveedor::getProveedorId).filter(Objects::nonNull).distinct().toList())
                .forEach(p -> proveedores.put(p.getId(), p));
        return lista.stream().map(p -> aDto(p, proveedores.get(p.getProveedorId()), sucursal)).toList();
    }

    @Transactional
    public ComprasDTOs.Pedido crear(UUID branchId, ComprasDTOs.NuevoPedido datos) {
        Branch sucursal = sucursal(branchId);
        UUID restaurantId = sucursal.getRestaurant().getId();
        Proveedor proveedor = compras.proveedor(datos.proveedorId(), restaurantId);
        LocalDate hoy = Combos.hoy();
        LocalDate para = datos.para() != null ? datos.para() : hoy.plusDays(1);
        if (para.isBefore(hoy)) throw new IllegalArgumentException("El pedido es para hoy o para después.");

        PedidoProveedor pedido = PedidoProveedor.builder()
                .branchId(branchId)
                .proveedorId(proveedor.getId())
                .proveedor(proveedor.getNombre())
                .para(para)
                .nota(ComprasService.limpiar(datos.nota()))
                .creadoPor(ComprasService.quien())
                .build();
        int orden = 0;
        for (ComprasDTOs.RenglonPedido r : datos.renglones()) {
            pedido.getRenglones().add(renglon(pedido, r, restaurantId, orden++));
        }
        pedido = pedidoRepository.save(pedido);
        // Como al repartidor: si el proveedor tiene WhatsApp, el pedido le
        // llega solo desde el numero de la sucursal.
        if (TelefonoMx.esValido(proveedor.getTelefono())) {
            mandar(pedido, proveedor, sucursal);
        }
        return aDto(pedido, proveedor, sucursal);
    }

    /** Lo manda (o lo vuelve a mandar) por el WhatsApp de la sucursal. */
    @Transactional
    public ComprasDTOs.Pedido enviar(UUID branchId, UUID id) {
        Branch sucursal = sucursal(branchId);
        PedidoProveedor p = pedido(branchId, id);
        if (!PedidoProveedor.PENDIENTE.equals(p.getEstado())) {
            throw new IllegalStateException("Ese pedido ya está " + p.getEstado().toLowerCase() + ".");
        }
        Proveedor proveedor = p.getProveedorId() != null ? proveedorRepository.findById(p.getProveedorId()).orElse(null) : null;
        if (proveedor == null || !TelefonoMx.esValido(proveedor.getTelefono())) {
            throw new IllegalArgumentException("Ponle el WhatsApp a " + p.getProveedor() + " en Proveedores para mandarle el pedido.");
        }
        mandar(p, proveedor, sucursal);
        return aDto(p, proveedor, sucursal);
    }

    private void mandar(PedidoProveedor p, Proveedor proveedor, Branch sucursal) {
        String telefono = TelefonoMx.canonico(proveedor.getTelefono());
        colaWhatsapp.encolar(sucursal.getId(), telefono, mensaje(p, sucursal),
                com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.PEDIDO_PROVEEDOR, "proveedor:" + p.getId());
        p.setEnviadoEn(LocalDateTime.now());
        p.setEnviadoA(telefono);
        pedidoRepository.save(p);
    }

    /** Un pedido que ya no va a llegar. */
    @Transactional
    public ComprasDTOs.Resultado cancelar(UUID branchId, UUID id) {
        PedidoProveedor p = pedido(branchId, id);
        if (!PedidoProveedor.PENDIENTE.equals(p.getEstado())) {
            throw new IllegalStateException("Solo se cancela un pedido que no ha llegado.");
        }
        p.setEstado(PedidoProveedor.CANCELADO);
        p.setCerradoEn(LocalDateTime.now());
        pedidoRepository.save(p);
        // Si ya le habia llegado, se le avisa por el mismo medio.
        if (p.getEnviadoA() != null) {
            Branch sucursal = sucursal(branchId);
            colaWhatsapp.encolar(branchId, p.getEnviadoA(),
                    "Buen día, le escribe " + quienEscribe(sucursal) + ". Le pedimos *cancelar* el pedido"
                            + (p.getPara() != null ? " para el " + p.getPara().format(DIA) : "") + " que le enviamos. Gracias.",
                    com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.PEDIDO_PROVEEDOR, "proveedor:" + p.getId());
        }
        return new ComprasDTOs.Resultado("Pedido a " + p.getProveedor() + " cancelado.");
    }

    // ------------------------------------------------------------------

    /** Valida el articulo y deja escrito como se pidio: "2 caja de 24 Coca-Cola 355 ml". */
    private PedidoProveedorRenglon renglon(PedidoProveedor pedido, ComprasDTOs.RenglonPedido r, UUID restaurantId, int orden) {
        PresentacionCompra pres = r.presentacionId() != null ? compras.presentacion(r.presentacionId(), restaurantId) : null;
        PedidoProveedorRenglon.PedidoProveedorRenglonBuilder b = PedidoProveedorRenglon.builder()
                .pedido(pedido)
                .cantidad(r.cantidad().setScale(3, RoundingMode.HALF_UP))
                .presentacionId(pres != null ? pres.getId() : null)
                .orden(orden);
        String cant = ComprasService.legible(r.cantidad());
        if (r.productId() != null) {
            Product p = compras.producto(r.productId(), restaurantId);
            if (pres != null && !r.productId().equals(pres.getProductId())) {
                throw new IllegalArgumentException("Esa presentación no es de " + p.getName() + ".");
            }
            if (pres == null && r.cantidad().stripTrailingZeros().scale() > 0) {
                throw new IllegalArgumentException(p.getName() + " se pide por pieza entera.");
            }
            String como = pres != null ? pres.getNombre() : (r.cantidad().compareTo(BigDecimal.ONE) == 0 ? "pieza" : "piezas");
            return b.productId(p.getId()).descripcion(recortar(cant + " " + como + " " + p.getName())).build();
        }
        if (r.ingredientId() == null) throw new IllegalArgumentException("Elige un ingrediente o un producto.");
        Ingredient i = compras.ingrediente(r.ingredientId(), restaurantId);
        String como;
        if (pres != null) {
            if (!r.ingredientId().equals(pres.getIngredientId())) {
                throw new IllegalArgumentException("Esa presentación no es de " + i.getName() + ".");
            }
            como = pres.getNombre();
        } else {
            String unidad = r.unidad() == null || r.unidad().isBlank() ? i.getUnitOfMeasure() : r.unidad();
            Unidades.convertir(r.cantidad(), unidad, i.getUnitOfMeasure()); // que la unidad sea compatible
            como = Unidades.canonica(unidad);
            b.unidad(como);
        }
        return b.ingredientId(i.getId()).descripcion(recortar(cant + " " + como + " " + i.getName())).build();
    }

    private ComprasDTOs.Pedido aDto(PedidoProveedor p, Proveedor proveedor, Branch sucursal) {
        List<ComprasDTOs.RenglonDePedido> renglones = p.getRenglones().stream().map(r -> new ComprasDTOs.RenglonDePedido(
                r.getId(),
                r.getIngredientId() != null ? "INGREDIENTE" : "PRODUCTO",
                r.getIngredientId() != null ? r.getIngredientId() : r.getProductId(),
                r.getCantidad(), r.getUnidad(), r.getPresentacionId(), r.getDescripcion(), r.getRecibido(), r.getMotivo()))
                .toList();
        return new ComprasDTOs.Pedido(p.getId(), p.getProveedorId(), p.getProveedor(),
                proveedor != null ? proveedor.getTelefono() : null,
                p.getPara(), p.getNota(), p.getEstado(), p.getCreadoPor(), p.getCreadoEn(), p.getCerradoEn(), p.getCompraId(),
                renglones, mensaje(p, sucursal), p.getEnviadoEn(), p.getEnviadoA());
    }

    /**
     * Buen día, le escribe Tacos Prime (sucursal Centro).
     * Para mañana, viernes 10 de octubre:
     * • 10 kg Arrachera
     * Gracias.
     */
    static String mensaje(PedidoProveedor p, Branch sucursal) {
        StringBuilder sb = new StringBuilder("Buen día, le escribe ").append(quienEscribe(sucursal)).append(".\n");
        if (p.getPara() != null) {
            LocalDate hoy = Combos.hoy();
            String dia = p.getPara().format(DIA);
            sb.append(p.getPara().equals(hoy) ? "Para hoy, " + dia
                    : p.getPara().equals(hoy.plusDays(1)) ? "Para mañana, " + dia
                    : "Para el " + dia).append(":\n");
        } else {
            sb.append("Le hago el siguiente pedido:\n");
        }
        p.getRenglones().forEach(r -> sb.append("• ").append(r.getDescripcion()).append('\n'));
        if (p.getNota() != null) sb.append(p.getNota()).append('\n');
        return sb.append("Gracias.").toString();
    }

    private PedidoProveedor pedido(UUID branchId, UUID id) {
        return pedidoRepository.findById(id)
                .filter(x -> x.getBranchId().equals(branchId))
                .orElseThrow(() -> new IllegalArgumentException("Ese pedido no es de esta sucursal."));
    }

    private Branch sucursal(UUID branchId) {
        return branchRepository.findById(branchId).orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
    }

    /** "Tacos Prime (sucursal Centro)". */
    static String quienEscribe(Branch sucursal) {
        String restaurante = sucursal.getRestaurant() != null ? sucursal.getRestaurant().getName() : null;
        String quien = restaurante != null ? restaurante : sucursal.getName();
        if (restaurante != null && sucursal.getName() != null && !sucursal.getName().equalsIgnoreCase(restaurante)) {
            quien += " (sucursal " + sucursal.getName() + ")";
        }
        return quien;
    }

    private static String recortar(String s) {
        return ComprasService.recortar(s, 200);
    }
}
