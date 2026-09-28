---
trigger: always_on
---

# Backend Rules (Spring Boot)
1. STACK: Java 21+, Spring Boot 3.x, Hibernate/JPA, PostgreSQL.
2. ENTIDADES: Usa UUID para IDs (`@GeneratedValue(strategy = GenerationType.UUID)`). Usa Lombok (`@Data`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`) para eliminar getters/setters.
3. DTOS: Usa EXCLUSIVAMENTE `record` de Java para DTOs (ej. `public record OrderRequestDTO(...)`).
4. MULTITENANCY: NUNCA hagas una consulta global. Los Repositorios DEBEN filtrar siempre por `restaurantId` y/o `branchId`.
5. SEGURIDAD: Los controladores deben estar protegidos con `@PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF')")` según aplique.
6. CÓDIGO LIMPIO: No generes comentarios obvios. Minimiza las líneas de código. Retorna `ResponseEntity` limpio.
7. OmniRest usa permisos crudos (ej. 'TABLES_READ'). NUNCA uses roles con prefijo 'ROLE_', usa siempre hasAuthority()
8. Cada endpoint expuesto en los controladores debe invocar estrictamente securityValidationService.validateUserAccessToBranch(branchId) en su primera línea.