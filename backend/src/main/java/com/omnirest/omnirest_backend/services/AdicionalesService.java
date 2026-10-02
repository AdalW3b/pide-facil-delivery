package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Adicional;
import com.omnirest.omnirest_backend.domain.entities.Category;
import com.omnirest.omnirest_backend.domain.entities.GrupoAdicional;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.entities.OrderItemAdicional;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.dtos.AdicionalDTO;
import com.omnirest.omnirest_backend.dtos.GrupoAdicionalDTO;
import com.omnirest.omnirest_backend.dtos.GrupoMenuDTO;
import com.omnirest.omnirest_backend.repositories.CategoryRepository;
import com.omnirest.omnirest_backend.repositories.GrupoAdicionalRepository;
import com.omnirest.omnirest_backend.repositories.IngredientRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Adicionales por platillo: el catalogo que arma el restaurante y la regla con
 * la que se cobran.
 *
 * El precio de un adicional siempre sale de aqui, nunca del navegador: el menu
 * web manda ids, y si mandara precios cualquiera podria pedirse la carne extra
 * a cero pesos.
 */
@Service
@RequiredArgsConstructor
public class AdicionalesService {

    private final GrupoAdicionalRepository grupoRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final IngredientRepository ingredientRepository;

    // ------------------------------------------------------------------
    // Panel
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<GrupoAdicionalDTO> listar(CustomUserDetails user) {
        return grupoRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(restauranteDe(user)).stream()
                .map(this::aDto)
                .toList();
    }

    @Transactional
    public GrupoAdicionalDTO crear(GrupoAdicionalDTO dto, CustomUserDetails user) {
        GrupoAdicional grupo = GrupoAdicional.builder().restaurantId(restauranteDe(user)).build();
        aplicar(grupo, dto);
        return aDto(grupoRepository.save(grupo));
    }

    @Transactional
    public GrupoAdicionalDTO actualizar(UUID id, GrupoAdicionalDTO dto, CustomUserDetails user) {
        GrupoAdicional grupo = buscarPropio(id, user);
        aplicar(grupo, dto);
        return aDto(grupoRepository.save(grupo));
    }

    /**
     * Borra el grupo y sus opciones. Los pedidos pasados no pierden nada: cada
     * linea guardo el nombre y el precio de lo que se eligio.
     */
    @Transactional
    public void eliminar(UUID id, CustomUserDetails user) {
        grupoRepository.delete(buscarPropio(id, user));
    }

    /**
     * Vuelca el formulario sobre el grupo. Las opciones se reconcilian por id
     * en vez de borrarse y recrearse: asi un adicional conserva su id y los
     * pedidos que ya lo usaron siguen apuntando a el.
     */
    private void aplicar(GrupoAdicional grupo, GrupoAdicionalDTO dto) {
        int minimo = dto.minimo() != null ? dto.minimo() : 0;
        int maximo = dto.maximo() != null ? dto.maximo() : 1;
        if (minimo > maximo) {
            throw new IllegalArgumentException("El mínimo no puede ser mayor que el máximo.");
        }
        long disponibles = dto.opciones().stream().filter(o -> !Boolean.FALSE.equals(o.activo())).count();
        if (minimo > disponibles) {
            throw new IllegalArgumentException("El grupo pide elegir al menos " + minimo
                    + " pero solo tiene " + disponibles + " opciones disponibles: nadie podría pedir el platillo.");
        }

        grupo.setNombre(dto.nombre().trim());
        grupo.setMinimo(minimo);
        grupo.setMaximo(maximo);
        grupo.setOrden(dto.orden() != null ? dto.orden() : 0);
        grupo.setActivo(dto.activo() == null || dto.activo());

        Map<UUID, Adicional> existentes = new HashMap<>();
        grupo.getOpciones().forEach(o -> existentes.put(o.getId(), o));

        List<Adicional> nuevas = new ArrayList<>();
        int orden = 0;
        for (AdicionalDTO o : dto.opciones()) {
            Adicional opcion = o.id() != null && existentes.containsKey(o.id())
                    ? existentes.get(o.id())
                    : Adicional.builder().grupo(grupo).build();
            opcion.setNombre(o.nombre().trim());
            opcion.setPrecio(o.precio() != null ? o.precio() : BigDecimal.ZERO);
            opcion.setActivo(o.activo() == null || o.activo());
            opcion.setOrden(orden++);
            aplicarIngrediente(opcion, o, grupo.getRestaurantId());
            nuevas.add(opcion);
        }
        // Se modifica la misma lista (orphanRemoval la vigila): reemplazarla
        // haria que Hibernate pierda la pista de las opciones quitadas.
        grupo.getOpciones().clear();
        grupo.getOpciones().addAll(nuevas);

        UUID restaurantId = grupo.getRestaurantId();
        grupo.setCategorias(new HashSet<>(categoriasPropias(dto.categoryIds(), restaurantId)));
        grupo.setProductos(new HashSet<>(productosPropios(dto.productIds(), restaurantId)));
    }

    /** Liga la opcion a un ingrediente del mismo restaurante, o la desliga. */
    private void aplicarIngrediente(Adicional opcion, AdicionalDTO dto, UUID restaurantId) {
        if (dto.ingredientId() == null) {
            opcion.setIngrediente(null);
            opcion.setCantidadIngrediente(null);
            return;
        }
        if (dto.cantidadIngrediente() == null || dto.cantidadIngrediente().signum() <= 0) {
            throw new IllegalArgumentException("Indica cuánto ingrediente gasta \"" + dto.nombre().trim() + "\".");
        }
        Ingredient ingrediente = ingredientRepository.findById(dto.ingredientId())
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado."));
        if (ingrediente.getRestaurant() == null || !ingrediente.getRestaurant().getId().equals(restaurantId)) {
            throw new AccessDeniedException("Ese ingrediente no es de tu restaurante.");
        }
        opcion.setIngrediente(ingrediente);
        opcion.setCantidadIngrediente(dto.cantidadIngrediente());
    }

    private List<Category> categoriasPropias(List<UUID> ids, UUID restaurantId) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Category> categorias = categoryRepository.findAllById(ids);
        for (Category c : categorias) {
            if (!c.getRestaurant().getId().equals(restaurantId)) {
                throw new AccessDeniedException("Esa categoría no es de tu restaurante.");
            }
        }
        return categorias;
    }

    private List<Product> productosPropios(List<UUID> ids, UUID restaurantId) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Product> productos = productRepository.findAllById(ids);
        for (Product p : productos) {
            if (p.getCategory() == null || !p.getCategory().getRestaurant().getId().equals(restaurantId)) {
                throw new AccessDeniedException("Ese platillo no es de tu restaurante.");
            }
        }
        return productos;
    }

    private GrupoAdicional buscarPropio(UUID id, CustomUserDetails user) {
        GrupoAdicional grupo = grupoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Grupo de adicionales no encontrado."));
        if (!grupo.getRestaurantId().equals(restauranteDe(user))) {
            throw new AccessDeniedException("Ese grupo de adicionales no es de tu restaurante.");
        }
        return grupo;
    }

    private UUID restauranteDe(CustomUserDetails user) {
        if (user == null || user.restaurantId() == null) {
            throw new AccessDeniedException("Tu usuario no pertenece a ningún restaurante.");
        }
        return user.restaurantId();
    }

    private GrupoAdicionalDTO aDto(GrupoAdicional g) {
        return new GrupoAdicionalDTO(
                g.getId(),
                g.getNombre(),
                g.getMinimo(),
                g.getMaximo(),
                g.getOrden(),
                g.getActivo(),
                g.getOpciones().stream()
                        .map(o -> new AdicionalDTO(o.getId(), o.getNombre(), o.getPrecio(), o.getActivo(),
                                o.gastaInventario() ? o.getIngrediente().getId() : null,
                                o.gastaInventario() ? o.getCantidadIngrediente() : null))
                        .toList(),
                g.getCategorias().stream().map(Category::getId).toList(),
                g.getProductos().stream().map(Product::getId).toList());
    }

    // ------------------------------------------------------------------
    // Menu del cliente
    // ------------------------------------------------------------------

    /** Los grupos activos del restaurante, para repartirlos entre sus platillos. */
    @Transactional(readOnly = true)
    public List<GrupoAdicional> gruposActivos(UUID restaurantId) {
        List<GrupoAdicional> grupos = grupoRepository.findByRestaurantIdAndActivoTrueOrderByOrdenAscNombreAsc(restaurantId);
        grupos.forEach(g -> g.getOpciones().size()); // cargarlas dentro de la transaccion
        return grupos;
    }

    /** Los grupos que aparecen en la ficha de un platillo. */
    public List<GrupoMenuDTO> gruposDelMenu(Product producto, List<GrupoAdicional> grupos) {
        return grupos.stream()
                .filter(g -> g.aplicaA(producto))
                .map(g -> new GrupoMenuDTO(
                        g.getId(),
                        g.getNombre(),
                        g.getMinimo(),
                        g.getMaximo(),
                        g.getOpciones().stream()
                                .map(o -> new GrupoMenuDTO.Opcion(
                                        o.getId(), o.getNombre(), o.getPrecio(), Boolean.TRUE.equals(o.getActivo())))
                                .toList()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Cobro
    // ------------------------------------------------------------------

    /** Lo que suman los adicionales de una linea y su desglose para guardar. */
    public record Eleccion(BigDecimal precioExtra, List<OrderItemAdicional> desglose) {
        public static final Eleccion NINGUNA = new Eleccion(BigDecimal.ZERO, List.of());
    }

    /**
     * Valida lo que el cliente eligio para un platillo y calcula cuanto suma.
     *
     * Rechaza lo que no se podria haber elegido en la ficha: un adicional de
     * otro platillo, uno agotado, mas de los permitidos o menos de los
     * obligatorios. Si el navegador viene alterado, el pedido no pasa.
     */
    public Eleccion resolver(Product producto, Collection<UUID> idsElegidos, List<GrupoAdicional> grupos) {
        Set<UUID> elegidos = idsElegidos == null ? Set.of() : new LinkedHashSet<>(idsElegidos);
        List<GrupoAdicional> aplicables = grupos.stream().filter(g -> g.aplicaA(producto)).toList();

        Map<UUID, Adicional> porId = new HashMap<>();
        aplicables.forEach(g -> g.getOpciones().forEach(o -> porId.put(o.getId(), o)));

        for (UUID id : elegidos) {
            Adicional opcion = porId.get(id);
            if (opcion == null) {
                throw new IllegalArgumentException("Uno de los adicionales no corresponde a " + producto.getName()
                        + ". Vuelve a abrir el platillo y elige de nuevo.");
            }
            if (!Boolean.TRUE.equals(opcion.getActivo())) {
                throw new IllegalStateException(opcion.getNombre() + " se agotó. Quítalo de " + producto.getName()
                        + " para continuar.");
            }
        }

        BigDecimal extra = BigDecimal.ZERO;
        List<OrderItemAdicional> desglose = new ArrayList<>();
        for (GrupoAdicional grupo : aplicables) {
            List<Adicional> delGrupo = grupo.getOpciones().stream()
                    .filter(o -> elegidos.contains(o.getId()))
                    .toList();

            if (delGrupo.size() < grupo.getMinimo()) {
                throw new IllegalArgumentException(grupo.esEleccionUnica()
                        ? "Elige " + grupo.getNombre().toLowerCase() + " para " + producto.getName() + "."
                        : "En " + producto.getName() + " elige al menos " + grupo.getMinimo()
                                + " de " + grupo.getNombre().toLowerCase() + ".");
            }
            if (delGrupo.size() > grupo.getMaximo()) {
                throw new IllegalArgumentException("En " + producto.getName() + " puedes elegir hasta "
                        + grupo.getMaximo() + " de " + grupo.getNombre().toLowerCase() + ".");
            }

            for (Adicional o : delGrupo) {
                extra = extra.add(o.getPrecio());
                desglose.add(congelar(grupo, o));
            }
        }
        return new Eleccion(extra, desglose);
    }

    private static OrderItemAdicional congelar(GrupoAdicional grupo, Adicional o) {
        return OrderItemAdicional.builder()
                .adicionalId(o.getId())
                .grupoNombre(grupo.getNombre())
                .nombre(o.getNombre())
                .precio(o.getPrecio())
                .ingredientId(o.gastaInventario() ? o.getIngrediente().getId() : null)
                .cantidadIngrediente(o.gastaInventario() ? o.getCantidadIngrediente() : null)
                .build();
    }

    /**
     * Cuelga lo elegido de la linea y le suma su precio al unitario. El precio
     * unitario queda con los adicionales dentro: la cuenta se recalcula en
     * varios lugares como cantidad x precio unitario y asi no los pierde.
     */
    public void aplicarALinea(OrderItem item, Eleccion eleccion) {
        item.setUnitPrice(item.getProduct().getPrice().add(eleccion.precioExtra()));
        eleccion.desglose().forEach(a -> a.setOrderItem(item));
        item.getAdicionales().addAll(eleccion.desglose());
    }

    // ------------------------------------------------------------------
    // Bot de WhatsApp
    // ------------------------------------------------------------------

    /** Lo que se pudo cobrar y lo que cocina tiene que revisar a mano. */
    public record EleccionBot(Eleccion eleccion, List<String> avisos) {
    }

    /**
     * La version tolerante de {@link #resolver}, para el bot.
     *
     * El bot pide por nombre y lo escribe un modelo de lenguaje, asi que puede
     * equivocarse. Rechazar el pedido cortaria la conversacion con el cliente
     * sin que sepa por que; en su lugar se cobra lo que si se reconocio y lo
     * demas llega a cocina como aviso, para que el mesero lo confirme.
     */
    public EleccionBot resolverPorNombre(Product producto, Collection<String> nombres, List<GrupoAdicional> grupos) {
        List<GrupoAdicional> aplicables = grupos.stream().filter(g -> g.aplicaA(producto)).toList();
        List<String> avisos = new ArrayList<>();
        Map<UUID, List<Adicional>> porGrupo = new HashMap<>();

        for (String nombre : nombres == null ? List.<String>of() : nombres) {
            if (nombre == null || nombre.isBlank()) continue;
            String buscado = normalizar(nombre);
            GrupoAdicional grupo = null;
            Adicional opcion = null;
            for (GrupoAdicional g : aplicables) {
                for (Adicional o : g.getOpciones()) {
                    if (normalizar(o.getNombre()).equals(buscado)) {
                        grupo = g;
                        opcion = o;
                    }
                }
            }
            if (opcion == null) {
                avisos.add("Pidió \"" + nombre.trim() + "\", que no está en los adicionales: confirmar");
            } else if (!Boolean.TRUE.equals(opcion.getActivo())) {
                avisos.add(opcion.getNombre() + " está agotado: no se cobró");
            } else {
                List<Adicional> delGrupo = porGrupo.computeIfAbsent(grupo.getId(), k -> new ArrayList<>());
                if (delGrupo.contains(opcion)) continue;
                if (delGrupo.size() >= grupo.getMaximo()) {
                    avisos.add("Pidió más de " + grupo.getMaximo() + " en " + grupo.getNombre()
                            + ": " + opcion.getNombre() + " no se cobró");
                } else {
                    delGrupo.add(opcion);
                }
            }
        }

        BigDecimal extra = BigDecimal.ZERO;
        List<OrderItemAdicional> desglose = new ArrayList<>();
        for (GrupoAdicional grupo : aplicables) {
            List<Adicional> elegidos = porGrupo.getOrDefault(grupo.getId(), List.of());
            if (elegidos.size() < grupo.getMinimo()) {
                avisos.add("Falta elegir " + grupo.getNombre().toLowerCase());
            }
            for (Adicional o : elegidos) {
                extra = extra.add(o.getPrecio());
                desglose.add(congelar(grupo, o));
            }
        }
        return new EleccionBot(new Eleccion(extra, desglose), avisos);
    }

    // ------------------------------------------------------------------
    // Plataformas de reparto
    // ------------------------------------------------------------------

    /** Un adicional como lo manda otra plataforma, con el precio que cobro. */
    public record OpcionExterna(String sku, String nombre, BigDecimal precio, int cantidad) {
    }

    /**
     * Lo que el cliente eligio en otra plataforma, como Rappi.
     *
     * La plataforma ya valido minimos y maximos y ya cobro, asi que aqui no se
     * rechaza nada: se liga cada opcion por su SKU (que es nuestro id) o por
     * su nombre, con el precio que cobro la plataforma, y lo que no se
     * reconoce llega a cocina como aviso.
     */
    public EleccionBot resolverExterno(Product producto, Collection<OpcionExterna> elegidas, List<GrupoAdicional> grupos) {
        List<GrupoAdicional> aplicables = grupos.stream().filter(g -> g.aplicaA(producto)).toList();
        List<String> avisos = new ArrayList<>();
        BigDecimal extra = BigDecimal.ZERO;
        List<OrderItemAdicional> desglose = new ArrayList<>();

        for (OpcionExterna elegida : elegidas == null ? List.<OpcionExterna>of() : elegidas) {
            GrupoAdicional grupo = null;
            Adicional opcion = null;
            for (GrupoAdicional g : aplicables) {
                for (Adicional o : g.getOpciones()) {
                    if (esLaMisma(o, elegida)) {
                        grupo = g;
                        opcion = o;
                    }
                }
            }
            if (opcion == null) {
                avisos.add("Pidió \"" + elegida.nombre() + "\", que no está en los adicionales: confirmar");
                continue;
            }
            int cantidad = Math.max(1, elegida.cantidad());
            BigDecimal precio = elegida.precio() != null ? elegida.precio() : opcion.getPrecio();
            for (int i = 0; i < cantidad; i++) {
                OrderItemAdicional congelado = congelar(grupo, opcion);
                congelado.setPrecio(precio);
                desglose.add(congelado);
            }
            extra = extra.add(precio.multiply(BigDecimal.valueOf(cantidad)));
        }
        return new EleccionBot(new Eleccion(extra, desglose), avisos);
    }

    private static boolean esLaMisma(Adicional opcion, OpcionExterna elegida) {
        if (elegida.sku() != null && elegida.sku().equalsIgnoreCase(opcion.getId().toString())) {
            return true;
        }
        return elegida.nombre() != null && normalizar(opcion.getNombre()).equals(normalizar(elegida.nombre()));
    }

    /**
     * Los adicionales de un platillo como texto, para el menu del bot:
     * "Tortilla (obligatorio, elige 1): Maíz, Harina +$5". Vacio si no tiene.
     */
    public List<String> describirParaBot(Product producto, List<GrupoAdicional> grupos) {
        return grupos.stream()
                .filter(g -> g.aplicaA(producto))
                .map(g -> {
                    String regla = g.getMinimo() > 0
                            ? (g.esEleccionUnica() ? "obligatorio, elige 1"
                                    : "obligatorio, elige de " + g.getMinimo() + " a " + g.getMaximo())
                            : "opcional, hasta " + g.getMaximo();
                    String opciones = g.getOpciones().stream()
                            .filter(o -> Boolean.TRUE.equals(o.getActivo()))
                            .map(o -> o.getPrecio().signum() > 0
                                    ? o.getNombre() + " +$" + o.getPrecio().stripTrailingZeros().toPlainString()
                                    : o.getNombre())
                            .reduce((a, b) -> a + ", " + b)
                            .orElse("");
                    return g.getNombre() + " (" + regla + "): " + opciones;
                })
                .toList();
    }

    /** "Maíz", "maiz " y "MAIZ" son lo mismo para quien escribe por WhatsApp. */
    static String normalizar(String texto) {
        return Normalizer.normalize(texto.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\s+", " ");
    }
}
