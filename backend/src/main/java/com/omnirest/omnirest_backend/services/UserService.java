package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.domain.entities.Table;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.dtos.CreateUserDTO;
import com.omnirest.omnirest_backend.dtos.UpdateUserDTO;
import com.omnirest.omnirest_backend.dtos.UserResponseDTO;
import com.omnirest.omnirest_backend.dtos.WaiterSummaryDTO;
import com.omnirest.omnirest_backend.dtos.TableResponseDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.RoleRepository;
import com.omnirest.omnirest_backend.repositories.TableRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final BranchRepository branchRepository;
    private final RestaurantRepository restaurantRepository;
    private final TableRepository tableRepository;
    private final PasswordEncoder passwordEncoder;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.omnirest.omnirest_backend.repositories.AreaPreparacionRepository areaRepository;

    @Transactional(readOnly = true)
    public List<UserResponseDTO> listUsers(CustomUserDetails userDetails) {
        UUID restaurantId = userDetails.restaurantId();
        if (restaurantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario no tiene restaurante asignado.");
        }

        boolean isDemo = restaurantRepository.findById(restaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            restaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(restaurantId);
        }

        boolean isSuperAdmin = "SUPER_ADMIN".equalsIgnoreCase(userDetails.roleName()) || isDemo;
        List<User> users;

        if (isSuperAdmin) {
            users = userRepository.findByRestaurantId(restaurantId);
        } else {
            if (userDetails.branchId() == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Branch manager no tiene sucursal asignada.");
            }
            users = userRepository.findByBranchId(userDetails.branchId());
        }

        return users.stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Transactional
    public UserResponseDTO createUser(CreateUserDTO request, CustomUserDetails userDetails) {
        UUID restaurantId = userDetails.restaurantId();
        if (restaurantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario no tiene restaurante asignado.");
        }

        if (userRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El usuario '" + request.username() + "' ya está registrado.");
        }

        Role role = roleRepository.findById(request.roleId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado."));

        boolean isSuperAdmin = ReglasDeRoles.esDueno(userDetails) || ReglasDeRoles.esOperador(userDetails);
        UUID finalBranchId = request.branchId();

        // Ni roles de otro restaurante, ni de plataforma, ni con mas permisos que
        // los de quien lo asigna.
        ReglasDeRoles.exigirPuedeAsignar(userDetails, role, restaurantId);

        if (!isSuperAdmin) {
            if (userDetails.branchId() == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Branch manager no tiene sucursal asignada.");
            }
            finalBranchId = userDetails.branchId();
        }

        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado."));

        if (Boolean.TRUE.equals(restaurant.getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: No se pueden agregar usuarios en cuentas Demo.");
        }

        // Validación de límites según el plan
        String plan = restaurant.getSubscriptionPlan() != null ? restaurant.getSubscriptionPlan().toUpperCase().trim() : "INICIAL";
        long currentUserCount = userRepository.countByRestaurantId(restaurantId);

        if ("INICIAL".equals(plan) && currentUserCount >= 5) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 5 usuarios para tu Plan Inicial. Actualiza al Plan Pro para registrar hasta 25 usuarios.");
        } else if ("PRO".equals(plan) && currentUserCount >= 25) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 25 usuarios para tu Plan Pro. Contacta a soporte para adquirir el Plan Cadena con usuarios ilimitados.");
        }

        Branch branch = null;
        if (finalBranchId != null) {
            branch = branchRepository.findById(finalBranchId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sucursal no encontrada."));
        }

        final Branch targetBranch = branch;
        List<Table> tables = (request.assignedTableIds() != null && !request.assignedTableIds().isEmpty())
                ? tableRepository.findAllById(request.assignedTableIds()).stream()
                        .filter(t -> targetBranch != null && t.getBranch() != null
                                && t.getBranch().getId().equals(targetBranch.getId()))
                        .collect(Collectors.toCollection(java.util.ArrayList::new))
                : new java.util.ArrayList<>();

        User user = User.builder()
                .name(request.name())
                .username(request.username())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(role)
                .restaurant(restaurant)
                .branch(branch)
                .tables(tables)
                .phoneNumber(request.phoneNumber())
                .areaId(areaDelRestaurante(request.areaId(), restaurantId))
                .build();

        User savedUser = userRepository.save(user);

        // Sync bidirectional relationship on Table and push WebSocket update
        if (savedUser.getBranch() != null) {
            List<Table> branchTables = tableRepository.findByBranchId(savedUser.getBranch().getId());
            for (Table table : branchTables) {
                if (table.getAssignedUsers() == null) {
                    table.setAssignedUsers(new java.util.ArrayList<>());
                } else {
                    table.setAssignedUsers(new java.util.ArrayList<>(table.getAssignedUsers()));
                }
                if (request.assignedTableIds() != null && request.assignedTableIds().contains(table.getId())) {
                    if (!table.getAssignedUsers().contains(savedUser)) {
                        table.getAssignedUsers().add(savedUser);
                    }
                } else {
                    table.getAssignedUsers().remove(savedUser);
                }
            }
            tableRepository.saveAll(branchTables);
            for (Table table : branchTables) {
                notifyTableWebSocket(table);
            }
        }

        return mapToResponseDTO(savedUser);
    }

    /**
     * Solo se toca a empleados del propio restaurante. Uno de otro restaurante
     * responde "no encontrado", sin confirmar que existe. El operador, que no
     * tiene restaurante, puede con todos.
     */
    private static void exigirMismoRestaurante(User user, CustomUserDetails quien) {
        if (ReglasDeRoles.esOperador(quien)) return;
        UUID propio = quien != null ? quien.restaurantId() : null;
        UUID delEmpleado = user.getRestaurant() != null ? user.getRestaurant().getId() : null;
        if (propio == null || !propio.equals(delEmpleado)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado.");
        }
    }

    @Transactional
    public UserResponseDTO updateUser(UUID targetUserId, UpdateUserDTO request, CustomUserDetails userDetails) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado."));

        exigirMismoRestaurante(user, userDetails);
        boolean isSuperAdmin = ReglasDeRoles.esDueno(userDetails) || ReglasDeRoles.esOperador(userDetails);
        Role role = roleRepository.findById(request.roleId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado."));

        UUID finalBranchId = request.branchId();

        if (!isSuperAdmin) {
            if (user.getBranch() == null || !user.getBranch().getId().equals(userDetails.branchId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes permisos para modificar usuarios fuera de tu sucursal.");
            }
            finalBranchId = userDetails.branchId();
        }
        // Cambiarle el rol a alguien pasa por las mismas reglas que darselo al crearlo.
        if (user.getRole() == null || !user.getRole().getId().equals(role.getId())) {
            ReglasDeRoles.exigirPuedeAsignar(userDetails, role,
                    user.getRestaurant() != null ? user.getRestaurant().getId() : userDetails.restaurantId());
        }

        if (!user.getUsername().equalsIgnoreCase(request.username())
                && userRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El usuario '" + request.username() + "' ya está registrado.");
        }

        Branch branch = null;
        if (finalBranchId != null) {
            branch = branchRepository.findById(finalBranchId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sucursal no encontrada."));
        }

        user.setName(request.name());
        user.setUsername(request.username());
        user.setRole(role);
        user.setBranch(branch);
        user.setAreaId(areaDelRestaurante(request.areaId(),
                user.getRestaurant() != null ? user.getRestaurant().getId() : userDetails.restaurantId()));

        if (request.phoneNumber() != null) {
            user.setPhoneNumber(request.phoneNumber());
        }

        final Branch updatedBranch = branch;
        if (request.assignedTableIds() != null) {
            List<Table> tables = request.assignedTableIds().isEmpty()
                    ? new java.util.ArrayList<>()
                    : tableRepository.findAllById(request.assignedTableIds()).stream()
                            .filter(t -> updatedBranch != null && t.getBranch() != null
                                    && t.getBranch().getId().equals(updatedBranch.getId()))
                            .collect(Collectors.toCollection(java.util.ArrayList::new));
            user.setTables(tables);
        } else if (updatedBranch != null && user.getTables() != null) {
            user.setTables(user.getTables().stream()
                    .filter(t -> t.getBranch() != null && t.getBranch().getId().equals(updatedBranch.getId()))
                    .collect(Collectors.toCollection(java.util.ArrayList::new)));
        }

        if (request.password() != null && !request.password().isBlank()) {
            if (request.password().length() < 6) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "La contraseña debe tener al menos 6 caracteres.");
            }
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }

        User savedUser = userRepository.save(user);

        // Sync bidirectional relationship on Table and push WebSocket update
        if (savedUser.getBranch() != null) {
            List<Table> branchTables = tableRepository.findByBranchId(savedUser.getBranch().getId());
            for (Table table : branchTables) {
                if (table.getAssignedUsers() == null) {
                    table.setAssignedUsers(new java.util.ArrayList<>());
                } else {
                    table.setAssignedUsers(new java.util.ArrayList<>(table.getAssignedUsers()));
                }
                if (request.assignedTableIds() != null && request.assignedTableIds().contains(table.getId())) {
                    if (!table.getAssignedUsers().contains(savedUser)) {
                        table.getAssignedUsers().add(savedUser);
                    }
                } else {
                    table.getAssignedUsers().remove(savedUser);
                }
            }
            tableRepository.saveAll(branchTables);
            for (Table table : branchTables) {
                notifyTableWebSocket(table);
            }
        }

        return mapToResponseDTO(savedUser);
    }

    @Transactional
    public void deleteUser(UUID targetUserId, CustomUserDetails userDetails) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado."));

        exigirMismoRestaurante(user, userDetails);
        boolean isSuperAdmin = ReglasDeRoles.esDueno(userDetails) || ReglasDeRoles.esOperador(userDetails);

        if (!isSuperAdmin) {
            if (user.getBranch() == null || !user.getBranch().getId().equals(userDetails.branchId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes permisos para eliminar usuarios fuera de tu sucursal.");
            }
            if (user.getRole() != null && user.getRole().getName().equalsIgnoreCase("SUPER_ADMIN")) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes eliminar a un SUPER_ADMIN.");
            }
        }

        if (user.getBranch() != null) {
            List<Table> branchTables = tableRepository.findByBranchId(user.getBranch().getId());
            for (Table table : branchTables) {
                if (table.getAssignedUsers() != null) {
                    table.setAssignedUsers(new java.util.ArrayList<>(table.getAssignedUsers()));
                    table.getAssignedUsers().remove(user);
                }
            }
            tableRepository.saveAll(branchTables);
            for (Table table : branchTables) {
                notifyTableWebSocket(table);
            }
        }

        userRepository.delete(user);
    }

    private void notifyTableWebSocket(Table table) {
        if (messagingTemplate == null || table == null || table.getBranch() == null)
            return;

        UUID activeOrderId = null;
        java.math.BigDecimal totalAmount = java.math.BigDecimal.ZERO;
        List<com.omnirest.omnirest_backend.dtos.OrderItemResponseDTO> items = List.of();
        com.omnirest.omnirest_backend.domain.enums.KitchenStatus kitchenStatus = null;
        java.time.LocalDateTime abiertaDesde = null;

        if (table.getOrders() != null) {
            com.omnirest.omnirest_backend.domain.entities.Order activeOrder = table.getOrders().stream()
                    .filter(o -> o.getStatus() == com.omnirest.omnirest_backend.domain.enums.OrderStatus.OPEN)
                    .findFirst()
                    .orElse(null);

            if (activeOrder != null) {
                activeOrderId = activeOrder.getId();
                abiertaDesde = activeOrder.getCreatedAt();
                totalAmount = activeOrder.getTotalAmount();
                kitchenStatus = com.omnirest.omnirest_backend.services.KitchenSummary
                        .resumir(activeOrder.getOrderItems());
                if (activeOrder.getOrderItems() != null) {
                    items = activeOrder.getOrderItems().stream()
                            // Un platillo cancelado ya no forma parte de la cuenta.
                            .filter(item -> item
                                    .getKitchenStatus() != com.omnirest.omnirest_backend.domain.enums.KitchenStatus.CANCELLED)
                            .map(item -> new com.omnirest.omnirest_backend.dtos.OrderItemResponseDTO(
                                    item.getId(),
                                    item.getProduct().getId(),
                                    item.getProduct().getName(),
                                    item.getQuantity(),
                                    item.getUnitPrice(),
                                    item.getSpecialInstructions(),
                                    item.adicionalesParaMostrar()))
                            .collect(Collectors.toList());
                }
            }
        }

        List<WaiterSummaryDTO> assignedWaiters = table.getAssignedUsers() != null
                ? table.getAssignedUsers().stream()
                        .map(u -> new WaiterSummaryDTO(
                                u.getId(),
                                u.getName() != null && !u.getName().isBlank() ? u.getName() : u.getUsername()))
                        .collect(Collectors.toList())
                : List.of();

        TableResponseDTO payload = new TableResponseDTO(
                table.getId(),
                table.getBranch().getId(),
                table.getTableNumber(),
                table.getStatus(),
                activeOrderId,
                totalAmount,
                items,
                table.getQrToken(),
                assignedWaiters,
                kitchenStatus,
                abiertaDesde);

        messagingTemplate.convertAndSend("/topic/branches/" + table.getBranch().getId() + "/tables", payload);
    }

    private UserResponseDTO mapToResponseDTO(User user) {
        UserResponseDTO.RoleInfo roleInfo = user.getRole() != null
                ? new UserResponseDTO.RoleInfo(user.getRole().getId(), user.getRole().getName(),
                        user.getRole().getDefaultRoute())
                : null;

        UserResponseDTO.BranchInfo branchInfo = user.getBranch() != null
                ? new UserResponseDTO.BranchInfo(user.getBranch().getId(), user.getBranch().getName())
                : null;

        List<UUID> assignedTableIds = user.getTables() != null
                ? user.getTables().stream().map(Table::getId).toList()
                : List.of();

        return new UserResponseDTO(
                user.getId(),
                user.getName(),
                user.getUsername(),
                roleInfo,
                branchInfo,
                user.getActive(),
                assignedTableIds,
                user.getPhoneNumber(),
                user.getAreaId());
    }

    /** El area tiene que ser del restaurante del empleado y estar encendida. */
    private java.util.UUID areaDelRestaurante(java.util.UUID areaId, java.util.UUID restaurantId) {
        if (areaId == null) return null;
        return areaRepository.findById(areaId)
                .filter(a -> a.getRestaurantId().equals(restaurantId) && Boolean.TRUE.equals(a.getActiva()))
                .map(com.omnirest.omnirest_backend.domain.entities.AreaPreparacion::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esa área no existe o está apagada."));
    }
}
