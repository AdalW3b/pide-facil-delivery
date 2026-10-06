package com.omnirest.omnirest_backend.services.asistente;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/** Peticiones JSON a los proveedores que no tienen SDK aquí (OpenAI, Gemini, compatibles). */
final class HttpJson {

    static final JsonMapper JSON = JsonMapper.builder().build();
    private static final HttpClient CLIENTE = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private HttpJson() {
    }

    /** POST con cuerpo JSON. Un estado de error se convierte en {@link ErrorDeProveedor}. */
    static JsonNode post(String proveedor, String url, Map<String, String> encabezados, Object cuerpo) {
        HttpRequest.Builder peticion = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(90))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(cuerpo)));
        encabezados.forEach(peticion::header);
        HttpResponse<String> respuesta;
        try {
            respuesta = CLIENTE.send(peticion.build(), HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ErrorDeProveedor.sinConexion(proveedor, e);
        } catch (Exception e) {
            throw ErrorDeProveedor.sinConexion(proveedor, e);
        }
        if (respuesta.statusCode() >= 300) {
            throw ErrorDeProveedor.de(proveedor, respuesta.statusCode(), respuesta.body());
        }
        return JSON.readTree(respuesta.body());
    }
}
