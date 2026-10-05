package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Permission;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Quien puede crear, editar y asignar que roles. Sin base de datos: las
 * mismas reglas valen al armar un rol y al darselo a un empleado.
 *
 * La idea de fondo: nadie da mas de lo que tiene. El operador de la
 * plataforma (SYSTEM_ADMIN) puede todo; el dueño (SUPER_ADMIN) todo lo de su
 * restaurante; los demas, solo permisos que ya tienen. Lo de la plataforma
 * nunca entra en un rol de restaurante.
 */
final class ReglasDeRoles {

    /** Permisos de la plataforma o de nivel dueño: nunca van en un rol de restaurante. */
    static final Set<String> PERMISOS_RESERVADOS =
            Set.of("MANAGE_RESTAURANTS", "SYSTEM_ADMIN", "SUPER_ADMIN", "BRANCH_MANAGER");

    /**
     * Nombres que no puede llevar un rol de restaurante: son los del sistema, y
     * el codigo los compara sin distinguir mayusculas ("super_admin" pasaria
     * por dueño).
     */
    static final Set<String> NOMBRES_RESERVADOS =
            Set.of("SYSTEM_ADMIN", "SUPER_ADMIN", "BRANCH_MANAGER", "ADMIN", "MESERO", "COCINA");

    /** Pantallas del panel a las que puede mandar un rol al entrar. */
    static final List<String> RUTAS = List.of(
            "/dashboard", "/kitchen", "/delivery", "/caja", "/sales-history", "/analytics",
            "/catalog", "/inventario", "/settings", "/settings/sucursales", "/settings/whatsapp",
            "/admin/employees", "/admin/roles");

    private ReglasDeRoles() {
    }

    /** El operador de la plataforma. */
    static boolean esOperador(CustomUserDetails u) {
        return u != null && "SYSTEM_ADMIN".equalsIgnoreCase(u.roleName());
    }

    /** El dueño del restaurante. */
    static boolean esDueno(CustomUserDetails u) {
        return u != null && "SUPER_ADMIN".equalsIgnoreCase(u.roleName());
    }

    static Set<String> permisosDe(CustomUserDetails u) {
        if (u == null || u.authorities() == null) return Set.of();
        return u.authorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
    }

    /** Un permiso que solo el operador puede ver y dar. */
    static boolean esReservado(String permiso) {
        return permiso != null && PERMISOS_RESERVADOS.contains(permiso.toUpperCase(Locale.ROOT));
    }

    /** Lo que puede llevar un rol que arma este usuario. */
    static void exigirPuedeOtorgar(CustomUserDetails quien, Collection<String> permisos) {
        if (esOperador(quien)) return;
        Set<String> propios = permisosDe(quien);
        for (String p : permisos) {
            if (esReservado(p)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "El permiso " + p + " es de la plataforma y no puede ir en un rol de tu restaurante.");
            }
            if (!esDueno(quien) && !propios.contains(p)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No puedes dar el permiso " + p + ": tú no lo tienes.");
            }
        }
    }

    /** El nombre de un rol de restaurante. No puede ser el de un rol del sistema ni el de un permiso. */
    static String exigirNombreValido(String nombre, Collection<String> nombresDePermisos) {
        String limpio = nombre == null ? "" : nombre.trim().replaceAll("\\s+", " ");
        if (limpio.isEmpty() || limpio.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe un nombre de hasta 100 letras.");
        }
        String mayusculas = limpio.toUpperCase(Locale.ROOT);
        boolean esPermiso = nombresDePermisos.stream().anyMatch(p -> p.equalsIgnoreCase(limpio));
        if (NOMBRES_RESERVADOS.contains(mayusculas) || esPermiso) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "\"" + limpio + "\" es un nombre reservado del sistema. Elige otro, por ejemplo \"Cajero\".");
        }
        return limpio;
    }

    /** La pantalla a la que manda el rol al entrar; por omision, Mesas. */
    static String exigirRuta(String ruta) {
        if (ruta == null || ruta.isBlank()) return "/dashboard";
        String limpia = ruta.trim();
        if (!RUTAS.contains(limpia)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La pantalla de inicio " + limpia + " no existe.");
        }
        return limpia;
    }

    /**
     * Si este usuario puede darle este rol a un empleado del restaurante
     * indicado. Bloquea los roles de otro restaurante, los de plataforma y los
     * que tienen mas permisos que quien los asigna.
     */
    static void exigirPuedeAsignar(CustomUserDetails quien, Role rol, UUID restauranteDelEmpleado) {
        if (esOperador(quien)) return;
        String nombre = rol.getName() != null ? rol.getName() : "";
        boolean delSistema = rol.getRestaurant() == null;

        if (delSistema && "SYSTEM_ADMIN".equalsIgnoreCase(nombre)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Ese rol es del operador de la plataforma y no se puede asignar.");
        }
        if (!delSistema && !rol.getRestaurant().getId().equals(restauranteDelEmpleado)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ese rol es de otro restaurante.");
        }
        if (esDueno(quien)) return;

        if (delSistema && "SUPER_ADMIN".equalsIgnoreCase(nombre)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tienes permisos para asignar el rol de SUPER_ADMIN.");
        }
        Set<String> propios = permisosDe(quien);
        List<Permission> delRol = rol.getPermissions() != null ? rol.getPermissions() : List.of();
        for (Permission p : delRol) {
            if (!propios.contains(p.getName())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No puedes asignar el rol " + nombre + ": tiene permisos que tú no tienes (" + p.getName() + ").");
            }
        }
    }
}
