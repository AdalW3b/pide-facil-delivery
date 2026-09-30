package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Cada sucursal tiene su propio numero de WhatsApp. El numero es lo que le
 * dice al sistema de que sucursal habla el cliente: "abre la mesa 1" llega
 * por el numero de una sucursal y esa es la mesa que se abre. Si dos
 * sucursales compartieran numero, los pedidos se mezclarian.
 */
@Service
@RequiredArgsConstructor
public class NumerosDeSucursal {

    private final BranchRepository branchRepository;

    /**
     * Rechaza el numero si ya es de otra sucursal. Compara el numero
     * normalizado: "+52 55 1234 5678" y "5215512345678" son el mismo.
     *
     * @param propia la sucursal que se esta guardando (null si es nueva)
     */
    public void validarUnico(String numero, UUID propia) {
        duenoDe(numero, propia).ifPresent(otra -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ese número de WhatsApp ya es de la sucursal " + descripcion(otra)
                            + ". Cada sucursal necesita su propio número.");
        });
    }

    /** La otra sucursal que ya tiene este numero, si hay una. */
    public Optional<Branch> duenoDe(String numero, UUID excluir) {
        String buscado = normalizado(numero);
        if (buscado == null) return Optional.empty();
        return branchRepository.findAll().stream()
                .filter(b -> !Objects.equals(b.getId(), excluir))
                .filter(b -> buscado.equals(normalizado(b.getWhatsappNumber())))
                .findFirst();
    }

    /** Como se guarda: "+52" y los diez digitos. Null si no hay numero. */
    public static String paraGuardar(String numero) {
        String n = normalizado(numero);
        return n == null ? null : "+" + n;
    }

    public static String descripcion(Branch sucursal) {
        String restaurante = sucursal.getRestaurant() != null ? sucursal.getRestaurant().getName() : null;
        return restaurante == null ? sucursal.getName() : sucursal.getName() + " (" + restaurante + ")";
    }

    private static String normalizado(String numero) {
        if (numero == null || numero.isBlank()) return null;
        String n = TelefonoMx.canonico(numero);
        return n == null || n.isBlank() ? null : n;
    }
}
