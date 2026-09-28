package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Table;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import com.omnirest.omnirest_backend.dtos.TableRequestDTO;
import com.omnirest.omnirest_backend.dtos.TableResponseDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.TableRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TableServiceTest {

    @Mock
    private TableRepository tableRepository;

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WhatsappIntegrationService whatsappIntegrationService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private RestaurantRepository restaurantRepository;

    @InjectMocks
    private TableService tableService;

    private UUID restaurantId;
    private UUID branchId;
    private Branch branch;
    private Table table;
    private CustomUserDetails branchUser;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        Restaurant restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Test Rest")
                .build();

        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Sucursal 1")
                .whatsappNumber("5215559876543")
                .build();

        table = Table.builder()
                .id(UUID.randomUUID())
                .branch(branch)
                .tableNumber(10)
                .status(TableStatus.AVAILABLE)
                .qrToken("qr-token-123")
                .build();

        branchUser = new CustomUserDetails(
                UUID.randomUUID(), "manager", "pwd", "BRANCH_MANAGER", "/dashboard", restaurantId, branchId, List.of());
    }

    @Test
    @DisplayName("getTables returns tables for the user's branch")
    void getTables_BranchUser_ReturnsTables() {
        when(tableRepository.findByBranchId(branchId)).thenReturn(List.of(table));

        List<TableResponseDTO> result = tableService.getTables(branchUser, branchId);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(10, result.get(0).tableNumber());
    }

    @Test
    @DisplayName("createTable creates table with unique qrToken")
    void createTable_Success_CreatesTable() {
        TableRequestDTO request = new TableRequestDTO(12, TableStatus.AVAILABLE, branchId);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(tableRepository.findByBranchIdAndTableNumber(branchId, 12)).thenReturn(Optional.empty());
        when(tableRepository.save(any(Table.class))).thenAnswer(invocation -> {
            Table t = invocation.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        TableResponseDTO response = tableService.createTable(request, branchUser);

        assertNotNull(response);
        assertEquals(12, response.tableNumber());
        assertEquals(TableStatus.AVAILABLE, response.status());
        assertNotNull(response.qrToken());
        verify(tableRepository).save(any(Table.class));
    }

    @Test
    @DisplayName("createTable throws IllegalArgumentException when table number already exists in branch")
    void createTable_DuplicateNumber_ThrowsIllegalArgumentException() {
        TableRequestDTO request = new TableRequestDTO(10, TableStatus.AVAILABLE, branchId);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(tableRepository.findByBranchIdAndTableNumber(branchId, 10)).thenReturn(Optional.of(table));

        assertThrows(IllegalArgumentException.class, () -> tableService.createTable(request, branchUser));
    }

    @Test
    @DisplayName("getRedirectUrlByQrToken generates correct WhatsApp URI with encoded text")
    void getRedirectUrlByQrToken_GeneratesWhatsappUrl() {
        when(tableRepository.findByQrToken("qr-token-123")).thenReturn(Optional.of(table));
        when(whatsappIntegrationService.getActiveWhatsappNumber(branchId.toString())).thenReturn("5215559876543");

        Optional<String> url = tableService.getRedirectUrlByQrToken("qr-token-123");

        assertTrue(url.isPresent());
        assertTrue(url.get().contains("https://wa.me/5215559876543"));
        assertTrue(url.get().contains("mesa%2010"));
    }

    @Test
    @DisplayName("assignWaiters assigns users belonging to branch and notifies via websocket")
    void assignWaiters_Success_AssignsWaitersAndBroadcasts() {
        User waiter = User.builder()
                .id(UUID.randomUUID())
                .username("carlos_waiter")
                .name("Carlos Mesero")
                .branch(branch)
                .build();

        when(tableRepository.findById(table.getId())).thenReturn(Optional.of(table));
        when(userRepository.findAllById(List.of(waiter.getId()))).thenReturn(List.of(waiter));
        when(tableRepository.save(any(Table.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TableResponseDTO response = tableService.assignWaitersToTable(table.getId(), List.of(waiter.getId()), branchUser);

        assertNotNull(response);
        assertEquals(1, response.assignedWaiters().size());
        assertEquals("Carlos Mesero", response.assignedWaiters().get(0).name());
        verify(messagingTemplate).convertAndSend(contains("/tables"), any(TableResponseDTO.class));
    }

    @Test
    @DisplayName("deleteTable throws AccessDeniedException when user belongs to different branch")
    void deleteTable_DifferentBranchUser_ThrowsAccessDeniedException() {
        UUID otherBranchId = UUID.randomUUID();
        CustomUserDetails otherUser = new CustomUserDetails(
                UUID.randomUUID(), "other", "pwd", "BRANCH_MANAGER", "/dashboard", restaurantId, otherBranchId, List.of());

        when(tableRepository.findById(table.getId())).thenReturn(Optional.of(table));

        assertThrows(AccessDeniedException.class, () -> tableService.deleteTable(table.getId(), otherUser));
    }
}
