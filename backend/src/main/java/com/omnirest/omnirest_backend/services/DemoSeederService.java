package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import com.omnirest.omnirest_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DemoSeederService implements CommandLineRunner {

        private final RestaurantRepository restaurantRepository;
        private final BranchRepository branchRepository;
        private final TableRepository tableRepository;
        private final CategoryRepository categoryRepository;
        private final ProductRepository productRepository;
        private final IngredientRepository ingredientRepository;
        private final RecipeItemRepository recipeItemRepository;
        private final BranchIngredientStockRepository branchIngredientStockRepository;
        private final BranchProductStockRepository branchProductStockRepository;
        private final OrderRepository orderRepository;
        private final OrderItemRepository orderItemRepository;
        private final PaymentMethodRepository paymentMethodRepository;
        private final RoleRepository roleRepository;
        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;

        @Override
        public void run(String... args) {
                if (userRepository.findByUsername("demo").isEmpty()) {
                        log.info("Creando entorno y cuenta Demo predeterminada (demo / demo123)...");
                        seedCompleteDemoEnvironment();
                }
        }

        @Transactional
        public void resetDemoData() {
                userRepository.findByUsername("demo").ifPresent(demoUser -> {
                        Restaurant demoRest = demoUser.getRestaurant();
                        if (demoRest != null && Boolean.TRUE.equals(demoRest.getIsDemo())) {
                                restaurantRepository.delete(demoRest);
                        }
                });
                seedCompleteDemoEnvironment();
        }

        @Transactional
        public void seedCompleteDemoEnvironment() {
                // 1. Restaurante Maqueta
                Restaurant demoRestaurant = restaurantRepository.save(Restaurant.builder()
                                .name("Taquería El Farolito (Demo)")
                                .active(true)
                                .isDemo(true)
                                .build());

                // 2. Roles y Usuario Administrador Demo
                Role superAdminRole = roleRepository.findByName("SUPER_ADMIN")
                                .orElseThrow(() -> new IllegalStateException("Rol SUPER_ADMIN no encontrado"));

                User demoAdmin = userRepository.save(User.builder()
                                .name("Demostración OmniRest")
                                .username("demo")
                                .passwordHash(passwordEncoder.encode("demo123"))
                                .role(superAdminRole)
                                .restaurant(demoRestaurant)
                                .active(true)
                                .build());

                // 3. Poblar datos operativos completos
                seedDemoData(demoRestaurant);
                log.info("Cuenta Demo configurada exitosamente con usuario: demo / demo123");
        }

        @Transactional
        public void seedDemoData(Restaurant restaurant) {
                // 1. Crear Sucursal Única Demo
                Branch branch = branchRepository.save(Branch.builder()
                                .restaurant(restaurant)
                                .name("Sucursal Principal (Demo)")
                                .address("Av. Gastronómica 123, Centro")
                                .whatsappNumber("5219510000000")
                                .botName("Paco Demo")
                                .botTone("Muy amable, alegre y con emojis")
                                .active(true)
                                .build());

                // 2. Métodos de Pago
                paymentMethodRepository.saveAll(List.of(
                                PaymentMethod.builder().branch(branch).name("Efectivo").active(true).build(),
                                PaymentMethod.builder().branch(branch).name("Tarjeta Terminal BBVA")
                                                .instructions("Aceptar chip o contactless").active(true).build(),
                                PaymentMethod.builder().branch(branch).name("Transferencia SPEI")
                                                .instructions("CLABE: 012180000123456789").active(true).build()));

                // 3. Mesero asignado a la sucursal
                Role meseroRole = roleRepository.findByName("Mesero").or(() -> roleRepository.findByName("MESERO"))
                                .orElseGet(() -> roleRepository.findByName("SUPER_ADMIN").orElse(null));

                User mesero = null;
                if (meseroRole != null) {
                        mesero = userRepository.save(User.builder()
                                        .name("Carlos Mesero")
                                        .username("mesero_" + restaurant.getId().toString().substring(0, 5))
                                        .passwordHash(passwordEncoder.encode("demo123"))
                                        .role(meseroRole)
                                        .restaurant(restaurant)
                                        .branch(branch)
                                        .active(true)
                                        .build());
                }

                // 4. Mesas Predefinidas (1 a 6)
                List<Table> tables = new ArrayList<>();
                for (int i = 1; i <= 6; i++) {
                        tables.add(Table.builder()
                                        .branch(branch)
                                        .tableNumber(i)
                                        .status(TableStatus.AVAILABLE)
                                        .qrToken(UUID.randomUUID().toString())
                                        .assignedUsers(mesero != null ? List.of(mesero) : List.of())
                                        .build());
                }
                tables = tableRepository.saveAll(tables);

                // 5. Categorías
                Category tacos = categoryRepository.save(Category.builder()
                                .restaurant(restaurant)
                                .name("Tacos & Especialidades")
                                .active(true)
                                .build());

                Category bebidas = categoryRepository.save(Category.builder()
                                .restaurant(restaurant)
                                .name("Bebidas")
                                .active(true)
                                .build());

                // 6. Materia Prima / Ingredientes
                Ingredient carne = ingredientRepository.save(Ingredient.builder()
                                .restaurant(restaurant)
                                .name("Carne al Pastor")
                                .unitOfMeasure("kg")
                                .active(true)
                                .build());

                Ingredient queso = ingredientRepository.save(Ingredient.builder()
                                .restaurant(restaurant)
                                .name("Queso Oaxaca")
                                .unitOfMeasure("kg")
                                .active(true)
                                .build());

                branchIngredientStockRepository.save(BranchIngredientStock.builder()
                                .id(new BranchIngredientStockKey(branch.getId(), carne.getId()))
                                .branch(branch)
                                .ingredient(carne)
                                .stock(new BigDecimal("25.000"))
                                .build());

                branchIngredientStockRepository.save(BranchIngredientStock.builder()
                                .id(new BranchIngredientStockKey(branch.getId(), queso.getId()))
                                .branch(branch)
                                .ingredient(queso)
                                .stock(new BigDecimal("18.500"))
                                .build());

                // 7. Productos y Recetas
                Product tacoPastor = Product.builder()
                                .category(tacos)
                                .name("Orden de Tacos al Pastor")
                                .price(new BigDecimal("95.00"))
                                .description("4 tacos con piña, cebolla y cilantro")
                                .active(true)
                                .isRecipe(true)
                                .trackStock(false)
                                .recipeItems(new ArrayList<>())
                                .build();

                Product savedTaco = productRepository.save(tacoPastor);
                recipeItemRepository.save(RecipeItem.builder()
                                .product(savedTaco)
                                .ingredient(carne)
                                .quantity(new BigDecimal("0.200"))
                                .recipeUnit("kg")
                                .build());

                Product refresco = productRepository.save(Product.builder()
                                .category(bebidas)
                                .name("Refresco 600ml")
                                .price(new BigDecimal("35.00"))
                                .description("Presentación en botella")
                                .active(true)
                                .isRecipe(false)
                                .trackStock(true)
                                .stock(50)
                                .build());

                branchProductStockRepository.save(BranchProductStock.builder()
                                .id(new BranchProductStockKey(branch.getId(), refresco.getId()))
                                .branch(branch)
                                .product(refresco)
                                .stock(50)
                                .build());

                // 8. Cuentas activas de prueba (Mesas 2 y 4 ocupadas para KDS y Comandera)
                Table table2 = tables.get(1);
                table2.setStatus(TableStatus.OCCUPIED);
                tableRepository.save(table2);

                Order order2 = orderRepository.save(Order.builder()
                                .branch(branch)
                                .table(table2)
                                .status(OrderStatus.OPEN)
                                .totalAmount(new BigDecimal("130.00"))
                                .waiterName(mesero != null ? mesero.getName() : "Carlos Mesero")
                                .createdAt(LocalDateTime.now().minusMinutes(18))
                                .build());

                orderItemRepository.save(OrderItem.builder()
                                .order(order2)
                                .product(savedTaco)
                                .quantity(1)
                                .unitPrice(new BigDecimal("95.00"))
                                .specialInstructions("Sin cebolla")
                                .kitchenStatus(KitchenStatus.PREPARING)
                                .build());

                orderItemRepository.save(OrderItem.builder()
                                .order(order2)
                                .product(refresco)
                                .quantity(1)
                                .unitPrice(new BigDecimal("35.00"))
                                .kitchenStatus(KitchenStatus.READY)
                                .readyAt(LocalDateTime.now().minusMinutes(5))
                                .build());

                // 9. Historial para Gráficas y Reportes (Últimos 5 días)
                for (int d = 1; d <= 5; d++) {
                        LocalDateTime date = LocalDateTime.now().minusDays(d).withHour(15).withMinute(0);
                        Order closedOrder = orderRepository.save(Order.builder()
                                        .branch(branch)
                                        .table(tables.get(d % tables.size()))
                                        .status(OrderStatus.CLOSED)
                                        .totalAmount(new BigDecimal("260.00").add(BigDecimal.valueOf(d * 20L)))
                                        .createdAt(date.minusMinutes(40))
                                        .closedAt(date)
                                        .waiterName("Carlos Mesero")
                                        .build());

                        orderItemRepository.save(OrderItem.builder()
                                        .order(closedOrder)
                                        .product(savedTaco)
                                        .quantity(2)
                                        .unitPrice(new BigDecimal("95.00"))
                                        .kitchenStatus(KitchenStatus.DELIVERED)
                                        .build());
                }
        }
}