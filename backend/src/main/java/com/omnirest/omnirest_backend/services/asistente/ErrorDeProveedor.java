package com.omnirest.omnirest_backend.services.asistente;

/**
 * Un fallo al hablar con el proveedor de IA, con un mensaje que el dueño
 * entiende y sabe resolver (llave equivocada, sin saldo, modelo que no existe).
 * Nunca lleva la llave.
 */
public class ErrorDeProveedor extends IllegalStateException {

    public ErrorDeProveedor(String mensaje) {
        super(mensaje);
    }

    static ErrorDeProveedor de(String proveedor, int status, String detalle) {
        String motivo = switch (status) {
            case 400 -> "rechazó la petición (revisa que el modelo exista y esté escrito bien)";
            case 401, 403 -> "rechazó la llave (revisa que sea correcta y esté activa)";
            case 402 -> "dice que la cuenta no tiene saldo";
            case 404 -> "no encontró el modelo o la dirección (revisa el modelo y la URL)";
            case 429 -> "está limitando las peticiones o la cuenta no tiene saldo; intenta en un momento";
            default -> status >= 500 ? "tuvo una falla de su lado; intenta en un momento" : "respondió con error " + status;
        };
        return new ErrorDeProveedor(proveedor + " " + motivo + ".");
    }

    static ErrorDeProveedor sinConexion(String proveedor, Exception e) {
        return new ErrorDeProveedor("No se pudo conectar con " + proveedor + ". Revisa la conexión o la URL e intenta de nuevo.");
    }
}
