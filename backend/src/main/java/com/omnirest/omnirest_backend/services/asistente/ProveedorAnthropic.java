package com.omnirest.omnirest_backend.services.asistente;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.core.ObjectMappers;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.MessageParam;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.Tool;
import com.anthropic.models.messages.ToolResultBlockParam;
import com.anthropic.models.messages.ToolUseBlock;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Claude, por el SDK oficial de Anthropic. Las instrucciones fijas y las
 * herramientas van en caché: son iguales para todos los restaurantes y se
 * cobran a una fracción en cada pregunta.
 */
final class ProveedorAnthropic implements ProveedorLlm {

    private final AnthropicClient cliente;
    private final String modelo;

    ProveedorAnthropic(String llave, String modelo) {
        this.cliente = AnthropicOkHttpClient.builder()
                .apiKey(llave)
                .timeout(Duration.ofSeconds(90))
                .build();
        this.modelo = modelo;
    }

    @Override
    public Conversacion iniciar(String instrucciones, String contexto, List<Turno> historial, String pregunta,
                                List<Herramienta> herramientas, int maxTokens) {
        List<MessageParam> mensajes = new ArrayList<>();
        for (Turno t : historial) {
            mensajes.add(MessageParam.builder()
                    .role(t.delUsuario() ? MessageParam.Role.USER : MessageParam.Role.ASSISTANT)
                    .content(t.texto())
                    .build());
        }
        mensajes.add(MessageParam.builder().role(MessageParam.Role.USER).content(pregunta).build());

        List<Tool> tools = herramientas.stream().map(ProveedorAnthropic::aTool).toList();
        // Lo fijo primero y en caché; lo del restaurante después, fuera del prefijo cacheado.
        List<TextBlockParam> sistema = List.of(
                TextBlockParam.builder().text(instrucciones)
                        .cacheControl(CacheControlEphemeral.builder().build()).build(),
                TextBlockParam.builder().text(contexto).build());

        return new Conversacion() {
            private Message ultimo;

            @Override
            public Paso siguiente() {
                MessageCreateParams.Builder params = MessageCreateParams.builder()
                        .model(modelo)
                        .maxTokens(maxTokens)
                        .systemOfTextBlockParams(sistema)
                        .messages(mensajes);
                tools.forEach(params::addTool);
                try {
                    ultimo = cliente.messages().create(params.build());
                } catch (AnthropicServiceException e) {
                    throw ErrorDeProveedor.de("Claude", e.statusCode(), e.getMessage());
                } catch (RuntimeException e) {
                    throw ErrorDeProveedor.sinConexion("Claude", e);
                }
                // La respuesta completa vuelve al historial tal cual (incluye el razonamiento).
                mensajes.add(ultimo.toParam());

                StringBuilder texto = new StringBuilder();
                List<Llamada> llamadas = new ArrayList<>();
                for (ContentBlock bloque : ultimo.content()) {
                    bloque.text().ifPresent(t -> texto.append(t.text()));
                    bloque.toolUse().ifPresent(u -> llamadas.add(aLlamada(u)));
                }
                boolean pide = ultimo.stopReason().map(StopReason.TOOL_USE::equals).orElse(false);
                if (ultimo.stopReason().map(StopReason.REFUSAL::equals).orElse(false)) {
                    return new Paso("El modelo no quiso responder esa pregunta. Intenta preguntarlo de otra forma.",
                            List.of(), ultimo.usage().inputTokens(), ultimo.usage().outputTokens());
                }
                return new Paso(texto.toString(), pide ? llamadas : List.of(),
                        ultimo.usage().inputTokens(), ultimo.usage().outputTokens());
            }

            @Override
            public void responder(List<Resultado> resultados) {
                // Todos los resultados van juntos en un solo mensaje del usuario.
                List<ContentBlockParam> bloques = resultados.stream()
                        .map(r -> ContentBlockParam.ofToolResult(ToolResultBlockParam.builder()
                                .toolUseId(r.llamada().id())
                                .content(r.contenido())
                                .isError(r.esError())
                                .build()))
                        .toList();
                mensajes.add(MessageParam.builder().role(MessageParam.Role.USER).contentOfBlockParams(bloques).build());
            }
        };
    }

    private static Tool aTool(Herramienta h) {
        Tool.InputSchema.Properties.Builder props = Tool.InputSchema.Properties.builder();
        @SuppressWarnings("unchecked")
        Map<String, Object> propiedades = (Map<String, Object>) h.parametros().getOrDefault("properties", Map.of());
        propiedades.forEach((k, v) -> props.putAdditionalProperty(k, JsonValue.from(v)));
        @SuppressWarnings("unchecked")
        List<String> requeridos = (List<String>) h.parametros().getOrDefault("required", List.of());
        return Tool.builder()
                .name(h.nombre())
                .description(h.descripcion())
                .inputSchema(Tool.InputSchema.builder().properties(props.build()).required(requeridos).build())
                .build();
    }

    private static Llamada aLlamada(ToolUseBlock u) {
        try {
            return new Llamada(u.id(), u.name(), ObjectMappers.jsonMapper().writeValueAsString(u._input()));
        } catch (Exception e) {
            return new Llamada(u.id(), u.name(), "{}");
        }
    }
}
