package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.AreaPreparacion;
import com.omnirest.omnirest_backend.domain.entities.Category;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.repositories.AreaPreparacionRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CategoryRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Las areas de preparacion del restaurante y a cual va cada platillo.
 *
 * Un platillo va al area del producto si la tiene, si no a la de su
 * categoria, y si no a la predeterminada (Cocina). Se fija al pedirlo: si
 * despues se cambia la configuracion, lo que ya esta en preparacion no se
 * mueve de pantalla.
 */
@Service
@RequiredArgsConstructor
public class AreasService {

    /** Las de siempre: [nombre, tipo]. La primera es la predeterminada. */
    private static final List<String[]> DE_SIEMPRE = List.of(
            new String[]{"Cocina", AreaPreparacion.PREPARACION},
            new String[]{"Parrilla", AreaPreparacion.PREPARACION},
            new String[]{"Barra", AreaPreparacion.PREPARACION},
            new String[]{"Postres", AreaPreparacion.PREPARACION},
            new String[]{"Empaque", AreaPreparacion.EMPAQUE});

    private final AreaPreparacionRepository areaRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final BranchRepository branchRepository;

    public record Area(UUID id, String nombre, String tipo, int orden, boolean activa, boolean predeterminada) {
    }

    public record CategoriaArea(UUID id, String nombre, UUID areaId) {
    }

    public record ProductoArea(UUID id, String nombre, UUID categoriaId, UUID areaId, boolean sinPreparacion) {
    }

    public record Asignacion(List<Area> areas, List<CategoriaArea> categorias, List<ProductoArea> productos) {
    }

    public record GuardarArea(String nombre, String tipo) {
    }

    public record GuardarAsignacion(List<CategoriaArea> categorias, List<ProductoArea> productos) {
    }

    // ------------------------------------------------------------------ areas

    /** Las areas del restaurante; uno nuevo recibe las de siempre la primera vez. */
    @Transactional
    public List<Area> areas(UUID restaurantId) {
        return lista(restaurantId).stream().map(AreasService::aDto).toList();
    }

    @Transactional
    public List<Area> areasDeSucursal(UUID branchId) {
        return areas(restauranteDe(branchId));
    }

    @Transactional
    public Area crear(UUID restaurantId, GuardarArea datos) {
        String nombre = nombre(datos.nombre());
        if (areaRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
            throw new IllegalArgumentException("Ya existe el área " + nombre + ".");
        }
        int orden = lista(restaurantId).stream().mapToInt(AreaPreparacion::getOrden).max().orElse(0) + 1;
        return aDto(areaRepository.save(AreaPreparacion.builder()
                .restaurantId(restaurantId)
                .nombre(nombre)
                .tipo(tipo(datos.tipo()))
                .orden(orden)
                .build()));
    }

    @Transactional
    public Area renombrar(UUID restaurantId, UUID id, GuardarArea datos) {
        AreaPreparacion a = area(restaurantId, id);
        String nombre = nombre(datos.nombre());
        if (!a.getNombre().equalsIgnoreCase(nombre) && areaRepository.existsByRestaurantIdAndNombreIgnoreCase(restaurantId, nombre)) {
            throw new IllegalArgumentException("Ya existe el área " + nombre + ".");
        }
        a.setNombre(nombre);
        if (datos.tipo() != null && !Boolean.TRUE.equals(a.getPredeterminada())) a.setTipo(tipo(datos.tipo()));
        return aDto(areaRepository.save(a));
    }

    /** Apagar un area: lo suyo pasa a la predeterminada. No se borra para no perder la historia. */
    @Transactional
    public Area activar(UUID restaurantId, UUID id, boolean activa) {
        AreaPreparacion a = area(restaurantId, id);
        if (!activa && Boolean.TRUE.equals(a.getPredeterminada())) {
            throw new IllegalStateException(a.getNombre() + " es el área predeterminada: elige otra antes de apagarla.");
        }
        a.setActiva(activa);
        return aDto(areaRepository.save(a));
    }

    @Transactional
    public Area hacerPredeterminada(UUID restaurantId, UUID id) {
        AreaPreparacion nueva = area(restaurantId, id);
        if (!AreaPreparacion.PREPARACION.equals(nueva.getTipo()) || !Boolean.TRUE.equals(nueva.getActiva())) {
            throw new IllegalArgumentException("La predeterminada tiene que ser un área activa que prepare platillos.");
        }
        for (AreaPreparacion a : lista(restaurantId)) {
            a.setPredeterminada(a.getId().equals(id));
        }
        areaRepository.saveAll(lista(restaurantId));
        return aDto(nueva);
    }

    // ------------------------------------------------------------------ asignacion

    @Transactional
    public Asignacion asignacion(UUID restaurantId) {
        List<Area> areas = areas(restaurantId);
        List<CategoriaArea> categorias = categoryRepository.findByRestaurantId(restaurantId).stream()
                .sorted(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
                .map(c -> new CategoriaArea(c.getId(), c.getName(), c.getAreaId()))
                .toList();
        List<ProductoArea> productos = productRepository.findByCategoryRestaurantId(restaurantId).stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .sorted(Comparator.comparing(Product::getName, String.CASE_INSENSITIVE_ORDER))
                .map(p -> new ProductoArea(p.getId(), p.getName(), p.getCategory().getId(), p.getAreaId(),
                        Boolean.TRUE.equals(p.getSinPreparacion())))
                .toList();
        return new Asignacion(areas, categorias, productos);
    }

    @Transactional
    public void guardarAsignacion(UUID restaurantId, GuardarAsignacion datos) {
        Set<UUID> validas = new HashSet<>();
        for (AreaPreparacion a : lista(restaurantId)) {
            if (AreaPreparacion.PREPARACION.equals(a.getTipo())) validas.add(a.getId());
        }
        if (datos.categorias() != null) {
            for (CategoriaArea c : datos.categorias()) {
                Category cat = categoryRepository.findByIdAndRestaurantId(c.id(), restaurantId)
                        .orElseThrow(() -> new IllegalArgumentException("Esa categoría no es de este restaurante."));
                cat.setAreaId(validar(c.areaId(), validas));
                categoryRepository.save(cat);
            }
        }
        if (datos.productos() != null) {
            for (ProductoArea p : datos.productos()) {
                Product prod = productRepository.findByIdAndCategoryRestaurantId(p.id(), restaurantId)
                        .orElseThrow(() -> new IllegalArgumentException("Ese producto no es de este restaurante."));
                prod.setAreaId(validar(p.areaId(), validas));
                prod.setSinPreparacion(p.sinPreparacion());
                productRepository.save(prod);
            }
        }
    }

    // ------------------------------------------------------------------ al pedir

    /**
     * Le pone su area al platillo que se esta pidiendo. Lo que no se prepara
     * (un refresco) nace listo.
     */
    @Transactional
    public void asignar(OrderItem item) {
        Product p = item.getProduct();
        if (p == null || p.getCategory() == null || p.getCategory().getRestaurant() == null) return;
        item.setAreaId(areaDe(p, p.getCategory().getRestaurant().getId()));
        if (Boolean.TRUE.equals(p.getSinPreparacion()) && item.getKitchenStatus() == KitchenStatus.PENDING) {
            item.setKitchenStatus(KitchenStatus.READY);
            item.setReadyAt(LocalDateTime.now());
        }
    }

    /** El area de un producto: la suya, la de su categoria o la predeterminada. Ignora las apagadas. */
    UUID areaDe(Product p, UUID restaurantId) {
        List<AreaPreparacion> areas = lista(restaurantId);
        Set<UUID> activas = new HashSet<>();
        for (AreaPreparacion a : areas) {
            if (Boolean.TRUE.equals(a.getActiva()) && AreaPreparacion.PREPARACION.equals(a.getTipo())) activas.add(a.getId());
        }
        if (p.getAreaId() != null && activas.contains(p.getAreaId())) return p.getAreaId();
        UUID deCategoria = p.getCategory() != null ? p.getCategory().getAreaId() : null;
        if (deCategoria != null && activas.contains(deCategoria)) return deCategoria;
        return predeterminada(areas);
    }

    /** El area efectiva de un platillo ya pedido (los de antes no tienen: van a la predeterminada). */
    @Transactional
    public UUID areaEfectiva(OrderItem item, UUID restaurantId) {
        return item.getAreaId() != null ? item.getAreaId() : predeterminada(lista(restaurantId));
    }

    @Transactional
    public UUID predeterminada(UUID restaurantId) {
        return predeterminada(lista(restaurantId));
    }

    /** "Barra", para los avisos al mesero. */
    @Transactional(readOnly = true)
    public String nombre(UUID areaId) {
        return areaId == null ? null : areaRepository.findById(areaId).map(AreaPreparacion::getNombre).orElse(null);
    }

    // ------------------------------------------------------------------

    private List<AreaPreparacion> lista(UUID restaurantId) {
        List<AreaPreparacion> areas = areaRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(restaurantId);
        if (!areas.isEmpty()) return areas;
        List<AreaPreparacion> nuevas = new ArrayList<>();
        for (int i = 0; i < DE_SIEMPRE.size(); i++) {
            nuevas.add(AreaPreparacion.builder()
                    .restaurantId(restaurantId)
                    .nombre(DE_SIEMPRE.get(i)[0])
                    .tipo(DE_SIEMPRE.get(i)[1])
                    .orden(i + 1)
                    .predeterminada(i == 0)
                    .build());
        }
        return areaRepository.saveAll(nuevas);
    }

    private static UUID predeterminada(List<AreaPreparacion> areas) {
        return areas.stream().filter(a -> Boolean.TRUE.equals(a.getPredeterminada())).map(AreaPreparacion::getId)
                .findFirst()
                .orElseGet(() -> areas.stream().filter(a -> AreaPreparacion.PREPARACION.equals(a.getTipo()))
                        .map(AreaPreparacion::getId).findFirst().orElse(null));
    }

    private AreaPreparacion area(UUID restaurantId, UUID id) {
        return areaRepository.findById(id)
                .filter(a -> a.getRestaurantId().equals(restaurantId))
                .orElseThrow(() -> new IllegalArgumentException("Esa área no es de este restaurante."));
    }

    public UUID restauranteDe(UUID branchId) {
        return branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."))
                .getRestaurant().getId();
    }

    private static UUID validar(UUID areaId, Set<UUID> validas) {
        if (areaId == null) return null;
        if (!validas.contains(areaId)) throw new IllegalArgumentException("Esa área no prepara platillos o no es de este restaurante.");
        return areaId;
    }

    private static String nombre(String n) {
        String x = n == null ? "" : n.trim();
        if (x.isEmpty() || x.length() > 40) throw new IllegalArgumentException("El nombre del área va de 1 a 40 letras.");
        return x;
    }

    private static String tipo(String t) {
        return AreaPreparacion.EMPAQUE.equalsIgnoreCase(t) ? AreaPreparacion.EMPAQUE : AreaPreparacion.PREPARACION;
    }

    private static Area aDto(AreaPreparacion a) {
        return new Area(a.getId(), a.getNombre(), a.getTipo(), a.getOrden() != null ? a.getOrden() : 0,
                Boolean.TRUE.equals(a.getActiva()), Boolean.TRUE.equals(a.getPredeterminada()));
    }
}
