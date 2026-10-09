package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.BitacoraPagoLinea;
import com.omnirest.omnirest_backend.repositories.BitacoraPagoLineaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Quien hizo que en los pagos en linea. Lo que mueve dinero queda anotado. */
@Service
@RequiredArgsConstructor
@Slf4j
public class BitacoraPagosLinea {

    /** Lo que se anota. */
    public enum Accion { CONECTAR, DESCONECTAR, ESTADO_CUENTA, ACTIVAR, DESACTIVAR, CONFIGURAR, COMISION, REEMBOLSO, DISPUTA }

    private final BitacoraPagoLineaRepository repositorio;

    public void anotar(UUID restaurantId, Accion accion, String detalle, String usuario) {
        repositorio.save(BitacoraPagoLinea.builder()
                .restaurantId(restaurantId)
                .accion(accion.name())
                .detalle(recortar(detalle, 500))
                .usuario(recortar(usuario, 120))
                .build());
        log.info("Pagos en linea [{}] {} por {}: {}", restaurantId, accion, usuario, detalle);
    }

    public List<BitacoraPagoLinea> recientes(UUID restaurantId) {
        return repositorio.findTop100ByRestaurantIdOrderByEnDesc(restaurantId);
    }

    private static String recortar(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
