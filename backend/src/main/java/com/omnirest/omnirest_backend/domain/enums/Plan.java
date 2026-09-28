package com.omnirest.omnirest_backend.domain.enums;

/**
 * Planes comerciales. null = sin limite.
 *
 * Ademas de los limites de tamano, el plan decide que funciones estan
 * disponibles: el delivery solo se ofrece en Pro y Cadena.
 */
public enum Plan {
    INICIAL("Inicial", 1, 5, false),
    PRO("Pro", 5, null, true),
    CADENA("Cadena", null, null, true);

    private final String displayName;
    private final Integer maxBranches;
    private final Integer maxUsers;
    private final boolean deliveryIncluded;

    Plan(String displayName, Integer maxBranches, Integer maxUsers, boolean deliveryIncluded) {
        this.displayName = displayName;
        this.maxBranches = maxBranches;
        this.maxUsers = maxUsers;
        this.deliveryIncluded = deliveryIncluded;
    }

    public String displayName() {
        return displayName;
    }

    public boolean allowsAnotherBranch(long currentBranches) {
        return maxBranches == null || currentBranches < maxBranches;
    }

    public boolean allowsAnotherUser(long currentUsers) {
        return maxUsers == null || currentUsers < maxUsers;
    }

    /** True si el plan incluye pedidos a domicilio. */
    public boolean includesDelivery() {
        return deliveryIncluded;
    }

    public Integer maxBranches() {
        return maxBranches;
    }

    public Integer maxUsers() {
        return maxUsers;
    }
}
