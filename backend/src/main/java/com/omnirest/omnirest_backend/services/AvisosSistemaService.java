package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.AvisoSistema;
import com.omnirest.omnirest_backend.repositories.AvisoSistemaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Los avisos de la plataforma al dueño de un restaurante: que entró soporte,
 * que se usó su código, cobros de la renta. Los ve en la campana del panel.
 */
@Service
@RequiredArgsConstructor
public class AvisosSistemaService {

    private final AvisoSistemaRepository avisoRepository;

    public record AvisoDTO(UUID id, String tipo, String titulo, String detalle, LocalDateTime creadoEn, boolean leido) {
    }

    public record Bandeja(long noLeidos, List<AvisoDTO> avisos) {
    }

    @Transactional
    public void avisar(UUID restaurantId, String tipo, String titulo, String detalle) {
        avisoRepository.save(AvisoSistema.builder()
                .restaurantId(restaurantId)
                .tipo(tipo)
                .titulo(recortar(titulo, 150))
                .detalle(recortar(detalle, 500))
                .build());
    }

    @Transactional(readOnly = true)
    public Bandeja bandeja(UUID restaurantId) {
        return new Bandeja(
                avisoRepository.countByRestaurantIdAndLeidoEnIsNull(restaurantId),
                avisoRepository.findTop30ByRestaurantIdOrderByCreadoEnDesc(restaurantId).stream()
                        .map(a -> new AvisoDTO(a.getId(), a.getTipo(), a.getTitulo(), a.getDetalle(),
                                a.getCreadoEn(), a.getLeidoEn() != null))
                        .toList());
    }

    @Transactional
    public void marcarLeidos(UUID restaurantId) {
        avisoRepository.marcarLeidos(restaurantId, LocalDateTime.now());
    }

    private static String recortar(String texto, int max) {
        if (texto == null) return null;
        return texto.length() > max ? texto.substring(0, max - 1) + "…" : texto;
    }
}
