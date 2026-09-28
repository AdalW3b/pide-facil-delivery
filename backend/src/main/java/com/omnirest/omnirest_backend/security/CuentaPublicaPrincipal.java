package com.omnirest.omnirest_backend.security;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Quien inicia sesion sin ser del personal: un cliente o un repartidor.
 *
 * Va aparte de {@link CustomUserDetails} a proposito. Los empleados viven en la
 * tabla de usuarios, con roles y permisos del negocio; estos son personas de
 * fuera cuyo alcance es su propia ficha y nada mas. Mezclarlos habria obligado
 * a darles un rol del sistema, y con el, puertas que no les tocan.
 */
public record CuentaPublicaPrincipal(
        UUID cuentaId,
        TipoCuenta tipo,
        UUID restaurantId,
        String telefono) {

    public Collection<? extends GrantedAuthority> autoridades() {
        return List.of(new SimpleGrantedAuthority(tipo.autoridad()));
    }

    public boolean esCliente() {
        return tipo == TipoCuenta.CLIENTE;
    }

    public boolean esRepartidor() {
        return tipo == TipoCuenta.REPARTIDOR;
    }
}
