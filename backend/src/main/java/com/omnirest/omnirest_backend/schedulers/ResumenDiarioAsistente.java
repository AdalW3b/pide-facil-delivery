package com.omnirest.omnirest_backend.schedulers;

import com.omnirest.omnirest_backend.domain.entities.AsistenteConfig;
import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.repositories.AsistenteConfigRepository;
import com.omnirest.omnirest_backend.repositories.AsistenteResumenRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.services.asistente.AsistenteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * El resumen del día anterior de cada sucursal, a las 7 de la mañana, para los
 * restaurantes con el asistente activo que lo pidieron. Si una sucursal falla
 * (llave vencida, proveedor caído) se sigue con las demás.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ResumenDiarioAsistente {

    private static final ZoneId MEXICO = ZoneId.of("America/Mexico_City");

    private final AsistenteConfigRepository configRepository;
    private final AsistenteResumenRepository resumenRepository;
    private final BranchRepository branchRepository;
    private final AsistenteService asistenteService;

    @Scheduled(cron = "0 0 7 * * *", zone = "America/Mexico_City")
    public void generar() {
        LocalDate ayer = LocalDate.now(MEXICO).minusDays(1);
        for (AsistenteConfig c : configRepository.findByComplementoActivoTrueAndResumenDiarioTrue()) {
            if (!c.configurado()) continue;
            for (Branch b : branchRepository.findByRestaurantIdAndActiveTrue(c.getRestaurantId())) {
                if (resumenRepository.existsByBranchIdAndDia(b.getId(), ayer)) continue;
                try {
                    asistenteService.generarResumen(c, b, ayer, AsistenteService.duenoDe(c.getRestaurantId()));
                } catch (RuntimeException e) {
                    log.warn("Asistente: no se pudo hacer el resumen de {} ({}): {}", b.getName(), b.getId(), e.getMessage());
                }
            }
        }
    }
}
