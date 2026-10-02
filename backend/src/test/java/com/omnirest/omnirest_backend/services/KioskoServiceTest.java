package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Kiosko;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.KioskoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Solo una tablet activada desde el panel puede pedir como kiosko. */
class KioskoServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final KioskoRepository kioskoRepository = mock(KioskoRepository.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final KioskoService servicio = new KioskoService(kioskoRepository, branchRepository);

    @BeforeEach
    void setUp() {
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(Branch.builder().id(branchId).name("Centro").build()));
        when(kioskoRepository.save(any(Kiosko.class))).thenAnswer(i -> {
            Kiosko k = i.getArgument(0);
            if (k.getId() == null) k.setId(UUID.randomUUID());
            return k;
        });
    }

    @Test
    @DisplayName("Al activar se guarda solo la huella del token, no el token")
    void activar() {
        KioskoService.Activado a = servicio.activar(branchId, "  Entrada  ", null);

        ArgumentCaptor<Kiosko> captor = ArgumentCaptor.forClass(Kiosko.class);
        verify(kioskoRepository).save(captor.capture());
        assertEquals("Entrada", a.nombre());
        assertTrue(a.token().length() >= 40);
        assertNotEquals(a.token(), captor.getValue().getTokenHash());
        assertEquals(KioskoService.huella(a.token()), captor.getValue().getTokenHash());
    }

    @Test
    @DisplayName("Valida el token, la sucursal y que siga activo")
    void validar() {
        Kiosko activo = Kiosko.builder().id(UUID.randomUUID()).branchId(branchId).nombre("Entrada")
                .tokenHash(KioskoService.huella("tok")).activo(true).build();
        when(kioskoRepository.findByTokenHash(KioskoService.huella("tok"))).thenReturn(Optional.of(activo));

        assertEquals(activo, servicio.validar(branchId, "tok"));
        assertNotNull(activo.getUltimoUso());

        assertThrows(ResponseStatusException.class, () -> servicio.validar(UUID.randomUUID(), "tok"), "otra sucursal");
        assertThrows(ResponseStatusException.class, () -> servicio.validar(branchId, "otro"), "token desconocido");
        assertThrows(ResponseStatusException.class, () -> servicio.validar(branchId, null), "sin token");

        activo.setActivo(false);
        assertThrows(ResponseStatusException.class, () -> servicio.validar(branchId, "tok"), "apagado desde el panel");
    }
}
