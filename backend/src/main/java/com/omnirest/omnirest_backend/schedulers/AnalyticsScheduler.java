package com.omnirest.omnirest_backend.schedulers;

import com.omnirest.omnirest_backend.services.AnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AnalyticsScheduler {

    private final AnalyticsService analyticsService;

    @Scheduled(cron = "0 0/30 * * * ?")
    public void refreshDailySalesView() {
        log.info("Ejecutando tarea programada de refresco para mv_daily_sales");
        try {
            analyticsService.refreshDailySalesView();
        } catch (Exception e) {
            log.error("Error al refrescar la vista materializada mv_daily_sales", e);
        }
    }
}
