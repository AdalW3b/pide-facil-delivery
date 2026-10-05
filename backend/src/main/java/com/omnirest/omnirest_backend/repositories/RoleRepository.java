package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {
    /**
     * Un rol del sistema por su nombre. Los roles de restaurante pueden
     * repetirse entre restaurantes, asi que no se buscan por aqui.
     */
    @Query("SELECT r FROM Role r WHERE r.name = :name AND r.restaurant IS NULL")
    Optional<Role> findByName(@Param("name") String name);

    /** Hay un rol del sistema con ese nombre (sin distinguir mayusculas). */
    @Query("SELECT count(r) > 0 FROM Role r WHERE lower(r.name) = lower(:name) AND r.restaurant IS NULL")
    boolean existeDelSistema(@Param("name") String name);

    /** El restaurante ya tiene un rol con ese nombre, sin contar el que se esta editando. */
    @Query("SELECT count(r) > 0 FROM Role r WHERE lower(r.name) = lower(:name) AND r.restaurant.id = :restaurantId "
            + "AND (:excepto IS NULL OR r.id <> :excepto)")
    boolean existeEnRestaurante(@Param("name") String name, @Param("restaurantId") UUID restaurantId,
                                @Param("excepto") UUID excepto);

    @Query("SELECT r FROM Role r WHERE (r.isCustom = false AND r.restaurant IS NULL) OR r.restaurant.id = :restaurantId")
    List<Role> findByRestaurantIdOrGlobal(@Param("restaurantId") UUID restaurantId);
}
