package com.omnirest.omnirest_backend.services.asistente;

import com.omnirest.omnirest_backend.domain.entities.AsistenteConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Arma el proveedor de IA de un restaurante con su llave descifrada. La llave no sale de aquí. */
@Component
@RequiredArgsConstructor
public class FabricaProveedores {

    private final CifradoLlaves cifrado;

    public ProveedorLlm crear(AsistenteConfig c) {
        if (c == null || !c.configurado()) {
            throw new IllegalStateException("El asistente no está configurado.");
        }
        String llave = cifrado.descifrar(c.getLlaveCifrada());
        return switch (c.getProveedor()) {
            case ANTHROPIC -> new ProveedorAnthropic(llave, c.getModelo());
            case OPENAI -> new ProveedorOpenAi("OpenAI", ProveedorOpenAi.URL_OPENAI, llave, c.getModelo());
            case GEMINI -> new ProveedorGemini(llave, c.getModelo());
            // Se vuelve a validar al usarla: el DNS de la dirección pudo cambiar desde que se guardó.
            case COMPATIBLE -> new ProveedorOpenAi("El servicio", UrlSegura.exigir(c.getUrlBase()), llave, c.getModelo());
        };
    }
}
