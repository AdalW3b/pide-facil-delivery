package com.omnirest.omnirest_backend.services.asistente;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * OpenAI y todo servicio compatible con su API de chat (DeepSeek, Mistral,
 * Groq, OpenRouter...): misma forma de mensajes y de herramientas, solo
 * cambia la dirección base.
 */
final class ProveedorOpenAi implements ProveedorLlm {

    static final String URL_OPENAI = "https://api.openai.com/v1";

    private final String nombre;
    private final String urlBase;
    private final String llave;
    private final String modelo;
    /** OpenAI pide max_completion_tokens; los compatibles suelen entender solo max_tokens. */
    private final String campoMaxTokens;

    ProveedorOpenAi(String nombre, String urlBase, String llave, String modelo) {
        this.nombre = nombre;
        this.campoMaxTokens = urlBase.startsWith(URL_OPENAI) ? "max_completion_tokens" : "max_tokens";
        this.urlBase = urlBase.replaceAll("/+$", "");
        this.llave = llave;
        this.modelo = modelo;
    }

    @Override
    public Conversacion iniciar(String instrucciones, String contexto, List<Turno> historial, String pregunta,
                                List<Herramienta> herramientas, int maxTokens) {
        ArrayNode mensajes = HttpJson.JSON.createArrayNode();
        mensajes.addObject().put("role", "system").put("content", instrucciones + "\n\n" + contexto);
        for (Turno t : historial) {
            mensajes.addObject().put("role", t.delUsuario() ? "user" : "assistant").put("content", t.texto());
        }
        mensajes.addObject().put("role", "user").put("content", pregunta);

        ArrayNode tools = HttpJson.JSON.createArrayNode();
        for (Herramienta h : herramientas) {
            ObjectNode funcion = tools.addObject().put("type", "function").putObject("function");
            funcion.put("name", h.nombre()).put("description", h.descripcion());
            funcion.set("parameters", HttpJson.JSON.valueToTree(h.parametros()));
        }

        return new Conversacion() {
            @Override
            public Paso siguiente() {
                ObjectNode cuerpo = HttpJson.JSON.createObjectNode();
                cuerpo.put("model", modelo);
                cuerpo.set("messages", mensajes);
                if (!tools.isEmpty()) cuerpo.set("tools", tools);
                cuerpo.put(campoMaxTokens, maxTokens);

                JsonNode r = HttpJson.post(nombre, urlBase + "/chat/completions",
                        Map.of("Authorization", "Bearer " + llave), cuerpo);
                JsonNode mensaje = r.path("choices").path(0).path("message");
                // El mensaje del asistente vuelve al historial tal cual, con sus tool_calls.
                mensajes.add(mensaje.deepCopy());

                List<Llamada> llamadas = new ArrayList<>();
                for (JsonNode c : mensaje.path("tool_calls")) {
                    llamadas.add(new Llamada(c.path("id").asString(), c.path("function").path("name").asString(),
                            c.path("function").path("arguments").asString("{}")));
                }
                String texto = mensaje.path("content").isNull() ? "" : mensaje.path("content").asString("");
                JsonNode uso = r.path("usage");
                return new Paso(texto, llamadas, uso.path("prompt_tokens").asLong(0), uso.path("completion_tokens").asLong(0));
            }

            @Override
            public void responder(List<Resultado> resultados) {
                for (Resultado res : resultados) {
                    mensajes.addObject()
                            .put("role", "tool")
                            .put("tool_call_id", res.llamada().id())
                            .put("content", res.contenido());
                }
            }
        };
    }
}
