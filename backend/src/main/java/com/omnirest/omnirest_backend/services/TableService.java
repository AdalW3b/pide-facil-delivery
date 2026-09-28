package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Table;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import com.omnirest.omnirest_backend.dtos.BulkTableRequestDTO;
import com.omnirest.omnirest_backend.dtos.BulkTableResponseDTO;
import com.omnirest.omnirest_backend.dtos.CreateTableRequestDTO;
import com.omnirest.omnirest_backend.dtos.TableRequestDTO;
import com.omnirest.omnirest_backend.dtos.TableResponseDTO;
import com.omnirest.omnirest_backend.dtos.WaiterSummaryDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.TableRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TableService {

    private final TableRepository tableRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final SimpMessagingTemplate messagingTemplate;

    public List<TableResponseDTO> getTables(CustomUserDetails user, UUID branchId) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            List<Table> tables = (branchId != null) 
                    ? tableRepository.findByBranchId(branchId) 
                    : tableRepository.findAll();
            return tables.stream().map(this::mapToResponse).collect(Collectors.toList());
        }

        UUID effectiveRestaurantId = user.restaurantId();
        boolean isDemoUser = effectiveRestaurantId != null && restaurantRepository.findById(effectiveRestaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);

        if (isDemoUser) {
            effectiveRestaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(user.restaurantId());
        }

        List<Table> tables;
        if (user.branchId() != null && !isDemoUser) {
            tables = tableRepository.findByBranchId(user.branchId());
        } else if (effectiveRestaurantId != null) {
            if (branchId != null) {
                Branch branch = branchRepository.findById(branchId)
                        .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
                if (!effectiveRestaurantId.equals(branch.getRestaurant().getId())) {
                    throw new AccessDeniedException("Acceso denegado: La sucursal no pertenece a tu restaurante.");
                }
                tables = tableRepository.findByBranchId(branchId);
            } else {
                tables = tableRepository.findByBranchRestaurantId(effectiveRestaurantId);
            }
        } else {
            if (branchId != null) {
                tables = tableRepository.findByBranchId(branchId);
            } else {
                tables = tableRepository.findAll();
            }
        }

        return tables.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public TableResponseDTO getTableById(UUID id, CustomUserDetails user) {
        Table table = tableRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada."));

        validateWriteScope(user, table.getBranch().getId());

        return mapToResponse(table);
    }

    public java.util.Optional<String> getRedirectUrlByQrToken(String qrToken) {
        return tableRepository.findByQrToken(qrToken)
                .map(table -> {
                    String branchId = table.getBranch().getId().toString();
                    String whatsappNumber = whatsappIntegrationService.getActiveWhatsappNumber(branchId);

                    if (whatsappNumber == null || whatsappNumber.isBlank()) {
                        whatsappNumber = table.getBranch().getWhatsappNumber();
                    }

                    if (whatsappNumber == null || whatsappNumber.isBlank()) {
                        throw new IllegalArgumentException("Número de WhatsApp de la sucursal no configurado.");
                    }

                    String cleanNumber = whatsappNumber.replace("+", "").replaceAll("\\s", "");

                    String text = "Hola, quiero abrir la mesa " + table.getTableNumber();
                    String encodedText = org.springframework.web.util.UriUtils.encode(text,
                            java.nio.charset.StandardCharsets.UTF_8);
                    return "https://wa.me/" + cleanNumber + "?text=" + encodedText;
                });
    }

    @Transactional
    public TableResponseDTO createTable(TableRequestDTO dto, CustomUserDetails user) {
        validateWriteScope(user, dto.branchId());

        Branch branch = branchRepository.findById(dto.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));

        tableRepository.findByBranchIdAndTableNumber(dto.branchId(), dto.tableNumber())
                .ifPresent(t -> {
                    throw new IllegalArgumentException("El número de mesa ya existe en esta sucursal.");
                });

        Table table = Table.builder()
                .branch(branch)
                .tableNumber(dto.tableNumber())
                .status(dto.status())
                .qrToken(UUID.randomUUID().toString())
                .build();

        return mapToResponse(tableRepository.save(table));
    }

    @Transactional
    public TableResponseDTO createTableForBranch(UUID branchId, CreateTableRequestDTO dto, CustomUserDetails user) {
        validateWriteScope(user, branchId);

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada con ID: " + branchId));

        if (Boolean.TRUE.equals(branch.getRestaurant().getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: No se permite crear mesas en cuentas Demo.");
        }

        tableRepository.findByBranchIdAndTableNumber(branchId, dto.tableNumber())
                .ifPresent(t -> {
                    throw new IllegalArgumentException(
                            "El número de mesa " + dto.tableNumber() + " ya existe en esta sucursal.");
                });

        Table table = Table.builder()
                .branch(branch)
                .tableNumber(dto.tableNumber())
                .status(TableStatus.AVAILABLE)
                .qrToken(UUID.randomUUID().toString())
                .build();

        return mapToResponse(tableRepository.save(table));
    }

    @Transactional
    public BulkTableResponseDTO bulkCreateTables(UUID branchId, BulkTableRequestDTO dto, CustomUserDetails user) {
        validateWriteScope(user, branchId);

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada con ID: " + branchId));

        if (Boolean.TRUE.equals(branch.getRestaurant().getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: No se permite crear mesas en cuentas Demo.");
        }

        List<Integer> existingTableNumbers = tableRepository.findByBranchId(branchId).stream()
                .map(Table::getTableNumber)
                .collect(Collectors.toList());

        List<Integer> uniqueNewNumbers = dto.tableNumbers().stream()
                .distinct()
                .filter(num -> !existingTableNumbers.contains(num))
                .collect(Collectors.toList());

        int skipped = dto.tableNumbers().size() - uniqueNewNumbers.size();

        List<Table> tablesToSave = uniqueNewNumbers.stream()
                .map(num -> Table.builder()
                        .branch(branch)
                        .tableNumber(num)
                        .status(TableStatus.AVAILABLE)
                        .qrToken(UUID.randomUUID().toString())
                        .build())
                .collect(Collectors.toList());

        tableRepository.saveAll(tablesToSave);

        String message = String.format("Se crearon %d mesas exitosamente y se omitieron %d duplicados.",
                tablesToSave.size(), skipped);

        return new BulkTableResponseDTO(message, tablesToSave.size(), skipped);
    }

    @Transactional
    public TableResponseDTO updateTable(UUID id, TableRequestDTO dto, CustomUserDetails user) {
        Table table = tableRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada."));

        validateWriteScope(user, table.getBranch().getId());
        validateWriteScope(user, dto.branchId());

        if (!table.getTableNumber().equals(dto.tableNumber())) {
            tableRepository.findByBranchIdAndTableNumber(dto.branchId(), dto.tableNumber())
                    .ifPresent(t -> {
                        throw new IllegalArgumentException("El número de mesa ya existe en esta sucursal.");
                    });
        }

        table.setTableNumber(dto.tableNumber());
        table.setStatus(dto.status());

        return mapToResponse(tableRepository.save(table));
    }

    @Transactional
    public TableResponseDTO assignWaitersToTable(UUID tableId, List<UUID> waiterIds, CustomUserDetails user) {
        Table table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada con ID: " + tableId));

        validateWriteScope(user, table.getBranch().getId());

        List<User> waiters = new java.util.ArrayList<>();
        if (waiterIds != null && !waiterIds.isEmpty()) {
            waiters = userRepository.findAllById(waiterIds).stream()
                    .filter(u -> u.getBranch() != null && u.getBranch().getId().equals(table.getBranch().getId()))
                    .collect(Collectors.toCollection(java.util.ArrayList::new));
        }

        table.setAssignedUsers(waiters);
        Table savedTable = tableRepository.save(table);

        TableResponseDTO response = mapToResponse(savedTable);
        messagingTemplate.convertAndSend("/topic/branches/" + table.getBranch().getId() + "/tables", response);

        return response;
    }

    @Transactional
    public void deleteTable(UUID id, CustomUserDetails user) {
        Table table = tableRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada."));

        validateWriteScope(user, table.getBranch().getId());
        tableRepository.delete(table);
    }

    public void validateWriteScope(CustomUserDetails user, UUID branchId) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            return;
        }
        if (user.branchId() != null) {
            if (!user.branchId().equals(branchId)) {
                throw new AccessDeniedException("Acceso denegado: No pertenece a tu sucursal.");
            }
        } else if (user.restaurantId() != null) {
            Branch branch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
            boolean userIsDemo = restaurantRepository.findById(user.restaurantId())
                    .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .orElse(false);
            if (userIsDemo && Boolean.TRUE.equals(branch.getRestaurant().getIsDemo())) {
                return;
            }
            if (!user.restaurantId().equals(branch.getRestaurant().getId())) {
                throw new AccessDeniedException("Acceso denegado: La sucursal no pertenece a tu restaurante.");
            }
        }
    }

    private TableResponseDTO mapToResponse(Table table) {
        UUID activeOrderId = null;
        java.math.BigDecimal totalAmount = java.math.BigDecimal.ZERO;
        List<com.omnirest.omnirest_backend.dtos.OrderItemResponseDTO> items = java.util.List.of();
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
                        .filter(u -> u.getBranch() != null && u.getBranch().getId().equals(table.getBranch().getId()))
                        .map(u -> new WaiterSummaryDTO(
                                u.getId(),
                                u.getName() != null && !u.getName().isBlank() ? u.getName() : u.getUsername()))
                        .collect(Collectors.toList())
                : List.of();

        return new TableResponseDTO(
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
    }
}
