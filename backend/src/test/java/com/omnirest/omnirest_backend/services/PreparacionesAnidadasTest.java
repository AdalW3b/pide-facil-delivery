package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.PreparacionComponente;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** El chile tatemado es una preparación y va dentro de la salsa. */
class PreparacionesAnidadasTest {

    private Ingredient chileSeco;
    private Ingredient tomatillo;
    private Ingredient chileTatemado;
    private Ingredient salsa;

    @BeforeEach
    void setUp() {
        chileSeco = ingrediente("Chile seco", "kg", "200");
        tomatillo = ingrediente("Tomatillo", "kg", "20");
        // 1 kg de chile seco rinde 0.5 kg de chile tatemado: $400 el kg.
        chileTatemado = preparacion("Chile tatemado", "kg", "0.5");
        lleva(chileTatemado, chileSeco, "1", "kg");
        // 1 kg de tomatillo + 100 g de chile tatemado rinden 2 l de salsa.
        salsa = preparacion("Salsa roja", "l", "2");
        lleva(salsa, tomatillo, "1", "kg");
        lleva(salsa, chileTatemado, "100", "g");
    }

    @Test
    @DisplayName("El costo sigue la receta de la preparación de adentro")
    void costoAnidado() {
        // Tanda: 1 kg × $20 + 0.1 kg × $400 = $60, entre 2 l = $30 el litro.
        assertEquals(0, new BigDecimal("30").compareTo(Costos.deIngrediente(salsa, Costos.GENERALES)));
    }

    @Test
    @DisplayName("Si la de adentro ya tiene costo propio, se usa ese")
    void costoPropioDeLaDeAdentro() {
        Costos.Precios precios = Costos.deSucursal(Map.of(chileTatemado.getId(), new BigDecimal("300")), Map.of());
        // 1 × 20 + 0.1 × 300 = $50, entre 2 = $25.
        assertEquals(0, new BigDecimal("25").compareTo(Costos.deIngrediente(salsa, precios)));
    }

    @Test
    @DisplayName("Una preparación no puede ir dentro de otra que ya la lleva")
    void sinCiclos() {
        // ¿El chile tatemado puede llevar salsa? No: la salsa ya lleva chile tatemado.
        assertTrue(OperacionesInventarioService.lleva(salsa, chileTatemado.getId(), 0));
        assertFalse(OperacionesInventarioService.lleva(chileTatemado, salsa.getId(), 0));
        assertFalse(OperacionesInventarioService.lleva(tomatillo, salsa.getId(), 0), "un ingrediente suelto no lleva nada");
    }

    @Test
    @DisplayName("Lo disponible cuenta lo que se puede preparar de la de adentro")
    void disponibleAnidado() {
        chileTatemado.setPrepararAlVender(true);
        salsa.setPrepararAlVender(true);
        // Hay 10 kg de tomatillo y 0.2 kg de chile seco (= 0.1 kg de tatemado = 1 tanda de salsa = 2 l).
        Map<UUID, BigDecimal> existencias = Map.of(tomatillo.getId(), new BigDecimal("10"),
                chileSeco.getId(), new BigDecimal("0.2"));
        assertEquals(0, new BigDecimal("2").compareTo(Disponible.de(salsa, existencias)));
    }

    private static Ingredient ingrediente(String nombre, String unidad, String costo) {
        return Ingredient.builder().id(UUID.randomUUID()).name(nombre).unitOfMeasure(unidad)
                .costoPromedio(new BigDecimal(costo)).build();
    }

    private static Ingredient preparacion(String nombre, String unidad, String rinde) {
        return Ingredient.builder().id(UUID.randomUUID()).name(nombre).unitOfMeasure(unidad)
                .esPreparado(true).rinde(new BigDecimal(rinde)).build();
    }

    private static void lleva(Ingredient preparacion, Ingredient componente, String cantidad, String unidad) {
        preparacion.getComponentes().add(PreparacionComponente.builder().preparado(preparacion).componente(componente)
                .cantidad(new BigDecimal(cantidad)).unidad(unidad).build());
    }
}
