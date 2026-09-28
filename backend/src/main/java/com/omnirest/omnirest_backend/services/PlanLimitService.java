package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.enums.Plan;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Aplica lo que permite el plan del restaurante: cuantas sucursales y usuarios
 * puede tener, y que funciones estan incluidas.
 *
 * Lanza IllegalStateException, que el manejador global convierte en un error
 * con mensaje legible para mostrarlo en pantalla.
 */
@Service
@RequiredArgsConstructor
public class PlanLimitService {

    private final RestaurantRepository restaurantRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;

    /** Plan con el que nace un restaurante nuevo (PLAN_POR_DEFECTO en el .env). */
    @Value("${omnirest.plan-por-defecto:INICIAL}")
    private Plan defaultPlan;

    public Plan defaultPlan() {
        return defaultPlan != null ? defaultPlan : Plan.INICIAL;
    }

    public void checkCanAddBranch(Restaurant restaurant) {
        Plan plan = planOf(restaurant);
        if (!plan.allowsAnotherBranch(branchRepository.countByRestaurantId(restaurant.getId()))) {
            throw new IllegalStateException("Tu plan " + plan.displayName() + " permite " + plan.maxBranches()
                    + (plan.maxBranches() == 1 ? " sucursal" : " sucursales")
                    + ". Mejora tu plan para anadir mas.");
        }
    }

    public void checkCanAddUser(UUID restaurantId) {
        Restaurant restaurant = buscar(restaurantId);
        Plan plan = planOf(restaurant);
        if (!plan.allowsAnotherUser(userRepository.countByRestaurantId(restaurantId))) {
            throw new IllegalStateException("Tu plan " + plan.displayName() + " permite hasta " + plan.maxUsers()
                    + " usuarios. Mejora tu plan para anadir mas.");
        }
    }

    /** Falla si el plan del restaurante no incluye pedidos a domicilio. */
    public void checkDeliveryAvailable(UUID restaurantId) {
        Plan plan = planOf(buscar(restaurantId));
        if (!plan.includesDelivery()) {
            throw new IllegalStateException("El servicio a domicilio no esta incluido en tu plan "
                    + plan.displayName() + ". Esta disponible desde el plan Pro.");
        }
    }

    /** Igual que el anterior, pero partiendo de la sucursal. */
    public void checkDeliveryAvailableForBranch(UUID branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        checkDeliveryAvailable(branch.getRestaurant().getId());
    }

    public boolean hasDelivery(UUID restaurantId) {
        return planOf(buscar(restaurantId)).includesDelivery();
    }

    public Plan planOf(Restaurant restaurant) {
        if (restaurant == null) {
            return Plan.INICIAL;
        }
        // subscription_plan es la fuente de verdad (ver migracion V7). Un valor
        // desconocido se trata como INICIAL: nunca se regalan funciones de pago
        // por culpa de un dato mal escrito.
        String valor = restaurant.getSubscriptionPlan();
        if (valor == null || valor.isBlank()) {
            return Plan.INICIAL;
        }
        try {
            return Plan.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Plan.INICIAL;
        }
    }

    private Restaurant buscar(UUID restaurantId) {
        return restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Restaurante no encontrado."));
    }
}
