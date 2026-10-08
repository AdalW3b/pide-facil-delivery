package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Gasto;
import com.omnirest.omnirest_backend.domain.entities.GastoFijo;
import com.omnirest.omnirest_backend.dtos.GastosDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.GastoFijoRepository;
import com.omnirest.omnirest_backend.repositories.GastoRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Gastos que no son compras de mercancia: renta, luz, agua, gas, nomina…
 * Cuentan como egreso en "Ingresos y egresos". Los que se repiten cada mes
 * quedan como gastos fijos y la pantalla avisa cuales faltan por pagar.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GastosService {

    static final Set<String> CATEGORIAS = Set.of("RENTA", "LUZ", "AGUA", "GAS", "NOMINA", "INTERNET", "MANTENIMIENTO", "IMPUESTOS", "OTRO");
    private static final Set<String> FORMAS_PAGO = Set.of("CAJA", "TRANSFERENCIA", "TARJETA");

    private final BranchRepository branchRepository;
    private final GastoRepository gastoRepository;
    private final GastoFijoRepository fijoRepository;
    private final CajaService cajaService;

    /** Los gastos fijos del mes (pagados o no) y todo lo que se gasto. */
    @Transactional(readOnly = true)
    public GastosDTOs.Mes mes(UUID branchId, String mes) {
        sucursal(branchId);
        YearMonth ym = mes(mes);
        LocalDate desde = ym.atDay(1);
        LocalDate hasta = ym.plusMonths(1).atDay(1);
        List<Gasto> gastos = gastoRepository.findByBranchIdAndFechaGreaterThanEqualAndFechaLessThanOrderByFechaDescCreadoEnDesc(branchId, desde, hasta);

        // El pago vigente de cada gasto fijo en el mes.
        Map<UUID, Gasto> pagos = new HashMap<>();
        for (Gasto g : gastos) {
            if (g.getGastoFijoId() != null && g.getAnuladoEn() == null) pagos.putIfAbsent(g.getGastoFijoId(), g);
        }
        List<GastosDTOs.GastoFijo> fijos = new ArrayList<>();
        BigDecimal pendiente = BigDecimal.ZERO;
        for (GastoFijo f : fijoRepository.findByBranchIdOrderByDiaDelMesAscConceptoAsc(branchId)) {
            Gasto pago = pagos.get(f.getId());
            // Uno desactivado solo se ve si se pago ese mes.
            if (!Boolean.TRUE.equals(f.getActivo()) && pago == null) continue;
            if (pago == null) pendiente = pendiente.add(f.getMonto());
            fijos.add(new GastosDTOs.GastoFijo(f.getId(), f.getCategoria(), f.getConcepto(), f.getMonto(), f.getDiaDelMes(),
                    Boolean.TRUE.equals(f.getActivo()), vence(ym, f.getDiaDelMes()), pago != null ? aDto(pago) : null));
        }
        BigDecimal total = gastos.stream().filter(g -> g.getAnuladoEn() == null).map(Gasto::getMonto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GastosDTOs.Mes(ym.toString(), fijos, gastos.stream().map(GastosService::aDto).toList(),
                dinero(total), dinero(pendiente));
    }

    @Transactional
    public GastosDTOs.Resultado registrar(UUID branchId, GastosDTOs.NuevoGasto datos) {
        sucursal(branchId);
        String categoria = categoria(datos.categoria());
        String forma = datos.formaPago().trim().toUpperCase();
        if (!FORMAS_PAGO.contains(forma)) {
            throw new IllegalArgumentException("Se paga con efectivo de caja, transferencia o tarjeta.");
        }
        LocalDate hoy = Combos.hoy();
        LocalDate fecha = datos.fecha() != null ? datos.fecha() : hoy;
        if (fecha.isAfter(hoy)) throw new IllegalArgumentException("La fecha del gasto no puede ser futura.");

        if (datos.gastoFijoId() != null) {
            GastoFijo f = fijo(branchId, datos.gastoFijoId());
            YearMonth ym = YearMonth.from(fecha);
            if (gastoRepository.existsByGastoFijoIdAndAnuladoEnIsNullAndFechaGreaterThanEqualAndFechaLessThan(
                    f.getId(), ym.atDay(1), ym.plusMonths(1).atDay(1))) {
                throw new IllegalStateException(f.getConcepto() + " ya se pagó ese mes.");
            }
        }

        BigDecimal monto = dinero(datos.monto());
        String concepto = datos.concepto().trim();
        Gasto g = Gasto.builder()
                .branchId(branchId)
                .categoria(categoria)
                .concepto(concepto)
                .monto(monto)
                .fecha(fecha)
                .formaPago(forma)
                .nota(limpiar(datos.nota()))
                .gastoFijoId(datos.gastoFijoId())
                .usuario(quien())
                .build();
        // El efectivo sale de la caja abierta; sin caja abierta no se registra nada.
        if ("CAJA".equals(forma)) {
            g.setMovimientoCajaId(cajaService.salidaPorGasto(branchId, monto, "Gasto · " + concepto, quien()));
        }
        gastoRepository.save(g);
        return new GastosDTOs.Resultado("Gasto registrado: " + concepto + " por " + pesos(monto)
                + ("CAJA".equals(forma) ? ". Salió de la caja." : "."));
    }

    /** Un gasto mal capturado se anula; si fue en efectivo, el dinero regresa a la caja abierta. */
    @Transactional
    public GastosDTOs.Resultado anular(UUID branchId, UUID id) {
        Gasto g = gastoRepository.findById(id)
                .filter(x -> x.getBranchId().equals(branchId))
                .orElseThrow(() -> new IllegalArgumentException("Ese gasto no es de esta sucursal."));
        if (g.getAnuladoEn() != null) throw new IllegalStateException("Este gasto ya estaba anulado.");
        boolean efectivo = g.getMovimientoCajaId() != null;
        if (efectivo) {
            cajaService.entradaPorGastoAnulado(branchId, g.getMonto(), "Gasto anulado · " + g.getConcepto(), quien());
        }
        g.setAnuladoEn(LocalDateTime.now());
        g.setAnuladoPor(quien());
        gastoRepository.save(g);
        log.info("Gasto {} anulado por {}", id, g.getAnuladoPor());
        return new GastosDTOs.Resultado("Gasto anulado" + (efectivo ? ": el efectivo regresó a la caja." : "."));
    }

    // ------------------------------------------------------------------ gastos fijos

    @Transactional
    public GastosDTOs.Resultado guardarFijo(UUID branchId, UUID id, GastosDTOs.GuardarGastoFijo datos) {
        sucursal(branchId);
        GastoFijo f = id != null ? fijo(branchId, id) : GastoFijo.builder().branchId(branchId).build();
        f.setCategoria(categoria(datos.categoria()));
        f.setConcepto(datos.concepto().trim());
        f.setMonto(dinero(datos.monto()));
        f.setDiaDelMes(datos.diaDelMes());
        f.setActivo(true);
        fijoRepository.save(f);
        return new GastosDTOs.Resultado(id != null ? "Gasto fijo actualizado." : "Gasto fijo agregado: " + f.getConcepto() + ".");
    }

    /** Deja de pedirse cada mes; lo ya pagado se queda. */
    @Transactional
    public GastosDTOs.Resultado quitarFijo(UUID branchId, UUID id) {
        GastoFijo f = fijo(branchId, id);
        f.setActivo(false);
        fijoRepository.save(f);
        return new GastosDTOs.Resultado(f.getConcepto() + " ya no se pedirá cada mes.");
    }

    // ------------------------------------------------------------------

    /** El dia de pago en ese mes; si el mes es mas corto, el ultimo dia. */
    static LocalDate vence(YearMonth ym, int dia) {
        return ym.atDay(Math.min(dia, ym.lengthOfMonth()));
    }

    private static YearMonth mes(String mes) {
        if (mes == null || mes.isBlank()) return YearMonth.from(Combos.hoy());
        try {
            return YearMonth.parse(mes.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("El mes va como 2026-10.");
        }
    }

    private static String categoria(String c) {
        String x = c == null ? "" : c.trim().toUpperCase();
        if (!CATEGORIAS.contains(x)) throw new IllegalArgumentException("Esa categoría no existe.");
        return x;
    }

    private GastoFijo fijo(UUID branchId, UUID id) {
        return fijoRepository.findById(id)
                .filter(x -> x.getBranchId().equals(branchId))
                .orElseThrow(() -> new IllegalArgumentException("Ese gasto fijo no es de esta sucursal."));
    }

    private void sucursal(UUID branchId) {
        if (!branchRepository.existsById(branchId)) throw new IllegalArgumentException("Sucursal no encontrada.");
    }

    private static GastosDTOs.Gasto aDto(Gasto g) {
        return new GastosDTOs.Gasto(g.getId(), g.getCategoria(), g.getConcepto(), g.getMonto(), g.getFecha(), g.getFormaPago(),
                g.getNota(), g.getGastoFijoId(), g.getUsuario(), g.getCreadoEn(), g.getAnuladoEn() != null, g.getAnuladoPor());
    }

    private static String quien() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CustomUserDetails u ? u.getUsername() : null;
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static BigDecimal dinero(BigDecimal n) {
        return (n != null ? n : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static String pesos(BigDecimal n) {
        return "$" + n.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
