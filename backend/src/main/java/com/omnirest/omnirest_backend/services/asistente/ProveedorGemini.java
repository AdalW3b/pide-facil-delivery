package com.omnirest.omnirest_backend.services.asistente;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Google Gemini por su API generateContent, con declaraciones de funciones. */
final class ProveedorGemini implements ProveedorLlm {

    private static final String URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final String llave;
    private final String modelo;

    ProveedorGemini(String llave, String modelo) {
        this.llave = llave;
        this.modelo = modelo;
    }

    @Override
    public Conversacion iniciar(String instrucciones, String contexto, List<Turno> historial, String pregunta,
                                List<Herramienta> herramientas, int maxTokens) {
        ArrayNode contenidos = HttpJson.JSON.createArrayNode();
        for (Turno t : historial) {
            agregarTexto(contenidos, t.delUsuario() ? "user" : "model", t.texto());
        }
        agregarTexto(contenidos, "user", pregunta);

        ArrayNode declaraciones = HttpJson.JSON.createArrayNode();
        for (Herramienta h : herramientas) {
            ObjectNode d = declaraciones.addObject();
            d.put("name", h.nombre()).put("description", h.descripcion());
            d.set("parameters", HttpJson.JSON.valueToTree(h.parametros()));
        }

        return new Conversacion() {
            @Override
            public Paso siguiente() {
                ObjectNode cuerpo = HttpJson.JSON.createObjectNode();
                cuerpo.putObject("systemInstruction").putArray("parts").addObject()
                        .put("text", instrucciones + "\n\n" + contexto);
                cuerpo.set("contents", contenidos);
                if (!declaraciones.isEmpty()) {
                    cuerpo.putArray("tools").addObject().set("functionDeclarations", declaraciones);
                }
                cuerpo.putObject("generationConfig").put("maxOutputTokens", maxTokens);

                String url = URL + URLEncoder.encode(modelo, StandardCharsets.UTF_8) + ":generateContent";
                JsonNode r = HttpJson.post("Gemini", url, Map.of("x-goog-api-key", llave), cuerpo);
                JsonNode contenido = r.path("candidates").path(0).path("content");
                // La respuesta del modelo vuelve al historial tal cual.
                ObjectNode delModelo = contenido.isObject() ? ((ObjectNode) contenido).deepCopy() : HttpJson.JSON.createObjectNode();
                delModelo.put("role", "model");
                contenidos.add(delModelo);

                StringBuilder texto = new StringBuilder();
                List<Llamada> llamadas = new ArrayList<>();
                for (JsonNode parte : contenido.path("parts")) {
                    if (parte.has("text")) texto.append(parte.path("text").asString(""));
                    if (parte.has("functionCall")) {
                        JsonNode f = parte.path("functionCall");
                        String id = f.has("id") ? f.path("id").asString() : UUID.randomUUID().toString();
                        llamadas.add(new Llamada(id, f.path("name").asString(), HttpJson.JSON.writeValueAsString(f.path("args"))));
                    }
                }
                JsonNode uso = r.path("usageMetadata");
                return new Paso(texto.toString(), llamadas, uso.path("promptTokenCount").asLong(0),
                        uso.path("candidatesTokenCount").asLong(0));
            }

            @Override
            public void responder(List<Resultado> resultados) {
                ObjectNode turno = contenidos.addObject();
                turno.put("role", "user");
                ArrayNode partes = turno.putArray("parts");
                for (Resultado res : resultados) {
                    ObjectNode respuesta = partes.addObject().putObject("functionResponse");
                    respuesta.put("name", res.llamada().nombre());
                    ObjectNode contenido = respuesta.putObject("response");
                    contenido.put(res.esError() ? "error" : "resultado", res.contenido());
                }
            }
        };
    }

    private static void agregarTexto(ArrayNode contenidos, String rol, String texto) {
        ObjectNode turno = contenidos.addObject();
        turno.put("role", rol);
        turno.putArray("parts").addObject().put("text", texto);
    }
}
