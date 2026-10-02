package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.CorteRepartidor;
import com.omnirest.omnirest_backend.domain.entities.Driver;
import com.omnirest.omnirest_backend.dtos.CuadreDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CorteRepartidorRepository;
import com.omnirest.omnirest_backend.repositories.DriverRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Cuadre de efectivo de los repartidores al cerrar el turno.
 *
 * El repartidor cobra en la puerta la comida y el envio; la propina es suya.
 * En caja entrega lo cobrado menos lo que se le paga por sus entregas (o todo,
 * si se le paga aparte). El corte registra lo esperado, lo que entrego de
 * verdad y la diferencia, y marca esas entregas como liquidadas.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CuadreService {

    private final OrderRepository orderRepository;
    private final CorteRepartidorRepository corteRepository;
    private final DriverRepository driverRepository;
    private final BranchRepository branchRepository;
    private final CajaService cajaService;

    @Transactional(readOnly = true)
    public List<CuadreDTOs.Pendiente> pendientes(UUID branchId) {
        return orderRepository.pendientesDeCuadre(branchId);
    }

    @Transactional
    public CuadreDTOs.Corte cerrar(UUID branchId, CuadreDTOs.CerrarCorte peticion, CustomUserDetails user) {
        var branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        Driver repartidor = driverRepository.findById(peticion.driverId())
                .filter(d -> d.getRestaurant().getId().equals(branch.getRestaurant().getId()))
                .orElseThrow(() -> new IllegalArgumentException("Ese repartidor no es de este restaurante."));
        // El efectivo que entrega va al cajon: tiene que haber caja abierta
        // para que el arqueo lo cuente.
        var turno = cajaService.exigirAbierta(branchId);

        // Primero se guarda el corte vacio para tener su id, luego se reclaman
        // las entregas con un solo UPDATE y se suman solo las que quedaron en el:
        // asi un segundo cierre simultaneo no cuenta las mismas.
        boolean descontado = peticion.pagoDescontado() == null || peticion.pagoDescontado();
        CorteRepartidor corte = corteRepository.save(CorteRepartidor.builder()
                .branchId(branchId)
                .driver(repartidor)
                .recibidoPor(user != null ? user.id() : null)
                .creadoEn(LocalDateTime.now())
                .entregas(0).cobrado(BigDecimal.ZERO).pagoRepartidor(BigDecimal.ZERO)
                .pagoDescontado(descontado)
                .esperado(BigDecimal.ZERO).recibido(peticion.recibido()).diferencia(BigDecimal.ZERO)
                .notas(peticion.notas() != null && !peticion.notas().isBlank() ? peticion.notas().trim() : null)
                .turnoId(turno.getId())
                .build());

        int liquidadas = orderRepository.liquidar(branchId, repartidor.getId(), corte.getId());
        if (liquidadas == 0) {
            throw new IllegalStateException(repartidor.getNombre() + " no tiene entregas por liquidar.");
        }

        Object[] t = orderRepository.totalesDelCorte(corte.getId()).get(0);
        BigDecimal cobrado = (BigDecimal) t[1];
        BigDecimal pago = (BigDecimal) t[2];
        BigDecimal esperado = descontado ? cobrado.subtract(pago) : cobrado;

        corte.setEntregas(((Number) t[0]).intValue());
        corte.setCobrado(cobrado);
        corte.setPagoRepartidor(pago);
        corte.setEsperado(esperado);
        corte.setDiferencia(peticion.recibido().subtract(esperado));
        corte = corteRepository.save(corte);

        log.info("Cuadre de {}: {} entregas, esperado ${}, recibido ${}, diferencia ${}",
                repartidor.getNombre(), corte.getEntregas(), esperado, peticion.recibido(), corte.getDiferencia());
        return aDto(corte, repartidor.getNombre());
    }

    @Transactional(readOnly = true)
    public List<CuadreDTOs.Corte> historial(UUID branchId) {
        return corteRepository.findTop50ByBranchIdOrderByCreadoEnDesc(branchId).stream()
                .map(c -> aDto(c, c.getDriver().getNombre()))
                .toList();
    }

    private static CuadreDTOs.Corte aDto(CorteRepartidor c, String repartidor) {
        return new CuadreDTOs.Corte(c.getId(), repartidor, c.getCreadoEn(), c.getEntregas(), c.getCobrado(),
                c.getPagoRepartidor(), c.getPagoDescontado(), c.getEsperado(), c.getRecibido(),
                c.getDiferencia(), c.getNotas());
    }
}
