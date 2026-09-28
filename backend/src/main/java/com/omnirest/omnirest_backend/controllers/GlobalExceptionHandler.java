package com.omnirest.omnirest_backend.controllers;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    /**
     * Un campo mal llenado en un formulario. Se devuelve el mensaje del campo,
     * no el volcado de Spring: estas pantallas las ve el cliente final, y
     * "Validation failed for argument [1] in public org.springframework..." no
     * le dice a nadie que su contrasena era corta.
     */
    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidacion(
            org.springframework.web.bind.MethodArgumentNotValidException ex) {
        String mensaje = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse("Revisa los datos del formulario.");

        return ResponseEntity.badRequest().body(Map.of("error", mensaje, "message", mensaje));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(409).body(Map.of("error", ex.getMessage()));
    }

    /**
     * Falta de permiso. Antes caia en el manejador general y salia como 500,
     * asi que un cliente no podia distinguir "no tienes acceso" de "el servidor
     * se rompio": con el primero hay que pedirle que inicie sesion, con el
     * segundo no.
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccesoDenegado(
            org.springframework.security.access.AccessDeniedException ex) {
        String mensaje = ex.getMessage() != null && !ex.getMessage().isBlank()
                ? ex.getMessage()
                : "No tienes acceso a esto.";
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", mensaje, "message", mensaje));
    }

    /** Sin sesion donde hace falta una. */
    @ExceptionHandler(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleSinSesion(
            org.springframework.security.authentication.AuthenticationCredentialsNotFoundException ex) {
        String mensaje = "Inicia sesión para continuar.";
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", mensaje, "message", mensaje));
    }

    /**
     * Credenciales malas en cualquier punto que autentique. Antes salia 500 con
     * "Bad credentials" en ingles: el personal que escribia mal su contrasena
     * veia un error del servidor.
     */
    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAutenticacion(
            org.springframework.security.core.AuthenticationException ex) {
        String mensaje = "Usuario o contraseña incorrectos.";
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", mensaje, "message", mensaje));
    }

    /** Un cuerpo que no se puede leer (JSON roto, tipo equivocado) es culpa de la peticion, no del servidor. */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleCuerpoIlegible(
            org.springframework.http.converter.HttpMessageNotReadableException ex) {
        String mensaje = "Los datos enviados no tienen un formato válido.";
        return ResponseEntity.badRequest().body(Map.of("error", mensaje, "message", mensaje));
    }

    /** Una ruta que no existe es un 404, no un fallo del servidor. */
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleRutaInexistente(
            org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        String mensaje = "No encontramos lo que buscas.";
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", mensaje, "message", mensaje));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(Map.of(
            "error", "No se puede eliminar el registro porque ya tiene historial de ventas u operaciones vinculadas. Por favor, desactivelo (marquelo como inactivo) en su lugar."
        ));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        String msg = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
            "error", msg,
            "message", msg
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        log.error("Error inesperado en el servidor: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
            "error", ex.getMessage() != null ? ex.getMessage() : "Error interno del servidor"
        ));
    }
}
