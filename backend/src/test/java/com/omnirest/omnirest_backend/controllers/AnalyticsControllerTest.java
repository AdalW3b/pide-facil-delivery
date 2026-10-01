package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AnalyticsService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** De que restaurante y sucursal sale cada reporte segun quien lo pide. */
@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

    @Mock AnalyticsService analyticsService;
    @Mock RestaurantRepository restaurantRepository;
    @Mock BranchRepository branchRepository;
    @Mock SecurityValidationService securityValidationService;
    @InjectMocks AnalyticsController controller;

    private final UUID mio = UUID.randomUUID();
    private final UUID ajeno = UUID.randomUUID();

    private CustomUserDetails usuario(String rol, UUID restaurante, UUID sucursal) {
        return new CustomUserDetails(UUID.randomUUID(), "u", "x", rol, "/", restaurante, sucursal, List.of());
    }

    private void restaurante(UUID id, boolean demo) {
        lenient().when(restaurantRepository.findById(id))
                .thenReturn(Optional.of(Restaurant.builder().id(id).isDemo(demo).build()));
    }

    @Test
    @DisplayName("El dueño no puede pedir las ventas de otro restaurante: se le da el suyo")
    void ignoraRestauranteAjeno() {
        restaurante(mio, false);
        AnalyticsController.Alcance a = controller.alcance(ajeno, null, usuario("SUPER_ADMIN", mio, null));
        assertEquals(mio, a.restaurantId());
        assertNull(a.branchId());
    }

    @Test
    @DisplayName("Una sucursal ajena se rechaza y el restaurante sale de la sucursal")
    void validaLaSucursal() {
        UUID suya = UUID.randomUUID();
        UUID otra = UUID.randomUUID();
        Branch b = Branch.builder().id(suya).restaurant(Restaurant.builder().id(mio).build()).build();
        when(branchRepository.findById(suya)).thenReturn(Optional.of(b));
        lenient().doThrow(new AccessDeniedException("no")).when(securityValidationService).validateUserAccessToBranch(otra);

        CustomUserDetails dueno = usuario("SUPER_ADMIN", mio, null);
        AnalyticsController.Alcance a = controller.alcance(ajeno, suya, dueno);
        assertEquals(mio, a.restaurantId(), "el restaurantId pedido no cuenta");
        assertEquals(suya, a.branchId());

        assertThrows(AccessDeniedException.class, () -> controller.alcance(null, otra, dueno));
    }

    @Test
    @DisplayName("El gerente sin sucursal elegida ve la suya, nunca todo el restaurante")
    void gerenteSoloSuSucursal() {
        UUID suya = UUID.randomUUID();
        Branch b = Branch.builder().id(suya).restaurant(Restaurant.builder().id(mio).build()).build();
        when(branchRepository.findById(suya)).thenReturn(Optional.of(b));

        AnalyticsController.Alcance a = controller.alcance(null, null, usuario("BRANCH_MANAGER", mio, suya));
        assertEquals(suya, a.branchId());
        verify(securityValidationService).validateUserAccessToBranch(suya);

        assertThrows(AccessDeniedException.class,
                () -> controller.alcance(null, null, usuario("BRANCH_MANAGER", mio, null)));
    }

    @Test
    @DisplayName("SYSTEM_ADMIN elige cualquier restaurante")
    void adminDelSistema() {
        AnalyticsController.Alcance a = controller.alcance(ajeno, null, usuario("SYSTEM_ADMIN", null, null));
        assertEquals(ajeno, a.restaurantId());
        verify(securityValidationService, never()).validateUserAccessToBranch(any());
    }

    @Test
    @DisplayName("Sin restaurante asignado no hay reporte (antes salian las ventas de todos)")
    void sinRestaurante() {
        assertThrows(AccessDeniedException.class, () -> controller.alcance(null, null, usuario("SUPER_ADMIN", null, null)));
    }
}
