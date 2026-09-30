package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.CarritoBotDTO;
import com.omnirest.omnirest_backend.dtos.WebhookOrderItemDTO;
import com.omnirest.omnirest_backend.dtos.WebhookOrderRequestDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CarritoBotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * El carrito del bot de WhatsApp: el pedido se arma aqui y no en la memoria
 * de la IA. El bot agrega y quita platillos conforme el cliente los pide, le
 * muestra el resumen que devuelve este servicio y, cuando el cliente dice que
 * si, confirma: se manda a cocina todo lo que hay, por el mismo camino que ya
 * usaba el bot (mesa, inventario, adicionales, avisos a cocina).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CarritoBotService {

    /** Un carrito sin movimiento por mas de este tiempo es de una conversacion que ya termino. */
    static final int HORAS_DE_VIDA = 6;

    private final CarritoBotRepository carritoRepository;
    private final BranchRepository branchRepository;
    private final OrderService orderService;
    private final AdicionalesService adicionalesService;
    private final AgotadosService agotadosService;

    public CarritoBotDTO ver(UUID branchId, String telefonoCrudo) {
        return carritoVigente(branchId, TelefonoMx.canonico(telefonoCrudo))
                .map(c -> resumen(c, List.of(), List.of()))
                .orElseGet(CarritoBotService::vacio);
    }

    public CarritoBotDTO agregar(UUID branchId, String telefonoCrudo, CarritoBotDTO.Agregar pedido) {
        String telefono = telefonoValido(telefonoCrudo);
        UUID restaurantId = restauranteDe(branchId);
        CarritoBot carrito = carritoVigente(branchId, telefono).orElseGet(() -> CarritoBot.builder()
                .branchId(branchId)
                .telefono(telefono)
                .items(new ArrayList<>())
                .build());
        if (pedido != null && pedido.tableNumber() != null) {
            carrito.setTableNumber(pedido.tableNumber());
        }

        List<String> noEncontrados = new ArrayList<>();
        List<GrupoAdicional> grupos = adicionalesService.gruposActivos(restaurantId);
        List<String> avisos = new ArrayList<>();
        for (WebhookOrderItemDTO dto : pedido == null || pedido.items() == null ? List.<WebhookOrderItemDTO>of() : pedido.items()) {
            if (dto == null || dto.product_name() == null || dto.product_name().isBlank()) continue;
            int cantidad = dto.quantity() != null && dto.quantity() > 0 ? dto.quantity() : 1;
            Product producto;
            producto = orderService.encontrarProducto(restaurantId, dto.product_name());
            if (producto == null) {
                noEncontrados.add(dto.product_name());
                continue;
            }
            if (agotadosService.estaAgotado(branchId, producto)) {
                avisos.add(producto.getName() + " se acabó por hoy.");
                continue;
            }
            if (Combos.esCombo(producto) && !Combos.vigenteHoy(producto)) {
                avisos.add("El combo " + producto.getName() + " no está disponible hoy (se vende "
                        + Combos.textoVigencia(producto) + ").");
                continue;
            }
            final Product elegido = producto;
            List<String> adicionales = dto.adicionales() == null ? List.of()
                    : dto.adicionales().stream().filter(a -> a != null && !a.isBlank()).map(String::trim).toList();
            avisos.addAll(adicionalesService.resolverPorNombre(elegido, adicionales, grupos).avisos());
            String instrucciones = recortar(dto.special_instructions());

            // El mismo platillo con lo mismo se suma; con otros adicionales es otra linea.
            Optional<CarritoBotItem> igual = carrito.getItems().stream()
                    .filter(i -> i.getProduct().getId().equals(elegido.getId())
                            && i.listaDeAdicionales().equals(adicionales)
                            && Objects.equals(i.getInstrucciones(), instrucciones))
                    .findFirst();
            if (igual.isPresent()) {
                igual.get().setCantidad(igual.get().getCantidad() + cantidad);
            } else {
                carrito.getItems().add(CarritoBotItem.builder()
                        .carrito(carrito)
                        .product(elegido)
                        .cantidad(cantidad)
                        .adicionales(adicionales.isEmpty() ? null : String.join("\n", adicionales))
                        .instrucciones(instrucciones)
                        .creadoEn(LocalDateTime.now())
                        .build());
            }
        }

        if (carrito.getItems().isEmpty()) {
            // Nada que guardar (todo lo pedido era desconocido): no se crea un carrito vacio.
            return new CarritoBotDTO(true, carrito.getTableNumber(), List.of(), BigDecimal.ZERO,
                    "El carrito está vacío.", noEncontrados, avisos);
        }
        carrito.setActualizadoEn(LocalDateTime.now());
        return resumen(carritoRepository.save(carrito), noEncontrados, avisos);
    }

    public CarritoBotDTO quitar(UUID branchId, String telefonoCrudo, CarritoBotDTO.Quitar quitar) {
        String telefono = TelefonoMx.canonico(telefonoCrudo);
        Optional<CarritoBot> vigente = carritoVigente(branchId, telefono);
        if (vigente.isEmpty() || quitar == null) {
            return vigente.map(c -> resumen(c, List.of(), List.of())).orElseGet(CarritoBotService::vacio);
        }
        CarritoBot carrito = vigente.get();
        UUID restaurantId = restauranteDe(branchId);
        List<CarritoBotDTO.Quitar> lista = quitar.items() != null && !quitar.items().isEmpty()
                ? quitar.items() : List.of(quitar);

        List<String> noEncontrados = new ArrayList<>();
        for (CarritoBotDTO.Quitar uno : lista) {
            if (uno == null || uno.product_name() == null || uno.product_name().isBlank()) continue;
            Product producto = orderService.encontrarProducto(restaurantId, uno.product_name());
            if (producto == null) {
                noEncontrados.add(uno.product_name());
                continue;
            }
            int porQuitar = uno.quantity() != null && uno.quantity() > 0 ? uno.quantity() : Integer.MAX_VALUE;
            // Se quita primero de lo ultimo que se agrego.
            List<CarritoBotItem> delProducto = new ArrayList<>(carrito.getItems().stream()
                    .filter(i -> i.getProduct().getId().equals(producto.getId())).toList());
            Collections.reverse(delProducto);
            for (CarritoBotItem item : delProducto) {
                if (porQuitar <= 0) break;
                int quita = Math.min(porQuitar, item.getCantidad());
                porQuitar -= quita;
                if (quita == item.getCantidad()) {
                    // Por identidad: dos lineas con los mismos datos no son la misma linea.
                    carrito.getItems().removeIf(x -> x == item);
                } else {
                    item.setCantidad(item.getCantidad() - quita);
                }
            }
        }

        if (carrito.getItems().isEmpty()) {
            carritoRepository.delete(carrito);
            return new CarritoBotDTO(true, null, List.of(), BigDecimal.ZERO, "El carrito está vacío.", noEncontrados, List.of());
        }
        carrito.setActualizadoEn(LocalDateTime.now());
        return resumen(carritoRepository.save(carrito), noEncontrados, List.of());
    }

    public CarritoBotDTO vaciar(UUID branchId, String telefonoCrudo) {
        carritoRepository.findByBranchIdAndTelefono(branchId, TelefonoMx.canonico(telefonoCrudo))
                .ifPresent(carritoRepository::delete);
        return vacio();
    }

    /**
     * Manda a cocina todo el carrito y lo vacia. Si algo falla (por ejemplo,
     * no alcanza un ingrediente) no se manda nada y el carrito queda igual,
     * para que el cliente pueda cambiar su pedido.
     */
    public CarritoBotDTO.Confirmacion confirmar(UUID branchId, String telefonoCrudo, CarritoBotDTO.Confirmar datos) {
        String telefono = TelefonoMx.canonico(telefonoCrudo);
        Optional<CarritoBot> vigente = carritoVigente(branchId, telefono);
        if (vigente.isEmpty() || vigente.get().getItems().isEmpty()) {
            return new CarritoBotDTO.Confirmacion(false, "El carrito está vacío: no hay nada que mandar a cocina.", vacio());
        }
        CarritoBot carrito = vigente.get();
        Integer mesa = datos != null && datos.tableNumber() != null ? datos.tableNumber() : carrito.getTableNumber();
        if (mesa == null) {
            throw new IllegalArgumentException("Falta el número de mesa para mandar el pedido a cocina.");
        }

        CarritoBotDTO enviado = resumen(carrito, List.of(), List.of());
        List<WebhookOrderItemDTO> items = carrito.getItems().stream()
                .map(i -> new WebhookOrderItemDTO(i.getProduct().getName(), i.getCantidad(), i.getInstrucciones(),
                        i.listaDeAdicionales()))
                .toList();
        orderService.addWebhookItems(new WebhookOrderRequestDTO(branchId, telefonoCrudo, mesa, items));

        carritoRepository.delete(carrito);
        log.info("Carrito del bot confirmado: {} platillos a cocina, mesa {}, sucursal {}", items.size(), mesa, branchId);
        return new CarritoBotDTO.Confirmacion(true, "Pedido enviado a cocina.", enviado);
    }

    /** Limpieza cada hora de carritos de conversaciones que ya terminaron. */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    public void limpiarAbandonados() {
        int borrados = carritoRepository.borrarAbandonados(LocalDateTime.now().minusHours(HORAS_DE_VIDA));
        if (borrados > 0) log.info("Carritos del bot abandonados borrados: {}", borrados);
    }

    // ------------------------------------------------------------------

    private Optional<CarritoBot> carritoVigente(UUID branchId, String telefono) {
        if (telefono == null || telefono.isBlank()) return Optional.empty();
        return carritoRepository.findByBranchIdAndTelefono(branchId, telefono).flatMap(c -> {
            if (c.getActualizadoEn() != null && c.getActualizadoEn().isBefore(LocalDateTime.now().minusHours(HORAS_DE_VIDA))) {
                // De otra conversacion: no se mezcla con el pedido de hoy.
                carritoRepository.delete(c);
                carritoRepository.flush();
                return Optional.empty();
            }
            return Optional.of(c);
        });
    }

    private UUID restauranteDe(UUID branchId) {
        return branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."))
                .getRestaurant().getId();
    }

    private String telefonoValido(String telefonoCrudo) {
        String telefono = TelefonoMx.canonico(telefonoCrudo);
        if (telefono == null || telefono.isBlank()) {
            throw new IllegalArgumentException("Falta el teléfono del cliente.");
        }
        return telefono;
    }

    private static String recortar(String texto) {
        if (texto == null || texto.isBlank()) return null;
        String t = texto.trim();
        return t.length() > 300 ? t.substring(0, 300) : t;
    }

    private static CarritoBotDTO vacio() {
        return new CarritoBotDTO(true, null, List.of(), BigDecimal.ZERO, "El carrito está vacío.", List.of(), List.of());
    }

    /** Precio y adicionales de cada linea calculados igual que al mandar a cocina. */
    private CarritoBotDTO resumen(CarritoBot carrito, List<String> noEncontrados, List<String> avisos) {
        List<GrupoAdicional> grupos = carrito.getItems().isEmpty() ? List.of()
                : adicionalesService.gruposActivos(carrito.getItems().get(0).getProduct().getCategory().getRestaurant().getId());
        List<CarritoBotDTO.Linea> lineas = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        StringBuilder texto = new StringBuilder();
        for (CarritoBotItem item : carrito.getItems()) {
            OrderItem calculo = OrderItem.builder().product(item.getProduct()).quantity(item.getCantidad()).build();
            adicionalesService.aplicarALinea(calculo,
                    adicionalesService.resolverPorNombre(item.getProduct(), item.listaDeAdicionales(), grupos).eleccion());
            BigDecimal subtotal = calculo.getUnitPrice().multiply(BigDecimal.valueOf(item.getCantidad()));
            total = total.add(subtotal);
            List<String> adicionales = calculo.adicionalesParaMostrar();
            lineas.add(new CarritoBotDTO.Linea(item.getId(), item.getProduct().getName(), item.getCantidad(),
                    adicionales, item.getInstrucciones(), calculo.getUnitPrice(), subtotal));

            texto.append(item.getCantidad()).append(" × ").append(item.getProduct().getName());
            if (!adicionales.isEmpty()) texto.append(" (").append(String.join("; ", adicionales)).append(")");
            if (item.getInstrucciones() != null) texto.append(" — \"").append(item.getInstrucciones()).append("\"");
            texto.append(" — ").append(pesos(subtotal)).append("\n");
        }
        texto.append("Total: ").append(pesos(total));
        return new CarritoBotDTO(lineas.isEmpty(), carrito.getTableNumber(), lineas, total, texto.toString(),
                noEncontrados, avisos);
    }

    private static String pesos(BigDecimal valor) {
        return "$" + String.format(Locale.US, "%,.2f", valor);
    }
}
